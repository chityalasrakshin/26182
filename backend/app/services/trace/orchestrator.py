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
from backend.app.services.bridge.detector import bridge_detector

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
        self.is_cached = blockchain_cache.is_cached(self.chain, self.seed_address)
        self.event_callback = event_callback

        # Graph representations
        self.nx_graph = nx.MultiDiGraph()
        self.node_hops: Dict[str, int] = {}
        self.node_chains: Dict[str, str] = {}
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
            "max_nodes": self.max_nodes,
            "is_cached": self.is_cached
        })

        # Ensure Neo4j connection is ready
        neo4j_client.connect()

        # 1. Initialize Seed Wallet Node
        root_label = label_store.lookup(self.seed_address, self.chain)
        self.node_hops[self.seed_address] = 0
        self.node_chains[self.seed_address] = self.chain
        self._add_node_to_nx_graph(self.seed_address, hop=0, label=root_label, chain=self.chain)
        neo4j_client.upsert_wallet_node(self.seed_address, self.chain, root_label)

        await self._emit_event("NODE_DISCOVERED", 0, {
            "address": self.seed_address,
            "chain": self.chain,
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
                "chain": self.chain,
                "entity": root_label.entity,
                "category": root_label.category,
                "confidence": root_label.confidence,
                "hop": 0,
                "path": [self.seed_address]
            })
            await self._emit_event("VASP_REACHED", 0, {
                "address": self.seed_address,
                "chain": self.chain,
                "vasp_name": root_label.entity,
                "hop": 0,
                "path": [self.seed_address]
            })

        # BFS queue stores: (address, current_hop, path_of_addresses, current_chain)
        queue: List[Tuple[str, int, List[str], str]] = [(self.seed_address, 0, [self.seed_address], self.chain)]
        current_level_hop = 0

        while queue and len(self.nx_graph.nodes) < self.max_nodes:
            current_address, current_hop, path, current_chain = queue.pop(0)

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
                    "chain": current_chain,
                    "hop": current_hop,
                    "path": path,
                    "in_degree": self.nx_graph.in_degree(current_address) if current_address in self.nx_graph else 0,
                    "out_degree": self.nx_graph.out_degree(current_address) if current_address in self.nx_graph else 0
                })
                continue

            await self._emit_event("EXPANDING_NODE", current_hop, {
                "address": current_address,
                "chain": current_chain,
                "hop": current_hop
            })

            # Dynamically resolve provider for current node's blockchain
            provider = BlockchainProviderFactory.get_provider(current_chain)

            # Fetch outgoing transfers (with caching and throttle protection)
            fetch_error = None
            try:
                txs = await provider.get_outgoing_txs(
                    current_address,
                    max_tx=self.max_tx_per_address
                )
            except Exception as e:
                logger.warning(f"Error fetching outgoing txs for {current_address} on {current_chain} hop {current_hop}: {e}")
                fetch_error = e
                txs = []

            # If no outgoing transactions, try combined activity
            if not txs:
                try:
                    activity = await provider.get_address_activity(
                        current_address,
                        max_tx=self.max_tx_per_address
                    )
                    curr_norm = current_address.strip() if current_chain == "solana" else current_address.lower()
                    txs = [t for t in activity if (t.from_address.strip() if current_chain == "solana" else t.from_address.lower()) == curr_norm]
                    fetch_error = None
                except Exception as e:
                    logger.debug(f"Activity query notice for {current_address}: {e}")
                    if fetch_error is None:
                        fetch_error = e
                    txs = []

            if not txs and current_hop == 0 and fetch_error is not None:
                raise ConnectionError(f"Failed fetching blockchain transactions for seed address {current_address}: {fetch_error}")

            if not txs:
                # Terminal dead-end on this branch
                if current_hop > 0 and current_address not in [v["address"] for v in self.matched_vasps]:
                    self.leaf_nodes.append({
                        "address": current_address,
                        "chain": current_chain,
                        "hop": current_hop,
                        "path": path,
                        "in_degree": self.nx_graph.in_degree(current_address) if current_address in self.nx_graph else 0,
                        "out_degree": 0
                    })
                continue

            # Process transactions
            for tx in txs:
                u = tx.from_address.strip() if current_chain == "solana" else (tx.from_address.lower() if tx.from_address else "")
                v = tx.to_address.strip() if current_chain == "solana" else (tx.to_address.lower() if tx.to_address else "")

                if not u or not v:
                    continue

                tx.hop = current_hop + 1
                self.all_transactions.append(tx)

                # Inspect for cross-chain bridge activity
                bridge_info = bridge_detector.inspect(tx, current_chain=current_chain)

                if bridge_info and bridge_info.is_bridge and bridge_info.destination_address:
                    dest_chain = (bridge_info.destination_chain or "ethereum").lower()
                    dest_addr = bridge_info.destination_address.strip() if dest_chain == "solana" else bridge_info.destination_address.lower()
                    bridge_contract_addr = bridge_info.bridge_contract or v
                    if current_chain != "solana":
                        bridge_contract_addr = bridge_contract_addr.lower()

                    bridge_hop = current_hop + 1
                    dest_hop = bridge_hop + 1

                    # 1. Add Bridge Contract Node
                    if bridge_contract_addr not in self.node_hops:
                        self.node_hops[bridge_contract_addr] = bridge_hop
                        self.node_chains[bridge_contract_addr] = current_chain
                        self._add_node_to_nx_graph(
                            bridge_contract_addr,
                            hop=bridge_hop,
                            role="BRIDGE_PROTOCOL",
                            chain=current_chain,
                            bridge_protocol=bridge_info.protocol
                        )
                        neo4j_client.upsert_wallet_node(bridge_contract_addr, current_chain)

                        await self._emit_event("NODE_DISCOVERED", bridge_hop, {
                            "address": bridge_contract_addr,
                            "chain": current_chain,
                            "hop": bridge_hop,
                            "is_vasp": False,
                            "label": f"[Bridge: {bridge_info.protocol}]",
                            "entity": bridge_info.protocol or "Bridge",
                            "risk_level": "LOW",
                            "category": "bridge"
                        })

                    # Edge from u to bridge contract
                    edge_id = f"{tx.tx_hash}_{u[:6]}_{bridge_contract_addr[:6]}_{tx.token_symbol}"
                    self.nx_graph.add_edge(
                        u,
                        bridge_contract_addr,
                        key=edge_id,
                        tx_hash=tx.tx_hash,
                        asset_symbol=tx.token_symbol or ("SOL" if current_chain == "solana" else "ETH"),
                        amount=tx.amount,
                        timestamp=tx.timestamp,
                        hop=bridge_hop,
                        is_cross_chain=False,
                        source_chain=current_chain,
                        target_chain=current_chain
                    )
                    neo4j_client.ingest_transaction(tx, chain=current_chain)

                    await self._emit_event("EDGE_ADDED", bridge_hop, {
                        "from_address": u,
                        "to_address": bridge_contract_addr,
                        "tx_hash": tx.tx_hash,
                        "amount": tx.amount,
                        "asset": tx.token_symbol or ("SOL" if current_chain == "solana" else "ETH"),
                        "hop": bridge_hop
                    })

                    # 2. Add Target Recipient Node on Destination Chain
                    dest_label = label_store.lookup(dest_addr, dest_chain)
                    is_dest_vasp = bool(dest_label and dest_label.is_vasp)

                    if dest_addr not in self.node_hops:
                        self.node_hops[dest_addr] = dest_hop
                        self.node_chains[dest_addr] = dest_chain
                        self._add_node_to_nx_graph(dest_addr, hop=dest_hop, label=dest_label, chain=dest_chain)
                        neo4j_client.upsert_wallet_node(dest_addr, dest_chain, dest_label)

                        await self._emit_event("NODE_DISCOVERED", dest_hop, {
                            "address": dest_addr,
                            "chain": dest_chain,
                            "hop": dest_hop,
                            "is_vasp": is_dest_vasp,
                            "label": dest_label.label if dest_label else f"Recipient ({dest_chain.upper()})",
                            "entity": dest_label.entity if dest_label else "Unknown",
                            "risk_level": dest_label.risk_level if dest_label else "LOW",
                            "category": dest_label.category if dest_label else "unknown"
                        })

                    # 3. Add Cross-Chain Directed Edge
                    cross_edge_id = f"bridge_{tx.tx_hash}_{bridge_contract_addr[:6]}_{dest_addr[:6]}"
                    self.nx_graph.add_edge(
                        bridge_contract_addr,
                        dest_addr,
                        key=cross_edge_id,
                        tx_hash=tx.tx_hash,
                        is_cross_chain=True,
                        bridge_protocol=bridge_info.protocol,
                        source_chain=current_chain,
                        target_chain=dest_chain,
                        amount=tx.amount,
                        asset_symbol=tx.token_symbol or "ETH",
                        timestamp=tx.timestamp,
                        hop=dest_hop
                    )

                    # 4. Ingest into Neo4j with Cross-Chain Edge Label
                    neo4j_client.ingest_cross_chain_transfer(
                        from_addr=bridge_contract_addr,
                        from_chain=current_chain,
                        to_addr=dest_addr,
                        to_chain=dest_chain,
                        protocol=bridge_info.protocol or "Bridge",
                        tx_hash=tx.tx_hash,
                        amount=tx.amount,
                        asset=tx.token_symbol or "ETH",
                        timestamp=tx.timestamp
                    )

                    # 5. Emit Real-Time WebSocket/SSE Event
                    await self._emit_event("CROSS_CHAIN_HOP_DETECTED", dest_hop, {
                        "bridge_protocol": bridge_info.protocol,
                        "bridge_contract": bridge_contract_addr,
                        "from_chain": current_chain,
                        "to_chain": dest_chain,
                        "recipient": dest_addr,
                        "amount": tx.amount,
                        "asset": tx.token_symbol or "ETH",
                        "tx_hash": tx.tx_hash,
                        "hop": dest_hop
                    })

                    new_path = path + [bridge_contract_addr, dest_addr]

                    # 6. Check if Destination Node is already a VASP
                    if is_dest_vasp:
                        logger.info(f"TERMINAL VASP REACHED CROSS-CHAIN: {dest_label.entity} ({dest_addr}) on {dest_chain} at hop {dest_hop}")
                        vasp_record = {
                            "address": dest_addr,
                            "chain": dest_chain,
                            "entity": dest_label.entity,
                            "category": dest_label.category,
                            "confidence": dest_label.confidence,
                            "hop": dest_hop,
                            "path": new_path,
                            "source_url": dest_label.source_url
                        }
                        if not any(item["address"] == dest_addr for item in self.matched_vasps):
                            self.matched_vasps.append(vasp_record)

                        await self._emit_event("VASP_REACHED", dest_hop, {
                            "address": dest_addr,
                            "chain": dest_chain,
                            "vasp_name": dest_label.entity,
                            "hop": dest_hop,
                            "path": new_path,
                            "confidence": dest_label.confidence
                        })
                        # Terminal match: Stop this branch!
                        continue
                    else:
                        # Enqueue destination address with dest_chain for subsequent hop expansion!
                        if dest_hop < self.max_depth and len(self.nx_graph.nodes) < self.max_nodes:
                            if dest_addr not in self.visited_addresses:
                                queue.append((dest_addr, dest_hop, new_path, dest_chain))
                        elif dest_hop == self.max_depth:
                            self.leaf_nodes.append({
                                "address": dest_addr,
                                "chain": dest_chain,
                                "hop": dest_hop,
                                "path": new_path,
                                "in_degree": self.nx_graph.in_degree(dest_addr) if dest_addr in self.nx_graph else 0,
                                "out_degree": 0
                            })
                        continue

                # Regular transaction processing
                neo4j_client.ingest_transaction(tx, chain=current_chain)

                # Next hop address is recipient
                next_addr = v
                next_hop = current_hop + 1

                # Lookup in LabelStore
                label_info = label_store.lookup(next_addr, current_chain)
                is_vasp = bool(label_info and label_info.is_vasp)

                # Add node to NetworkX if not already present
                is_new_node = next_addr not in self.node_hops
                if is_new_node:
                    self.node_hops[next_addr] = next_hop
                    self.node_chains[next_addr] = current_chain
                    self._add_node_to_nx_graph(next_addr, hop=next_hop, label=label_info, chain=current_chain)
                    neo4j_client.upsert_wallet_node(next_addr, current_chain, label_info)

                    await self._emit_event("NODE_DISCOVERED", next_hop, {
                        "address": next_addr,
                        "chain": current_chain,
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
                    asset_symbol=tx.token_symbol or ("SOL" if current_chain == "solana" else "ETH"),
                    amount=tx.amount,
                    timestamp=tx.timestamp,
                    hop=next_hop,
                    is_cross_chain=False,
                    source_chain=current_chain,
                    target_chain=current_chain
                )

                await self._emit_event("EDGE_ADDED", next_hop, {
                    "from_address": u,
                    "to_address": v,
                    "tx_hash": tx.tx_hash,
                    "amount": tx.amount,
                    "asset": tx.token_symbol or ("SOL" if current_chain == "solana" else "ETH"),
                    "hop": next_hop
                })

                new_path = path + [next_addr]

                # --- EARLY STOPPING CHECK ---
                if is_vasp:
                    # TERMINAL MATCH: Branch ends here
                    logger.info(f"TERMINAL VASP REACHED: {label_info.entity} ({next_addr}) at hop {next_hop}")
                    vasp_record = {
                        "address": next_addr,
                        "chain": current_chain,
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
                        "chain": current_chain,
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
                        queue.append((next_addr, next_hop, new_path, current_chain))
                elif next_hop == self.max_depth:
                    self.leaf_nodes.append({
                        "address": next_addr,
                        "chain": current_chain,
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
                        node_chain = self.node_chains.get(addr, self.chain)
                        lbl = label_store.lookup(addr, node_chain)
                        path_nodes.append({
                            "address": addr,
                            "chain": node_chain,
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
            "is_cached": self.is_cached,
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
        """Exports in-memory graph to Cytoscape format with multi-chain & bridge metadata."""
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        for node_id, data in self.nx_graph.nodes(data=True):
            role = data.get("role", "INTERMEDIARY")
            node_chain = data.get("chain") or self.node_chains.get(node_id, self.chain)
            lbl = label_store.lookup(node_id, node_chain)
            is_vasp = bool(lbl and lbl.is_vasp)

            if role == "BRIDGE_PROTOCOL":
                proto_name = data.get("bridge_protocol") or "Bridge"
                label_text = f"[Bridge: {proto_name}]"
            elif is_vasp:
                label_text = lbl.entity
            else:
                label_text = f"{node_id[:6]}...{node_id[-4:]}"

            nodes.append(
                GraphNode(
                    data=GraphNodeData(
                        id=node_id,
                        label=label_text,
                        address=node_id,
                        role=role,
                        hop=data.get("hop", 0),
                        is_vasp=is_vasp,
                        vasp_name=lbl.entity if is_vasp else None,
                        risk_score=90.0 if (lbl and lbl.risk_level == "CRITICAL") else (10.0 if is_vasp else 40.0),
                        confidence="HIGH" if is_vasp else "UNVERIFIED",
                        chain=node_chain
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
                        asset_symbol=data.get("asset_symbol", "ETH"),
                        amount=data.get("amount", 0.0),
                        timestamp=data.get("timestamp") or datetime.now(timezone.utc),
                        hop=data.get("hop", 1),
                        is_cross_chain=data.get("is_cross_chain", False),
                        bridge_protocol=data.get("bridge_protocol"),
                        source_chain=data.get("source_chain"),
                        target_chain=data.get("target_chain")
                    )
                )
            )

        stats = {
            "root_wallet": self.seed_address,
            "chain": self.chain,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "vasp_nodes_found": sum(1 for n in nodes if n.data.is_vasp),
            "cross_chain_edges": sum(1 for e in edges if e.data.is_cross_chain),
            "max_hop_reached": max([n.data.hop for n in nodes], default=0)
        }

        return GraphData(nodes=nodes, edges=edges, stats=stats)

    def _add_node_to_nx_graph(
        self,
        address: str,
        hop: int,
        label: Optional[AddressLabel] = None,
        role: Optional[str] = None,
        chain: Optional[str] = None,
        bridge_protocol: Optional[str] = None
    ):
        is_vasp = bool(label and label.is_vasp)
        node_chain = chain or self.node_chains.get(address, self.chain)
        self.node_chains[address] = node_chain

        if role is None:
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
            chain=node_chain,
            is_vasp=is_vasp,
            entity=label.entity if label else ("Bridge" if role == "BRIDGE_PROTOCOL" else "Unknown"),
            category=label.category if label else ("bridge" if role == "BRIDGE_PROTOCOL" else "unknown"),
            risk_level=label.risk_level if label else "LOW",
            bridge_protocol=bridge_protocol
        )
