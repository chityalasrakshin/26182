"""
Sweep-Transaction Detection Heuristic Engine.

A sweep (consolidation) transaction aggregates funds from multiple addresses or UTXOs
into a single target address. Common in:
1. Exchange deposit sweeps (sweeping user deposit addresses into exchange hot/cold wallet).
2. Attacker loot consolidation (sweeping compromised victim accounts into a collector wallet).
3. Wallet maintenance (consolidating fragmented UTXO dust into a clean balance).

Detection criteria:
- Multi-input consolidation: >= 3 inputs.
- Concentrated output: Exactly 1 output, or 1 dominant output carrying >= 85-90% of value.
- High consolidation ratio (dominant output value / total input value).
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set
import networkx as nx

from backend.app.schemas.heuristics import UTXOTransaction, SweepDetectionResult

logger = logging.getLogger(__name__)


class SweepDetector:
    """
    Detects sweep and consolidation patterns in UTXO transactions and graph topologies.
    """

    def __init__(
        self,
        min_inputs: int = 3,
        min_consolidation_ratio: float = 0.85,
        confidence_threshold: float = 0.70
    ):
        self.min_inputs = min_inputs
        self.min_consolidation_ratio = min_consolidation_ratio
        self.confidence_threshold = confidence_threshold

    def analyze_utxo_transaction(
        self,
        tx: UTXOTransaction,
        known_vasps: Optional[Set[str]] = None
    ) -> Optional[SweepDetectionResult]:
        """
        Evaluates a single UTXO transaction against sweep criteria.
        """
        known_vasps = {v.lower() for v in (known_vasps or set())}

        # Must have at least min_inputs
        if len(tx.inputs) < self.min_inputs:
            return None

        if not tx.outputs or tx.total_input_btc <= 0:
            return None

        # Determine dominant output
        sorted_outputs = sorted(tx.outputs, key=lambda o: o.amount_btc, reverse=True)
        dominant_out = sorted_outputs[0]
        dominant_amt = dominant_out.amount_btc
        consolidation_ratio = dominant_amt / max(tx.total_input_btc, 1e-8)

        output_count = len(tx.outputs)

        # Case 1: Exactly 1 output (pure sweep)
        # All inputs -> 1 single output (minus miner fee)
        is_pure_sweep = (output_count == 1)

        # Case 2: Dominant output with small change/fee
        is_dominant_sweep = (output_count == 2 and consolidation_ratio >= self.min_consolidation_ratio)

        # Case 3: More outputs, but dominant output has >= 90%
        is_multi_out_sweep = (output_count > 2 and consolidation_ratio >= 0.90)

        if not (is_pure_sweep or is_dominant_sweep or is_multi_out_sweep):
            return None

        # Calculate confidence score
        confidence = 0.70
        if is_pure_sweep:
            confidence += 0.25
        elif is_dominant_sweep:
            confidence += 0.18
        else:
            confidence += 0.10

        # High input count bonus
        if len(tx.inputs) >= 10:
            confidence += 0.05

        confidence = min(round(confidence, 2), 1.0)
        if confidence < self.confidence_threshold:
            return None

        # Determine sweep typology
        target_addr = dominant_out.address.lower()
        if target_addr in known_vasps:
            sweep_type = "EXCHANGE_DEPOSIT_SWEEP"
        elif len(tx.inputs) >= 5 and dominant_amt > 1.0:
            sweep_type = "SUSPICIOUS_LOOT_SWEEP"
        else:
            sweep_type = "WALLET_CONSOLIDATION"

        swept_sources = list({inp.address.lower() for inp in tx.inputs if inp.address})

        explanation = (
            f"Sweep consolidation detected: {len(tx.inputs)} inputs consolidated into single "
            f"destination ({target_addr[:10]}...) receiving {dominant_amt:.4f} BTC "
            f"({consolidation_ratio*100:.1f}% of total input value)."
        )

        return SweepDetectionResult(
            tx_hash=tx.tx_hash,
            chain=tx.chain,
            timestamp=tx.timestamp,
            sweep_target_address=target_addr,
            swept_source_addresses=swept_sources,
            input_count=len(tx.inputs),
            output_count=output_count,
            consolidated_amount=dominant_amt,
            consolidation_ratio=round(consolidation_ratio, 4),
            is_sweep=True,
            confidence_score=confidence,
            sweep_type=sweep_type,
            explanation=explanation
        )

    def analyze_transactions(
        self,
        txs: List[UTXOTransaction],
        known_vasps: Optional[Set[str]] = None
    ) -> List[SweepDetectionResult]:
        """Scans a batch of UTXO transactions for sweep events."""
        results = []
        for tx in txs:
            res = self.analyze_utxo_transaction(tx, known_vasps)
            if res:
                results.append(res)
        return results

    def analyze_graph(
        self,
        graph: nx.MultiDiGraph,
        min_in_degree: int = 3,
        known_vasps: Optional[Set[str]] = None
    ) -> List[SweepDetectionResult]:
        """
        Detects fan-in sweep consolidation nodes in a NetworkX transaction graph.
        Identifies addresses that receive concurrent transfers from multiple distinct sources.
        """
        known_vasps = {v.lower() for v in (known_vasps or set())}
        sweeps = []

        for node in graph.nodes():
            in_edges = list(graph.in_edges(node, data=True))
            distinct_sources = {u for u, _ in graph.in_edges(node)}

            if len(distinct_sources) < min_in_degree:
                continue

            total_inflow = sum(float(data.get("amount", 0.0) or 0.0) for _, _, data in in_edges)
            if total_inflow <= 0:
                continue

            timestamps = [data.get("timestamp") for _, _, data in in_edges if data.get("timestamp")]
            sample_tx_hash = in_edges[0][2].get("tx_hash", f"graph_sweep_{node[:8]}")

            # Confidence based on degree
            confidence = min(0.70 + 0.05 * min(len(distinct_sources), 6), 0.95)

            target_norm = node.lower()
            sweep_type = "EXCHANGE_DEPOSIT_SWEEP" if target_norm in known_vasps else "WALLET_CONSOLIDATION"

            sweeps.append(
                SweepDetectionResult(
                    tx_hash=sample_tx_hash,
                    chain="graph",
                    timestamp=timestamps[0] if timestamps else datetime.now(timezone.utc),
                    sweep_target_address=node,
                    swept_source_addresses=list(distinct_sources),
                    input_count=len(distinct_sources),
                    output_count=1,
                    consolidated_amount=round(total_inflow, 4),
                    consolidation_ratio=1.0,
                    is_sweep=True,
                    confidence_score=round(confidence, 2),
                    sweep_type=sweep_type,
                    explanation=(
                        f"Graph fan-in consolidation: Address {node[:10]}... received "
                        f"consolidated funds from {len(distinct_sources)} distinct sources "
                        f"totalling {total_inflow:.4f} units."
                    )
                )
            )

        return sweeps


# Global default detector instance
sweep_detector = SweepDetector()
