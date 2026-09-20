"""Graph presentation adapter.

Keeps NetworkX and traversal concerns out of the API/UI contract.  The existing
builder remains the source of truth; this adapter normalizes additive metadata
for newer graph clients without changing traversal or persistence behavior.
"""

from typing import Any, Dict, Optional
import networkx as nx

from backend.app.schemas.analysis import GraphData


def build_graph_response(
    graph: nx.MultiDiGraph,
    *,
    target_address: str,
    blockchain: str = "unknown",
    base_response: Optional[GraphData] = None,
) -> GraphData:
    """Return a frontend-ready response while preserving existing Cytoscape data."""
    if base_response is not None:
        response = base_response
        max_hop = max((int(node.data.hop or 0) for node in response.nodes), default=0)
        response.metadata = {
            "targetAddress": target_address,
            "blockchain": blockchain,
            "totalNodes": len(response.nodes),
            "totalEdges": len(response.edges),
            "totalTransactions": sum(edge.data.transaction_count for edge in response.edges),
            "maxHop": max_hop,
        }
        return response

    # Fallback for callers that only have a NetworkX graph.  The production
    # export path supplies base_response so all existing enrichment is retained.
    nodes = []
    for node_id, attrs in graph.nodes(data=True):
        nodes.append({"data": {"id": str(node_id), "address": str(node_id), "label": attrs.get("label", str(node_id)[:10]), **attrs}})
    edges = []
    for index, (source, target, key, attrs) in enumerate(graph.edges(keys=True, data=True)):
        edges.append({"data": {"id": str(attrs.get("tx_hash") or key or index), "source": str(source), "target": str(target), **attrs}})
    return GraphData(
        nodes=nodes,  # type: ignore[arg-type]
        edges=edges,  # type: ignore[arg-type]
        stats={"root_wallet": target_address, "total_nodes": len(nodes), "total_edges": len(edges)},
        metadata={"targetAddress": target_address, "blockchain": blockchain, "totalNodes": len(nodes), "totalEdges": len(edges), "totalTransactions": len(edges), "maxHop": 0},
    )
