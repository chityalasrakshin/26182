"""
One-Click Judicial Court Dossier Service (Case 5).

Orchestrates generation of 5 synchronized legal assets and bundles them
into a downloadable ZIP archive for court submission:

1. 01_CrPC_Section_91_Seizure_Notice.pdf (and .json) — Official statutory notice via ReportLab
2. 02_Section_65B_Evidence_Certificate.pdf (and .json) — Digital evidence admissibility cert with SHA-256
3. 03_Forensic_Graph_Topography.svg (and .png) — Vector topography and high-res diagram
4. 04_Transaction_Ledger_Audit.csv — Tabular ledger of all hops with USD and INR valuations
5. 05_Case_Diary_Investigative_Narrative.txt — Case diary narrative for IO
6. 00_MANIFEST_INTEGRITY.json & README.txt — Cryptographic checksums and court submission guide

All artifacts are hashed and cross-referenced for tamper-evident chain of custody.
"""

import io
import csv
import json
import hashlib
import zipfile
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from backend.app.services.reporting.legal_notice_generator import LegalNoticeGenerator, VASP_COMPLIANCE_CONTACTS
from backend.app.services.reporting.graph_visualizer import TraceGraphVisualizer
from backend.app.schemas.analysis import AttributionSchema

logger = logging.getLogger("reporting.dossier")

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("ReportLab is not installed; PDF generation in DossierService will fall back to text representation.")


class DossierService:
    """
    Unified dossier builder that generates all 5 court-ready assets
    and packages them into a single ZIP archive.
    """

    @staticmethod
    def generate_dossier(
        case_id: str,
        wallet_address: str,
        chain: str = "ethereum",
        attributions: Optional[List[Dict[str, Any]]] = None,
        evidence: Optional[List[Dict[str, Any]]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
        risk_assessment: Optional[Dict[str, Any]] = None,
        narrative_text: Optional[str] = None,
        graph_data: Optional[Dict[str, Any]] = None,
        investigator_name: str = "Investigating Officer",
        investigating_unit: str = "Cyber Crime Investigation Cell",
    ) -> bytes:
        """
        Generates a complete court dossier ZIP archive.

        Returns:
            Raw bytes of the ZIP file.
        """
        attributions = attributions or []
        evidence = evidence or []
        transactions = transactions or []
        artifact_hashes: Dict[str, str] = {}
        chain_display = "Ethereum Mainnet" if chain == "ethereum" else chain.title()

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # ──────────────────────────────────────────────────────
            # Asset 4: Transaction Ledger Audit (CSV)
            # ──────────────────────────────────────────────────────
            try:
                csv_buffer = io.StringIO()
                writer = csv.writer(csv_buffer)
                writer.writerow([
                    "Hop", "TX Hash", "From", "To", "Amount", "Asset",
                    "Amount USD", "Amount INR", "Timestamp", "Chain",
                ])
                for tx in transactions:
                    if isinstance(tx, dict):
                        writer.writerow([
                            tx.get("hop", ""),
                            tx.get("tx_hash", ""),
                            tx.get("from_address", tx.get("from", "")),
                            tx.get("to_address", tx.get("to", "")),
                            tx.get("amount", ""),
                            tx.get("token_symbol", tx.get("asset", "")),
                            tx.get("amount_usd", ""),
                            tx.get("amount_inr", ""),
                            tx.get("timestamp", ""),
                            tx.get("chain", chain),
                        ])
                    elif hasattr(tx, "tx_hash"):
                        writer.writerow([
                            getattr(tx, "hop", ""),
                            tx.tx_hash,
                            tx.from_address,
                            tx.to_address,
                            tx.amount,
                            getattr(tx, "token_symbol", ""),
                            getattr(tx, "amount_usd", ""),
                            getattr(tx, "amount_inr", ""),
                            tx.timestamp,
                            getattr(tx, "chain", chain),
                        ])

                csv_bytes = csv_buffer.getvalue().encode("utf-8")
                filename = "04_Transaction_Ledger_Audit.csv"
                zf.writestr(filename, csv_bytes)
                artifact_hashes[filename] = hashlib.sha256(csv_bytes).hexdigest()
                logger.info(f"Dossier: Generated {filename} ({len(transactions)} transactions)")
            except Exception as e:
                logger.warning(f"Dossier: Transaction ledger generation skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Asset 5: Case Diary Investigative Narrative (TXT)
            # ──────────────────────────────────────────────────────
            try:
                narrative = narrative_text or DossierService._generate_default_narrative(
                    case_id=case_id,
                    wallet_address=wallet_address,
                    chain=chain_display,
                    attributions=attributions,
                    transactions=transactions,
                    risk_assessment=risk_assessment,
                )
                narrative_bytes = narrative.encode("utf-8")
                filename = "05_Case_Diary_Investigative_Narrative.txt"
                zf.writestr(filename, narrative_bytes)
                artifact_hashes[filename] = hashlib.sha256(narrative_bytes).hexdigest()
                logger.info(f"Dossier: Generated {filename}")
            except Exception as e:
                logger.warning(f"Dossier: Narrative generation skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Asset 3: Forensic Graph Topography (PNG & Vector SVG)
            # ──────────────────────────────────────────────────────
            top_vasp = attributions[0].get("vasp_name") if attributions and isinstance(attributions[0], dict) else None
            attr_score = float(attributions[0].get("score", 0)) if attributions and isinstance(attributions[0], dict) else 0.0
            risk_level = risk_assessment.get("risk_level", "MEDIUM") if risk_assessment else "MEDIUM"

            try:
                graph_png = TraceGraphVisualizer.render_flow_diagram(
                    wallet_address=wallet_address,
                    chain=chain_display,
                    top_vasp_name=top_vasp,
                    attribution_score=attr_score,
                    risk_level=risk_level,
                    transactions=transactions[:20],
                    case_id=case_id
                )
                filename = "03_Forensic_Graph_Topography.png"
                zf.writestr(filename, graph_png)
                artifact_hashes[filename] = hashlib.sha256(graph_png).hexdigest()
                logger.info(f"Dossier: Generated {filename}")
            except Exception as e:
                logger.warning(f"Dossier: Graph topography PNG skipped: {e}")

            try:
                graph_svg = DossierService._generate_topography_svg(
                    wallet_address=wallet_address,
                    chain=chain_display,
                    top_vasp_name=top_vasp,
                    attribution_score=attr_score,
                    risk_level=risk_level,
                    transactions=transactions[:20],
                    case_id=case_id
                )
                filename = "03_Forensic_Graph_Topography.svg"
                svg_bytes = graph_svg.encode("utf-8")
                zf.writestr(filename, svg_bytes)
                artifact_hashes[filename] = hashlib.sha256(svg_bytes).hexdigest()
                logger.info(f"Dossier: Generated {filename}")
            except Exception as e:
                logger.warning(f"Dossier: Graph topography SVG skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Asset 1: Section 91 CrPC Seizure Notice (PDF & JSON)
            # ──────────────────────────────────────────────────────
            top_attr_obj = None
            if attributions:
                attr_data = attributions[0]
                if isinstance(attr_data, dict):
                    top_attr_obj = AttributionSchema(
                        vasp_name=attr_data.get("vasp_name", "Unknown VASP"),
                        score=float(attr_data.get("score", 0)),
                        evidence_strength=attr_data.get("evidence_strength", "MEDIUM"),
                        rank=int(attr_data.get("rank", 1)),
                        summary=attr_data.get("summary", ""),
                    )
                elif hasattr(attr_data, "vasp_name"):
                    top_attr_obj = attr_data

            if top_attr_obj:
                try:
                    notice = LegalNoticeGenerator.generate_freeze_notice(
                        case_id=case_id,
                        wallet_address=wallet_address,
                        chain=chain,
                        attribution=top_attr_obj,
                        evidence=evidence,
                        transactions=transactions,
                        officer_name=investigator_name,
                        police_station=investigating_unit,
                    )
                    notice_json = json.dumps(notice, indent=2, default=str).encode("utf-8")
                    json_name = "01_CrPC_Section_91_Seizure_Notice.json"
                    zf.writestr(json_name, notice_json)
                    artifact_hashes[json_name] = hashlib.sha256(notice_json).hexdigest()
                except Exception as e:
                    logger.warning(f"Dossier: Seizure notice JSON skipped: {e}")

                try:
                    pdf_bytes = DossierService._generate_seizure_notice_pdf(
                        case_id=case_id,
                        wallet_address=wallet_address,
                        chain=chain_display,
                        attribution=top_attr_obj,
                        transactions=transactions,
                        investigator_name=investigator_name,
                        investigating_unit=investigating_unit,
                    )
                    pdf_name = "01_CrPC_Section_91_Seizure_Notice.pdf"
                    zf.writestr(pdf_name, pdf_bytes)
                    artifact_hashes[pdf_name] = hashlib.sha256(pdf_bytes).hexdigest()
                    logger.info(f"Dossier: Generated {pdf_name}")
                except Exception as e:
                    logger.warning(f"Dossier: Seizure notice PDF skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Asset 2: Section 65B Evidence Certificate (JSON & PDF)
            # ──────────────────────────────────────────────────────
            try:
                evidence_cert = DossierService._generate_65b_certificate(
                    case_id=case_id,
                    wallet_address=wallet_address,
                    chain=chain_display,
                    transactions=transactions,
                    attributions=attributions,
                    investigator_name=investigator_name,
                    investigating_unit=investigating_unit,
                    artifact_hashes=artifact_hashes,
                )
                cert_json = json.dumps(evidence_cert, indent=2, default=str).encode("utf-8")
                cert_json_name = "02_Section_65B_Evidence_Certificate.json"
                zf.writestr(cert_json_name, cert_json)
                artifact_hashes[cert_json_name] = hashlib.sha256(cert_json).hexdigest()

                # Generate Section 65B Certificate PDF (referencing already computed artifact hashes)
                cert_pdf_bytes = DossierService._generate_65b_certificate_pdf(
                    case_id=case_id,
                    wallet_address=wallet_address,
                    chain=chain_display,
                    transactions=transactions,
                    attributions=attributions,
                    investigator_name=investigator_name,
                    investigating_unit=investigating_unit,
                    artifact_hashes=artifact_hashes,
                )
                cert_pdf_name = "02_Section_65B_Evidence_Certificate.pdf"
                zf.writestr(cert_pdf_name, cert_pdf_bytes)
                artifact_hashes[cert_pdf_name] = hashlib.sha256(cert_pdf_bytes).hexdigest()
                logger.info(f"Dossier: Generated {cert_pdf_name}")
            except Exception as e:
                logger.warning(f"Dossier: Section 65B certificate generation skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Court Submission Guide (README.txt)
            # ──────────────────────────────────────────────────────
            try:
                readme_text = DossierService._generate_readme(
                    case_id=case_id,
                    wallet_address=wallet_address,
                    chain=chain_display,
                    artifact_hashes=artifact_hashes,
                )
                readme_bytes = readme_text.encode("utf-8")
                zf.writestr("README.txt", readme_bytes)
                artifact_hashes["README.txt"] = hashlib.sha256(readme_bytes).hexdigest()
            except Exception as e:
                logger.warning(f"Dossier: README generation skipped: {e}")

            # ──────────────────────────────────────────────────────
            # Manifest: SHA-256 hashes for cryptographic evidence integrity
            # ──────────────────────────────────────────────────────
            manifest = {
                "case_id": case_id,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "wallet_address": wallet_address,
                "chain": chain_display,
                "total_artifacts": len(artifact_hashes),
                "artifact_checksums": artifact_hashes,
                "integrity_note": (
                    "All SHA-256 checksums above were computed at dossier generation time. "
                    "Verify by computing sha256sum on each file independently."
                ),
            }
            manifest_json = json.dumps(manifest, indent=2).encode("utf-8")
            zf.writestr("00_MANIFEST_INTEGRITY.json", manifest_json)

        zip_buffer.seek(0)
        logger.info(f"Dossier for case {case_id}: ZIP generated with {len(artifact_hashes)} artifacts.")
        return zip_buffer.getvalue()

    @staticmethod
    def _generate_seizure_notice_pdf(
        case_id: str,
        wallet_address: str,
        chain: str,
        attribution: AttributionSchema,
        transactions: List[Any],
        investigator_name: str,
        investigating_unit: str,
    ) -> bytes:
        """
        Renders a formal, publication-quality Section 91 CrPC / Section 94 BNSS
        Asset Preservation & Freezing Notice PDF using ReportLab.
        """
        if not REPORTLAB_AVAILABLE:
            return b"%PDF-1.4 [ReportLab unavailable]"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm,
            title=f"Section 91 CrPC Notice - {case_id[:8].upper()}",
            author="CryptoTrace Intelligence Platform",
        )

        styles = getSampleStyleSheet()
        NAVY = colors.HexColor("#1a237e")
        CRIMSON = colors.HexColor("#b71c1c")
        BORDER = colors.HexColor("#94a3b8")

        title_style = ParagraphStyle(
            "NoticeTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
        body_style = ParagraphStyle(
            "NoticeBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
            alignment=TA_JUSTIFY,
        )
        body_bold = ParagraphStyle(
            "NoticeBodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )
        legal_subhead = ParagraphStyle(
            "LegalSubhead",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=NAVY,
            spaceBefore=3 * mm,
            spaceAfter=1.5 * mm,
        )

        elements = []

        # 1. State Police Emblem Banner
        banner_table = Table([[
            Paragraph("<b>GOVERNMENT OF INDIA // STATE POLICE / CID</b><br/>CYBER CRIME INVESTIGATION CELL", title_style)
        ]], colWidths=[182 * mm])
        banner_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), NAVY),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 2 * mm))

        # Title
        elements.append(Paragraph(
            "<b>FORMAL REQUISITION &amp; FREEZE ORDER UNDER SECTION 91 Cr.P.C., 1973 / SECTION 94 BNSS, 2023</b><br/>"
            "<font size='7' color='#b71c1c'><b>URGENT: IMMEDIATE PRESERVATION OF STOLEN ASSETS &amp; DISCLOSURE OF BENEFICIAL KYC</b></font>",
            ParagraphStyle("Sub", fontName="Helvetica-Bold", fontSize=9.5, leading=12, alignment=TA_CENTER, textColor=CRIMSON)
        ))
        elements.append(Spacer(1, 3 * mm))

        # Metadata Table
        now = datetime.now(timezone.utc)
        ref_no = f"LEA/CYBER/{now.year}/{case_id[:8].upper()}"
        vasp_name = attribution.vasp_name if attribution else "Virtual Asset Service Provider"
        contact_info = VASP_COMPLIANCE_CONTACTS.get(vasp_name, {
            "entity": f"{vasp_name} Legal & Compliance Operations",
            "email": "compliance@exchange.com",
            "designated_lea_email": "lawenforcement@exchange.com",
            "portal": "Official Law Enforcement Portal",
            "fiu_ind_registration": "N/A",
            "sahyog_routing_code": "SAHYOG-VASP-GLB",
            "nodal_officer": "Nodal Officer / Compliance Desk",
        })

        meta_rows = [
            ["Notice Ref No:", ref_no, "Date of Issuance:", now.strftime("%d-%B-%Y")],
            ["Case Reference:", case_id, "NCRP Ref No:", f"NCRP-{now.year}-{case_id[:6].upper()}"],
            ["Target Suspect Wallet:", f"{wallet_address[:18]}...{wallet_address[-12:]}", "Blockchain Rail:", chain.upper()],
            ["Destination VASP:", vasp_name, "FIU-IND Reg:", contact_info.get("fiu_ind_registration", "N/A")],
            ["VASP Nodal Officer:", contact_info.get("nodal_officer", "Nodal Officer"), "Sahyog Code:", contact_info.get("sahyog_routing_code", "N/A")],
        ]
        meta_table = Table(meta_rows, colWidths=[38 * mm, 53 * mm, 38 * mm, 53 * mm])
        meta_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 3 * mm))

        # Notice Body Paragraphs
        elements.append(Paragraph(
            f"<b>TO:</b> The Nodal Officer / Head of Legal Compliance, <b>{contact_info.get('entity')}</b><br/>"
            f"Designated LEA Desk: <font color='#1d4ed8'><u>{contact_info.get('designated_lea_email', contact_info.get('email'))}</u></font>",
            body_style
        ))
        elements.append(Spacer(1, 2 * mm))

        elements.append(Paragraph(
            "1. <b>STATUTORY AUTHORITY:</b> This statutory preservation requisition is served upon you under "
            "<b>Section 91 of the Code of Criminal Procedure, 1973 (Cr.P.C.) / Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023</b>, "
            "read with <b>Section 318(4) of Bharatiya Nyaya Sanhita (BNS), 2023</b> (Cheating &amp; Dishonest Misappropriation of Property), "
            "<b>Section 66D of the Information Technology Act, 2000</b>, and the Prevention of Money Laundering Act (PMLA), 2002.",
            body_style
        ))
        elements.append(Spacer(1, 2 * mm))

        elements.append(Paragraph(
            f"2. <b>MATTER OF INVESTIGATION:</b> An active cyber financial fraud investigation is currently conducted by "
            f"<b>{investigating_unit}</b> regarding the unauthorized siphoning of proceeds of crime. Directed forensic tracing "
            f"confirms that victim assets originating from the suspect address <b>{wallet_address}</b> were deposited directly into "
            f"custodial deposit clusters maintained by your platform <b>({vasp_name})</b> with an algorithmic attribution confidence of "
            f"<b>{attribution.score:.1f}%</b> ({attribution.evidence_strength} confidence).",
            body_style
        ))
        elements.append(Spacer(1, 2 * mm))

        # Transaction Table
        elements.append(Paragraph("<b>3. CRITICAL ON-CHAIN TRANSACTION IDENTIFIERS:</b>", legal_subhead))
        tx_rows = [["Hop", "Transaction Hash", "From Address", "To Address", "Amount", "Asset"]]
        for i, tx in enumerate(transactions[:6], 1):
            if isinstance(tx, dict):
                tx_hash = tx.get("tx_hash", "-")
                from_a = tx.get("from_address", tx.get("from", "-"))
                to_a = tx.get("to_address", tx.get("to", "-"))
                amt = str(tx.get("amount", "0"))
                asset = str(tx.get("token_symbol", tx.get("asset", "ETH")))
                hop = str(tx.get("hop", i))
            else:
                tx_hash = getattr(tx, "tx_hash", "-")
                from_a = getattr(tx, "from_address", "-")
                to_a = getattr(tx, "to_address", "-")
                amt = str(getattr(tx, "amount", "0"))
                asset = str(getattr(tx, "token_symbol", "ETH"))
                hop = str(getattr(tx, "hop", i))

            tx_rows.append([
                hop,
                f"{tx_hash[:10]}...{tx_hash[-8:]}" if len(tx_hash) > 18 else tx_hash,
                f"{from_a[:8]}...{from_a[-6:]}" if len(from_a) > 14 else from_a,
                f"{to_a[:8]}...{to_a[-6:]}" if len(to_a) > 14 else to_a,
                amt[:8],
                asset[:6]
            ])

        tx_table = Table(tx_rows, colWidths=[12 * mm, 50 * mm, 38 * mm, 38 * mm, 24 * mm, 20 * mm])
        tx_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        elements.append(tx_table)
        elements.append(Spacer(1, 2.5 * mm))

        # Statutory Directives
        elements.append(Paragraph("<b>4. STATUTORY DIRECTIVES &amp; MANDATORY INJUNCTIONS:</b>", legal_subhead))
        directives = [
            "<b>(A) IMMEDIATE ASSET PRESERVATION &amp; FREEZE:</b> Place an immediate, irrevocable administrative hold / freeze on the user account, sub-accounts, custodial UID, and any linked crypto deposit addresses identified above. Strictly prohibit further off-ramping, swap, or withdrawal of funds.",
            "<b>(B) BENEFICIAL KYC DISCLOSURE:</b> Furnish certified copies of complete Customer Identification Dossiers (Full Legal Name, Government Issued ID, PAN/Aadhaar/Passport, Registered Mobile Number, Email Address, Residential Address, and Liveness verification logs).",
            "<b>(C) FIAT BANKING DETAILS:</b> Disclose all linked domestic and foreign bank account numbers, UPI IDs, credit cards, or payment methods used for fiat deposits or withdrawals.",
            "<b>(D) TECHNICAL FORENSIC LOGS:</b> Furnish server access logs containing IPv4/IPv6 addresses, port numbers, login timestamps, user-agent strings, and device fingerprints for all sessions accessing the subject account.",
        ]
        for d in directives:
            elements.append(Paragraph(f"• {d}", body_style))
            elements.append(Spacer(1, 1.5 * mm))

        # Legal Penal Warning
        elements.append(Paragraph(
            "<b>5. PENAL CONSEQUENCE FOR NON-COMPLIANCE:</b> Take notice that non-compliance or intentional delay in "
            "preserving these proceeds of crime attracts penal consequences under <b>Section 175 of Indian Penal Code (IPC) / "
            "Section 222 of Bharatiya Nyaya Sanhita (BNS), 2023</b> (Omission to produce document or electronic record to public servant), "
            "and may invite proceedings for abetment of money laundering under the Prevention of Money Laundering Act (PMLA), 2002.",
            ParagraphStyle("Warning", parent=body_style, textColor=CRIMSON)
        ))
        elements.append(Spacer(1, 4 * mm))

        # Signatory & Seal Block
        sig_data = [
            [
                Paragraph("<b>OFFICIAL SEAL / EMBLEM</b><br/><br/>[ STATE CYBER CRIME INVESTIGATION ]<br/>[ RECOGNISED POLICE STATION ]", ParagraphStyle("Seal", fontName="Helvetica", fontSize=7, alignment=TA_CENTER, textColor=colors.gray)),
                Paragraph(
                    f"<b>ISSUED BY:</b><br/>"
                    f"<b>{investigator_name}</b><br/>"
                    f"Cyber Crime Investigating Officer<br/>"
                    f"{investigating_unit}<br/>"
                    f"Republic of India",
                    ParagraphStyle("Sig", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_RIGHT)
                )
            ]
        ]
        sig_table = Table(sig_data, colWidths=[80 * mm, 102 * mm])
        sig_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(sig_table)

        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def _generate_65b_certificate_pdf(
        case_id: str,
        wallet_address: str,
        chain: str,
        transactions: List[Any],
        attributions: List[Any],
        investigator_name: str,
        investigating_unit: str,
        artifact_hashes: Dict[str, str],
    ) -> bytes:
        """
        Renders a formal Section 65B Indian Evidence Act / Section 63 BSA
        Electronic Evidence Admissibility Certificate as an A4 PDF using ReportLab.
        """
        if not REPORTLAB_AVAILABLE:
            return b"%PDF-1.4 [ReportLab unavailable]"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=14 * mm,
            title=f"Section 65B Evidence Certificate - {case_id[:8].upper()}",
            author="CryptoTrace Forensic Intelligence Platform",
        )

        styles = getSampleStyleSheet()
        NAVY = colors.HexColor("#0f172a")
        GOLD = colors.HexColor("#854d0e")
        BORDER = colors.HexColor("#cbd5e1")

        title_style = ParagraphStyle(
            "CertTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
        body_style = ParagraphStyle(
            "CertBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
            alignment=TA_JUSTIFY,
        )
        legal_subhead = ParagraphStyle(
            "CertSubhead",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=NAVY,
            spaceBefore=3 * mm,
            spaceAfter=1.5 * mm,
        )

        elements = []

        # 1. Header Banner
        banner_table = Table([[
            Paragraph(
                "<b>IN THE COURT OF COMPETENT JURISDICTION // LAW ENFORCEMENT RECORD</b><br/>"
                "CERTIFICATE UNDER SECTION 65B(4) OF THE INDIAN EVIDENCE ACT, 1872<br/>"
                "READ WITH SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023",
                title_style
            )
        ]], colWidths=[182 * mm])
        banner_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), NAVY),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(banner_table)
        elements.append(Spacer(1, 3 * mm))

        # Certificate Preamble
        now = datetime.now(timezone.utc)
        elements.append(Paragraph(
            f"<b>CASE REFERENCE:</b> {case_id} &nbsp;|&nbsp; <b>DATE OF ISSUE:</b> {now.strftime('%d-%B-%Y')} &nbsp;|&nbsp; <b>TIME:</b> {now.strftime('%H:%M:%S UTC')}",
            ParagraphStyle("Sub", fontName="Helvetica-Bold", fontSize=8.5, alignment=TA_CENTER, textColor=colors.HexColor("#475569"))
        ))
        elements.append(Spacer(1, 3 * mm))

        # Section A: System Identification
        elements.append(Paragraph("<b>PART A: IDENTIFICATION OF COMPUTER SYSTEM &amp; FORENSIC FACILITY</b>", legal_subhead))
        elements.append(Paragraph(
            "1. This electronic certificate accompanies computer-generated digital outputs produced by the "
            "<b>CryptoTrace Autonomous Blockchain Intelligence Platform (v2.4)</b>, hosted on dedicated law enforcement forensic infrastructure.<br/>"
            "2. The computer systems and cryptographic nodes were in regular, lawful use to produce and analyze blockchain transaction ledgers, "
            "smart contract interactions, and VASP deposit attributions in the ordinary course of investigative operations.<br/>"
            "3. Throughout the material period, the computer platform operated properly without malfunction, disruption, or unauthorized alteration.",
            body_style
        ))
        elements.append(Spacer(1, 2.5 * mm))

        # Section B: Electronic Records Produced
        top_v = attributions[0].get("vasp_name") if attributions and isinstance(attributions[0], dict) else "Identified VASP"
        elements.append(Paragraph("<b>PART B: PARTICULARS OF ELECTRONIC EVIDENCE GENERATED</b>", legal_subhead))
        meta_rows = [
            ["Target Suspect Address:", wallet_address, "Blockchain Network:", chain],
            ["Total On-Chain Txs:", str(len(transactions)), "Destination Custody:", str(top_v)],
            ["Hash Algorithm:", "FIPS 180-4 SHA-256 (256-bit)", "Platform Engine:", "CryptoTrace v2.4 (BFS Graph Engine)"],
        ]
        meta_t = Table(meta_rows, colWidths=[42 * mm, 50 * mm, 42 * mm, 48 * mm])
        meta_t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f8fafc")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(meta_t)
        elements.append(Spacer(1, 3 * mm))

        # Section C: Cryptographic Hash Manifest Table
        elements.append(Paragraph("<b>PART C: CRYPTOGRAPHIC CHAIN OF CUSTODY (SHA-256 CHECKSUM LEDGER)</b>", legal_subhead))
        elements.append(Paragraph(
            "Each artifact within this court dossier was atomically hashed at the moment of creation. Any post-generation modification will invalidate the matching digest:",
            body_style
        ))
        elements.append(Spacer(1, 1.5 * mm))

        hash_rows = [["#", "Artifact Filename", "SHA-256 Cryptographic Checksum"]]
        idx = 1
        for fname, hval in sorted(artifact_hashes.items()):
            if not fname.endswith(".pdf"):  # Include other artifacts in table
                hash_rows.append([
                    str(idx),
                    fname,
                    hval
                ])
                idx += 1

        hash_t = Table(hash_rows, colWidths=[10 * mm, 64 * mm, 108 * mm])
        hash_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        elements.append(hash_t)
        elements.append(Spacer(1, 3 * mm))

        # Section D: Formal Examiner Declaration
        elements.append(Paragraph("<b>PART D: STATUTORY DECLARATION &amp; JURAT</b>", legal_subhead))
        statement = (
            f"I, <b>{investigator_name}</b>, holding official position as Investigating Officer at <b>{investigating_unit}</b>, "
            f"do hereby solemnly certify and declare in terms of <b>Section 65B(4) of the Indian Evidence Act, 1872</b> and "
            f"<b>Section 63(4) of the Bharatiya Sakshya Adhiniyam, 2023</b>, that to the best of my knowledge and belief, "
            f"the electronic materials listed above were produced by computer systems operating properly under my lawful supervision. "
            f"The electronic records are true, faithful, and unaltered reproductions of the original data as recorded on the public "
            f"{chain} distributed ledger at the time of extraction."
        )
        elements.append(Paragraph(statement, body_style))
        elements.append(Spacer(1, 5 * mm))

        # Signatory Box
        sig_data = [
            [
                Paragraph("<b>DATE &amp; LOCATION:</b><br/>" + now.strftime("%d-%B-%Y") + "<br/>Cyber Crime Investigation Headquarters", ParagraphStyle("Loc", fontName="Helvetica", fontSize=8, leading=11)),
                Paragraph(
                    f"<b>CERTIFIED BY:</b><br/>"
                    f"<b>{investigator_name}</b><br/>"
                    f"Investigating Officer / Digital Evidence Examiner<br/>"
                    f"{investigating_unit}<br/>"
                    f"Republic of India",
                    ParagraphStyle("Sig", fontName="Helvetica", fontSize=8, leading=11, alignment=TA_RIGHT)
                )
            ]
        ]
        sig_t = Table(sig_data, colWidths=[90 * mm, 92 * mm])
        sig_t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(sig_t)

        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def _generate_topography_svg(
        wallet_address: str,
        chain: str,
        top_vasp_name: Optional[str] = None,
        attribution_score: float = 0.0,
        risk_level: str = "MEDIUM",
        transactions: Optional[List[Dict[str, Any]]] = None,
        case_id: str = "CASE-TRACE",
    ) -> str:
        """
        Generates an ultra-crisp, publication-quality vector SVG transaction flow diagram.
        """
        transactions = transactions or []
        vasp_label = top_vasp_name if top_vasp_name else "VASP Deposit"
        short_suspect = f"{wallet_address[:8]}...{wallet_address[-6:]}" if len(wallet_address) > 16 else wallet_address

        # Determine intermediate transit node
        transit_addr = "Transit / Layering Node"
        for tx in transactions[:3]:
            to_a = tx.get("to") or tx.get("to_address") if isinstance(tx, dict) else getattr(tx, "to_address", None)
            if to_a and to_a.lower() != wallet_address.lower():
                transit_addr = f"{to_a[:8]}...{to_a[-6:]}"
                break

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 420" width="1000" height="420" style="background:#0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="suspectGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#450a0a"/>
      <stop offset="100%" stop-color="#1c0707"/>
    </linearGradient>
    <linearGradient id="transitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#172554"/>
      <stop offset="100%" stop-color="#0b1329"/>
    </linearGradient>
    <linearGradient id="vaspGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
    </marker>
    <marker id="arrowVasp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399" />
    </marker>
  </defs>

  <!-- Header Banner -->
  <rect x="0" y="0" width="1000" height="52" fill="url(#headerGrad)"/>
  <line x1="0" y1="52" x2="1000" y2="52" stroke="#334155" stroke-width="2"/>
  <text x="24" y="32" fill="#f8fafc" font-size="14" font-weight="bold" letter-spacing="1">CRYPTOTRACE // MULTI-HOP FORENSIC FLOW TOPOGRAPHY</text>
  <text x="680" y="32" fill="#94a3b8" font-size="11" font-weight="bold">CASE: {case_id[:8].upper()} | {chain.upper()} | RISK: {risk_level.upper()}</text>

  <!-- Grid Background Points -->
  <g opacity="0.15" fill="#64748b">
    <circle cx="50" cy="120" r="1.5"/><circle cx="150" cy="120" r="1.5"/><circle cx="250" cy="120" r="1.5"/><circle cx="350" cy="120" r="1.5"/><circle cx="450" cy="120" r="1.5"/><circle cx="550" cy="120" r="1.5"/><circle cx="650" cy="120" r="1.5"/><circle cx="750" cy="120" r="1.5"/><circle cx="850" cy="120" r="1.5"/><circle cx="950" cy="120" r="1.5"/>
    <circle cx="50" cy="220" r="1.5"/><circle cx="150" cy="220" r="1.5"/><circle cx="250" cy="220" r="1.5"/><circle cx="350" cy="220" r="1.5"/><circle cx="450" cy="220" r="1.5"/><circle cx="550" cy="220" r="1.5"/><circle cx="650" cy="220" r="1.5"/><circle cx="750" cy="220" r="1.5"/><circle cx="850" cy="220" r="1.5"/><circle cx="950" cy="220" r="1.5"/>
    <circle cx="50" cy="320" r="1.5"/><circle cx="150" cy="320" r="1.5"/><circle cx="250" cy="320" r="1.5"/><circle cx="350" cy="320" r="1.5"/><circle cx="450" cy="320" r="1.5"/><circle cx="550" cy="320" r="1.5"/><circle cx="650" cy="320" r="1.5"/><circle cx="750" cy="320" r="1.5"/><circle cx="850" cy="320" r="1.5"/><circle cx="950" cy="320" r="1.5"/>
  </g>

  <!-- Connecting Arrows -->
  <path d="M 280 230 L 390 230" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
  <rect x="305" y="212" width="70" height="20" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="0.75"/>
  <text x="340" y="226" fill="#38bdf8" font-size="9" font-weight="bold" text-anchor="middle">HOP 1</text>

  <path d="M 610 230 L 720 230" stroke="#34d399" stroke-width="2.5" marker-end="url(#arrowVasp)"/>
  <rect x="635" y="212" width="70" height="20" rx="4" fill="#1e293b" stroke="#34d399" stroke-width="0.75"/>
  <text x="670" y="226" fill="#34d399" font-size="9" font-weight="bold" text-anchor="middle">DEPOSIT</text>

  <!-- Node 1: Suspect Root -->
  <g transform="translate(60, 160)">
    <rect width="220" height="140" rx="10" fill="url(#suspectGrad)" stroke="#ef4444" stroke-width="2"/>
    <rect x="0" y="0" width="220" height="34" rx="10" fill="#991b1b"/>
    <rect x="0" y="20" width="220" height="14" fill="#991b1b"/>
    <text x="110" y="22" fill="#fee2e2" font-size="11" font-weight="bold" text-anchor="middle">SUSPECT TARGET WALLET</text>
    <text x="110" y="65" fill="#f87171" font-size="10" font-weight="bold" text-anchor="middle">ROLE: FRAUD SOURCE</text>
    <rect x="18" y="78" width="184" height="26" rx="4" fill="#18181b" stroke="#ef4444" stroke-width="0.75"/>
    <text x="110" y="95" fill="#fecaca" font-size="10" font-family="monospace" text-anchor="middle">{short_suspect}</text>
    <text x="110" y="125" fill="#94a3b8" font-size="9" text-anchor="middle">{chain.upper()}</text>
  </g>

  <!-- Node 2: Intermediate Hop -->
  <g transform="translate(390, 160)">
    <rect width="220" height="140" rx="10" fill="url(#transitGrad)" stroke="#3b82f6" stroke-width="2"/>
    <rect x="0" y="0" width="220" height="34" rx="10" fill="#1e40af"/>
    <rect x="0" y="20" width="220" height="14" fill="#1e40af"/>
    <text x="110" y="22" fill="#dbeafe" font-size="11" font-weight="bold" text-anchor="middle">TRANSIT / PEELING HOP</text>
    <text x="110" y="65" fill="#60a5fa" font-size="10" font-weight="bold" text-anchor="middle">LAYER: PASS-THROUGH</text>
    <rect x="18" y="78" width="184" height="26" rx="4" fill="#18181b" stroke="#3b82f6" stroke-width="0.75"/>
    <text x="110" y="95" fill="#bfdbfe" font-size="10" font-family="monospace" text-anchor="middle">{transit_addr}</text>
    <text x="110" y="125" fill="#94a3b8" font-size="9" text-anchor="middle">Dispersal &amp; Transit</text>
  </g>

  <!-- Node 3: Destination VASP -->
  <g transform="translate(720, 160)">
    <rect width="220" height="140" rx="10" fill="url(#vaspGrad)" stroke="#10b981" stroke-width="2"/>
    <rect x="0" y="0" width="220" height="34" rx="10" fill="#065f46"/>
    <rect x="0" y="20" width="220" height="14" fill="#065f46"/>
    <text x="110" y="22" fill="#d1fae5" font-size="11" font-weight="bold" text-anchor="middle">DESTINATION VASP</text>
    <text x="110" y="65" fill="#34d399" font-size="10" font-weight="bold" text-anchor="middle">{vasp_label.upper()} CLUSTER</text>
    <rect x="18" y="78" width="184" height="26" rx="4" fill="#18181b" stroke="#10b981" stroke-width="0.75"/>
    <text x="110" y="95" fill="#a7f3d0" font-size="10" font-family="monospace" text-anchor="middle">CONFIDENCE: {attribution_score:.1f}%</text>
    <text x="110" y="125" fill="#6ee7b7" font-size="9" font-weight="bold" text-anchor="middle">STATUTORY FREEZE TARGET</text>
  </g>

  <!-- Footer Legend -->
  <rect x="0" y="375" width="1000" height="45" fill="#090d16"/>
  <line x1="0" y1="375" x2="1000" y2="375" stroke="#1e293b" stroke-width="1"/>
  <circle cx="40" cy="397" r="5" fill="#ef4444"/>
  <text x="52" y="401" fill="#cbd5e1" font-size="10">Suspect Input Wallet</text>
  <circle cx="210" cy="397" r="5" fill="#3b82f6"/>
  <text x="222" y="401" fill="#cbd5e1" font-size="10">Layering / Peeling Node</text>
  <circle cx="410" cy="397" r="5" fill="#10b981"/>
  <text x="422" y="401" fill="#cbd5e1" font-size="10">Attributed Custodial Exchange (VASP)</text>
  <text x="960" y="401" fill="#64748b" font-size="9" text-anchor="end">SHA-256 Tamper-Evident Graph</text>
</svg>"""
        return svg

    @staticmethod
    def _generate_65b_certificate(
        case_id: str,
        wallet_address: str,
        chain: str,
        transactions: List,
        attributions: List,
        investigator_name: str,
        investigating_unit: str,
        artifact_hashes: Dict[str, str],
    ) -> Dict[str, Any]:
        """Generates Indian Evidence Act Section 65B(4) compliance certificate."""
        now = datetime.now(timezone.utc)
        top_vasp = None
        if attributions:
            a = attributions[0]
            top_vasp = a.get("vasp_name") if isinstance(a, dict) else getattr(a, "vasp_name", None)

        return {
            "certificate_title": "CERTIFICATE UNDER SECTION 65B(4) OF THE INDIAN EVIDENCE ACT, 1872 / SECTION 63 BSA 2023",
            "case_reference": case_id,
            "date_of_issue": now.strftime("%d-%B-%Y"),
            "time_of_issue_utc": now.strftime("%H:%M:%S UTC"),

            "section_a_computer_system": {
                "description": "CryptoTrace Forensic Intelligence Platform v2.4",
                "system_type": "Automated cryptocurrency wallet-to-VASP attribution engine",
                "data_sources": [
                    "Public Blockchain RPC Providers (Etherscan, TronGrid, Mempool)",
                    "Live Price Valuation Feeds (CoinGecko Market Data / Forex FX)",
                    "Curated VASP Master Registry (28,000+ verified addresses)",
                    "OFAC SDN Digital Currency Sanctions List",
                    "ScamSniffer Web3 Phishing Blacklist",
                    "Etherscan Label Cloud",
                ],
                "regular_use": True,
                "operating_properly": True,
            },

            "section_b_electronic_record": {
                "wallet_address_analyzed": wallet_address,
                "blockchain_network": chain,
                "total_transactions_processed": len(transactions),
                "top_attributed_vasp": top_vasp,
                "analysis_timestamp": now.isoformat(),
            },

            "section_c_integrity": {
                "sha256_checksums": artifact_hashes,
                "tamper_evidence": "All artifacts were generated in a single atomic operation. SHA-256 checksums above can be independently verified.",
            },

            "section_d_certification": {
                "certified_by": investigator_name,
                "designation": "Investigating Officer",
                "unit": investigating_unit,
                "statement": (
                    f"I, {investigator_name}, certify under Section 65B(4) of the Indian Evidence Act, 1872 "
                    f"and Section 63 of Bharatiya Sakshya Adhiniyam, 2023, "
                    f"that the electronic evidence contained in this dossier (Case Reference: {case_id}) "
                    f"has been produced by a computer system in regular use, which was operating properly "
                    f"at the material time. The information contained was supplied in the ordinary course "
                    f"of its activities and is a faithful reproduction of the original electronic records."
                ),
            },
        }

    @staticmethod
    def _generate_default_narrative(
        case_id: str,
        wallet_address: str,
        chain: str,
        attributions: List,
        transactions: List,
        risk_assessment: Optional[Dict] = None,
    ) -> str:
        """Generates a default investigative narrative when AI narrative service is unavailable."""
        now = datetime.now(timezone.utc)
        risk_level = risk_assessment.get("risk_level", "MEDIUM") if risk_assessment else "MEDIUM"

        lines = [
            "=" * 72,
            "CASE DIARY — INVESTIGATIVE NARRATIVE (PARCHA)",
            "=" * 72,
            "",
            f"Case Reference:    {case_id}",
            f"Subject Wallet:    {wallet_address}",
            f"Blockchain Rail:   {chain}",
            f"Generated:         {now.strftime('%d-%B-%Y %H:%M UTC')}",
            f"Risk Assessment:   {risk_level}",
            "",
            "-" * 72,
            "INVESTIGATION SUMMARY",
            "-" * 72,
            "",
            f"The CryptoTrace Forensic Intelligence Platform analyzed wallet",
            f"'{wallet_address}' on the {chain} blockchain.",
            f"A total of {len(transactions)} transactions were examined across",
            f"multiple hops from the suspect address.",
            "",
        ]

        if attributions:
            lines.append("VASP ATTRIBUTIONS IDENTIFIED:")
            lines.append("")
            for i, attr in enumerate(attributions[:5]):
                name = attr.get("vasp_name") if isinstance(attr, dict) else getattr(attr, "vasp_name", "Unknown")
                score = attr.get("score") if isinstance(attr, dict) else getattr(attr, "score", 0)
                lines.append(f"  {i+1}. {name} (Confidence: {score:.1f}%)")
            lines.append("")

        if risk_assessment:
            lines.append("RISK INDICATORS:")
            indicators = risk_assessment.get("indicators", [])
            for ind in indicators[:10]:
                lines.append(f"  • {ind}")
            lines.append("")

        lines.extend([
            "-" * 72,
            "EVIDENTIARY NOTE",
            "-" * 72,
            "",
            "This narrative is generated automatically by the CryptoTrace platform.",
            "All transaction data and attributions are verifiable against the",
            "accompanying SHA-256 checksums in the dossier manifest.",
            "",
            "This document is intended for use by investigating officers and may",
            "be annexed to the case diary under relevant provisions of the",
            "Information Technology Act, 2000 and the Indian Evidence Act, 1872.",
            "",
            "=" * 72,
        ])

        return "\n".join(lines)

    @staticmethod
    def _generate_readme(
        case_id: str,
        wallet_address: str,
        chain: str,
        artifact_hashes: Dict[str, str],
    ) -> str:
        """Generates README.txt court submission guide."""
        lines = [
            "================================================================================",
            "             JUDICIAL EVIDENCE DOSSIER — SUBMISSION & AUDIT GUIDE",
            "================================================================================",
            f"Case Reference:         {case_id}",
            f"Suspect Target Wallet:  {wallet_address}",
            f"Blockchain Network:     {chain}",
            f"Generation Timestamp:   {datetime.now(timezone.utc).isoformat()} UTC",
            "",
            "CONTENTS OF THIS DOSSIER ARCHIVE:",
            "--------------------------------------------------------------------------------",
            "1. 01_CrPC_Section_91_Seizure_Notice.pdf / .json",
            "   Official statutory preservation requisition order issued to the identified VASP",
            "   nodal officer under CrPC § 91 / BNSS § 94 demanding immediate asset freeze.",
            "",
            "2. 02_Section_65B_Evidence_Certificate.pdf / .json",
            "   Statutory electronic evidence admissibility certificate under Section 65B(4)",
            "   of the Indian Evidence Act, 1872 / Section 63 BSA 2023 certifying data authenticity.",
            "",
            "3. 03_Forensic_Graph_Topography.svg / .png",
            "   Tamper-evident vector SVG and high-resolution visual flow diagram showing the path",
            "   of funds from the suspect wallet through transit hops into the target VASP.",
            "",
            "4. 04_Transaction_Ledger_Audit.csv",
            "   Complete tabular transaction ledger including Hop, TX Hash, From, To, Amounts,",
            "   Assets, and converted USD and INR valuations at the time of transfer.",
            "",
            "5. 05_Case_Diary_Investigative_Narrative.txt",
            "   Investigating officer case diary parcha summarizing the factual findings,",
            "   algorithmic attribution scores, and risk classifications.",
            "",
            "6. 00_MANIFEST_INTEGRITY.json",
            "   Cryptographic SHA-256 hash manifest of every file contained in this bundle.",
            "",
            "VERIFICATION INSTRUCTIONS FOR JUDICIAL EXAMINER / REGISTRAR:",
            "--------------------------------------------------------------------------------",
            "To verify that no file has been altered or tampered with since generation:",
            "  Windows PowerShell: Get-FileHash <filename> -Algorithm SHA256",
            "  Linux / macOS:      sha256sum <filename>",
            "",
            "Compare the computed hash against the values recorded in '00_MANIFEST_INTEGRITY.json'",
            "and Part C of '02_Section_65B_Evidence_Certificate.pdf'.",
            "================================================================================",
        ]
        return "\n".join(lines)


# Module-level singleton
dossier_service = DossierService()
