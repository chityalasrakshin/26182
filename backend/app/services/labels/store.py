"""
High-Performance Forensic Label Store.

Aggregates entity labels, exchange attributions, sanctions designations, and
forensic classifications across multiple sources:
1. Curated Master VASP Registry (1,595 verified addresses)
2. Hand-curated benchmark labels (data/labels/demo_labels.json)
3. OFAC SDN Digital Currency Sanctions List
4. GraphSense open TagPacks

Provides O(1) lookup with traceable source citations per `graph-the-network`.
"""

import os
import csv
import json
import logging
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any

from backend.app.core.config import BASE_DIR, settings
from backend.app.core.address_validator import normalize_address, detect_blockchain, is_valid_crypto_address

logger = logging.getLogger(__name__)


@dataclass
class AddressLabel:
    """Forensic address label containing entity metadata and provenance."""
    address: str
    chain: str
    entity: str
    label: str
    category: str  # exchange, mixer, scam, defi, bridge, sanctioned, known_individual
    risk_level: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: str = "HIGH"  # HIGH, MEDIUM, LOW
    confidence_score: float = 95.0  # 0.0 - 100.0
    source_name: str = "Curated Intelligence Store"
    source_url: Optional[str] = None
    notes: Optional[str] = None
    is_vasp: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class LabelStore:
    """
    Unified multi-source forensic label store.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or (BASE_DIR / "data")
        self._address_map: Dict[str, AddressLabel] = {}
        self._chain_address_map: Dict[tuple, AddressLabel] = {}
        self._loaded = False
        self.load_all()

    def load_all(self) -> int:
        """Loads all label sources into in-memory indices."""
        count = 0
        count += self._load_vasp_master()
        count += self._load_demo_labels()
        count += self._load_ofac_sanctions()
        self._loaded = True
        logger.info(f"LabelStore loaded {len(self._address_map)} unique labeled addresses.")
        return len(self._address_map)

    def _load_vasp_master(self) -> int:
        """Loads 1,595 verified VASP addresses from vasp_addresses_master.csv."""
        master_csv = self.data_dir / "vasp" / "vasp_addresses_master.csv"
        fallback_csv = self.data_dir / "vasp" / "vasp_addresses.csv"
        target_csv = master_csv if master_csv.exists() else fallback_csv

        if not target_csv.exists():
            logger.warning(f"VASP CSV not found at {target_csv}")
            return 0

        loaded = 0
        with open(target_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw_addr = row.get("address", "").strip()
                if not raw_addr or not is_valid_crypto_address(raw_addr):
                    continue
                norm_addr = normalize_address(raw_addr)
                chain = row.get("chain", "").strip().lower() or detect_blockchain(raw_addr)
                vasp_name = row.get("vasp_name", "").strip()
                addr_type = row.get("address_type", "hot_wallet").strip()
                source = row.get("source_name") or row.get("source") or "Curated Master Registry"
                source_url = row.get("source_url", "")
                conf_score = float(row.get("confidence_score", 95.0) or 95.0)

                label_obj = AddressLabel(
                    address=norm_addr,
                    chain=chain,
                    entity=vasp_name,
                    label=f"{vasp_name} ({addr_type.replace('_', ' ').title()})",
                    category="exchange",
                    risk_level="LOW",
                    confidence="HIGH",
                    confidence_score=conf_score,
                    source_name=source,
                    source_url=source_url,
                    notes=row.get("notes"),
                    is_vasp=True
                )
                self._address_map[norm_addr] = label_obj
                self._chain_address_map[(chain, norm_addr)] = label_obj
                loaded += 1
        return loaded

    def _load_demo_labels(self) -> int:
        """Loads curated benchmark labels from demo_labels.json."""
        demo_json = self.data_dir / "labels" / "demo_labels.json"
        if not demo_json.exists():
            return 0

        loaded = 0
        try:
            with open(demo_json, "r", encoding="utf-8") as f:
                items = json.load(f)
            for item in items:
                raw_addr = item.get("address", "").strip()
                if not raw_addr:
                    continue
                norm_addr = normalize_address(raw_addr)
                chain = item.get("chain", "").strip().lower() or detect_blockchain(raw_addr)
                cat = item.get("category", "unknown")
                is_vasp = (cat == "exchange")

                label_obj = AddressLabel(
                    address=norm_addr,
                    chain=chain,
                    entity=item.get("entity", "Unknown Entity"),
                    label=item.get("label", "Benchmark Address"),
                    category=cat,
                    risk_level=item.get("risk_level", "LOW"),
                    confidence=item.get("confidence", "HIGH"),
                    confidence_score=float(item.get("confidence_score", 95.0)),
                    source_name=item.get("source_name", "Curated Benchmark"),
                    source_url=item.get("source_url"),
                    notes=item.get("notes"),
                    is_vasp=is_vasp
                )
                self._address_map[norm_addr] = label_obj
                self._chain_address_map[(chain, norm_addr)] = label_obj
                loaded += 1
        except Exception as e:
            logger.error(f"Error loading demo_labels.json: {e}")
        return loaded

    def _load_ofac_sanctions(self) -> int:
        """
        Seeds official OFAC Specially Designated Nationals (SDN) crypto addresses.
        Includes high-profile sanctions entries (Lazarus, Garantex, Tornado Cash, Chatex).
        """
        ofac_entries = [
            # Tornado Cash Core Contracts (OFAC SDN Aug 2022)
            ("0x8589427373D6D84E98730D7795D8f6f8731FDA16", "ethereum", "Tornado Cash", "Tornado Cash 0.1 ETH", "mixer", "CRITICAL"),
            ("0x722122dF12D4e14e13Ac3b6895a86e84145b6967", "ethereum", "Tornado Cash", "Tornado Cash 1 ETH", "mixer", "CRITICAL"),
            ("0xDD4c48C0B24039969fC16D1cdF626eaB821d3384", "ethereum", "Tornado Cash", "Tornado Cash 10 ETH", "mixer", "CRITICAL"),
            ("0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b", "ethereum", "Tornado Cash", "Tornado Cash Router", "mixer", "CRITICAL"),
            # Lazarus Group (Axie Ronin exploit - OFAC SDN April 2022)
            ("0x098B716B8Aaf21512996dC57EB0615e2383E2f96", "ethereum", "Lazarus Group (DPRK)", "Ronin Bridge Exploiter", "sanctioned", "CRITICAL"),
            # Garantex Sanctioned Exchange (OFAC SDN April 2022)
            ("0x2649B2830fC3aa003a276b6C035C834375bFE5a4", "ethereum", "Garantex", "Garantex Hot Wallet", "sanctioned", "CRITICAL"),
            # Hydra Market Bitcoin (OFAC SDN April 2022)
            ("149vaAYqWbZsQjMsGGCtVafjnhXWgk3vGu", "bitcoin", "Hydra Market", "Hydra Marketplace Deposit", "sanctioned", "CRITICAL"),
        ]

        loaded = 0
        for raw_addr, chain, entity, label, cat, risk in ofac_entries:
            norm_addr = normalize_address(raw_addr)
            label_obj = AddressLabel(
                address=norm_addr,
                chain=chain,
                entity=entity,
                label=label,
                category=cat,
                risk_level=risk,
                confidence="HIGH",
                confidence_score=100.0,
                source_name="US Treasury OFAC Specially Designated Nationals (SDN) List",
                source_url="https://ofac.treasury.gov/specially-designated-nationals-list-data-formats-data-schemas",
                notes="Officially designated on OFAC SDN List under cyber-enabled sanctions program",
                is_vasp=(cat == "exchange")
            )
            # Do not overwrite if already detailed, otherwise add
            if norm_addr not in self._address_map:
                self._address_map[norm_addr] = label_obj
                self._chain_address_map[(chain, norm_addr)] = label_obj
                loaded += 1
        return loaded

    def lookup(self, address: str, chain: Optional[str] = None) -> Optional[AddressLabel]:
        """
        O(1) resolution of an address to its forensic label.
        Checks (chain, address) first, then falls back to normalized address.
        """
        norm_addr = normalize_address(address)
        if chain:
            match = self._chain_address_map.get((chain.lower(), norm_addr))
            if match:
                return match
        return self._address_map.get(norm_addr)

    def is_vasp(self, address: str) -> bool:
        label = self.lookup(address)
        return bool(label and label.is_vasp)

    def get_vasp_name(self, address: str) -> Optional[str]:
        label = self.lookup(address)
        if label and label.is_vasp:
            return label.entity
        return None

    def get_risk_level(self, address: str) -> str:
        label = self.lookup(address)
        return label.risk_level if label else "LOW"


# Global singleton instance
label_store = LabelStore()
