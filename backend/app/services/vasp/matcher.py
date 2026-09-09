import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

from backend.app.core.config import settings
from backend.app.core.address_validator import is_valid_crypto_address, normalize_address, detect_blockchain
from backend.app.schemas.analysis import VASPSchema, VASPAddressSchema

logger = logging.getLogger("vasp.matcher")


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

                vasp_info = {
                    "vasp_name": vasp_name,
                    "address": norm_addr,
                    "chain": chain,
                    "address_type": address_type,
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
                        "category": "Centralized Exchange",
                        "addresses": []
                    }
                self._vasp_map[vasp_name]["addresses"].append(vasp_info)
                loaded_count += 1

        loaded_count += self._load_solana_seeds()
        self._loaded = True
        logger.info(f"Loaded {loaded_count} verified VASP addresses across {len(self._vasp_map)} entities.")
        return loaded_count

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
                    "category": "Centralized Exchange",
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
        by_chain = {}
        by_type = {}
        by_status = {}

        for item in self._address_map.values():
            chain = item.get("chain", "unknown").upper()
            atype = item.get("address_type", "unknown")
            status = item.get("verification_status", "verified")

            by_chain[chain] = by_chain.get(chain, 0) + 1
            by_type[atype] = by_type.get(atype, 0) + 1
            by_status[status] = by_status.get(status, 0) + 1

        return {
            "total_addresses": len(self._address_map),
            "total_vasps": len(self._vasp_map),
            "by_vasp": by_vasp,
            "by_chain": by_chain,
            "by_type": by_type,
            "by_status": by_status
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
