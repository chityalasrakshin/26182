"""
Pydantic Schemas for Phase 3: Clustering Heuristics & Risk Scoring.

Defines DTOs for:
- UTXO inputs, outputs, and full transactions
- Address clusters (Common-Input-Ownership Heuristic)
- Sweep / consolidation transaction detection
- Peeling-chain detection
- Composite heuristic analysis summaries
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel, Field


# ==============================================================================
# UTXO Data Models
# ==============================================================================

class UTXOInput(BaseModel):
    """A single input (spent UTXO) in a Bitcoin transaction."""
    address: str = Field(..., description="The address that unlocked and spent this UTXO")
    value_sat: int = Field(default=0, description="Amount in Satoshis")
    amount_btc: float = Field(default=0.0, description="Amount in BTC")
    txid: Optional[str] = Field(default=None, description="Previous transaction hash")
    vout: Optional[int] = Field(default=None, description="Previous output index")


class UTXOOutput(BaseModel):
    """A single output created by a Bitcoin transaction."""
    address: str = Field(..., description="Recipient address or change address")
    value_sat: int = Field(default=0, description="Amount in Satoshis")
    amount_btc: float = Field(default=0.0, description="Amount in BTC")
    index: int = Field(default=0, description="Output index within transaction")
    is_change: Optional[bool] = Field(default=None, description="Flagged if inferred as change")


class UTXOTransaction(BaseModel):
    """Full representation of a multi-input, multi-output UTXO transaction."""
    tx_hash: str
    chain: str = "bitcoin"
    block_height: Optional[int] = None
    timestamp: datetime
    inputs: List[UTXOInput] = Field(default_factory=list)
    outputs: List[UTXOOutput] = Field(default_factory=list)
    total_input_btc: float = 0.0
    total_output_btc: float = 0.0
    fee_btc: float = 0.0

    def model_post_init(self, __context: Any) -> None:
        if not self.total_input_btc and self.inputs:
            self.total_input_btc = sum(inp.amount_btc for inp in self.inputs)
        if not self.total_output_btc and self.outputs:
            self.total_output_btc = sum(out.amount_btc for out in self.outputs)
        if not self.fee_btc and self.total_input_btc >= self.total_output_btc:
            self.fee_btc = round(self.total_input_btc - self.total_output_btc, 8)


# ==============================================================================
# Clustering (Common-Input-Ownership Heuristic)
# ==============================================================================

class AddressCluster(BaseModel):
    """A cluster of addresses inferred to belong to the same entity via CIOH."""
    cluster_id: str = Field(..., description="Canonical representative address or identifier")
    members: List[str] = Field(default_factory=list, description="All addresses in this cluster")
    cluster_size: int = Field(default=1, description="Count of member addresses")
    chain: str = "bitcoin"
    total_volume_btc: float = Field(default=0.0, description="Total observable transaction volume")
    tx_count: int = Field(default=0, description="Number of contributing multi-input transactions")
    known_entity: Optional[str] = Field(default=None, description="VASP / entity label if identified")
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None


class ClusterQueryResponse(BaseModel):
    """Response when querying a cluster for a given address."""
    queried_address: str
    is_clustered: bool = False
    cluster: Optional[AddressCluster] = None
    co_spenders: List[str] = Field(default_factory=list)


# ==============================================================================
# Sweep / Consolidation Detection
# ==============================================================================

class SweepDetectionResult(BaseModel):
    """Results from detecting sweep/consolidation transactions."""
    tx_hash: str
    chain: str = "bitcoin"
    timestamp: datetime
    sweep_target_address: str = Field(..., description="Consolidation destination address")
    swept_source_addresses: List[str] = Field(default_factory=list, description="Source addresses swept")
    input_count: int
    output_count: int
    consolidated_amount: float
    consolidation_ratio: float = Field(
        ..., description="Ratio of primary output amount to total input amount (e.g. 0.95 = 95% consolidated)"
    )
    is_sweep: bool = True
    confidence_score: float = Field(default=0.90, ge=0.0, le=1.0)
    sweep_type: str = Field(
        default="WALLET_CONSOLIDATION",
        description="WALLET_CONSOLIDATION, EXCHANGE_DEPOSIT_SWEEP, or SUSPICIOUS_LOOT_SWEEP"
    )
    explanation: str


# ==============================================================================
# Peeling-Chain Detection
# ==============================================================================

class PeelChainHop(BaseModel):
    """A single hop in a detected peeling chain."""
    hop_index: int
    tx_hash: str
    input_address: str
    peeled_address: str
    peeled_amount: float
    change_address: str
    change_amount: float
    timestamp: datetime
    peel_ratio: float = Field(..., description="Ratio of peeled amount to total transaction amount")


class PeelChainDetectionResult(BaseModel):
    """A sequence of 2-output transactions exhibiting peeling chain behavior."""
    chain_id: str
    start_address: str
    chain_length: int = Field(..., ge=1, description="Number of peeling hops in the chain")
    initial_amount: float
    total_peeled_amount: float
    remaining_change_amount: float
    peeled_destinations: List[str] = Field(default_factory=list)
    change_path: List[str] = Field(default_factory=list)
    hops: List[PeelChainHop] = Field(default_factory=list)
    avg_hop_interval_seconds: float = 0.0
    confidence_score: float = Field(default=0.85, ge=0.0, le=1.0)
    is_peeling_chain: bool = True
    explanation: str


# ==============================================================================
# Composite Heuristic Analysis Request & Response
# ==============================================================================

class HeuristicAnalyzeRequest(BaseModel):
    """Request to run heuristics against an address or raw transactions."""
    address: Optional[str] = None
    chain: str = "bitcoin"
    raw_transactions: Optional[List[Dict[str, Any]]] = None


class HeuristicAnalysisSummary(BaseModel):
    """Comprehensive summary of heuristic findings for an address/subgraph."""
    address: Optional[str] = None
    chain: str = "bitcoin"
    cluster: Optional[AddressCluster] = None
    sweeps_detected: List[SweepDetectionResult] = Field(default_factory=list)
    peel_chains_detected: List[PeelChainDetectionResult] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    summary: str
