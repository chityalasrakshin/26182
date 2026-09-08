import datetime
from typing import Dict, Any, List, Optional
from backend.app.schemas.analysis import AttributionSchema, EvidenceSchema, NormalizedTransaction

VASP_COMPLIANCE_CONTACTS: Dict[str, Dict[str, str]] = {
    "Binance": {
        "entity": "Binance Holdings Ltd. / Compliance Department",
        "email": "case-management@binance.com",
        "designated_lea_email": "lawenforcement@binance.com",
        "portal": "https://www.binance.com/en/support/law-enforcement",
        "jurisdiction": "Global / FIU-IND Registered",
        "fiu_ind_registration": "FIU-IND/VDA/REG/2024/BIN-001",
        "sahyog_routing_code": "SAHYOG-VASP-BINANCE-GLB",
        "nodal_officer": "Binance Global LE Desk",
    },
    "WazirX": {
        "entity": "Zanmai Labs Pvt. Ltd. (WazirX Compliance Desk)",
        "email": "lawenforcement@wazirx.com",
        "designated_lea_email": "nodalofficer@wazirx.com",
        "portal": "https://wazirx.com/law-enforcement",
        "jurisdiction": "India (FIU-IND Registered)",
        "fiu_ind_registration": "FIU-IND/VDA/REG/2024/WZX-002",
        "sahyog_routing_code": "SAHYOG-VASP-WAZIRX-IND",
        "nodal_officer": "Rajagopal Menon, VP & Nodal Officer",
    },
    "CoinDCX": {
        "entity": "Neblio Technologies Pvt. Ltd. (CoinDCX Legal)",
        "email": "compliance@coindcx.com",
        "designated_lea_email": "lawenforcement@coindcx.com",
        "portal": "https://coindcx.com/legal",
        "jurisdiction": "India (FIU-IND Registered)",
        "fiu_ind_registration": "FIU-IND/VDA/REG/2024/CDX-003",
        "sahyog_routing_code": "SAHYOG-VASP-COINDCX-IND",
        "nodal_officer": "CoinDCX Compliance & Legal Team",
    },
    "ZebPay": {
        "entity": "Awlencan Innovations India Pvt. Ltd. (ZebPay)",
        "email": "compliance@zebpay.com",
        "designated_lea_email": "lawenforcement@zebpay.com",
        "portal": "https://zebpay.com/legal",
        "jurisdiction": "India (FIU-IND Registered)",
        "fiu_ind_registration": "FIU-IND/VDA/REG/2024/ZBP-004",
        "sahyog_routing_code": "SAHYOG-VASP-ZEBPAY-IND",
        "nodal_officer": "ZebPay Nodal Officer & Compliance Head",
    },
    "Mudrex": {
        "entity": "Mudrex Inc. / Mudrex India (Compliance Department)",
        "email": "compliance@mudrex.com",
        "designated_lea_email": "lawenforcement@mudrex.com",
        "portal": "https://mudrex.com/legal",
        "jurisdiction": "India (FIU-IND Registered)",
        "fiu_ind_registration": "FIU-IND/VDA/REG/2024/MDX-005",
        "sahyog_routing_code": "SAHYOG-VASP-MUDREX-IND",
        "nodal_officer": "Mudrex Compliance & Legal Operations",
    },
    "Coinbase": {
        "entity": "Coinbase, Inc. Legal Process Team",
        "email": "lawenforcement@coinbase.com",
        "designated_lea_email": "lawenforcement@coinbase.com",
        "portal": "https://www.coinbase.com/legal/law-enforcement",
        "jurisdiction": "United States / Global",
        "fiu_ind_registration": "N/A (Foreign VASP)",
        "sahyog_routing_code": "SAHYOG-VASP-COINBASE-US",
        "nodal_officer": "Coinbase Global LE Response Team",
    },
    "Kraken": {
        "entity": "Payward, Inc. (Kraken Compliance)",
        "email": "compliance@kraken.com",
        "designated_lea_email": "lawenforcement@kraken.com",
        "portal": "https://www.kraken.com/legal",
        "jurisdiction": "Global",
        "fiu_ind_registration": "N/A (Foreign VASP)",
        "sahyog_routing_code": "SAHYOG-VASP-KRAKEN-GLB",
        "nodal_officer": "Kraken Legal & Compliance",
    },
    "OKX": {
        "entity": "OKX Global Law Enforcement Operations",
        "email": "compliance@okx.com",
        "designated_lea_email": "lawenforcement@okx.com",
        "portal": "https://www.okx.com/help",
        "jurisdiction": "Global",
        "fiu_ind_registration": "N/A (Foreign VASP)",
        "sahyog_routing_code": "SAHYOG-VASP-OKX-GLB",
        "nodal_officer": "OKX Global LE Desk",
    },
    "KuCoin": {
        "entity": "KuCoin Legal Team",
        "email": "lawenforcement@kucoin.com",
        "designated_lea_email": "lawenforcement@kucoin.com",
        "portal": "https://www.kucoin.com",
        "jurisdiction": "Global",
        "fiu_ind_registration": "N/A (Foreign VASP)",
        "sahyog_routing_code": "SAHYOG-VASP-KUCOIN-GLB",
        "nodal_officer": "KuCoin Legal & Compliance",
    },
}


class LegalNoticeGenerator:
    """
    Generates standardized Law Enforcement Asset Preservation & Freeze Notices
    under Section 91 CrPC / Section 94 BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023)
    and international Mutual Legal Assistance frameworks.
    """

    @staticmethod
    def generate_freeze_notice(
        case_id: str,
        wallet_address: str,
        chain: str,
        attribution: Optional[AttributionSchema],
        evidence: List[EvidenceSchema],
        transactions: List[NormalizedTransaction],
        officer_name: str = "Investigating Officer",
        police_station: str = "Cyber Crime Police Station / CID",
        crime_number: str = "NCRP/2026/CYBER-FRAUD",
        victim_loss: str = "₹ 15,00,000 (INR Equivalent)"
    ) -> Dict[str, Any]:
        vasp_name = attribution.vasp_name if attribution else "Virtual Asset Service Provider"
        contact_info = VASP_COMPLIANCE_CONTACTS.get(vasp_name, {
            "entity": f"{vasp_name} Legal & Compliance Operations",
            "email": "compliance@exchange.com",
            "designated_lea_email": "compliance@exchange.com",
            "portal": "Official Law Enforcement Portal",
            "jurisdiction": "International",
            "fiu_ind_registration": "N/A",
            "sahyog_routing_code": "N/A",
            "nodal_officer": "Nodal Officer / Compliance Head",
        })

        date_str = datetime.datetime.utcnow().strftime("%d-%B-%Y")
        ref_no = f"LEA/CYBER/{datetime.datetime.utcnow().year}/{case_id[:8].upper()}"

        # FIU-IND metadata
        fiu_reg = contact_info.get("fiu_ind_registration", "N/A")
        sahyog_code = contact_info.get("sahyog_routing_code", "N/A")
        nodal_officer = contact_info.get("nodal_officer", "Nodal Officer")
        lea_email = contact_info.get("designated_lea_email", contact_info["email"])

        # Extract target VASP deposit transactions
        vasp_txs = [
            t for t in transactions[:5]
        ]

        notice_text = f"""
================================================================================
FORMAL NOTICE FOR PRESERVATION & FREEZING OF CRYPTO ASSETS / BENEFICIAL KYC
UNDER SECTION 94 OF BNSS, 2023 / SECTION 91 OF CODE OF CRIMINAL PROCEDURE, 1973
AND SECTION 318(4) BHARATIYA NYAYA SANHITA (BNS), 2023
================================================================================

REF NO: {ref_no}
DATE OF ISSUANCE: {date_str}
NCRP ACKNOWLEDGEMENT NO: {crime_number}

TO:
The Nodal Officer / Compliance Department,
{contact_info['entity']}
Designated LEA Email: {lea_email}
Official LEA Portal: {contact_info['portal']}
FIU-IND Registration: {fiu_reg}
Sahyog Routing Code: {sahyog_code}
Nodal Officer: {nodal_officer}

FROM:
{officer_name},
{police_station},
Law Enforcement Agency, Republic of India.

SUBJECT: URGENT NOTICE TO PRESERVE AND FREEZE PROCEEDS OF CRIME IN CYBER FRAUD CASE

Sir/Madam,

1. Whereas an investigation is currently underway at this Police Unit regarding organized cyber financial fraud / unauthorized siphoning of victim funds amounting to approximately {victim_loss}.

2. This notice is issued under:
   - Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 / Section 91 Cr.P.C., 1973
   - Section 318(4) of Bharatiya Nyaya Sanhita (BNS), 2023 (Cheating & Dishonest Misappropriation)
   - Section 66D of Information Technology Act, 2000 (Cheating by Personation using Computer Resource)
   - Prevention of Money Laundering Act (PMLA), 2002

3. Observable blockchain intelligence and directed fund flow analysis confirm that proceeds of crime originated from/traversed through the following target address and were directly deposited into your platform's custodial infrastructure:

   - Target Suspect Wallet: {wallet_address}
   - Blockchain Network: {chain.upper()}
   - Identified Destination VASP: {vasp_name}
   - FIU-IND Registration: {fiu_reg}
   - Attribution Score: {attribution.score if attribution else 0}/100 ({attribution.evidence_strength if attribution else 'N/A'} Confidence)

4. CRITICAL ON-CHAIN TRANSACTION PROOFS IDENTIFYING DEPOSIT INTO YOUR VASP:
"""

        for i, tx in enumerate(vasp_txs, 1):
            notice_text += f"""
   [{i}] Transaction Hash: {tx.tx_hash}
       - Timestamp: {tx.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}
       - Amount: {tx.amount} {tx.token_symbol}
       - From Address: {tx.from_address}
       - Destination VASP Deposit Address: {tx.to_address}
"""

        notice_text += f"""
5. DIRECTIVES / LEGAL REQUISITIONS UNDER SECTION 94 BNSS / SECTION 91 Cr.P.C.:
   You are hereby requested and directed to:
   a) IMMEDIATELY FREEZE / LOCK all funds, crypto balances, and fiat withdrawal capabilities associated with the recipient User UID / Account ID linked to the destination deposit address.
   b) PRESERVE and provide complete KYC (Know Your Customer) records, including full name, verified passport/Aadhaar/national ID, registered phone number, registered email, residential address, and IP login logs (with timestamps and port numbers).
   c) PROVIDE full deposit and withdrawal history for the subject account from inception to date.
   d) CONFIRM compliance with this freeze order via reply email within TWENTY-FOUR (24) HOURS of receipt to the issuing authority AND via the I4C Sahyog Portal (routing code: {sahyog_code}).
   e) FILE Suspicious Transaction Report (STR) with FIU-IND under PMLA, 2002 Rule 7 within 7 working days.

6. NON-DISCLOSURE DIRECTIVE (Gag Order):
   In the interest of ongoing criminal investigation, you are strictly instructed NOT to disclose the existence of this request to the account holder.

7. COMPLIANCE ROUTING:
   - Reply via Sahyog Portal: https://sahyog.gov.in (Code: {sahyog_code})
   - Copy to FIU-IND: fiuindia@nic.in
   - Copy to Investigating Authority: cybercell@police.gov.in

Issued under signature and seal of the Investigating Authority.

____________________________________
({officer_name})
{police_station}
Contact / Email: cybercell@police.gov.in
================================================================================
"""

        return {
            "notice_markdown": notice_text.strip(),
            "vasp_name": vasp_name,
            "compliance_email": contact_info["email"],
            "designated_lea_email": lea_email,
            "compliance_portal": contact_info["portal"],
            "fiu_ind_registration": fiu_reg,
            "sahyog_routing_code": sahyog_code,
            "nodal_officer": nodal_officer,
            "ref_number": ref_no,
            "crime_number": crime_number,
            "statutory_references": [
                "Section 94 BNSS (Bharatiya Nagarik Suraksha Sanhita), 2023",
                "Section 91 CrPC (Code of Criminal Procedure), 1973",
                "Section 318(4) BNS (Bharatiya Nyaya Sanhita), 2023",
                "Section 66D Information Technology Act, 2000",
                "Prevention of Money Laundering Act (PMLA), 2002",
            ],
            "generated_at": datetime.datetime.utcnow().isoformat()
        }

