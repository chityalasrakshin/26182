"""
Account-Based (EVM & Tron) Deposit Clustering & NetworkX Graph Science.

Adapted from GraphSense open-source intelligence models and academic graph analytics:
1. Deposit-Address Forwarding Heuristic:
   Detects customer deposit proxies on account-based chains (Ethereum, Polygon, BNB, Tron)
   where funds are repeatedly forwarded into a known exchange hot wallet (sweep pattern).
2. NetworkX Louvain Modularity Community Detection:
   Partitions transaction subgraphs into discrete communities and syndicates,
   calculating Newman-Girvan graph modularity (Q) to separate laundering rings.
"""

import logging
from typing import List, Dict, Optional, Any, Set, Tuple
import networkx as nx

from backend.app.core.address_validator import normalize_address
from backend.app.services.labels.store import label_store, LabelStore
from backend.app.schemas.heuristics import (
    DepositForwardingResult,
    GraphCommunityResult
)

logger = logging.getLogger(__name__)


def _safe_normalize(addr: str) -> str:
    """Safely normalizes an address, falling back gracefully for test/mock addresses."""
    if not addr or not isinstance(addr, str):
        return ""
    clean = addr.strip()
    try:
        return normalize_address(clean)
    except Exception:
        return clean.lower() if clean.startswith("0x") else clean


class AccountDepositClusterer:
    """
    Forensic clustering engine for account-based blockchains (Ethereum, Tron, etc.).
    """

    def __init__(self, store: Optional[LabelStore] = None):
        self.label_store = store or label_store

    def detect_deposit_forwarding(
        self,
        transactions: List[Dict[str, Any]],
        known_vasps: Optional[Set[str]] = None,
        min_forwarding_ratio: float = 0.80,
        chain: str = "ethereum"
    ) -> List[DepositForwardingResult]:
        """
        Detects intermediate customer deposit proxies that receive funds and subsequently
        forward >= min_forwarding_ratio into a known exchange hot wallet.
        """
        if not transactions:
            return []

        # 1. Normalize and index transactions
        inbound_by_addr: Dict[str, List[Dict[str, Any]]] = {}
        outbound_by_addr: Dict[str, List[Dict[str, Any]]] = {}

        for tx in transactions:
            src = _safe_normalize(tx.get("from_address") or tx.get("source") or tx.get("sender") or "")
            dst = _safe_normalize(tx.get("to_address") or tx.get("target") or tx.get("recipient") or "")
            amt = float(tx.get("amount") or tx.get("value") or 0.0)
            tx_h = tx.get("tx_hash") or tx.get("hash") or ""

            if not src or not dst or amt <= 0:
                continue

            inbound_by_addr.setdefault(dst, []).append({"from": src, "amount": amt, "tx_hash": tx_h})
            outbound_by_addr.setdefault(src, []).append({"to": dst, "amount": amt, "tx_hash": tx_h})

        results: List[DepositForwardingResult] = []

        # 2. Check each candidate intermediate address
        for intermediate_addr, in_txs in inbound_by_addr.items():
            out_txs = outbound_by_addr.get(intermediate_addr, [])
            if not out_txs:
                continue

            total_inbound = sum(t["amount"] for t in in_txs)
            if total_inbound <= 0:
                continue

            # Group outbound by destination VASP
            for out in out_txs:
                dest_addr = out["to"]
                forwarded_amt = out["amount"]

                # Check if destination is a known VASP
                is_known_vasp = False
                vasp_name = "Unknown Exchange"

                if known_vasps and (dest_addr in known_vasps or dest_addr.lower() in known_vasps):
                    is_known_vasp = True
                    lbl = self.label_store.lookup(dest_addr, chain=chain)
                    if lbl:
                        vasp_name = lbl.entity
                else:
                    lbl = self.label_store.lookup(dest_addr, chain=chain)
                    if lbl and (lbl.is_vasp or lbl.category == "exchange"):
                        is_known_vasp = True
                        vasp_name = lbl.entity

                if not is_known_vasp:
                    continue

                # Check forwarding ratio
                ratio = min(1.0, round(forwarded_amt / total_inbound, 4))
                if ratio >= min_forwarding_ratio:
                    conf = 0.96 if ratio >= 0.90 else 0.88
                    in_hashes = [t["tx_hash"] for t in in_txs if t["tx_hash"]]
                    out_hashes = [out["tx_hash"]] if out["tx_hash"] else []

                    explanation = (
                        f"Address {intermediate_addr[:10]}... received {total_inbound:.4f} {chain.upper()} "
                        f"and forwarded {forwarded_amt:.4f} ({ratio*100:.1f}%) to {vasp_name} "
                        f"hot wallet ({dest_addr[:10]}...), identifying it as an exchange customer deposit proxy."
                    )

                    results.append(
                        DepositForwardingResult(
                            intermediate_address=intermediate_addr,
                            destination_vasp=vasp_name,
                            destination_address=dest_addr,
                            chain=chain,
                            inbound_amount=round(total_inbound, 6),
                            forwarded_amount=round(forwarded_amt, 6),
                            forwarding_ratio=ratio,
                            inbound_tx_hashes=in_hashes,
                            forwarding_tx_hashes=out_hashes,
                            confidence_score=conf,
                            is_deposit_proxy=True,
                            explanation=explanation
                        )
                    )

        return results

    def detect_communities(
        self,
        graph: Optional[nx.MultiDiGraph] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
        chain: str = "ethereum"
    ) -> Tuple[List[GraphCommunityResult], float]:
        """
        Runs NetworkX Louvain community detection to partition the graph into modular
        cohesive clusters (syndicates/deposit rings) and returns modularity score Q.
        """
        # 1. Build or normalize graph
        if graph is None and transactions:
            graph = nx.MultiDiGraph()
            for tx in transactions:
                src = _safe_normalize(tx.get("from_address") or tx.get("source") or tx.get("sender") or "")
                dst = _safe_normalize(tx.get("to_address") or tx.get("target") or tx.get("recipient") or "")
                amt = float(tx.get("amount") or tx.get("value") or 1.0)
                if src and dst:
                    graph.add_edge(src, dst, weight=amt)

        if not graph or len(graph.nodes) < 2:
            return [], 0.0

        # 2. Convert to undirected graph with aggregated weights for Louvain
        G_undir = nx.Graph()
        for u, v, data in graph.edges(data=True):
            if u == v:
                continue
            weight = float(data.get("amount") or data.get("value") or data.get("weight") or 1.0)
            if G_undir.has_edge(u, v):
                G_undir[u][v]["weight"] += weight
            else:
                G_undir.add_edge(u, v, weight=weight)

        for n in graph.nodes:
            if not G_undir.has_node(n):
                G_undir.add_node(n)

        # 3. Compute Louvain communities
        try:
            communities = list(nx.community.louvain_communities(G_undir, weight="weight", seed=42))
        except Exception as e:
            logger.warning(f"Louvain community detection error: {e}, falling back to connected components.")
            communities = list(nx.connected_components(G_undir))

        # 4. Compute Modularity Score Q
        modularity_score = 0.0
        if len(G_undir.edges) > 0 and len(communities) > 1:
            try:
                modularity_score = float(nx.community.modularity(G_undir, communities, weight="weight"))
            except Exception:
                modularity_score = 0.0

        # 5. Format community results
        results: List[GraphCommunityResult] = []
        # Sort communities by size descending
        sorted_communities = sorted(communities, key=lambda c: len(c), reverse=True)

        for idx, com_nodes in enumerate(sorted_communities):
            members = sorted(list(com_nodes))
            # Calculate internal volume
            internal_vol = 0.0
            subg = G_undir.subgraph(com_nodes)
            for _, _, data in subg.edges(data=True):
                internal_vol += data.get("weight", 0.0)

            # Identify dominant entity/category from LabelStore
            dominant_entity = None
            dominant_category = None

            for m in members:
                lbl = self.label_store.lookup(m, chain=chain)
                if lbl:
                    dominant_entity = lbl.entity
                    dominant_category = lbl.category
                    break

            results.append(
                GraphCommunityResult(
                    community_id=f"COMMUNITY-{idx + 1}",
                    members=members,
                    size=len(members),
                    total_internal_volume=round(internal_vol, 4),
                    dominant_entity=dominant_entity,
                    dominant_category=dominant_category or "suspect_cluster",
                    modularity_contribution=round(modularity_score / max(1, len(sorted_communities)), 4)
                )
            )

        return results, round(modularity_score, 4)


# Global default instance
account_deposit_clusterer = AccountDepositClusterer()
