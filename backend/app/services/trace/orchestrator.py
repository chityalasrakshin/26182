"""
Multi-Hop Trace Orchestrator for Blockchain VASP Attribution.

Performs bounded BFS outward from a seed wallet up to configurable `max_depth`.
Features:
- Evaluates every discovered address against `LabelStore` after each hop.
- Early Stopping: Immediately stops expanding any branch that hits a known VASP
  (or terminal entity), recording the full chain-of-custody path.
- Cypher ShortestPath: Resolves exact shortest path to VASP in Neo4j (with
  NetworkX fallback if Neo4j is offline).
- Graceful Unresolved Handling: If no VASP is found within depth limit, returns
  the partial graph and nearest-but-unlabeled leaf nodes (not an error).
- Real-Time Event Emission: Emits granular events (HOP_STARTED, NODE_DISCOVERED,
  EDGE_ADDED, VASP_REACHED, HOP_COMPLETED, TRACE_COMPLETED).
"""

import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Set, Tuple, Any, Optional, Callable, Awaitable
import networkx as nx

from backend.app.core.config import settings
from backend.app.core.address_validator import detect_blockchain, normalize_address
from backend.app.schemas.analysis import NormalizedTransaction, GraphData, GraphNode, GraphNodeData, GraphEdge, GraphEdgeData
from backend.app.schemas.trace import TraceEvent
from backend.app.services.blockchain.factory import BlockchainProviderFactory
from backend.app.services.blockchain.cache import blockchain_cache
from backend.app.services.labels.store import label_store, AddressLabel
from backend.app.services.graph.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)


class TraceOrchestrator:
    """
    Orchestrates multi-hop, async fund-flow traces outward from suspect wallets.
    """

    def __init__(
        self,
        seed_address: str,
        chain: Optional[str] = None,
        max_depth: int = 6,
        max_nodes: int = 150,
        max_tx_per_address: int = 30,
        job_id: Optional[str] = None,
        event_callback: Optional[Callable[[TraceEvent], Awaitable[None]]] = None
    ):
        self.seed_address = normalize_address(seed_address)
        self.chain = (chain or detect_blockchain(self.seed_address)).lower()
        self.max_depth = min(max_depth, 10)
        self.max_nodes = max_nodes or settings.MAX_NODES_PER_ANALYSIS
        self.max_tx_per_address = max_tx_per_address or settings.MAX_TRANSACTIONS_PER_ADDRESS
        self.job_id = job_id or f"trace_{int(time.time())}"
        self.event_callback = event_callback

        # Graph representations
        self.nx_graph = nx.MultiDiGraph()
        self.node_hops: Dict[str, int] = {}
        self.all_transactions: List[NormalizedTransaction] = []
        self.matched_vasps: List[Dict[str, Any]] = []
        self.leaf_nodes: List[Dict[str, Any]] = []
        self.visited_addresses: Set[str] = set()

    async def _emit_event(self, event_name: str, hop: int, data: Dict[str, Any]):
        """Dispatches real-time event to registered callback / SSE / WebSocket listeners."""
        if not self.event_callback:
            return
        event = TraceEvent(
            event=event_name,
            job_id=self.job_id,
            hop=hop,
            timestamp=datetime.now(timezone.utc),
            data=data
        )
        try:
            await self.event_callback(event)
        except Exception as e:
            logger.warning(f"Failed to dispatch trace event {event_name}: {e}")

    async def run_trace(self) -> Dict[str, Any]:
        """
        Executes the multi-hop BFS trace.
        Returns complete trace result including paths, graph summary, and leaf nodes.
        """
        logger.info(f"Starting multi-hop trace: {self.seed_address} on {self.chain} (max_depth={self.max_depth}, job={self.job_id})")
        start_time = datetime.now(timezone.utc)

        await self._emit_event("JOB_STARTED", 0, {
            "address": self.seed_address,
            "chain": self.chain,
            "max_depth": self.max_depth,
            "max_nodes": self.max_nodes
        })

        # Ensure Neo4j connection is ready
        neo4j_client.connect()

        # Initialize provider
        provider = BlockchainProviderFactory.get_provider(self.chain)

        # 1. Initialize Seed Wallet Node
        root_label = label_store.lookup(self.seed_address, self.chain)
        self.node_hops[self.seed_address] = 0
        self._add_node_to_nx_graph(self.seed_address, hop=0, label=root_label)
        neo4j_client.upsert_wallet_node(self.seed_address, self.chain, root_label)

        await self._emit_event("NODE_DISCOVERED", 0, {
            "address": self.seed_address,
            "hop": 0,
            "is_vasp": bool(root_label and root_label.is_vasp),
            "label": root_label.label if root_label else "Suspect Root Wallet",
            "entity": root_label.entity if root_label else "Suspect Root",
            "risk_level": root_label.risk_level if root_label else "SUSPECT"
        })

        # Check if seed itself is already a VASP
        if root_label and root_label.is_vasp:
            self.matched_vasps.append({
                "address": self.seed_address,
                "entity": root_label.entity,
                "category": root_label.category,
                "confidence": root_label.confidence,
                "hop": 0,
                "path": [self.seed_address]
            })
            await self._emit_event("VASP_REACHED", 0, {
                "address": self.seed_address,
                "vasp_name": root_label.entity,
                "hop": 0,
                "path": [self.seed_address]
            })

        # BFS queue stores: (address, current_hop, path_of_addresses)
        queue: List[Tuple[str, int, List[str]]] = [(self.seed_address, 0, [self.seed_address])]
        current_level_hop = 0

        while queue and len(self.nx_graph.nodes) < self.max_nodes:
            current_address, current_hop, path = queue.pop(0)

            # Detect new hop level transition
            if current_hop > current_level_hop:
                await self._emit_event("HOP_COMPLETED", current_level_hop, {
                    "hop": current_level_hop,
                    "nodes_count": len(self.nx_graph.nodes),
                    "edges_count": len(self.nx_graph.edges),
                    "vasps_found_so_far": len(self.matched_vasps)
                })
                current_level_hop = current_hop
                await self._emit_event("HOP_STARTED", current_hop, {
                    "hop": current_hop,
                    "queue_remaining": len(queue) + 1
                })

            if current_address in self.visited_addresses:
                continue
            self.visited_addresses.add(current_address)

            # If node is at max_depth, do not expand further; record as potential frontier leaf
            if current_hop >= self.max_depth:
                self.leaf_nodes.append({
                    "address": current_address,
                    "hop": current_hop,
                    "path": path,
                    "in_degree": self.nx_graph.in_degree(current_address) if current_address in self.nx_graph else 0,
                    "out_degree": self.nx_graph.out_degree(current_address) if current_address in self.nx_graph else 0
                })
                continue

            await self._emit_event("EXPANDING_NODE", current_hop, {
                "address": current_address,
                "hop": current_hop
            })

            # Fetch outgoing transfers (with caching and throttle protection)
            try:
                txs = await provider.get_outgoing_txs(
                    current_address,
                    max_tx=self.max_tx_per_address
                )
            except Exception as e:
                logger.warning(f"Error fetching outgoing txs for {current_address} on hop {current_hop}: {e}")
                txs = []

            # If no outgoing transactions, try combined activity
            if not txs:
                try:
                    activity = await provider.get_address_activity(
                        current_address,
                        max_tx=self.max_tx_per_address
                    )
                    curr_norm = current_address.lower()
                    txs = [t for t in activity if t.from_address.lower() == curr_norm]
                except Exception as e:
                    logger.debug(f"Activity fallback notice for {current_address}: {e}")
                    txs = []

            if not txs:
                # Terminal dead-end on this branch
                if current_hop > 0 and current_address not in [v["address"] for v in self.matched_vasps]:
                    self.leaf_nodes.append({
                        "address": current_address,
                        "hop": current_hop,
                        "path": path,
                        "in_degree": self.nx_graph.in_degree(current_address) if current_address in self.nx_graph else 0,
                        "out_degree": 0
                    })
                continue

            # Process transactions
            for tx in txs:
                u = tx.from_address.lower() if tx.from_address else ""
                v = tx.to_address.lower() if tx.to_address else ""

                if not u or not v:
                    continue

                tx.hop = current_hop + 1
                self.all_transactions.append(tx)

                # Ingest to Neo4j
                neo4j_client.ingest_transaction(tx, chain=self.chain)

                # Next hop address is recipient
                next_addr = v
                next_hop = current_hop + 1

                # Lookup in LabelStore
                label_info = label_store.lookup(next_addr, self.chain)
                is_vasp = bool(label_info and label_info.is_vasp)

                # Add node to NetworkX if not already present
                is_new_node = next_addr not in self.node_hops
                if is_new_node:
                    self.node_hops[next_addr] = next_hop
                    self._add_node_to_nx_graph(next_addr, hop=next_hop, label=label_info)
                    neo4j_client.upsert_wallet_node(next_addr, self.chain, label_info)

                    await self._emit_event("NODE_DISCOVERED", next_hop, {
                        "address": next_addr,
                        "hop": next_hop,
                        "is_vasp": is_vasp,
                        "label": label_info.label if label_info else "Unlabeled",
                        "entity": label_info.entity if label_info else "Unknown",
                        "risk_level": label_info.risk_level if label_info else "LOW",
                        "category": label_info.category if label_info else "unknown"
                    })

                # Add directed edge in NetworkX
                edge_id = f"{tx.tx_hash}_{u[:6]}_{v[:6]}_{tx.token_symbol}"
                self.nx_graph.add_edge(
                    u,
                    v,
                    key=edge_id,
                    tx_hash=tx.tx_hash,
                    asset_symbol=tx.token_symbol or "ETH",
                    amount=tx.amount,
                    timestamp=tx.timestamp,
                    hop=next_hop
                )

                await self._emit_event("EDGE_ADDED", next_hop, {
                    "from_address": u,
                    "to_address": v,
                    "tx_hash": tx.tx_hash,
                    "amount": tx.amount,
                    "asset": tx.token_symbol or "ETH",
                    "hop": next_hop
                })

                new_path = path + [next_addr]

                # --- EARLY STOPPING CHECK ---
                if is_vasp:
                    # TERMINAL MATCH: Branch ends here
                    logger.info(f"TERMINAL VASP REACHED: {label_info.entity} ({next_addr}) at hop {next_hop}")
                    vasp_record = {
                        "address": next_addr,
                        "entity": label_info.entity,
                        "category": label_info.category,
                        "confidence": label_info.confidence,
                        "hop": next_hop,
                        "path": new_path,
                        "source_url": label_info.source_url
                    }
                    if not any(item["address"] == next_addr for item in self.matched_vasps):
                        self.matched_vasps.append(vasp_record)

                    await self._emit_event("VASP_REACHED", next_hop, {
                        "address": next_addr,
                        "vasp_name": label_info.entity,
                        "hop": next_hop,
                        "path": new_path,
                        "confidence": label_info.confidence
                    })
                    # Do NOT append to queue — this branch stops!
                    continue

                # If not VASP, continue BFS expansion if depth permits
                if next_hop < self.max_depth and len(self.nx_graph.nodes) < self.max_nodes:
                    if next_addr not in self.visited_addresses:
                        queue.append((next_addr, next_hop, new_path))
                elif next_hop == self.max_depth:
                    self.leaf_nodes.append({
                        "address": next_addr,
                        "hop": next_hop,
                        "path": new_path,
                        "in_degree": self.nx_graph.in_degree(next_addr) if next_addr in self.nx_graph else 0,
                        "out_degree": 0
                    })

        completed_time = datetime.now(timezone.utc)

        # 2. Resolve Shortest Path to VASP
        shortest_path_result = None
        if self.matched_vasps:
            # Sort matched VASPs by shortest hop distance
            self.matched_vasps.sort(key=lambda x: x["hop"])
            nearest_vasp = self.matched_vasps[0]

            # Try Cypher shortestPath via Neo4j
            neo4j_paths = neo4j_client.find_shortest_path_to_vasp(self.seed_address, max_hops=self.max_depth)
            if neo4j_paths:
                shortest_path_result = neo4j_paths[0]
            else:
                # Fallback: Extract from NetworkX graph
                try:
                    nx_path = nx.shortest_path(self.nx_graph, source=self.seed_address, target=nearest_vasp["address"])
                    path_nodes = []
                    for addr in nx_path:
                        lbl = label_store.lookup(addr, self.chain)
                        path_nodes.append({
                            "address": addr,
                            "label": lbl.label if lbl else "Unlabeled Address",
                            "is_vasp": bool(lbl and lbl.is_vasp),
                            "vasp_name": lbl.entity if (lbl and lbl.is_vasp) else "",
                            "category": lbl.category if lbl else "unknown"
                        })
                    shortest_path_result = {
                        "nodes": path_nodes,
                        "edges": nearest_vasp.get("path", []),
                        "hop_count": len(nx_path) - 1
                    }
                except Exception as e:
                    logger.debug(f"NetworkX path fallback notice: {e}")
                    shortest_path_result = {
                        "nodes": [{"address": a} for a in nearest_vasp["path"]],
                        "edges": [],
                        "hop_count": nearest_vasp["hop"]
                    }

        # Deduplicate leaf nodes
        seen_leaves = set()
        deduped_leaves = []
        for leaf in self.leaf_nodes:
            if leaf["address"] not in seen_leaves and leaf["address"] not in [v["address"] for v in self.matched_vasps]:
                seen_leaves.add(leaf["address"])
                deduped_leaves.append(leaf)
        self.leaf_nodes = deduped_leaves

        vasp_found = len(self.matched_vasps) > 0
        summary_msg = (
            f"Trace completed in {(completed_time - start_time).total_seconds():.2f}s: "
            f"Found {len(self.matched_vasps)} VASP endpoints ({nearest_vasp['entity'] if vasp_found else 'none'}) "
            f"across {len(self.nx_graph.nodes)} nodes and {len(self.nx_graph.edges)} edges."
            if vasp_found else
            f"Trace completed without VASP match within {self.max_depth} hops: "
            f"Explored {len(self.nx_graph.nodes)} nodes, {len(self.nx_graph.edges)} edges, {len(self.leaf_nodes)} frontier leaf nodes."
        )

        final_payload = {
            "job_id": self.job_id,
            "address": self.seed_address,
            "chain": self.chain,
            "status": "COMPLETED",
            "max_depth": self.max_depth,
            "current_depth": current_level_hop,
            "started_at": start_time,
            "completed_at": completed_time,
            "num_nodes": len(self.nx_graph.nodes),
            "num_edges": len(self.nx_graph.edges),
            "num_transactions": len(self.all_transactions),
            "vasp_found": vasp_found,
            "matched_vasps": self.matched_vasps,
            "shortest_path": shortest_path_result,
            "leaf_nodes": self.leaf_nodes[:10],  # Top frontier candidates
            "summary": summary_msg
        }

        await self._emit_event("TRACE_COMPLETED", current_level_hop, {
            "status": "COMPLETED",
            "vasp_found": vasp_found,
            "matched_vasps_count": len(self.matched_vasps),
            "total_nodes": len(self.nx_graph.nodes),
            "total_edges": len(self.nx_graph.edges),
            "shortest_path_hops": shortest_path_result.get("hop_count") if shortest_path_result else None
        })

        return final_payload

    def export_cytoscape_data(self) -> GraphData:
        """Exports in-memory graph to Cytoscape format."""
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        for node_id, data in self.nx_graph.nodes(data=True):
            role = data.get("role", "INTERMEDIARY")
            lbl = label_store.lookup(node_id, self.chain)
            is_vasp = bool(lbl and lbl.is_vasp)
            nodes.append(
                GraphNode(
                    data=GraphNodeData(
                        id=node_id,
                        label=lbl.entity if is_vasp else f"{node_id[:6]}...{node_id[-4:]}",
                        role=role,
                        hop=data.get("hop", 0),
                        is_vasp=is_vasp,
                        vasp_name=lbl.entity if is_vasp else None,
                        risk_score=90.0 if (lbl and lbl.risk_level == "CRITICAL") else (10.0 if is_vasp else 40.0),
                        confidence="HIGH" if is_vasp else "UNVERIFIED"
                    )
                )
            )

        for u, v, k, data in self.nx_graph.edges(keys=True, data=True):
            edges.append(
                GraphEdge(
                    data=GraphEdgeData(
                        id=str(k),
                        source=u,
                        target=v,
                        tx_hash=data.get("tx_hash", ""),
                        amount=data.get("amount", 0.0),
                        asset_symbol=data.get("asset_symbol", "ETH"),
                        hop=data.get("hop", 1)
                    )
                )
            )

        return GraphData(nodes=nodes, edges=edges)

    def _add_node_to_nx_graph(self, address: str, hop: int, label: Optional[AddressLabel] = None):
        is_vasp = bool(label and label.is_vasp)
        if hop == 0:
            role = "INPUT_WALLET"
        elif is_vasp:
            role = "KNOWN_VASP"
        else:
            role = f"HOP_{hop}"

        self.nx_graph.add_node(
            address,
            hop=hop,
            role=role,
            is_vasp=is_vasp,
            entity=label.entity if label else "Unknown",
            category=label.category if label else "unknown",
            risk_level=label.risk_level if label else "LOW"
        )
