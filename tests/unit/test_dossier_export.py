"""
Unit Tests for Case 5: One-Click Judicial Court Dossier (.ZIP Export).

Verifies:
1. Dossier ZIP generation with all 5 artifacts.
2. SHA-256 manifest integrity file.
3. Section 65B Evidence Certificate structure.
4. Transaction Ledger CSV format.
5. Investigative Narrative content.
6. ZIP structure with correct filenames.
7. Empty/minimal input handling.
"""

import io
import json
import zipfile
import hashlib
import pytest

from backend.app.services.reporting.dossier_service import DossierService, dossier_service


@pytest.fixture
def sample_attributions():
    return [
        {
            "vasp_name": "Binance",
            "score": 92.5,
            "evidence_strength": "HIGH",
            "rank": 1,
            "summary": "Direct deposit to Binance hot wallet 0x28C6...",
        },
        {
            "vasp_name": "WazirX",
            "score": 78.0,
            "evidence_strength": "MEDIUM",
            "rank": 2,
            "summary": "Secondary path through WazirX deposit cluster",
        },
    ]


@pytest.fixture
def sample_transactions():
    return [
        {
            "tx_hash": "0xabc123def456",
            "from_address": "0xsuspect",
            "to_address": "0xintermediary",
            "amount": 10.5,
            "token_symbol": "ETH",
            "amount_usd": 26250.0,
            "amount_inr": 2187562.5,
            "timestamp": "2025-06-15T10:00:00Z",
            "hop": 1,
            "chain": "ethereum",
        },
        {
            "tx_hash": "0x789ghi012jkl",
            "from_address": "0xintermediary",
            "to_address": "0x28C6c06298d514Db089934071355E5743bf21d60",
            "amount": 10.0,
            "token_symbol": "ETH",
            "amount_usd": 25000.0,
            "amount_inr": 2083750.0,
            "timestamp": "2025-06-15T12:00:00Z",
            "hop": 2,
            "chain": "ethereum",
        },
    ]


@pytest.fixture
def sample_risk():
    return {
        "risk_level": "HIGH",
        "score": 78.5,
        "indicators": [
            "Rapid fund movement within 24 hours",
            "Interaction with OFAC-sanctioned entity",
            "Peel chain pattern detected",
        ],
        "explanation": "Funds rapidly layered through intermediary wallets.",
    }


def test_dossier_zip_generation(sample_attributions, sample_transactions, sample_risk):
    """Verify dossier ZIP is generated with all expected files."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-CASE-001",
        wallet_address="0xsuspect_wallet_address",
        chain="ethereum",
        attributions=sample_attributions,
        transactions=sample_transactions,
        risk_assessment=sample_risk,
    )

    assert isinstance(zip_bytes, bytes)
    assert len(zip_bytes) > 0

    # Open and inspect ZIP
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        assert "00_MANIFEST_INTEGRITY.json" in names
        assert "01_CrPC_Section_91_Seizure_Notice.json" in names
        assert "01_CrPC_Section_91_Seizure_Notice.pdf" in names
        assert "02_Section_65B_Evidence_Certificate.json" in names
        assert "02_Section_65B_Evidence_Certificate.pdf" in names
        assert "03_Forensic_Graph_Topography.png" in names
        assert "03_Forensic_Graph_Topography.svg" in names
        assert "04_Transaction_Ledger_Audit.csv" in names
        assert "05_Case_Diary_Investigative_Narrative.txt" in names
        assert "README.txt" in names

        # Verify court-ready statutory PDF content
        sec91_pdf = zf.read("01_CrPC_Section_91_Seizure_Notice.pdf")
        assert sec91_pdf.startswith(b"%PDF-")
        assert len(sec91_pdf) > 2000

        sec65b_pdf = zf.read("02_Section_65B_Evidence_Certificate.pdf")
        assert sec65b_pdf.startswith(b"%PDF-")
        assert len(sec65b_pdf) > 2000

        # Verify vector SVG
        svg_content = zf.read("03_Forensic_Graph_Topography.svg").decode("utf-8")
        assert "<svg" in svg_content and "</svg>" in svg_content
        assert "SUSPECT TARGET WALLET" in svg_content
        assert "DESTINATION VASP" in svg_content

        # Verify court submission guide
        readme_content = zf.read("README.txt").decode("utf-8")
        assert "JUDICIAL EVIDENCE DOSSIER" in readme_content


def test_manifest_integrity(sample_attributions, sample_transactions, sample_risk):
    """Verify SHA-256 manifest contains correct checksums for all artifacts."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-INTEGRITY",
        wallet_address="0xtest",
        chain="ethereum",
        attributions=sample_attributions,
        transactions=sample_transactions,
        risk_assessment=sample_risk,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        manifest_data = json.loads(zf.read("00_MANIFEST_INTEGRITY.json"))
        checksums = manifest_data["artifact_checksums"]

        assert manifest_data["case_id"] == "TEST-INTEGRITY"
        assert manifest_data["total_artifacts"] >= 4

        # Verify each checksum matches actual file content
        for filename, expected_hash in checksums.items():
            if filename in zf.namelist():
                actual_content = zf.read(filename)
                actual_hash = hashlib.sha256(actual_content).hexdigest()
                assert actual_hash == expected_hash, f"Hash mismatch for {filename}"


def test_section_65b_certificate_structure(sample_attributions, sample_transactions):
    """Verify Section 65B certificate has required legal sections."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-65B",
        wallet_address="0xtest_65b",
        chain="ethereum",
        attributions=sample_attributions,
        transactions=sample_transactions,
        investigator_name="Inspector Sharma",
        investigating_unit="Cyber Crime PS, Mumbai",
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        cert = json.loads(zf.read("02_Section_65B_Evidence_Certificate.json"))

        assert "SECTION 65B" in cert["certificate_title"]
        assert cert["case_reference"] == "TEST-65B"

        # Section A: Computer system description
        assert cert["section_a_computer_system"]["operating_properly"] is True

        # Section B: Electronic record details
        assert cert["section_b_electronic_record"]["wallet_address_analyzed"] == "0xtest_65b"
        assert cert["section_b_electronic_record"]["total_transactions_processed"] == 2
        assert cert["section_b_electronic_record"]["top_attributed_vasp"] == "Binance"

        # Section D: Certification
        assert "Inspector Sharma" in cert["section_d_certification"]["certified_by"]
        assert "Section 65B(4)" in cert["section_d_certification"]["statement"]


def test_transaction_ledger_csv(sample_transactions):
    """Verify transaction ledger CSV has correct format and data."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-CSV",
        wallet_address="0xtest_csv",
        chain="ethereum",
        transactions=sample_transactions,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        csv_content = zf.read("04_Transaction_Ledger_Audit.csv").decode("utf-8")
        lines = csv_content.strip().split("\n")

        # Header row
        assert "Hop" in lines[0]
        assert "TX Hash" in lines[0]
        assert "Amount USD" in lines[0]
        assert "Amount INR" in lines[0]

        # Data rows
        assert len(lines) == 3  # 1 header + 2 transactions


def test_investigative_narrative(sample_attributions, sample_risk):
    """Verify narrative contains case details and attributions."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-NARRATIVE",
        wallet_address="0xnarrative_test",
        chain="ethereum",
        attributions=sample_attributions,
        risk_assessment=sample_risk,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        narrative = zf.read("05_Case_Diary_Investigative_Narrative.txt").decode("utf-8")

        assert "TEST-NARRATIVE" in narrative
        assert "0xnarrative_test" in narrative
        assert "Binance" in narrative
        assert "INVESTIGATION SUMMARY" in narrative
        assert "HIGH" in narrative


def test_empty_input_dossier():
    """Verify dossier generates even with minimal input (no attributions/transactions)."""
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-EMPTY",
        wallet_address="0xempty",
        chain="ethereum",
    )

    assert isinstance(zip_bytes, bytes)
    assert len(zip_bytes) > 0

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        # Should still have manifest + ledger + narrative at minimum
        assert "00_MANIFEST_INTEGRITY.json" in names
        assert "04_Transaction_Ledger_Audit.csv" in names
        assert "05_Case_Diary_Investigative_Narrative.txt" in names


def test_custom_narrative_text():
    """Verify custom narrative text overrides default generation."""
    custom_text = "This is a custom investigative narrative provided by the officer."
    zip_bytes = DossierService.generate_dossier(
        case_id="TEST-CUSTOM",
        wallet_address="0xcustom",
        chain="ethereum",
        narrative_text=custom_text,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        narrative = zf.read("05_Case_Diary_Investigative_Narrative.txt").decode("utf-8")
        assert narrative == custom_text


def test_singleton_instance():
    """Verify dossier_service is a global singleton."""
    assert dossier_service is not None
    assert isinstance(dossier_service, DossierService)
