"""
Neo4j Graph Database Client & Ingestion Service.

Provides schema initialization, transaction/wallet ingestion, and Cypher shortest-path
queries to nearest labeled VASP nodes per `BUILD-PLAN.md` Phase 1 and `graph-the-network`.

Implements dual-engine fallback: if Neo4j is offline or the neo4j package is not
connected, methods return structured fallbacks without crashing the application.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from backend.app.core.config import settings
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.labels.store import label_store, AddressLabel

logger = logging.getLogger(__name__)

try:
    from neo4j import GraphDatabase, AsyncGraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    logger.info("neo4j python package not installed; Neo4j client operating in in-memory fallback mode.")


class Neo4jGraphClient:
    """
    Neo4j client managing connection pooling, schema constraints, batch edge insertion,
    and Cypher shortest-path queries.
    """

    def __init__(
        self,
        uri: Optional[str] = None,
        user: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.uri = uri or settings.NEO4J_URI
        self.user = user or settings.NEO4J_USER
        self.password = password or settings.NEO4J_PASSWORD
        self._driver = None
        self._connected = False

    def connect(self) -> bool:
        """Establishes connection to Neo4j instance if available."""
        if not NEO4J_AVAILABLE:
            return False
        try:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                connection_timeout=3.0,
                max_connection_lifetime=300
            )
            # Verify connectivity
            self._driver.verify_connectivity()
            self._connected = True
            logger.info(f"Connected to Neo4j at {self.uri}")
            self.init_schema()
            return True
        except Exception as e:
            logger.warning(f"Neo4j connection to {self.uri} failed: {e}. Falling back to in-memory graph.")
            self._connected = False
            return False

    @property
    def is_connected(self) -> bool:
        return self._connected

    def close(self):
        if self._driver:
            self._driver.close()
            self._connected = False

    def init_schema(self):
        """Initializes unique constraints and indices for fast shortestPath lookup."""
        if not self._connected or not self._driver:
            return

        constraints = [
            "CREATE CONSTRAINT wallet_address_unique IF NOT EXISTS FOR (w:Wallet) REQUIRE w.address IS UNIQUE;",
            "CREATE INDEX wallet_chain_vasp IF NOT EXISTS FOR (w:Wallet) ON (w.chain, w.is_vasp);",
            "CREATE INDEX tx_hash_index IF NOT EXISTS FOR ()-[r:SENT]-() ON (r.tx_hash);"
        ]
        with self._driver.session() as session:
            for q in constraints:
                try:
                    session.run(q)
                except Exception as e:
                    logger.debug(f"Schema constraint notice: {e}")

    def upsert_wallet_node(
        self,
        address: str,
        chain: str,
        label_info: Optional[AddressLabel] = None
    ) -> bool:
        """Upserts a (:Wallet) node with forensic labels."""
        if not self._connected or not self._driver:
            return False

        label_obj = label_info or label_store.lookup(address, chain)
        norm_address = address.strip() if chain.lower() == "solana" else address.lower()
        props = {
            "address": norm_address,
            "chain": chain.lower(),
            "is_vasp": bool(label_obj and label_obj.is_vasp),
            "vasp_name": label_obj.entity if (label_obj and label_obj.is_vasp) else "",
            "label": label_obj.label if label_obj else "Unlabeled Address",
            "category": label_obj.category if label_obj else "unknown",
            "risk_level": label_obj.risk_level if label_obj else "LOW",
            "confidence": label_obj.confidence if label_obj else "UNVERIFIED",
            "confidence_score": float(label_obj.confidence_score) if label_obj else 0.0,
            "source_url": label_obj.source_url if (label_obj and label_obj.source_url) else ""
        }

        query = """
        MERGE (w:Wallet {address: $address})
        ON CREATE SET 
            w.chain = $chain,
            w.is_vasp = $is_vasp,
            w.vasp_name = $vasp_name,
            w.label = $label,
            w.category = $category,
            w.risk_level = $risk_level,
            w.confidence = $confidence,
            w.confidence_score = $confidence_score,
            w.source_url = $source_url,
            w.created_at = datetime()
        ON MATCH SET
            w.is_vasp = CASE WHEN $is_vasp THEN $is_vasp ELSE w.is_vasp END,
            w.vasp_name = CASE WHEN $vasp_name <> '' THEN $vasp_name ELSE w.vasp_name END,
            w.label = CASE WHEN $label <> 'Unlabeled Address' THEN $label ELSE w.label END
        """
        try:
            with self._driver.session() as session:
                session.run(query, props)
            return True
        except Exception as e:
            logger.error(f"Error upserting wallet node {address}: {e}")
            return False

    def ingest_transaction(
        self,
        tx: NormalizedTransaction,
        chain: str = "ethereum"
    ) -> bool:
        """
        Ingests a single transaction, upserting (:Wallet) sender and recipient
        and creating the -[:SENT]-> edge carrying source and confidence attributes.
        """
        if not self._connected or not self._driver:
            return False

        from_addr = tx.from_address.strip() if chain.lower() == "solana" else tx.from_address.lower()
        to_addr = tx.to_address.strip() if chain.lower() == "solana" else tx.to_address.lower()

        # Ensure both endpoints exist
        self.upsert_wallet_node(from_addr, chain)
        self.upsert_wallet_node(to_addr, chain)

        rel_query = """
        MATCH (a:Wallet {address: $from_addr})
        MATCH (b:Wallet {address: $to_addr})
        MERGE (a)-[r:SENT {tx_hash: $tx_hash, asset: $asset}]->(b)
        ON CREATE SET
            r.amount = $amount,
            r.chain = $chain,
            r.block_number = $block_number,
            r.timestamp = $timestamp,
            r.source = $source_api,
            r.confidence = 'CONFIRMED'
        """
        params = {
            "from_addr": from_addr,
            "to_addr": to_addr,
            "tx_hash": tx.tx_hash,
            "asset": tx.asset_type or "NATIVE",
            "amount": float(tx.amount),
            "chain": chain.lower(),
            "block_number": tx.block_number or 0,
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else datetime.utcnow().isoformat(),
            "source_api": getattr(tx, "source_api", None) or "blockchain_explorer"
        }

        try:
            with self._driver.session() as session:
                session.run(rel_query, params)
            return True
        except Exception as e:
            logger.error(f"Error ingesting transaction edge {tx.tx_hash}: {e}")
            return False

    def ingest_cross_chain_transfer(
        self,
        from_addr: str,
        from_chain: str,
        to_addr: str,
        to_chain: str,
        protocol: str,
        tx_hash: str,
        amount: float,
        asset: str,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Ingests a cross-chain bridging event into Neo4j:
        MERGE (u:Wallet {address: $from_addr})
        ON CREATE SET u.chain = $from_chain
        MERGE (v:Wallet {address: $to_addr})
        ON CREATE SET v.chain = $to_chain
        CREATE (u)-[r:BRIDGED_TO {
            protocol: $protocol,
            tx_hash: $tx_hash,
            amount: $amount,
            asset: $asset,
            from_chain: $from_chain,
            to_chain: $to_chain,
            timestamp: $timestamp
        }]->(v)
        """
        if not self._connected or not self._driver:
            return False

        u_norm = from_addr.strip() if from_chain.lower() == "solana" else from_addr.strip().lower()
        v_norm = to_addr.strip() if to_chain.lower() == "solana" else to_addr.strip().lower()

        rel_query = """
        MERGE (u:Wallet {address: $from_addr})
        ON CREATE SET u.chain = $from_chain
        MERGE (v:Wallet {address: $to_addr})
        ON CREATE SET v.chain = $to_chain
        CREATE (u)-[r:BRIDGED_TO {
            protocol: $protocol,
            tx_hash: $tx_hash,
            amount: $amount,
            asset: $asset,
            from_chain: $from_chain,
            to_chain: $to_chain,
            timestamp: $timestamp
        }]->(v)
        """
        params = {
            "from_addr": u_norm,
            "from_chain": from_chain.lower(),
            "to_addr": v_norm,
            "to_chain": to_chain.lower(),
            "protocol": protocol,
            "tx_hash": tx_hash,
            "amount": float(amount or 0.0),
            "asset": asset or "NATIVE",
            "timestamp": timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
        }

        try:
            with self._driver.session() as session:
                session.run(rel_query, params)
            return True
        except Exception as e:
            logger.error(f"Error ingesting cross-chain transfer {tx_hash}: {e}")
            return False

    def find_shortest_path_to_vasp(
        self,
        seed_address: str,
        max_hops: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Executes Cypher shortestPath to any labeled VASP node:
        MATCH (a:Wallet {address:$addr}), (v:Wallet)
        WHERE v.is_vasp = true AND a <> v
        MATCH p = shortestPath((a)-[:SENT*1..6]->(v))
        RETURN p
        """
        if not self._connected or not self._driver:
            return []

        cypher = f"""
        MATCH (a:Wallet {{address: $seed_addr}}), (v:Wallet)
        WHERE v.is_vasp = true AND a.address <> v.address
        MATCH p = shortestPath((a)-[:SENT*1..{max_hops}]->(v))
        RETURN 
            [n in nodes(p) | {{address: n.address, label: n.label, is_vasp: n.is_vasp, vasp_name: n.vasp_name, category: n.category}}] as path_nodes,
            [r in relationships(p) | {{tx_hash: r.tx_hash, amount: r.amount, asset: r.asset}}] as path_edges,
            length(p) as hop_count
        ORDER BY hop_count ASC
        LIMIT 5
        """
        paths = []
        try:
            with self._driver.session() as session:
                result = session.run(cypher, {"seed_addr": seed_address.lower()})
                for record in result:
                    paths.append({
                        "nodes": record["path_nodes"],
                        "edges": record["path_edges"],
                        "hop_count": record["hop_count"]
                    })
        except Exception as e:
            logger.error(f"Cypher shortestPath query error: {e}")
        return paths


# Global singleton instance
neo4j_client = Neo4jGraphClient()
