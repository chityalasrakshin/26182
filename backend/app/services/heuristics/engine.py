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
    ChangeAddressDetectionResult,
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
from backend.app.services.heuristics.change_detector import (
    ChangeAddressDetector,
    change_detector
)
from backend.app.services.heuristics.account_clustering import (
    AccountDepositClusterer,
    account_deposit_clusterer
)

logger = logging.getLogger(__name__)


class HeuristicsEngine:
    """
    Orchestrates all heuristics for UTXO and account-based clustering, change detection, and risk analysis.
    """

    def __init__(
        self,
        cluster_eng: Optional[CommonInputClusteringEngine] = None,
        sweep_det: Optional[SweepDetector] = None,
        peel_det: Optional[PeelChainDetector] = None,
        change_det: Optional[ChangeAddressDetector] = None,
        deposit_clust: Optional[AccountDepositClusterer] = None
    ):
        self.clustering_engine = cluster_eng or clustering_engine
        self.sweep_detector = sweep_det or sweep_detector
        self.peel_detector = peel_det or peel_detector
        self.change_detector = change_det or change_detector
        self.deposit_clusterer = deposit_clust or account_deposit_clusterer

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

        # 4. Detect Change Addresses (VincenzoImp heuristics)
        cluster_members = set(queried_cluster.members) if queried_cluster else None
        change_results = self.change_detector.analyze_transactions(
            transactions,
            known_cluster=cluster_members
        )

        # 5. Synthesize findings
        total_swept_vol = sum(s.consolidated_amount for s in sweeps)
        total_peeled_vol = sum(p.total_peeled_amount for p in peel_chains)
        max_peel_len = max([p.chain_length for p in peel_chains], default=0)

        total_payment_vol = sum(c.payment_amount_btc for c in change_results)
        total_change_vol = sum(c.change_amount_btc for c in change_results)
        change_addrs = set(c.change_address for c in change_results)

        metrics = {
            "is_clustered": bool(queried_cluster and queried_cluster.cluster_size > 1),
            "cluster_size": queried_cluster.cluster_size if queried_cluster else 1,
            "sweeps_count": len(sweeps),
            "total_swept_volume": round(total_swept_vol, 6),
            "peel_chains_count": len(peel_chains),
            "max_peel_chain_length": max_peel_len,
            "total_peeled_volume": round(total_peeled_vol, 6),
            "change_transactions_count": len(change_results),
            "total_payment_volume": round(total_payment_vol, 6),
            "total_change_volume": round(total_change_vol, 6),
            "identified_change_addresses_count": len(change_addrs),
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
        if change_results:
            rules_used = ", ".join(sorted(set(c.heuristic_rule for c in change_results)))
            narratives.append(
                f"{len(change_results)} change address disambiguation(s) detected "
                f"({round(total_payment_vol, 4)} BTC payment volume, rule(s): {rules_used})."
            )

        summary_text = " | ".join(narratives) if narratives else "No anomalous clustering or laundering patterns detected."

        return HeuristicAnalysisSummary(
            address=queried_address,
            chain="bitcoin",
            cluster=queried_cluster,
            sweeps_detected=sweeps,
            peel_chains_detected=peel_chains,
            change_detected=change_results,
            metrics=metrics,
            summary=summary_text
        )

    def analyze_graph(
        self,
        graph: nx.MultiDiGraph,
        root_wallet: Optional[str] = None,
        known_vasps: Optional[Set[str]] = None,
        chain: str = "ethereum"
    ) -> HeuristicAnalysisSummary:
        """
        Executes graph-level heuristic sweep, peel chain, deposit forwarding,
        and NetworkX Louvain community detection on NetworkX graph.
        """
        sweeps = self.sweep_detector.analyze_graph(graph, known_vasps=known_vasps)
        peel_chains = self.peel_detector.detect_graph_peel_chains(graph, root_wallet=root_wallet)

        # 1. NetworkX Louvain Community Detection
        communities, mod_score = self.deposit_clusterer.detect_communities(graph=graph, chain=chain)

        # 2. Deposit Forwarding Sweep Detection
        edge_txs = []
        for u, v, data in graph.edges(data=True):
            edge_txs.append({
                "from_address": u,
                "to_address": v,
                "amount": float(data.get("amount") or data.get("value") or data.get("weight") or 0.0),
                "tx_hash": data.get("tx_hash") or data.get("hash") or ""
            })
        deposit_sweeps = self.deposit_clusterer.detect_deposit_forwarding(
            edge_txs,
            known_vasps=known_vasps,
            chain=chain
        )

        total_swept_vol = sum(s.consolidated_amount for s in sweeps)
        total_peeled_vol = sum(p.total_peeled_amount for p in peel_chains)
        total_forwarded_vol = sum(d.forwarded_amount for d in deposit_sweeps)
        max_peel_len = max([p.chain_length for p in peel_chains], default=0)

        metrics = {
            "sweeps_count": len(sweeps),
            "total_swept_volume": round(total_swept_vol, 4),
            "peel_chains_count": len(peel_chains),
            "max_peel_chain_length": max_peel_len,
            "total_peeled_volume": round(total_peeled_vol, 4),
            "deposit_proxies_count": len(deposit_sweeps),
            "total_forwarded_volume": round(total_forwarded_vol, 4),
            "communities_count": len(communities),
            "modularity_score": mod_score,
            "graph_nodes": len(graph.nodes),
            "graph_edges": len(graph.edges)
        }

        narratives = [
            f"Graph heuristic analysis: {len(sweeps)} consolidation node(s), "
            f"{len(peel_chains)} peeling chain(s) across {len(graph.nodes)} addresses."
        ]
        if deposit_sweeps:
            vasps = ", ".join(sorted(set(d.destination_vasp for d in deposit_sweeps)))
            narratives.append(
                f"{len(deposit_sweeps)} deposit-address proxy sweep(s) identified routing to {vasps}."
            )
        if communities:
            narratives.append(
                f"NetworkX Louvain partitioned graph into {len(communities)} community cluster(s) "
                f"(modularity Q={mod_score:.3f})."
            )

        summary_text = " | ".join(narratives)

        return HeuristicAnalysisSummary(
            address=root_wallet,
            chain="graph",
            cluster=None,
            sweeps_detected=sweeps,
            peel_chains_detected=peel_chains,
            deposit_forwarding_detected=deposit_sweeps,
            communities_detected=communities,
            modularity_score=mod_score,
            metrics=metrics,
            summary=summary_text
        )



# Global default heuristics engine
heuristics_engine = HeuristicsEngine()
