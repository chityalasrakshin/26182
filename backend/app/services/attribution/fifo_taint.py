"""
FIFO (First-In, First-Out) Taint Tracking Engine.

Implements deterministic taint propagation across a directed transaction graph.
When suspect/dirty funds mix with clean funds at intermediary hops, this engine
computes the exact `traceable_amount`, `unclassified_amount`, and `taint_ratio`
on each edge/transaction using conservative FIFO accounting.

Algorithm:
1. Seed initial suspect wallets with their full incoming balances as "tainted".
2. For each transaction (sorted chronologically):
   - If the sender has tainted balance, propagate taint to the receiver
     using FIFO: deduct from sender's tainted balance, add to receiver's.
   - Traceable amount = min(sender's tainted balance, transaction amount)
   - Unclassified amount = transaction amount - traceable amount
3. Returns annotated transactions with taint metadata.

Source: Adapted from CRYPTO-TRACE-/backend/services/attribution.py
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class TaintAnnotation:
    """Taint metadata for a single transaction."""
    tx_hash: str
    from_address: str
    to_address: str
    amount: float
    asset: str
    traceable_amount: float
    unclassified_amount: float
    taint_ratio: float  # traceable_amount / amount (0.0 to 1.0)
    hop: Optional[int] = None
    timestamp: Optional[str] = None
    chain: str = "ethereum"


@dataclass
class TaintSummary:
    """Summary of taint propagation across the entire graph."""
    total_transactions: int = 0
    total_volume: float = 0.0
    total_traceable: float = 0.0
    total_unclassified: float = 0.0
    overall_taint_ratio: float = 0.0
    suspect_wallets_count: int = 0
    tainted_addresses_count: int = 0
    tainted_addresses: List[str] = field(default_factory=list)


class FIFOTaintEngine:
    """
    Deterministic FIFO taint tracking engine for cryptocurrency forensic analysis.

    Given a set of suspect wallets and a chronologically-ordered list of transactions,
    computes how much of each transaction's value is traceable back to the suspect
    source using conservative FIFO (First-In, First-Out) accounting.

    This is essential for LEA (Law Enforcement Agency) investigations where dirty funds
    mix with clean funds through intermediary hops, and investigators need exact
    mathematical accounting of traceable vs unclassified amounts.
    """

    def __init__(self):
        self._suspected_balance: Dict[str, float] = {}
        self._initial_suspects: set = set()

    def compute_taint(
        self,
        transactions: List[Dict[str, Any]],
        suspect_wallets: List[str],
        chain: str = "ethereum"
    ) -> Tuple[List[TaintAnnotation], TaintSummary]:
        """
        Apply FIFO taint tracking across a list of transactions.

        Args:
            transactions: List of transaction dicts, each containing:
                - from_address (str)
                - to_address (str)
                - amount (float)
                - tx_hash (str)
                - timestamp (datetime or str, optional)
                - token_symbol (str, optional)
                - hop (int, optional)
                - chain (str, optional)
            suspect_wallets: List of known suspect/dirty wallet addresses
            chain: Default chain identifier

        Returns:
            Tuple of (annotated_transactions, summary)
        """
        # Reset state for fresh computation
        self._suspected_balance = {}
        self._initial_suspects = {addr.lower().strip() for addr in suspect_wallets}

        # Sort transactions chronologically
        sorted_txs = sorted(
            transactions,
            key=lambda x: str(x.get("timestamp", "") or "")
        )

        annotations: List[TaintAnnotation] = []
        total_volume = 0.0
        total_traceable = 0.0
        total_unclassified = 0.0

        for tx in sorted_txs:
            from_addr = str(tx.get("from_address", "")).lower().strip()
            to_addr = str(tx.get("to_address", "")).lower().strip()

            try:
                amount = float(tx.get("amount", 0.0))
            except (ValueError, TypeError):
                amount = 0.0

            if amount <= 0 or not from_addr or not to_addr:
                continue

            tx_chain = tx.get("chain", chain)
            tx_hash = tx.get("tx_hash", "")
            asset = tx.get("token_symbol", "ETH") or "ETH"
            hop = tx.get("hop")
            timestamp = tx.get("timestamp")
            if hasattr(timestamp, "isoformat"):
                timestamp = timestamp.isoformat()

            # --- FIFO Taint Propagation Logic ---

            # Determine if this transaction carries taint:
            # 1. Sender is an initial suspect
            # 2. Sender has accumulated tainted balance
            # 3. Receiver is an initial suspect receiving first inflow (seeding)
            is_tainted_source = (
                from_addr in self._initial_suspects
                or self._suspected_balance.get(from_addr, 0.0) > 0
            )

            is_seed_inflow = (
                to_addr in self._initial_suspects
                and self._suspected_balance.get(to_addr, 0.0) == 0.0
                and not is_tainted_source
            )

            # Auto-seed suspect wallets: if a suspect sends funds but has no
            # prior tainted balance, seed their balance with the tx amount.
            # This handles the origin case where the suspect IS the crime source.
            if from_addr in self._initial_suspects:
                current_bal = self._suspected_balance.get(from_addr, 0.0)
                if current_bal < amount:
                    self._suspected_balance[from_addr] = amount

            if is_tainted_source or is_seed_inflow:
                # Propagate taint to the receiver
                self._suspected_balance[to_addr] = (
                    self._suspected_balance.get(to_addr, 0.0) + amount
                )

            # Compute traceable amount using FIFO conservative rule
            sender_taint = self._suspected_balance.get(from_addr, 0.0)
            traceable = min(sender_taint, amount)
            unclassified = amount - traceable

            # Deduct traceable amount from sender's tainted balance
            self._suspected_balance[from_addr] = max(0.0, sender_taint - traceable)

            # Calculate taint ratio
            taint_ratio = traceable / amount if amount > 0 else 0.0

            annotation = TaintAnnotation(
                tx_hash=tx_hash,
                from_address=from_addr,
                to_address=to_addr,
                amount=amount,
                asset=asset,
                traceable_amount=round(traceable, 8),
                unclassified_amount=round(unclassified, 8),
                taint_ratio=round(taint_ratio, 6),
                hop=hop,
                timestamp=str(timestamp) if timestamp else None,
                chain=tx_chain,
            )
            annotations.append(annotation)

            total_volume += amount
            total_traceable += traceable
            total_unclassified += unclassified

        # Identify all addresses that have non-zero taint balance
        tainted_addresses = [
            addr for addr, bal in self._suspected_balance.items() if bal > 0
        ]

        summary = TaintSummary(
            total_transactions=len(annotations),
            total_volume=round(total_volume, 8),
            total_traceable=round(total_traceable, 8),
            total_unclassified=round(total_unclassified, 8),
            overall_taint_ratio=round(
                total_traceable / total_volume if total_volume > 0 else 0.0, 6
            ),
            suspect_wallets_count=len(self._initial_suspects),
            tainted_addresses_count=len(tainted_addresses),
            tainted_addresses=tainted_addresses[:50],  # Cap for serialization
        )

        logger.info(
            f"FIFO taint analysis complete: {summary.total_transactions} txs, "
            f"traceable={summary.total_traceable:.4f}, "
            f"taint_ratio={summary.overall_taint_ratio:.2%}"
        )

        return annotations, summary

    def get_address_taint_balance(self, address: str) -> float:
        """Returns the current tainted balance for a specific address."""
        return self._suspected_balance.get(address.lower().strip(), 0.0)

    def get_all_tainted_balances(self) -> Dict[str, float]:
        """Returns all addresses with non-zero tainted balances."""
        return {
            addr: bal
            for addr, bal in self._suspected_balance.items()
            if bal > 0
        }


# Module-level convenience function
def compute_fifo_taint(
    transactions: List[Dict[str, Any]],
    suspect_wallets: List[str],
    chain: str = "ethereum"
) -> Tuple[List[TaintAnnotation], TaintSummary]:
    """
    Convenience function to compute FIFO taint without instantiating the engine.

    Args:
        transactions: List of transaction dicts
        suspect_wallets: List of known suspect/dirty wallet addresses
        chain: Default chain identifier

    Returns:
        Tuple of (annotated_transactions, summary)
    """
    engine = FIFOTaintEngine()
    return engine.compute_taint(transactions, suspect_wallets, chain)
