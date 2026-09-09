"""
Bitcoin Common-Input-Ownership Heuristic (CIOH) Clustering Engine.

Principle:
In UTXO-based cryptocurrencies (like Bitcoin), when a transaction spends multiple
UTXOs simultaneously as inputs, the private keys for all those input addresses
must be supplied to authorize the transaction. Unless the transaction is an explicit
collaborative transaction (such as a CoinJoin), all input addresses are inferred
to be controlled by the same wallet entity or owner.

Implementation:
Uses Disjoint-Set Union (DSU) / Union-Find with path compression and union by rank
for efficient, near-linear time address clustering. Detects and optionally skips
CoinJoin structures to prevent false-positive cluster poisoning.
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Set, Optional, Tuple, Any

from backend.app.schemas.heuristics import (
    UTXOTransaction,
    UTXOInput,
    UTXOOutput,
    AddressCluster
)

logger = logging.getLogger(__name__)


class DisjointSetUnion:
    """
    Disjoint-Set Union (Union-Find) with path compression and union by rank.
    """

    def __init__(self):
        self.parent: Dict[str, str] = {}
        self.rank: Dict[str, int] = {}
        self.members: Dict[str, Set[str]] = defaultdict(set)

    def find(self, item: str) -> str:
        """Find representative of the set containing item with path compression."""
        if item not in self.parent:
            self.parent[item] = item
            self.rank[item] = 0
            self.members[item] = {item}
            return item

        # Path compression
        path = []
        curr = item
        while self.parent[curr] != curr:
            path.append(curr)
            curr = self.parent[curr]

        for node in path:
            self.parent[node] = curr

        return curr

    def union(self, x: str, y: str) -> str:
        """Union the sets containing x and y. Returns the new root."""
        root_x = self.find(x)
        root_y = self.find(y)

        if root_x == root_y:
            return root_x

        # Union by rank
        if self.rank[root_x] < self.rank[root_y]:
            root_x, root_y = root_y, root_x

        self.parent[root_y] = root_x
        if self.rank[root_x] == self.rank[root_y]:
            self.rank[root_x] += 1

        # Merge member sets
        self.members[root_x].update(self.members.pop(root_y, {root_y}))
        return root_x

    def get_set(self, item: str) -> Set[str]:
        """Get all elements in the set containing item."""
        root = self.find(item)
        return set(self.members.get(root, {root}))


class CommonInputClusteringEngine:
    """
    Clustering engine applying the Common-Input-Ownership Heuristic to UTXO transactions.
    """

    def __init__(self, filter_coinjoin: bool = True):
        self.dsu = DisjointSetUnion()
        self.filter_coinjoin = filter_coinjoin
        
        # Cluster metadata tracked by root representative
        self.cluster_tx_counts: Dict[str, int] = defaultdict(int)
        self.cluster_volumes: Dict[str, float] = defaultdict(float)
        self.cluster_first_seen: Dict[str, datetime] = {}
        self.cluster_last_seen: Dict[str, datetime] = {}
        self.address_co_spenders: Dict[str, Set[str]] = defaultdict(set)
        self.processed_tx_hashes: Set[str] = set()

    def is_coinjoin(self, tx: UTXOTransaction) -> bool:
        """
        Check if transaction appears to be a CoinJoin (e.g. Wasabi / Whirlpool / JoinMarket).
        CoinJoin signatures:
        - 3 or more distinct inputs AND 3 or more distinct outputs
        - Multiple identical output amounts (denominations)
        """
        if len(tx.inputs) < 3 or len(tx.outputs) < 3:
            return False

        output_values = [out.value_sat for out in tx.outputs if out.value_sat > 0]
        if not output_values:
            return False

        # Count frequencies of output values
        counts = defaultdict(int)
        for v in output_values:
            counts[v] += 1

        # If 3 or more outputs share the exact same amount, likely a CoinJoin
        max_identical = max(counts.values(), default=0)
        return max_identical >= 3

    def add_transaction(self, tx: UTXOTransaction) -> Optional[str]:
        """
        Processes a UTXO transaction and applies the common-input heuristic.
        Returns the cluster_id (root) if a multi-input cluster was formed/expanded,
        or None if single-input or CoinJoin.
        """
        if tx.tx_hash in self.processed_tx_hashes:
            return None
        self.processed_tx_hashes.add(tx.tx_hash)

        # Filter CoinJoin if enabled to prevent cluster poisoning
        if self.filter_coinjoin and self.is_coinjoin(tx):
            logger.debug(f"Skipping CoinJoin transaction {tx.tx_hash} in common-input clustering.")
            return None

        # Extract unique input addresses
        input_addresses = list({
            inp.address.lower().strip()
            for inp in tx.inputs
            if inp.address and inp.address.strip()
        })

        if len(input_addresses) < 2:
            # Single-input or empty: ensure address is registered in DSU if present
            if input_addresses:
                addr = input_addresses[0]
                self.dsu.find(addr)
                self._update_temporal(addr, tx.timestamp)
            return None

        # Multi-input transaction: Common-Input-Ownership Heuristic applies!
        first_addr = input_addresses[0]
        root = self.dsu.find(first_addr)

        # Record pairwise co-spending
        for i, addr_a in enumerate(input_addresses):
            for addr_b in input_addresses[i + 1:]:
                self.address_co_spenders[addr_a].add(addr_b)
                self.address_co_spenders[addr_b].add(addr_a)

        # Union all inputs together
        for other_addr in input_addresses[1:]:
            root = self.dsu.union(first_addr, other_addr)

        # Update cluster metadata for the new root
        self.cluster_tx_counts[root] += 1
        self.cluster_volumes[root] += tx.total_input_btc

        self._update_temporal(root, tx.timestamp)

        return root

    def add_transactions(self, txs: List[UTXOTransaction]) -> int:
        """Processes multiple transactions. Returns count of multi-input clustering events."""
        count = 0
        for tx in txs:
            res = self.add_transaction(tx)
            if res is not None:
                count += 1
        return count

    def _update_temporal(self, item: str, ts: datetime):
        """Update first_seen and last_seen timestamps for a root."""
        root = self.dsu.find(item)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        if root not in self.cluster_first_seen or ts < self.cluster_first_seen[root]:
            self.cluster_first_seen[root] = ts
        if root not in self.cluster_last_seen or ts > self.cluster_last_seen[root]:
            self.cluster_last_seen[root] = ts

    def get_cluster(self, address: str) -> Optional[AddressCluster]:
        """
        Lookup cluster containing the specified address.
        """
        norm_addr = address.lower().strip()
        if norm_addr not in self.dsu.parent:
            return None

        root = self.dsu.find(norm_addr)
        members = sorted(list(self.dsu.get_set(norm_addr)))

        return AddressCluster(
            cluster_id=root,
            members=members,
            cluster_size=len(members),
            chain="bitcoin",
            total_volume_btc=round(self.cluster_volumes.get(root, 0.0), 8),
            tx_count=self.cluster_tx_counts.get(root, 0),
            first_seen=self.cluster_first_seen.get(root),
            last_seen=self.cluster_last_seen.get(root)
        )

    def get_all_clusters(self, min_size: int = 2) -> Dict[str, AddressCluster]:
        """
        Returns all discovered clusters with at least `min_size` members.
        """
        clusters: Dict[str, AddressCluster] = {}
        all_roots = set()

        for addr in self.dsu.parent:
            root = self.dsu.find(addr)
            all_roots.add(root)

        for root in all_roots:
            members = sorted(list(self.dsu.members.get(root, {root})))
            if len(members) >= min_size:
                clusters[root] = AddressCluster(
                    cluster_id=root,
                    members=members,
                    cluster_size=len(members),
                    chain="bitcoin",
                    total_volume_btc=round(self.cluster_volumes.get(root, 0.0), 8),
                    tx_count=self.cluster_tx_counts.get(root, 0),
                    first_seen=self.cluster_first_seen.get(root),
                    last_seen=self.cluster_last_seen.get(root)
                )

        return clusters

    def get_co_spenders(self, address: str) -> Set[str]:
        """Returns addresses that have directly co-spent with the given address in a tx."""
        norm_addr = address.lower().strip()
        return set(self.address_co_spenders.get(norm_addr, set()))


# Global default engine instance
clustering_engine = CommonInputClusteringEngine()
