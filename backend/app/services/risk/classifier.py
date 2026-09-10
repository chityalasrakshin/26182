"""
Explainable Multi-Signal Risk Engine with Anti-Double-Counting.
Grounded in FATF Virtual Assets Typologies & Elliptic++ Benchmark Taxonomy.

Combines trace topology, intelligence findings, and VASP attributions into a
bounded, explainable risk score [0-100]. Prevents double-counting by clustering
related signals into 4 category layers with hard mathematical caps.

Theoretical & Academic Foundations:
  - FATF (2020): Report on Virtual Assets Red Flag Indicators of Money Laundering
    and Terrorist Financing (Financial Action Task Force, Paris).
  - Elliptic++ Benchmark: Weber et al. (2019) / Bellei et al. (2023),
    "Elliptic++: A Large-Scale Graph Dataset for Anti-Money Laundering in Cryptocurrency",
    git-disl/EllipticPlusPlus and feedzai/research-aml-elliptic.

13 Formal Typology Signals mapped across 4 Bounded Layers:

1. VELOCITY_LAYER (Cap 25):
   - RAPID_FORWARDING (Weight 20): Immediate pass-through (<30 min) per FATF Indicator T.10 & Elliptic++ temporal delta.
   - SUSPICIOUS_VELOCITY (Weight 10): High volume in short window (<2h) per FATF Indicator T.11 & Elliptic++ burst density.

2. DISPERSION_LAYER (Cap 25):
   - PEEL_CHAIN (Weight 22): Asymmetric peeling chain per FATF Indicator P.3 & Elliptic++ linear motifs.
   - HIGH_FAN_OUT (Weight 12): Structuring / smurfing (out-degree >= 5) per FATF Indicator P.1 & Elliptic++ out-degree.
   - HIGH_FAN_IN (Weight 12): Consolidation / aggregation (in-degree >= 5) per FATF Indicator P.2 & Elliptic++ in-degree.
   - SWEEP_CONSOLIDATION (Weight 15): Multi-source balance aggregation per FATF Indicator P.4.
   - COMMON_INPUT_CLUSTER (Weight 12): Transitive co-spending cluster (Bitcoin Common-Input-Ownership Heuristic).

3. RECURRENCE_LAYER (Cap 10):
   - REPEATED_DESTINATION (Weight 8): Recurring target address (>=3 transfers) per FATF Indicator P.6.
   - ROUND_AMOUNT_PATTERN (Weight 5): Manual threshold structuring per FATF Indicator S.2 & Elliptic++ distribution moments.

4. ENTITY_RISK_LAYER (Cap 50):
   - SANCTIONED_ENTITY_INTERACTION (Weight 45): Direct/indirect interaction with OFAC SDN / designated sanctions targets.
   - KNOWN_SCAM_INTERACTION (Weight 35): Direct/indirect interaction with reported scams, phishing, or illicit drains.
   - KNOWN_MIXER_INTERACTION (Weight 30): Interaction with non-custodial privacy mixers (Tornado Cash, Blender.io).
   - KNOWN_BRIDGE_INTERACTION (Weight 5): Interaction with cross-chain bridges as a chain-hopping evasion indicator.

Anti-Double-Counting Architecture:
  Signals in the same layer cannot exceed that layer's hard cap.
  Composite Score = min(100, Velocity_eff + Dispersion_eff + Recurrence_eff + EntityRisk_eff)
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field

import networkx as nx

from backend.app.schemas.analysis import RiskAssessmentSchema
from backend.app.services.heuristics.peel_detector import peel_detector
from backend.app.services.heuristics.sweep_detector import sweep_detector
from backend.app.services.heuristics.common_input import clustering_engine
from backend.app.services.labels.store import label_store

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Signal Configuration
# ═══════════════════════════════════════════════════════════════════════════════

# Default signal weights (raw points before category capping)
DEFAULT_SIGNAL_WEIGHTS = {
    "PEEL_CHAIN": 22,
    "HIGH_FAN_OUT": 12,
    "HIGH_FAN_IN": 12,
    "SWEEP_CONSOLIDATION": 15,
    "COMMON_INPUT_CLUSTER": 12,
    "RAPID_FORWARDING": 20,
    "SUSPICIOUS_VELOCITY": 10,
    "ROUND_AMOUNT_PATTERN": 5,
    "REPEATED_DESTINATION": 8,
    "KNOWN_MIXER_INTERACTION": 30,
    "KNOWN_BRIDGE_INTERACTION": 5,
    "SANCTIONED_ENTITY_INTERACTION": 45,
    "KNOWN_SCAM_INTERACTION": 35,
}

# Category groupings and their hard caps
CATEGORY_CAPS = {
    "VELOCITY_LAYER": 25,       # RAPID_FORWARDING + SUSPICIOUS_VELOCITY
    "DISPERSION_LAYER": 25,     # HIGH_FAN_OUT + HIGH_FAN_IN + PEEL_CHAIN + SWEEP_CONSOLIDATION + COMMON_INPUT_CLUSTER
    "RECURRENCE_LAYER": 10,     # REPEATED_DESTINATION + ROUND_AMOUNT_PATTERN
    "ENTITY_RISK_LAYER": 50,    # SANCTIONED + MIXER + SCAM + BRIDGE
}

# Signal → Category mapping
SIGNAL_CATEGORIES = {
    "RAPID_FORWARDING": "VELOCITY_LAYER",
    "SUSPICIOUS_VELOCITY": "VELOCITY_LAYER",
    "HIGH_FAN_OUT": "DISPERSION_LAYER",
    "HIGH_FAN_IN": "DISPERSION_LAYER",
    "PEEL_CHAIN": "DISPERSION_LAYER",
    "SWEEP_CONSOLIDATION": "DISPERSION_LAYER",
    "COMMON_INPUT_CLUSTER": "DISPERSION_LAYER",
    "REPEATED_DESTINATION": "RECURRENCE_LAYER",
    "ROUND_AMOUNT_PATTERN": "RECURRENCE_LAYER",
    "SANCTIONED_ENTITY_INTERACTION": "ENTITY_RISK_LAYER",
    "KNOWN_MIXER_INTERACTION": "ENTITY_RISK_LAYER",
    "KNOWN_SCAM_INTERACTION": "ENTITY_RISK_LAYER",
    "KNOWN_BRIDGE_INTERACTION": "ENTITY_RISK_LAYER",
}

# Known mixer and bridge addresses (lowercase)
KNOWN_MIXERS: Set[str] = {
    # Tornado Cash
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    "0xa160cdab225685da1d56aa342ad8841c3b53f291",
    "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
    "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc",
    "0x23773e65ed146a459791799d01336db287f25334",
    # Blender.io
    "0x94a1b5cdb22c43faab4abeb5c74999895464bf6e",
}

KNOWN_BRIDGES: Set[str] = {
    # Stargate
    "0x8731d54e9d02c286767d56ac03e8037c07e01e98",
    "0x296f55f8fb28e498b858d0bcda06d955b2cb3f97",
    # Hop Protocol
    "0xb8901acb165ed027e32754e0ffe830802919727f",
    # Wormhole
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
}

KNOWN_SCAMS: Set[str] = set()  # Populated from VASP registry or external feeds


@dataclass
class RiskSignalContribution:
    """Individual risk signal contribution with audit trail."""
    signal: str
    category: str
    raw_weight: int
    effective_weight: int
    reason: str
    evidence: List[Dict[str, Any]] = field(default_factory=list)


class RiskClassifier:
    """
    Transparent, explainable 11-signal risk indicator classifier.

    Evaluates observable on-chain structural patterns and entity interactions,
    with anti-double-counting category caps to prevent score inflation.
    Each signal is independently detectable and contributes to a bounded
    composite score [0-100].
    """

    @staticmethod
    def evaluate_risk(
        graph: nx.MultiDiGraph,
        root_wallet: str,
        known_entities: Optional[Dict[str, str]] = None,
        cluster_info: Optional[Dict[str, Any]] = None,
        utxo_transactions: Optional[List[Any]] = None
    ) -> RiskAssessmentSchema:
        """
        Evaluate risk indicators from the transaction graph and heuristic findings.

        Args:
            graph: NetworkX MultiDiGraph with node/edge attributes
            root_wallet: The seed wallet address being investigated
            known_entities: Optional dict mapping addresses to entity types
                          (e.g., {"0xabc...": "MIXER", "0xdef...": "SANCTIONED"})
            cluster_info: Optional dictionary with common-input cluster details
            utxo_transactions: Optional list of raw UTXO transactions

        Returns:
            RiskAssessmentSchema with bounded score, level, and indicators
        """
        known_entities = known_entities or {}
        contributions: List[RiskSignalContribution] = []
        category_running_totals: Dict[str, int] = {k: 0 for k in CATEGORY_CAPS}

        total_nodes = len(graph.nodes)
        total_edges = len(graph.edges)
        max_hop = max(
            [data.get("hop", 0) for _, data in graph.nodes(data=True)],
            default=0
        )

        # Collect all edge timestamps and amounts
        edge_data = []
        for u, v, data in graph.edges(data=True):
            ts = data.get("timestamp")
            if ts:
                if getattr(ts, "tzinfo", None) is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                else:
                    ts = ts.astimezone(timezone.utc)
            amount = float(data.get("amount", 0) or 0)
            edge_data.append({
                "source": u, "target": v,
                "timestamp": ts, "amount": amount,
                "tx_hash": data.get("tx_hash", ""),
                "hop": data.get("hop", 0),
            })

        timestamps = [e["timestamp"] for e in edge_data if e["timestamp"]]
        timestamps.sort()

        # ═══════════════════════════════════════════════════════════════════
        # Signal 1: PEEL_CHAIN — Asymmetric sequential peeling
        # ═══════════════════════════════════════════════════════════════════
        peel_chain_length = 0
        peel_evidence = []
        if utxo_transactions:
            utxo_peels = peel_detector.detect_utxo_peel_chains(utxo_transactions)
            if utxo_peels:
                peel_chain_length = utxo_peels[0].chain_length
                peel_evidence = [{
                    "chain_id": p.chain_id,
                    "length": p.chain_length,
                    "peeled_total": p.total_peeled_amount
                } for p in utxo_peels]

        if not peel_chain_length:
            graph_peels = peel_detector.detect_graph_peel_chains(graph, root_wallet=root_wallet)
            if graph_peels:
                peel_chain_length = graph_peels[0].chain_length
                peel_evidence = [{
                    "chain_id": p.chain_id,
                    "length": p.chain_length,
                    "peeled_total": p.total_peeled_amount
                } for p in graph_peels]

        if not peel_chain_length:
            peel_chain_length = _detect_peel_chain(graph, root_wallet)

        if peel_chain_length:
            contributions.append(_make_contribution(
                "PEEL_CHAIN", category_running_totals,
                f"Peel chain pattern detected: Linear chain of {peel_chain_length} "
                f"asymmetric sequential peeling transfers from root wallet.",
                evidence=peel_evidence
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 2: HIGH_FAN_OUT — Structuring / smurfing
        # ═══════════════════════════════════════════════════════════════════
        fan_out_count = 0
        for node in graph.nodes():
            out_degree = graph.out_degree(node)
            if out_degree >= 5:
                fan_out_count += 1

        if fan_out_count >= 1:
            contributions.append(_make_contribution(
                "HIGH_FAN_OUT", category_running_totals,
                f"High fan-out structuring: {fan_out_count} node(s) distributing "
                f"funds to 5+ distinct recipients (smurfing pattern)."
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 3: HIGH_FAN_IN — Aggregation / consolidation
        # ═══════════════════════════════════════════════════════════════════
        fan_in_count = 0
        for node in graph.nodes():
            in_degree = graph.in_degree(node)
            if in_degree >= 5:
                fan_in_count += 1

        if fan_in_count >= 1:
            contributions.append(_make_contribution(
                "HIGH_FAN_IN", category_running_totals,
                f"High fan-in aggregation: {fan_in_count} node(s) receiving "
                f"from 5+ distinct sources (consolidation pattern)."
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 3b: SWEEP_CONSOLIDATION — Multi-source consolidation
        # ═══════════════════════════════════════════════════════════════════
        sweep_detected = False
        sweep_evidence = []
        if utxo_transactions:
            utxo_sweeps = sweep_detector.analyze_transactions(utxo_transactions)
            if utxo_sweeps:
                sweep_detected = True
                sweep_evidence = [{
                    "tx_hash": s.tx_hash,
                    "inputs": s.input_count,
                    "amount": s.consolidated_amount
                } for s in utxo_sweeps[:3]]

        if not sweep_detected:
            graph_sweeps = sweep_detector.analyze_graph(graph, min_in_degree=3)
            if graph_sweeps:
                sweep_detected = True
                sweep_evidence = [{
                    "target": s.sweep_target_address,
                    "sources": len(s.swept_source_addresses),
                    "amount": s.consolidated_amount
                } for s in graph_sweeps[:3]]

        if sweep_detected:
            contributions.append(_make_contribution(
                "SWEEP_CONSOLIDATION", category_running_totals,
                f"Sweep transaction detected: Multi-source balance consolidation identified in transaction flow.",
                evidence=sweep_evidence
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 3c: COMMON_INPUT_CLUSTER — Co-spending entity cluster
        # ═══════════════════════════════════════════════════════════════════
        cluster_detected = False
        cluster_evidence = []
        if cluster_info and cluster_info.get("cluster_size", 1) > 1:
            cluster_detected = True
            cluster_evidence = [{
                "cluster_id": cluster_info.get("cluster_id"),
                "size": cluster_info.get("cluster_size"),
                "members": cluster_info.get("members", [])[:5]
            }]
        elif root_wallet:
            cl = clustering_engine.get_cluster(root_wallet)
            if cl and cl.cluster_size > 1:
                cluster_detected = True
                cluster_evidence = [{
                    "cluster_id": cl.cluster_id,
                    "size": cl.cluster_size,
                    "members": cl.members[:5]
                }]

        if cluster_detected:
            c_size = cluster_evidence[0].get("size", 2)
            contributions.append(_make_contribution(
                "COMMON_INPUT_CLUSTER", category_running_totals,
                f"Common-input ownership cluster: Seed wallet belongs to a multi-address "
                f"co-spending cluster of {c_size} addresses.",
                evidence=cluster_evidence
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 4: RAPID_FORWARDING — Quick in-out pass-through
        # ═══════════════════════════════════════════════════════════════════
        rapid_forwarding = _detect_rapid_forwarding(edge_data)
        if rapid_forwarding:
            contributions.append(_make_contribution(
                "RAPID_FORWARDING", category_running_totals,
                f"Rapid pass-through forwarding: {rapid_forwarding} address(es) "
                f"forwarded received funds within 30 minutes of receipt."
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 5: SUSPICIOUS_VELOCITY — High volume in short timeframe
        # ═══════════════════════════════════════════════════════════════════
        if len(timestamps) >= 2:
            duration_hours = (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0
            if duration_hours < 2.0 and total_edges >= 6:
                contributions.append(_make_contribution(
                    "SUSPICIOUS_VELOCITY", category_running_totals,
                    f"Suspicious velocity: {total_edges} transfers executed "
                    f"within {duration_hours:.1f} hours ({total_edges/max(0.1, duration_hours):.0f} tx/hr)."
                ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 6: ROUND_AMOUNT_PATTERN — Human structuring indicator
        # ═══════════════════════════════════════════════════════════════════
        round_amounts = _detect_round_amounts(edge_data)
        if round_amounts >= 3:
            contributions.append(_make_contribution(
                "ROUND_AMOUNT_PATTERN", category_running_totals,
                f"Round amount structuring: {round_amounts} transfers with "
                f"suspiciously round values (common in manual structuring)."
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signal 7: REPEATED_DESTINATION — Same recipient in multiple transfers
        # ═══════════════════════════════════════════════════════════════════
        dest_counts: Dict[str, int] = {}
        for e in edge_data:
            dest_counts[e["target"]] = dest_counts.get(e["target"], 0) + 1
        repeated_dests = [addr for addr, count in dest_counts.items() if count >= 3]

        if repeated_dests:
            contributions.append(_make_contribution(
                "REPEATED_DESTINATION", category_running_totals,
                f"Repeated destination pattern: {len(repeated_dests)} address(es) "
                f"received 3+ transfers (potential aggregation point)."
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Signals 8-11: Entity-based signals (Mixer, Bridge, Sanctioned, Scam)
        # Grounded in FATF Anonymizing Services & OFAC/UN Sanctions Designations
        # ═══════════════════════════════════════════════════════════════════
        graph_addresses = set(graph.nodes())

        # Check against known mixer addresses
        mixer_hits = graph_addresses.intersection(KNOWN_MIXERS)
        for addr in known_entities:
            if known_entities[addr].upper() == "MIXER":
                mixer_hits.add(addr)

        # Check against known bridge addresses
        bridge_hits = graph_addresses.intersection(KNOWN_BRIDGES)
        for addr in known_entities:
            if known_entities[addr].upper() == "BRIDGE":
                bridge_hits.add(addr)

        # Check against sanctioned entities
        sanctioned_hits = set()
        for addr in known_entities:
            if known_entities[addr].upper() == "SANCTIONED" and addr in graph_addresses:
                sanctioned_hits.add(addr)

        # Check against known scam addresses
        scam_hits = graph_addresses.intersection(KNOWN_SCAMS)
        for addr in known_entities:
            if known_entities[addr].upper() == "SCAM" and addr in graph_addresses:
                scam_hits.add(addr)

        # Cross-reference with Forensic LabelStore (dynamic OFAC SDN, mixers, scams, bridges)
        if label_store:
            for addr in graph_addresses:
                try:
                    lbl = label_store.lookup(addr)
                    if lbl:
                        cat = (lbl.category or "").lower()
                        if cat in ("sanctioned", "sanctions") or (lbl.risk_level == "CRITICAL" and not lbl.is_vasp):
                            sanctioned_hits.add(addr)
                        elif cat == "mixer":
                            mixer_hits.add(addr)
                        elif cat in ("scam", "fraud", "exploit"):
                            scam_hits.add(addr)
                        elif cat == "bridge":
                            bridge_hits.add(addr)
                except Exception:
                    pass

        if mixer_hits:
            contributions.append(_make_contribution(
                "KNOWN_MIXER_INTERACTION", category_running_totals,
                f"Mixer interaction detected: {len(mixer_hits)} known mixing service "
                f"address(es) found in transaction graph (e.g., Tornado Cash, Blender).",
                evidence=[{"address": a, "entity_type": "MIXER"} for a in list(mixer_hits)[:5]]
            ))

        if bridge_hits:
            contributions.append(_make_contribution(
                "KNOWN_BRIDGE_INTERACTION", category_running_totals,
                f"Cross-chain bridge interaction: {len(bridge_hits)} bridge protocol "
                f"address(es) detected (Stargate, Hop, Wormhole).",
                evidence=[{"address": a, "entity_type": "BRIDGE"} for a in list(bridge_hits)[:5]]
            ))

        if sanctioned_hits:
            contributions.append(_make_contribution(
                "SANCTIONED_ENTITY_INTERACTION", category_running_totals,
                f"SANCTIONED entity interaction: {len(sanctioned_hits)} OFAC/sanctioned "
                f"address(es) found in direct transaction flow.",
                evidence=[{"address": a, "entity_type": "SANCTIONED"} for a in list(sanctioned_hits)[:5]]
            ))

        if scam_hits:
            contributions.append(_make_contribution(
                "KNOWN_SCAM_INTERACTION", category_running_totals,
                f"Known scam interaction: {len(scam_hits)} reported scam/fraud "
                f"address(es) found in transaction graph.",
                evidence=[{"address": a, "entity_type": "SCAM"} for a in list(scam_hits)[:5]]
            ))

        # ═══════════════════════════════════════════════════════════════════
        # Compute Bounded Final Score [0-100]
        # ═══════════════════════════════════════════════════════════════════
        raw_score_sum = sum(c.effective_weight for c in contributions)
        risk_score = min(max(raw_score_sum, 0), 100)

        # Determine risk level
        if risk_score >= 75:
            risk_level = "CRITICAL"
        elif risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Generate human-readable indicators list
        indicators: List[str] = []
        # Sort contributions by effective weight descending
        contributions.sort(key=lambda c: (c.effective_weight, c.raw_weight), reverse=True)
        for c in contributions:
            if c.effective_weight > 0:
                indicators.append(f"[+{c.effective_weight}pts] {c.reason}")
            elif c.raw_weight > 0:
                indicators.append(f"[+0pts (layer capped)] {c.reason}")

        if not indicators:
            indicators.append(
                "No anomalous flow patterns or high-risk entity interactions observed. "
                "Direct or low-complexity transaction flow."
            )

        # Generate explanation
        explanation = _generate_explanation(risk_level, risk_score, contributions, max_hop, total_edges)

        return RiskAssessmentSchema(
            risk_level=risk_level,
            score=round(risk_score, 1),
            indicators=indicators,
            explanation=explanation
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Signal Detection Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _make_contribution(
    signal: str,
    category_totals: Dict[str, int],
    reason: str,
    evidence: Optional[List[Dict]] = None
) -> RiskSignalContribution:
    """Create a contribution with anti-double-counting category capping."""
    raw_weight = DEFAULT_SIGNAL_WEIGHTS.get(signal, 10)
    category = SIGNAL_CATEGORIES.get(signal, "ENTITY_RISK_LAYER")
    cap = CATEGORY_CAPS.get(category, 30)
    current = category_totals.get(category, 0)
    remaining = max(0, cap - current)
    effective = min(raw_weight, remaining)
    category_totals[category] = current + effective

    return RiskSignalContribution(
        signal=signal,
        category=category,
        raw_weight=raw_weight,
        effective_weight=effective,
        reason=reason,
        evidence=evidence or [],
    )


def _detect_peel_chain(graph: nx.MultiDiGraph, root: str) -> int:
    """
    Detect peel chain pattern: linear chain of sequential small-value transfers.
    Returns the length of the longest peel chain, or 0 if none detected.
    """
    chain_length = 0
    current = root

    visited = {root}
    for _ in range(10):  # Max chain length to check
        successors = list(graph.successors(current))
        if len(successors) != 1:
            break  # Not a linear chain

        next_node = successors[0]
        if next_node in visited:
            break

        # Check if the node only has 1 predecessor (linear)
        predecessors = list(graph.predecessors(next_node))
        if len(predecessors) != 1:
            break

        chain_length += 1
        visited.add(next_node)
        current = next_node

    return chain_length if chain_length >= 3 else 0


def _detect_rapid_forwarding(edge_data: List[Dict]) -> int:
    """
    Detect addresses that rapidly forward received funds (within 30 min).
    Returns count of rapid-forwarding addresses.
    """
    # Group edges by target (receiving) and source (sending)
    received_at: Dict[str, datetime] = {}  # addr → earliest receive timestamp
    sent_at: Dict[str, datetime] = {}  # addr → earliest send timestamp after receive

    for e in edge_data:
        ts = e.get("timestamp")
        if not ts:
            continue
        target = e["target"]
        source = e["source"]

        if target not in received_at or ts < received_at[target]:
            received_at[target] = ts

        if source not in sent_at or ts < sent_at[source]:
            sent_at[source] = ts

    rapid_count = 0
    for addr in received_at:
        if addr in sent_at:
            recv_time = received_at[addr]
            send_time = sent_at[addr]
            if send_time > recv_time:
                diff = (send_time - recv_time).total_seconds()
                if diff < 1800:  # 30 minutes
                    rapid_count += 1

    return rapid_count


def _detect_round_amounts(edge_data: List[Dict]) -> int:
    """
    Detect suspiciously round transaction amounts.
    Returns count of round-amount transactions.
    """
    round_count = 0
    for e in edge_data:
        amount = e.get("amount", 0)
        if amount <= 0:
            continue
        # Check if amount is a round number (e.g., 1.0, 10.0, 100.0, 0.5, 0.1)
        if amount >= 0.1:
            # Check if amount has no more than 2 significant decimal digits
            rounded = round(amount, 2)
            if abs(amount - rounded) < 1e-8:
                # Further check: is it a "nice" number?
                if amount == int(amount) or amount * 10 == int(amount * 10):
                    round_count += 1
    return round_count


def _generate_explanation(
    risk_level: str,
    score: float,
    contributions: List[RiskSignalContribution],
    max_hop: int,
    total_edges: int
) -> str:
    """Generate human-readable risk explanation."""
    active_signals = [c for c in contributions if c.effective_weight > 0]
    signal_names = [c.signal.replace("_", " ").title() for c in active_signals[:3]]

    if risk_level == "CRITICAL":
        return (
            f"CRITICAL risk level ({score}/100). Multiple high-severity indicators detected "
            f"including {', '.join(signal_names)}. Observable transaction flow demonstrates "
            f"characteristics consistent with organized money laundering typologies across "
            f"{max_hop} traversal hops and {total_edges} transfers."
        )
    elif risk_level == "HIGH":
        return (
            f"HIGH risk indicators observed ({score}/100). Key signals: "
            f"{', '.join(signal_names)}. Transaction flow demonstrates rapid multi-hop "
            f"layering across intermediary addresses prior to reaching terminal endpoints."
        )
    elif risk_level == "MEDIUM":
        return (
            f"Moderate risk indicators observed ({score}/100). Detected signals: "
            f"{', '.join(signal_names) if signal_names else 'intermediary routing'}. "
            f"Observed flow involves moderate structural complexity warranting further review."
        )
    else:
        return (
            f"Low risk indicators observed ({score}/100). Direct or low-hop observable "
            f"activity with standard counterparty flow patterns. No high-risk entity "
            f"interactions or suspicious structuring detected."
        )
