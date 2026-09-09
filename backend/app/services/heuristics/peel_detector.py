"""
Peeling-Chain Detection Heuristic Engine.

A peeling chain is a money-laundering and privacy pattern commonly used in UTXO
and cryptocurrency transfers. A large balance is systematically peeled:
At each step i:
  Input: Address A_i
  Output 1: Small peel payment P_i to counterparty / exchange / mixer (typically 5-35% of total)
  Output 2: Remaining large change C_i to fresh change address A_{i+1} (typically 65-95% of total)
Then A_{i+1} repeats the process, creating a sequence of chained transfers.

Detection criteria:
- Exactly 2 outputs (or 1 small peel + 1 primary change).
- Significant output value asymmetry (peel_ratio <= 0.40).
- Succession: The change output address is spent as input in the subsequent transaction.
- Minimum chain length >= 2 consecutive peeling hops (typically >= 3 for high confidence).
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set, Tuple
import networkx as nx

from backend.app.schemas.heuristics import (
    UTXOTransaction,
    PeelChainHop,
    PeelChainDetectionResult
)

logger = logging.getLogger(__name__)


class PeelChainDetector:
    """
    High-precision detector for peeling chain structures across UTXO transactions
    and directed transaction graphs.
    """

    def __init__(
        self,
        min_chain_length: int = 2,
        max_peel_ratio: float = 0.40,
        min_change_ratio: float = 0.60
    ):
        self.min_chain_length = min_chain_length
        self.max_peel_ratio = max_peel_ratio
        self.min_change_ratio = min_change_ratio

    def _is_peel_transaction(
        self,
        tx: UTXOTransaction
    ) -> Optional[Tuple[str, str, float, str, float, float]]:
        """
        Tests whether a single UTXO transaction qualifies as an asymmetric peel step.
        Returns (input_addr, peeled_addr, peeled_amt, change_addr, change_amt, peel_ratio) or None.
        """
        # Exactly 2 outputs required for classic peel step
        if len(tx.outputs) != 2:
            return None

        out_a, out_b = tx.outputs[0], tx.outputs[1]
        amt_a, amt_b = out_a.amount_btc, out_b.amount_btc
        total_out = amt_a + amt_b

        if total_out <= 0:
            return None

        # Determine which output is the peeled payment and which is the change
        if amt_a < amt_b:
            peeled_out, change_out = out_a, out_b
            peeled_amt, change_amt = amt_a, amt_b
        else:
            peeled_out, change_out = out_b, out_a
            peeled_amt, change_amt = amt_b, amt_a

        peel_ratio = peeled_amt / total_out
        change_ratio = change_amt / total_out

        # Check asymmetry
        if peel_ratio > self.max_peel_ratio or change_ratio < self.min_change_ratio:
            return None

        input_addr = tx.inputs[0].address.lower() if tx.inputs else ""
        peeled_addr = peeled_out.address.lower()
        change_addr = change_out.address.lower()

        return (input_addr, peeled_addr, peeled_amt, change_addr, change_amt, peel_ratio)

    def detect_utxo_peel_chains(
        self,
        transactions: List[UTXOTransaction]
    ) -> List[PeelChainDetectionResult]:
        """
        Traces sequences of UTXO transactions where change outputs are subsequently spent.
        """
        # Build index: input_address -> tx
        tx_by_input: Dict[str, List[UTXOTransaction]] = {}
        for tx in transactions:
            for inp in tx.inputs:
                addr = inp.address.lower().strip()
                if addr:
                    if addr not in tx_by_input:
                        tx_by_input[addr] = []
                    tx_by_input[addr].append(tx)

        # Find all individual peel steps
        peel_steps: Dict[str, Tuple[UTXOTransaction, Tuple]] = {}
        for tx in transactions:
            step = self._is_peel_transaction(tx)
            if step:
                peel_steps[tx.tx_hash] = (tx, step)

        # Build chains by following change_addr -> next tx input
        visited_txs: Set[str] = set()
        detected_chains: List[PeelChainDetectionResult] = []

        # Sort candidate starting transactions chronologically
        sorted_peels = sorted(
            peel_steps.values(),
            key=lambda item: item[0].timestamp
        )

        for tx, step in sorted_peels:
            if tx.tx_hash in visited_txs:
                continue

            current_tx = tx
            current_step = step
            chain_hops: List[PeelChainHop] = []
            chain_tx_hashes = []

            while current_tx and current_step:
                inp_addr, peel_addr, peel_amt, chg_addr, chg_amt, ratio = current_step
                chain_tx_hashes.append(current_tx.tx_hash)

                chain_hops.append(
                    PeelChainHop(
                        hop_index=len(chain_hops) + 1,
                        tx_hash=current_tx.tx_hash,
                        input_address=inp_addr,
                        peeled_address=peel_addr,
                        peeled_amount=peel_amt,
                        change_address=chg_addr,
                        change_amount=chg_amt,
                        timestamp=current_tx.timestamp,
                        peel_ratio=round(ratio, 4)
                    )
                )

                # Look for subsequent transaction that spends from chg_addr
                next_candidates = tx_by_input.get(chg_addr, [])
                next_tx = None
                next_step = None

                for cand in next_candidates:
                    if cand.tx_hash not in chain_tx_hashes and cand.tx_hash in peel_steps:
                        next_tx = cand
                        next_step = peel_steps[cand.tx_hash][1]
                        break

                current_tx = next_tx
                current_step = next_step

            # If chain meets minimum length requirement
            if len(chain_hops) >= self.min_chain_length:
                for h in chain_tx_hashes:
                    visited_txs.add(h)

                initial_amount = chain_hops[0].peeled_amount + chain_hops[0].change_amount
                total_peeled = sum(h.peeled_amount for h in chain_hops)
                remaining = chain_hops[-1].change_amount

                # Calculate average time delta between hops
                intervals = []
                for i in range(1, len(chain_hops)):
                    dt = abs((chain_hops[i].timestamp - chain_hops[i - 1].timestamp).total_seconds())
                    intervals.append(dt)
                avg_interval = (sum(intervals) / len(intervals)) if intervals else 0.0

                # Confidence: base 0.75 + 0.08 per extra hop
                confidence = min(0.75 + 0.08 * (len(chain_hops) - 2), 0.98)

                explanation = (
                    f"Peeling chain confirmed: {len(chain_hops)} sequential hops peeling off "
                    f"{total_peeled:.4f} BTC across {len(chain_hops)} destinations while carrying "
                    f"forward {remaining:.4f} BTC change from origin {chain_hops[0].input_address[:10]}..."
                )

                detected_chains.append(
                    PeelChainDetectionResult(
                        chain_id=f"peel_{chain_hops[0].tx_hash[:10]}",
                        start_address=chain_hops[0].input_address,
                        chain_length=len(chain_hops),
                        initial_amount=round(initial_amount, 6),
                        total_peeled_amount=round(total_peeled, 6),
                        remaining_change_amount=round(remaining, 6),
                        peeled_destinations=[h.peeled_address for h in chain_hops],
                        change_path=[h.change_address for h in chain_hops],
                        hops=chain_hops,
                        avg_hop_interval_seconds=round(avg_interval, 1),
                        confidence_score=round(confidence, 2),
                        is_peeling_chain=True,
                        explanation=explanation
                    )
                )

        return detected_chains

    def detect_graph_peel_chains(
        self,
        graph: nx.MultiDiGraph,
        root_wallet: Optional[str] = None
    ) -> List[PeelChainDetectionResult]:
        """
        Detects peeling chain structures within a NetworkX transaction graph.
        Looks for paths where nodes repeatedly have 2 outgoing edges with asymmetric amounts.
        """
        chains: List[PeelChainDetectionResult] = []
        candidates_to_check = [root_wallet] if root_wallet and root_wallet in graph else list(graph.nodes())

        visited_nodes: Set[str] = set()

        for start_node in candidates_to_check:
            if start_node in visited_nodes:
                continue

            current = start_node
            hops: List[PeelChainHop] = []
            local_visited = {current}

            for step_idx in range(1, 15):
                out_edges = list(graph.out_edges(current, data=True))
                # Classic peel: 2 outgoing edges from current address
                if len(out_edges) != 2:
                    break

                e1, e2 = out_edges[0], out_edges[1]
                amt1 = float(e1[2].get("amount", 0.0) or 0.0)
                amt2 = float(e2[2].get("amount", 0.0) or 0.0)
                tot = amt1 + amt2

                if tot <= 0:
                    break

                if amt1 < amt2:
                    peel_edge, change_edge = e1, e2
                    peel_amt, change_amt = amt1, amt2
                else:
                    peel_edge, change_edge = e2, e1
                    peel_amt, change_amt = amt2, amt1

                ratio = peel_amt / tot
                if ratio > self.max_peel_ratio:
                    break

                peel_target = peel_edge[1]
                change_target = change_edge[1]

                ts = change_edge[2].get("timestamp") or datetime.now(timezone.utc)
                tx_hash = change_edge[2].get("tx_hash", f"tx_peel_{current[:6]}_{step_idx}")

                hops.append(
                    PeelChainHop(
                        hop_index=step_idx,
                        tx_hash=tx_hash,
                        input_address=current,
                        peeled_address=peel_target,
                        peeled_amount=peel_amt,
                        change_address=change_target,
                        change_amount=change_amt,
                        timestamp=ts,
                        peel_ratio=round(ratio, 4)
                    )
                )

                if change_target in local_visited:
                    break

                local_visited.add(change_target)
                current = change_target

            if len(hops) >= self.min_chain_length:
                visited_nodes.update(local_visited)
                initial_amt = hops[0].peeled_amount + hops[0].change_amount
                total_peeled = sum(h.peeled_amount for h in hops)
                remaining = hops[-1].change_amount
                confidence = min(0.75 + 0.08 * (len(hops) - 2), 0.98)

                chains.append(
                    PeelChainDetectionResult(
                        chain_id=f"graph_peel_{hops[0].input_address[:8]}",
                        start_address=hops[0].input_address,
                        chain_length=len(hops),
                        initial_amount=round(initial_amt, 4),
                        total_peeled_amount=round(total_peeled, 4),
                        remaining_change_amount=round(remaining, 4),
                        peeled_destinations=[h.peeled_address for h in hops],
                        change_path=[h.change_address for h in hops],
                        hops=hops,
                        avg_hop_interval_seconds=0.0,
                        confidence_score=round(confidence, 2),
                        is_peeling_chain=True,
                        explanation=(
                            f"Graph peeling chain: {len(hops)} consecutive asymmetric hops "
                            f"peeling {total_peeled:.4f} across {len(hops)} recipients."
                        )
                    )
                )

        return chains


# Global default peel detector instance
peel_detector = PeelChainDetector()
