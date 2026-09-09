"""
Unified Heuristics Engine.

Combines:
1. Bitcoin Common-Input-Ownership Heuristic (CIOH) clustering.
2. Sweep / consolidation transaction detection.
3. Peeling-chain pattern detection.

Provides a single high-level interface for analyzing UTXO transactions,
wallet clusters, and transaction graphs.
"""

import logging
from typing import List, Dict, Optional, Any, Set
import networkx as nx

from backend.app.schemas.heuristics import (
    UTXOTransaction,
    AddressCluster,
    SweepDetectionResult,
    PeelChainDetectionResult,
    HeuristicAnalysisSummary
)
from backend.app.services.heuristics.common_input import (
    CommonInputClusteringEngine,
    clustering_engine
)
from backend.app.services.heuristics.sweep_detector import (
    SweepDetector,
    sweep_detector
)
from backend.app.services.heuristics.peel_detector import (
    PeelChainDetector,
    peel_detector
)

logger = logging.getLogger(__name__)


class HeuristicsEngine:
    """
    Orchestrates all Phase 3 heuristics for entity clustering and risk analysis.
    """

    def __init__(
        self,
        cluster_eng: Optional[CommonInputClusteringEngine] = None,
        sweep_det: Optional[SweepDetector] = None,
        peel_det: Optional[PeelChainDetector] = None
    ):
        self.clustering_engine = cluster_eng or clustering_engine
        self.sweep_detector = sweep_det or sweep_detector
        self.peel_detector = peel_det or peel_detector

    def analyze_utxo_transactions(
        self,
        transactions: List[UTXOTransaction],
        queried_address: Optional[str] = None,
        known_vasps: Optional[Set[str]] = None
    ) -> HeuristicAnalysisSummary:
        """
        Executes all heuristics across a set of UTXO transactions.
        """
        # 1. Cluster addresses using Common-Input Heuristic
        self.clustering_engine.add_transactions(transactions)

        queried_cluster = None
        if queried_address:
            queried_cluster = self.clustering_engine.get_cluster(queried_address)

        # 2. Detect Sweep / Consolidation transactions
        sweeps = self.sweep_detector.analyze_transactions(transactions, known_vasps=known_vasps)

        # 3. Detect Peeling Chains
        peel_chains = self.peel_detector.detect_utxo_peel_chains(transactions)

        # 4. Synthesize findings
        total_swept_vol = sum(s.consolidated_amount for s in sweeps)
        total_peeled_vol = sum(p.total_peeled_amount for p in peel_chains)
        max_peel_len = max([p.chain_length for p in peel_chains], default=0)

        metrics = {
            "is_clustered": bool(queried_cluster and queried_cluster.cluster_size > 1),
            "cluster_size": queried_cluster.cluster_size if queried_cluster else 1,
            "sweeps_count": len(sweeps),
            "total_swept_volume": round(total_swept_vol, 6),
            "peel_chains_count": len(peel_chains),
            "max_peel_chain_length": max_peel_len,
            "total_peeled_volume": round(total_peeled_vol, 6),
            "total_transactions_analyzed": len(transactions)
        }

        # Build human-readable summary
        narratives = []
        if queried_cluster and queried_cluster.cluster_size > 1:
            narratives.append(
                f"Common-input clustering identified {queried_cluster.cluster_size} co-spending "
                f"addresses in entity cluster {queried_cluster.cluster_id[:10]}..."
            )
        if sweeps:
            narratives.append(f"{len(sweeps)} sweep consolidation transaction(s) detected.")
        if peel_chains:
            narratives.append(
                f"{len(peel_chains)} peeling chain(s) identified (longest: {max_peel_len} hops)."
            )

        summary_text = " | ".join(narratives) if narratives else "No anomalous clustering or laundering patterns detected."

        return HeuristicAnalysisSummary(
            address=queried_address,
            chain="bitcoin",
            cluster=queried_cluster,
            sweeps_detected=sweeps,
            peel_chains_detected=peel_chains,
            metrics=metrics,
            summary=summary_text
        )

    def analyze_graph(
        self,
        graph: nx.MultiDiGraph,
        root_wallet: Optional[str] = None,
        known_vasps: Optional[Set[str]] = None
    ) -> HeuristicAnalysisSummary:
        """
        Executes graph-level heuristic sweep and peel chain detection on NetworkX graph.
        """
        sweeps = self.sweep_detector.analyze_graph(graph, known_vasps=known_vasps)
        peel_chains = self.peel_detector.detect_graph_peel_chains(graph, root_wallet=root_wallet)

        total_swept_vol = sum(s.consolidated_amount for s in sweeps)
        total_peeled_vol = sum(p.total_peeled_amount for p in peel_chains)
        max_peel_len = max([p.chain_length for p in peel_chains], default=0)

        metrics = {
            "sweeps_count": len(sweeps),
            "total_swept_volume": round(total_swept_vol, 4),
            "peel_chains_count": len(peel_chains),
            "max_peel_chain_length": max_peel_len,
            "total_peeled_volume": round(total_peeled_vol, 4),
            "graph_nodes": len(graph.nodes),
            "graph_edges": len(graph.edges)
        }

        summary_text = (
            f"Graph heuristic analysis: {len(sweeps)} consolidation node(s), "
            f"{len(peel_chains)} peeling chain(s) across {len(graph.nodes)} addresses."
        )

        return HeuristicAnalysisSummary(
            address=root_wallet,
            chain="graph",
            cluster=None,
            sweeps_detected=sweeps,
            peel_chains_detected=peel_chains,
            metrics=metrics,
            summary=summary_text
        )


# Global default heuristics engine
heuristics_engine = HeuristicsEngine()
