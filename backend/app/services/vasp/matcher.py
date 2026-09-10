import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from datetime import datetime

from backend.app.core.config import settings
from backend.app.core.address_validator import is_valid_crypto_address, normalize_address, detect_blockchain
from backend.app.schemas.analysis import VASPSchema, VASPAddressSchema

logger = logging.getLogger("vasp.matcher")

# ---------------------------------------------------------------------------
# Multi-Category Classification Constants
# ---------------------------------------------------------------------------
CATEGORY_CENTRALIZED_EXCHANGE = "CENTRALIZED_EXCHANGE"
CATEGORY_INSTANT_SWAP_NON_KYC = "INSTANT_SWAP_NON_KYC"
CATEGORY_SANCTIONED_ENTITY = "SANCTIONED_ENTITY"
CATEGORY_PHISHING_DRAINER = "PHISHING_DRAINER"
CATEGORY_MIXER = "MIXER"
CATEGORY_DEFI = "DEFI"
CATEGORY_BRIDGE = "BRIDGE"
CATEGORY_UNKNOWN = "UNKNOWN"

# Map label store categories to standardized matcher categories
_CATEGORY_MAP = {
    "exchange": CATEGORY_CENTRALIZED_EXCHANGE,
    "centralized exchange": CATEGORY_CENTRALIZED_EXCHANGE,
    "instant_swap_non_kyc": CATEGORY_INSTANT_SWAP_NON_KYC,
    "sanctioned": CATEGORY_SANCTIONED_ENTITY,
    "scam": CATEGORY_PHISHING_DRAINER,
    "phishing": CATEGORY_PHISHING_DRAINER,
    "mixer": CATEGORY_MIXER,
    "defi": CATEGORY_DEFI,
    "bridge": CATEGORY_BRIDGE,
}


def classify_category(raw_category: str) -> str:
    """Maps raw category strings to standardized multi-category constants."""
    if not raw_category:
        return CATEGORY_CENTRALIZED_EXCHANGE
    return _CATEGORY_MAP.get(raw_category.lower().strip(), CATEGORY_CENTRALIZED_EXCHANGE)


class VASPMatcher:
    """
    High-performance, multi-chain VASP address matching engine.
    Maintains O(1) in-memory indices for (chain, address) and address lookups.
    """

    def __init__(self, data_path: Optional[Path] = None):
        master_path = settings.VASP_DATA_PATH.parent / "vasp_addresses_master.csv"
        self.data_path = master_path if master_path.exists() else settings.VASP_DATA_PATH
        
        # In-memory indices
        self._chain_address_map: Dict[tuple, Dict[str, Any]] = {}
        self._address_map: Dict[str, Dict[str, Any]] = {}
        self._vasp_map: Dict[str, Dict[str, Any]] = {}
        self._loaded = False

    def load_seed_data(self) -> int:
        """
        Loads curated VASP address dataset into high-speed in-memory hash tables.
        """
        if not self.data_path.exists():
            logger.warning(f"VASP master seed file not found at {self.data_path}")
            return 0

        loaded_count = 0
        with open(self.data_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                addr_raw = row.get("address", "").strip()
                if not is_valid_crypto_address(addr_raw):
                    continue

                norm_addr = normalize_address(addr_raw)
                chain = row.get("chain", "").strip().lower() or detect_blockchain(addr_raw)
                vasp_name = row.get("vasp_name", "").strip()
                address_type = row.get("address_type", "hot_wallet").strip()
                source_name = row.get("source_name") or row.get("source") or "Curated Registry"
                source_url = row.get("source_url", "")
                source_type = row.get("source_type", "blockchain explorer public label")
                ver_status = row.get("verification_status", "verified")
                confidence = row.get("confidence", "HIGH")
                conf_score = float(row.get("confidence_score", 95.0) or 95.0)
                notes = row.get("notes", "")
                raw_cat = row.get("category", "exchange")
                category = classify_category(raw_cat)

                vasp_info = {
                    "vasp_name": vasp_name,
                    "address": norm_addr,
                    "chain": chain,
                    "address_type": address_type,
                    "category": category,
                    "source": source_name,
                    "source_name": source_name,
                    "source_url": source_url,
                    "source_type": source_type,
                    "verification_status": ver_status,
                    "confidence": confidence,
                    "confidence_score": conf_score,
                    "notes": notes,
                    "last_verified_at": row.get("last_verified_at", "2026-08-25 00:00:00")
                }

                # Primary O(1) indices
                self._chain_address_map[(chain, norm_addr)] = vasp_info
                self._address_map[norm_addr] = vasp_info

                if vasp_name not in self._vasp_map:
                    self._vasp_map[vasp_name] = {
                        "name": vasp_name,
                        "category": category,
                        "addresses": []
                    }
                self._vasp_map[vasp_name]["addresses"].append(vasp_info)
                loaded_count += 1

        loaded_count += self._load_solana_seeds()
        loaded_count += self._load_instant_swaps()
        loaded_count += self._load_threat_intel()
        loaded_count += self._load_etherscan_labels()
        self._loaded = True
        logger.info(f"Loaded {loaded_count} verified VASP & threat intelligence addresses across {len(self._vasp_map)} entities (total unique addresses: {len(self._address_map)}).")
        return len(self._address_map)

    def _load_instant_swaps(self) -> int:
        """Loads non-KYC instant swap desks with legal compliance contacts."""
        swaps_file = self.data_path.parent.parent / "labels" / "instant_swaps.json"
        if not swaps_file.exists():
            return 0
        count = 0
        try:
            import json
            with open(swaps_file, "r", encoding="utf-8") as f:
                records = json.load(f)
            for item in records:
                raw_addr = item.get("address", "")
                if not is_valid_crypto_address(raw_addr):
                    continue
                norm_addr = normalize_address(raw_addr)
                chain = item.get("chain", "ethereum").lower()
                entity = item.get("entity", "Instant Swap Desk")
                category = CATEGORY_INSTANT_SWAP_NON_KYC
                info = {
                    "vasp_name": entity,
                    "address": norm_addr,
                    "chain": chain,
                    "address_type": item.get("entity_type", "Instant Swap Router"),
                    "category": category,
                    "source": item.get("source_name", "Instant Swap Registry"),
                    "source_name": item.get("source_name", "Instant Swap Registry"),
                    "source_url": item.get("portal", "https://fixedfloat.com"),
                    "source_type": "official instant exchange infrastructure",
                    "verification_status": "verified",
                    "confidence": "HIGH",
                    "confidence_score": float(item.get("confidence_score", 95.0)),
                    "compliance_email": item.get("compliance_email"),
                    "designated_lea_email": item.get("designated_lea_email"),
                    "sahyog_routing_code": item.get("sahyog_routing_code"),
                    "notes": item.get("notes", "Non-KYC Instant Swap Node"),
                    "last_verified_at": "2026-08-25 00:00:00"
                }
                self._chain_address_map[(chain, norm_addr)] = info
                self._address_map[norm_addr] = info
                if entity not in self._vasp_map:
                    self._vasp_map[entity] = {
                        "name": entity,
                        "category": category,
                        "addresses": []
                    }
                self._vasp_map[entity]["addresses"].append(info)
                count += 1
        except Exception as e:
            logger.warning(f"Failed to load instant swaps in matcher: {e}")
        return count

    def _load_threat_intel(self) -> int:
        """Loads ScamSniffer drainers and OFAC SDN sanctions into multi-category indices."""
        labels_dir = self.data_path.parent.parent / "labels"
        count = 0
        import json

        # 1. ScamSniffer Blacklist
        scam_file = labels_dir / "scamsniffer_blacklist.json"
        if scam_file.exists():
            try:
                with open(scam_file, "r", encoding="utf-8") as f:
                    records = json.load(f)
                for item in records:
                    raw_addr = item.get("address", "")
                    if not is_valid_crypto_address(raw_addr):
                        continue
                    norm_addr = normalize_address(raw_addr)
                    chain = item.get("chain", "ethereum").lower()
                    entity = item.get("entity", "ScamSniffer Phishing Drainer")
                    category = CATEGORY_PHISHING_DRAINER
                    info = {
                        "vasp_name": entity,
                        "address": norm_addr,
                        "chain": chain,
                        "address_type": "phishing_drainer",
                        "category": category,
                        "source": item.get("source_name", "ScamSniffer Web3 Blacklist"),
                        "source_name": item.get("source_name", "ScamSniffer Web3 Blacklist"),
                        "source_url": item.get("source_url", "https://github.com/scamsniffer/scam-database"),
                        "source_type": "threat intelligence blacklist",
                        "verification_status": "verified",
                        "confidence": "HIGH",
                        "confidence_score": 98.0,
                        "notes": item.get("notes", "ScamSniffer Flagged Malicious Drainer"),
                        "last_verified_at": "2026-08-25 00:00:00"
                    }
                    self._chain_address_map[(chain, norm_addr)] = info
                    self._address_map[norm_addr] = info
                    count += 1
            except Exception as e:
                logger.warning(f"Failed to load ScamSniffer in matcher: {e}")

        # 2. OFAC SDN Sanctions
        ofac_file = labels_dir / "ofac_sdn.json"
        if ofac_file.exists():
            try:
                with open(ofac_file, "r", encoding="utf-8") as f:
                    records = json.load(f)
                for item in records:
                    raw_addr = item.get("address", "")
                    if not is_valid_crypto_address(raw_addr):
                        continue
                    norm_addr = normalize_address(raw_addr)
                    chain = item.get("chain", "ethereum").lower()
                    entity = item.get("entity", "OFAC Sanctioned Entity")
                    category = CATEGORY_SANCTIONED_ENTITY
                    info = {
                        "vasp_name": entity,
                        "address": norm_addr,
                        "chain": chain,
                        "address_type": "sanctioned_wallet",
                        "category": category,
                        "source": "US OFAC SDN List",
                        "source_name": "US OFAC SDN Digital Currency List",
                        "source_url": "https://ofac.treasury.gov",
                        "source_type": "statutory sanctions designation",
                        "verification_status": "verified",
                        "confidence": "HIGH",
                        "confidence_score": 100.0,
                        "notes": item.get("notes", "OFAC Sanctioned Address"),
                        "last_verified_at": "2026-08-25 00:00:00"
                    }
                    self._chain_address_map[(chain, norm_addr)] = info
                    self._address_map[norm_addr] = info
                    count += 1
            except Exception as e:
                logger.warning(f"Failed to load OFAC in matcher: {e}")

        return count

    def _load_etherscan_labels(self) -> int:
        """Loads expanded high-confidence Etherscan exchange and infrastructure labels."""
        eth_file = self.data_path.parent.parent / "labels" / "etherscan_labels.json"
        if not eth_file.exists():
            return 0
        count = 0
        try:
            import json
            with open(eth_file, "r", encoding="utf-8") as f:
                records = json.load(f)
            for item in records:
                raw_addr = item.get("address", "")
                if not is_valid_crypto_address(raw_addr):
                    continue
                norm_addr = normalize_address(raw_addr)
                entity = item.get("entity", "Etherscan Labeled Entity")
                raw_cat = item.get("category", "exchange")

                # Skip burn, null, zero, and unhosted test addresses
                if entity.lower().startswith("null:") or raw_cat.lower() in ("null", "burn"):
                    continue
                if norm_addr in (
                    "0x0000000000000000000000000000000000000000",
                    "0x000000000000000000000000000000000000dead",
                    "0x0000000000000000000000000000000000000002",
                    "0x0000000000000000000000000000000000000003",
                    "0x0000000000000000000000000000000000000004",
                    "0x0000000000000000000000000000000000000005",
                    "0x0000000000000000000000000000000000000006",
                    "0x0000000000000000000000000000000000000007",
                    "0x0000000000000000000000000000000000000008",
                    "0x0000000000000000000000000000000000000009",
                    "0x1111111111111111111111111111111111111111",
                    "0x2222222222222222222222222222222222222222",
                    "0x3333333333333333333333333333333333333333",
                    "0x4444444444444444444444444444444444444444",
                    "0x6666666666666666666666666666666666666666",
                    "0x8888888888888888888888888888888888888888",
                    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                    "0xffffffffffffffffffffffffffffffffffffffff",
                ):
                    continue

                # Don't overwrite higher-priority master / instant swaps / OFAC
                if norm_addr in self._address_map:
                    continue
                chain = item.get("chain", "ethereum").lower()
                category = classify_category(raw_cat)
                info = {
                    "vasp_name": entity,
                    "address": norm_addr,
                    "chain": chain,
                    "address_type": item.get("entity_type", "labeled_account"),
                    "category": category,
                    "source": item.get("source_name", "Etherscan Verified Labels"),
                    "source_name": item.get("source_name", "Etherscan Verified Labels"),
                    "source_url": item.get("source_url", "https://etherscan.io"),
                    "source_type": "blockchain explorer public label",
                    "verification_status": "verified",
                    "confidence": "HIGH",
                    "confidence_score": float(item.get("confidence_score", 92.0)),
                    "notes": item.get("notes", ""),
                    "last_verified_at": "2026-08-25 00:00:00"
                }
                self._chain_address_map[(chain, norm_addr)] = info
                self._address_map[norm_addr] = info
                if entity not in self._vasp_map:
                    self._vasp_map[entity] = {
                        "name": entity,
                        "category": category,
                        "addresses": []
                    }
                self._vasp_map[entity]["addresses"].append(info)
                count += 1
        except Exception as e:
            logger.warning(f"Failed to load Etherscan labels in matcher: {e}")
        return count

    def _load_solana_seeds(self) -> int:
        """Loads verified Solana VASP addresses into matcher indices."""
        solana_seeds = [
            # Binance Solana Hot Wallets
            ("5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe", "solana", "Binance", "hot_wallet", "Binance Solana Hot Wallet 1"),
            ("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "solana", "Binance", "hot_wallet", "Binance Solana Hot Wallet 2"),
            # Coinbase Solana Hot Wallets
            ("2AQdpHJ2JpcEgBtAZubqznPUwhG13nM69qKEmaJ13G3b", "solana", "Coinbase", "prime_custody", "Coinbase Solana Prime Custody"),
            ("H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS", "solana", "Coinbase", "cold_storage", "Coinbase Solana Cold Storage"),
            # Kraken Solana Hot Wallets
            ("FWznbcNXWQuHTawe9RxvQ2LdJF24zVnSZTGpzZMnLnh8", "solana", "Kraken", "hot_wallet", "Kraken Solana Hot Wallet"),
            # OKX Solana Deposit Wallet
            ("5VCwKtCXgCJ6kit5FybXjvmsWnGn6XZ8NFgkWDV1b63X", "solana", "OKX", "hot_wallet", "OKX Solana Hot Wallet"),
            # Bybit Solana
            ("AC5RDfQFmDS1deWZos921qqvw3LNo8KSmCHbZc2gHSU8", "solana", "Bybit", "hot_wallet", "Bybit Solana Hot Wallet"),
        ]

        count = 0
        for raw_addr, chain, vasp_name, addr_type, notes in solana_seeds:
            norm_addr = normalize_address(raw_addr)
            info = {
                "vasp_name": vasp_name,
                "address": norm_addr,
                "chain": chain,
                "address_type": addr_type,
                "category": CATEGORY_CENTRALIZED_EXCHANGE,
                "source": "Solana Verified VASP Registry",
                "source_name": "Solana Verified VASP Registry",
                "source_url": "https://solscan.io",
                "source_type": "blockchain explorer public label",
                "verification_status": "verified",
                "confidence": "HIGH",
                "confidence_score": 98.0,
                "notes": notes,
                "last_verified_at": "2026-08-25 00:00:00"
            }
            self._chain_address_map[(chain, norm_addr)] = info
            self._address_map[norm_addr] = info

            if vasp_name not in self._vasp_map:
                self._vasp_map[vasp_name] = {
                    "name": vasp_name,
                    "category": CATEGORY_CENTRALIZED_EXCHANGE,
                    "addresses": []
                }
            self._vasp_map[vasp_name]["addresses"].append(info)
            count += 1
        return count

    def match_address(self, address: str, chain: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Fast O(1) lookup to check if an address belongs to a known VASP cluster.
        """
        if not self._loaded:
            self.load_seed_data()

        if not address:
            return None

        norm_addr = normalize_address(address)
        if chain:
            res = self._chain_address_map.get((chain.lower(), norm_addr))
            if res:
                return res

        return self._address_map.get(norm_addr)

    def is_vasp(self, address: str, chain: Optional[str] = None) -> bool:
        """Alias for is_vasp_address."""
        return self.is_vasp_address(address, chain)

    def is_vasp_address(self, address: str, chain: Optional[str] = None) -> bool:
        return self.match_address(address, chain) is not None

    def is_known_vasp(self, address: str, chain: Optional[str] = None) -> bool:
        """Alias for is_vasp_address for backwards compatibility."""
        return self.is_vasp_address(address, chain)

    def get_vasp_name(self, address: str, chain: Optional[str] = None) -> Optional[str]:
        match = self.match_address(address, chain)
        return match["vasp_name"] if match else None

    def get_category(self, address: str, chain: Optional[str] = None) -> Optional[str]:
        """Returns the standardized category for a matched address."""
        match = self.match_address(address, chain)
        return match.get("category", CATEGORY_UNKNOWN) if match else None

    def get_addresses_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Returns all addresses matching a specific category."""
        if not self._loaded:
            self.load_seed_data()
        return [v for v in self._address_map.values() if v.get("category") == category]

    def get_all_addresses(self) -> List[Dict[str, Any]]:
        """Returns flat list of all indexed VASP address dictionaries."""
        if not self._loaded:
            self.load_seed_data()
        return list(self._address_map.values())

    def get_all_vasps(self) -> List[VASPSchema]:
        if not self._loaded:
            self.load_seed_data()

        output = []
        for vasp_name, data in self._vasp_map.items():
            addr_schemas = [
                VASPAddressSchema(
                    address=a["address"],
                    chain=a["chain"],
                    address_type=a["address_type"],
                    source=a.get("source_name", a.get("source", "Verified")),
                    confidence=a["confidence"],
                    notes=a.get("notes")
                )
                for a in data["addresses"]
            ]
            output.append(
                VASPSchema(
                    name=vasp_name,
                    category=data["category"],
                    addresses=addr_schemas
                )
            )
        return output

    def get_stats(self) -> Dict[str, Any]:
        """Returns rich statistics on loaded VASP addresses."""
        if not self._loaded:
            self.load_seed_data()

        by_vasp = {vname: len(d["addresses"]) for vname, d in self._vasp_map.items()}
        by_chain: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        by_category: Dict[str, int] = {}

        for item in self._address_map.values():
            chain = item.get("chain", "unknown").upper()
            atype = item.get("address_type", "unknown")
            status = item.get("verification_status", "verified")
            category = item.get("category", CATEGORY_UNKNOWN)

            by_chain[chain] = by_chain.get(chain, 0) + 1
            by_type[atype] = by_type.get(atype, 0) + 1
            by_status[status] = by_status.get(status, 0) + 1
            by_category[category] = by_category.get(category, 0) + 1

        return {
            "total_addresses": len(self._address_map),
            "total_vasps": len(self._vasp_map),
            "by_vasp": by_vasp,
            "by_chain": by_chain,
            "by_type": by_type,
            "by_status": by_status,
            "by_category": by_category
        }

    async def sync_to_database(self, session: Any) -> int:
        """
        Synchronizes in-memory VASP registry to relational database if needed.
        """
        from backend.app.models.database import VASP, VASPAddress
        from sqlalchemy import select, func

        if not self._loaded:
            self.load_seed_data()

        existing_count = await session.scalar(select(func.count(VASPAddress.id))) or 0
        if existing_count > 0:
            return existing_count

        inserted = 0
        for vasp_name, vasp_data in self._vasp_map.items():
            result = await session.execute(select(VASP).where(VASP.name == vasp_name))
            db_vasp = result.scalar_one_or_none()
            if not db_vasp:
                db_vasp = VASP(
                    name=vasp_name,
                    category=vasp_data.get("category", "Centralized Exchange"),
                    risk_rating="LOW"
                )
                session.add(db_vasp)
                await session.flush()

            for a in vasp_data.get("addresses", []):
                db_addr = VASPAddress(
                    vasp_id=db_vasp.id,
                    address=a["address"],
                    chain=a["chain"],
                    address_type=a.get("address_type", "hot_wallet"),
                    source_name=a.get("source_name", "Curated Registry"),
                    source_url=a.get("source_url"),
                    source_type=a.get("source_type", "blockchain explorer public label"),
                    verification_status=a.get("verification_status", "verified"),
                    confidence=a.get("confidence", "HIGH"),
                    confidence_score=float(a.get("confidence_score", 95.0)),
                    notes=a.get("notes")
                )
                session.add(db_addr)
                inserted += 1

        await session.commit()
        logger.info(f"Synchronized {inserted} VASP addresses to database.")
        return inserted


# Global singleton instance
vasp_matcher = VASPMatcher()
vasp_matcher.load_seed_data()
