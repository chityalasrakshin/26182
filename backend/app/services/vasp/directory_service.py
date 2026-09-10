"""
VASP Directory & Mock SAHYOG Dispatch Service.
Phase 6: Mock SAHYOG / VASP Directory.

Provides:
- In-memory and persistent database registry of VASP compliance entities.
- Seed data covering 16 major VASPs with FIU registrations, SLAs, and routing codes.
- Query and lookup functions for lawful disclosure requests.
"""

import json
import logging
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from backend.app.models.database import VASPDirectory, AsyncSessionLocal

logger = logging.getLogger("vasp.directory")


SEED_VASP_DIRECTORY_DATA: List[Dict[str, Any]] = [
    {
        "name": "Binance",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / FIU-IND Registered",
        "country": "Global",
        "known_deposit_cluster_labels": ["binance_hot_wallet", "binance_deposit_cluster", "binance_erc20_gateway", "binance_trc20_pool"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/binance/dispatch",
        "mock_response_sla": "24 Hours (Emergency Statutory Freeze)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/BIN-001",
        "sahyog_routing_code": "SAHYOG-VASP-BINANCE-GLB",
        "compliance_email": "case-management@binance.com",
        "designated_lea_email": "lawenforcement@binance.com",
        "compliance_portal": "https://www.binance.com/en/support/law-enforcement",
        "nodal_officer": "Binance Global LE Desk",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "WazirX",
        "category": "Centralized Exchange",
        "jurisdiction": "India (FIU-IND Registered)",
        "country": "India",
        "known_deposit_cluster_labels": ["wazirx_hot_wallet", "wazirx_deposit_eth", "wazirx_tron_collector"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/wazirx/dispatch",
        "mock_response_sla": "24 Hours (Domestic Court Order)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/WZX-002",
        "sahyog_routing_code": "SAHYOG-VASP-WAZIRX-IND",
        "compliance_email": "lawenforcement@wazirx.com",
        "designated_lea_email": "nodalofficer@wazirx.com",
        "compliance_portal": "https://wazirx.com/law-enforcement",
        "nodal_officer": "Rajagopal Menon, VP & Nodal Officer",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "CoinDCX",
        "category": "Centralized Exchange",
        "jurisdiction": "India (FIU-IND Registered)",
        "country": "India",
        "known_deposit_cluster_labels": ["coindcx_hot_storage", "coindcx_user_deposit", "coindcx_usdt_clearing"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/coindcx/dispatch",
        "mock_response_sla": "24 Hours (Statutory Requisition)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/CDX-003",
        "sahyog_routing_code": "SAHYOG-VASP-COINDCX-IND",
        "compliance_email": "compliance@coindcx.com",
        "designated_lea_email": "lawenforcement@coindcx.com",
        "compliance_portal": "https://coindcx.com/legal",
        "nodal_officer": "CoinDCX Compliance & Legal Team",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "ZebPay",
        "category": "Centralized Exchange",
        "jurisdiction": "India (FIU-IND Registered)",
        "country": "India",
        "known_deposit_cluster_labels": ["zebpay_hot_wallet", "zebpay_customer_inflow"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/zebpay/dispatch",
        "mock_response_sla": "24 Hours (Domestic Directive)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/ZBP-004",
        "sahyog_routing_code": "SAHYOG-VASP-ZEBPAY-IND",
        "compliance_email": "compliance@zebpay.com",
        "designated_lea_email": "lawenforcement@zebpay.com",
        "compliance_portal": "https://zebpay.com/legal",
        "nodal_officer": "ZebPay Nodal Officer & Compliance Head",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "Mudrex",
        "category": "Centralized Exchange",
        "jurisdiction": "India (FIU-IND Registered)",
        "country": "India",
        "known_deposit_cluster_labels": ["mudrex_omnibus_wallet", "mudrex_deposit_pool"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/mudrex/dispatch",
        "mock_response_sla": "24 Hours (Statutory Compliance)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/MDX-005",
        "sahyog_routing_code": "SAHYOG-VASP-MUDREX-IND",
        "compliance_email": "compliance@mudrex.com",
        "designated_lea_email": "lawenforcement@mudrex.com",
        "compliance_portal": "https://mudrex.com/legal",
        "nodal_officer": "Mudrex Compliance & Legal Operations",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "Coinbase",
        "category": "Centralized Exchange",
        "jurisdiction": "United States / Global",
        "country": "United States",
        "known_deposit_cluster_labels": ["coinbase_prime_cold", "coinbase_deposit_sweep", "coinbase_commerce_inflow"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/coinbase/dispatch",
        "mock_response_sla": "48 Hours (MLAT / International Requisition)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-COINBASE-US",
        "compliance_email": "lawenforcement@coinbase.com",
        "designated_lea_email": "lawenforcement@coinbase.com",
        "compliance_portal": "https://www.coinbase.com/legal/law-enforcement",
        "nodal_officer": "Coinbase Global LE Response Team",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Kraken",
        "category": "Centralized Exchange",
        "jurisdiction": "United States / Global",
        "country": "United States",
        "known_deposit_cluster_labels": ["kraken_hot_storage", "kraken_user_deposit"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/kraken/dispatch",
        "mock_response_sla": "48 Hours (Cross-Border Subpoena)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-KRAKEN-GLB",
        "compliance_email": "compliance@kraken.com",
        "designated_lea_email": "lawenforcement@kraken.com",
        "compliance_portal": "https://www.kraken.com/legal",
        "nodal_officer": "Kraken Legal & Compliance Desk",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "OKX",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / Seychelles",
        "country": "Seychelles",
        "known_deposit_cluster_labels": ["okx_hot_wallet", "okx_deposit_hub", "okx_tron_inflow"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/okx/dispatch",
        "mock_response_sla": "24 Hours (FIU Registered Cross-Border)",
        "fiu_registration_number": "FIU-IND/VDA/REG/2024/OKX-006",
        "sahyog_routing_code": "SAHYOG-VASP-OKX-GLB",
        "compliance_email": "compliance@okx.com",
        "designated_lea_email": "lawenforcement@okx.com",
        "compliance_portal": "https://www.okx.com/help",
        "nodal_officer": "OKX Global LE Desk",
        "is_fiu_registered": True,
        "is_simulated": True,
    },
    {
        "name": "KuCoin",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / Seychelles",
        "country": "Seychelles",
        "known_deposit_cluster_labels": ["kucoin_hot_pool", "kucoin_deposit_wallet"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/kucoin/dispatch",
        "mock_response_sla": "48 Hours (International Preservation)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-KUCOIN-GLB",
        "compliance_email": "lawenforcement@kucoin.com",
        "designated_lea_email": "lawenforcement@kucoin.com",
        "compliance_portal": "https://www.kucoin.com",
        "nodal_officer": "KuCoin Legal & Compliance",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Bybit",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / UAE",
        "country": "United Arab Emirates",
        "known_deposit_cluster_labels": ["bybit_hot_wallet", "bybit_deposit_sweep"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/bybit/dispatch",
        "mock_response_sla": "48 Hours (International LE Directive)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-BYBIT-GLB",
        "compliance_email": "compliance@bybit.com",
        "designated_lea_email": "lawenforcement@bybit.com",
        "compliance_portal": "https://www.bybit.com",
        "nodal_officer": "Bybit LE Operations",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Bitfinex",
        "category": "Centralized Exchange",
        "jurisdiction": "British Virgin Islands",
        "country": "British Virgin Islands",
        "known_deposit_cluster_labels": ["bitfinex_hot_wallet", "bitfinex_multisig_cold"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/bitfinex/dispatch",
        "mock_response_sla": "72 Hours (Offshore Preservation)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-BITFINEX-BVI",
        "compliance_email": "compliance@bitfinex.com",
        "designated_lea_email": "lawenforcement@bitfinex.com",
        "compliance_portal": "https://www.bitfinex.com/legal",
        "nodal_officer": "iFinex Legal Compliance",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Gate.io",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / Cayman Islands",
        "country": "Cayman Islands",
        "known_deposit_cluster_labels": ["gateio_hot_pool", "gateio_deposit_collector"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/gateio/dispatch",
        "mock_response_sla": "48 Hours (Standard Cross-Border)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-GATEIO-GLB",
        "compliance_email": "support@gate.io",
        "designated_lea_email": "lawenforcement@gate.io",
        "compliance_portal": "https://gate.io",
        "nodal_officer": "Gate Compliance Group",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "HTX",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / Seychelles",
        "country": "Seychelles",
        "known_deposit_cluster_labels": ["htx_hot_wallet", "htx_deposit_sweep"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/htx/dispatch",
        "mock_response_sla": "48 Hours (International Preservation)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-HTX-GLB",
        "compliance_email": "htxcompliance@htx-inc.com",
        "designated_lea_email": "lawenforcement@htx.com",
        "compliance_portal": "https://www.htx.com",
        "nodal_officer": "HTX Compliance Department",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Crypto.com",
        "category": "Centralized Exchange",
        "jurisdiction": "Global / Singapore",
        "country": "Singapore",
        "known_deposit_cluster_labels": ["cryptocom_hot_wallet", "cryptocom_deposit_address"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/cryptocom/dispatch",
        "mock_response_sla": "48 Hours (Regional Enforcement)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-CRYPTOCOM-SGP",
        "compliance_email": "lawenforcement@crypto.com",
        "designated_lea_email": "lawenforcement@crypto.com",
        "compliance_portal": "https://crypto.com",
        "nodal_officer": "Foris DAX Compliance",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Gemini",
        "category": "Centralized Exchange",
        "jurisdiction": "United States",
        "country": "United States",
        "known_deposit_cluster_labels": ["gemini_custody", "gemini_clearing_hot"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/gemini/dispatch",
        "mock_response_sla": "48 Hours (US Court Order / MLAT)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-GEMINI-US",
        "compliance_email": "compliance@gemini.com",
        "designated_lea_email": "lawenforcement@gemini.com",
        "compliance_portal": "https://www.gemini.com/legal",
        "nodal_officer": "Gemini Trust Legal Operations",
        "is_fiu_registered": False,
        "is_simulated": True,
    },
    {
        "name": "Bitstamp",
        "category": "Centralized Exchange",
        "jurisdiction": "Luxembourg / EU",
        "country": "Luxembourg",
        "known_deposit_cluster_labels": ["bitstamp_hot_pool", "bitstamp_deposit_cluster"],
        "mock_contact_endpoint": "https://sahyog.gov.in/api/v1/vasp/bitstamp/dispatch",
        "mock_response_sla": "48 Hours (EU MiCA / MLAT Requisition)",
        "fiu_registration_number": None,
        "sahyog_routing_code": "SAHYOG-VASP-BITSTAMP-EU",
        "compliance_email": "compliance@bitstamp.net",
        "designated_lea_email": "lawenforcement@bitstamp.net",
        "compliance_portal": "https://www.bitstamp.net",
        "nodal_officer": "Bitstamp Europe Compliance",
        "is_fiu_registered": False,
        "is_simulated": True,
    }
]


class VASPDirectoryService:
    """
    Manages the mock SAHYOG / VASP Compliance Directory.
    Enforces that all operations remain within the mock/simulated integration boundary.
    """

    @staticmethod
    async def seed_directory(session: AsyncSession) -> int:
        """
        Seeds the vasp_directory table idempotently.
        Inserts new VASP records or updates existing records.
        """
        seeded_count = 0
        for item in SEED_VASP_DIRECTORY_DATA:
            stmt = select(VASPDirectory).where(VASPDirectory.name == item["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()

            labels_json = json.dumps(item.get("known_deposit_cluster_labels", []))
            if existing:
                # Update attributes
                existing.category = item["category"]
                existing.jurisdiction = item["jurisdiction"]
                existing.country = item["country"]
                existing.known_deposit_cluster_labels = labels_json
                existing.mock_contact_endpoint = item["mock_contact_endpoint"]
                existing.mock_response_sla = item["mock_response_sla"]
                existing.fiu_registration_number = item["fiu_registration_number"]
                existing.sahyog_routing_code = item["sahyog_routing_code"]
                existing.compliance_email = item["compliance_email"]
                existing.designated_lea_email = item["designated_lea_email"]
                existing.compliance_portal = item["compliance_portal"]
                existing.nodal_officer = item["nodal_officer"]
                existing.is_fiu_registered = item["is_fiu_registered"]
                existing.is_simulated = True
            else:
                new_entry = VASPDirectory(
                    name=item["name"],
                    category=item["category"],
                    jurisdiction=item["jurisdiction"],
                    country=item["country"],
                    known_deposit_cluster_labels=labels_json,
                    mock_contact_endpoint=item["mock_contact_endpoint"],
                    mock_response_sla=item["mock_response_sla"],
                    fiu_registration_number=item["fiu_registration_number"],
                    sahyog_routing_code=item["sahyog_routing_code"],
                    compliance_email=item["compliance_email"],
                    designated_lea_email=item["designated_lea_email"],
                    compliance_portal=item["compliance_portal"],
                    nodal_officer=item["nodal_officer"],
                    is_fiu_registered=item["is_fiu_registered"],
                    is_simulated=True
                )
                session.add(new_entry)
                seeded_count += 1

        await session.commit()
        logger.info(f"VASP directory seeded successfully: {seeded_count} newly added entries.")
        return seeded_count

    @staticmethod
    async def get_directory(
        session: AsyncSession,
        search: Optional[str] = None,
        fiu_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Retrieves VASP directory records with optional search and FIU registration filter.
        """
        stmt = select(VASPDirectory)
        if fiu_only:
            stmt = stmt.where(VASPDirectory.is_fiu_registered == True)
        if search:
            q = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    VASPDirectory.name.ilike(q),
                    VASPDirectory.jurisdiction.ilike(q),
                    VASPDirectory.country.ilike(q),
                    VASPDirectory.sahyog_routing_code.ilike(q)
                )
            )

        stmt = stmt.order_by(VASPDirectory.is_fiu_registered.desc(), VASPDirectory.name.asc())
        res = await session.execute(stmt)
        records = res.scalars().all()

        results = []
        for r in records:
            try:
                cluster_labels = json.loads(r.known_deposit_cluster_labels or "[]")
            except Exception:
                cluster_labels = []

            results.append({
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "jurisdiction": r.jurisdiction,
                "country": r.country,
                "known_deposit_cluster_labels": cluster_labels,
                "mock_contact_endpoint": r.mock_contact_endpoint,
                "mock_response_sla": r.mock_response_sla,
                "contact_endpoint": r.mock_contact_endpoint,
                "response_sla": r.mock_response_sla,
                "fiu_registration_number": r.fiu_registration_number,
                "sahyog_routing_code": r.sahyog_routing_code,
                "compliance_email": r.compliance_email,
                "designated_lea_email": r.designated_lea_email,
                "compliance_portal": r.compliance_portal,
                "nodal_officer": r.nodal_officer,
                "is_fiu_registered": r.is_fiu_registered,
                "is_simulated": r.is_simulated,
                "created_at": r.created_at,
            })
        return results

    @staticmethod
    async def get_by_name(session: AsyncSession, name: str) -> Optional[Dict[str, Any]]:
        """
        Looks up a single VASP directory entry by name (case-insensitive substring/prefix match).
        """
        clean_name = name.strip().lower()
        stmt = select(VASPDirectory).where(VASPDirectory.name.ilike(clean_name))
        res = await session.execute(stmt)
        record = res.scalar_one_or_none()

        if not record:
            # Try prefix match (e.g. "Binance Tron" -> "Binance")
            for prefix in ["binance", "wazirx", "coindcx", "coinbase", "okx", "kraken", "kucoin", "bybit", "bitfinex", "gate", "htx", "crypto", "gemini", "bitstamp", "zebpay", "mudrex"]:
                if prefix in clean_name:
                    stmt = select(VASPDirectory).where(VASPDirectory.name.ilike(f"%{prefix}%"))
                    res = await session.execute(stmt)
                    record = res.scalars().first()
                    if record:
                        break

        if not record:
            return None

        try:
            cluster_labels = json.loads(record.known_deposit_cluster_labels or "[]")
        except Exception:
            cluster_labels = []

        return {
            "id": record.id,
            "name": record.name,
            "category": record.category,
            "jurisdiction": record.jurisdiction,
            "country": record.country,
            "known_deposit_cluster_labels": cluster_labels,
            "mock_contact_endpoint": record.mock_contact_endpoint,
            "mock_response_sla": record.mock_response_sla,
            "contact_endpoint": record.mock_contact_endpoint,
            "response_sla": record.mock_response_sla,
            "fiu_registration_number": record.fiu_registration_number,
            "sahyog_routing_code": record.sahyog_routing_code,
            "compliance_email": record.compliance_email,
            "designated_lea_email": record.designated_lea_email,
            "compliance_portal": record.compliance_portal,
            "nodal_officer": record.nodal_officer,
            "is_fiu_registered": record.is_fiu_registered,
            "is_simulated": record.is_simulated,
            "created_at": record.created_at,
        }


directory_service = VASPDirectoryService()
