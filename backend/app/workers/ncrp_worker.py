"""
NCRP 1930 Helpline Batch Triage Worker.

Processes bulk fraud complaints from the National Cyber Crime Reporting Portal
(NCRP Helpline 1930) and computes Flight-Risk Priority Scores (0-100) for
each suspect wallet address.

Flight-Risk Scoring:
- CRITICAL (≥80): Funds moved into Indian FIU VASP within 48 hours → Immediate freeze!
- HIGH (60-79): Funds deposited into international CEX or instant swap desk.
- MEDIUM (40-59): Funds still in unhosted intermediate wallets.
- COLD (<40): Inactive or dead wallet.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("ncrp.worker")

# Indian FIU-IND registered VASPs (immediate freeze eligible)
INDIAN_FIU_VASPS = {
    "WazirX", "CoinDCX", "ZebPay", "CoinSwitch Kuber", "Giottus",
    "BuyUcoin", "Unocoin", "Bitbns", "Mudrex",
}

# International CEXs and instant swap desks (high risk)
INTERNATIONAL_CEXS = {
    "Binance", "Coinbase", "Kraken", "OKX", "Bybit", "KuCoin", "Huobi",
    "Gate.io", "Bitfinex", "Gemini", "Crypto.com",
}

INSTANT_SWAP_DESKS = {
    "FixedFloat", "ChangeNOW", "SimpleSwap", "SideShift",
}


@dataclass
class NCRPComplaintResult:
    """Result of triage analysis for a single NCRP complaint."""
    complaint_id: str
    suspect_wallet: str
    chain: str = "ethereum"
    flight_risk_score: int = 0
    priority: str = "COLD"  # CRITICAL, HIGH, MEDIUM, COLD
    priority_badge: str = "⚪"  # 🔴, 🟡, ⚪
    nearest_vasp: Optional[str] = None
    vasp_hop_distance: Optional[int] = None
    vasp_category: Optional[str] = None
    is_indian_fiu_vasp: bool = False
    is_instant_swap: bool = False
    total_outflow: float = 0.0
    defrauded_amount_inr: float = 0.0
    analysis_notes: str = ""
    analyzed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class NCRPBatchResult:
    """Aggregate result for a batch of NCRP complaints."""
    batch_id: str
    total_complaints: int = 0
    processed: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    cold_count: int = 0
    status: str = "PENDING"  # PENDING, PROCESSING, COMPLETED, FAILED
    results: List[NCRPComplaintResult] = field(default_factory=list)
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["results"] = [r.to_dict() if hasattr(r, 'to_dict') else r for r in self.results]
        return data


class NCRPTriageWorker:
    """
    Asynchronous NCRP complaint triage worker.

    For each suspect wallet address:
    1. Validates and normalizes the address.
    2. Performs quick label store lookup (Hop 0).
    3. If needed, traces to Hop 1 & Hop 2 via lightweight orchestrator.
    4. Computes Flight-Risk Priority Score (0-100).
    """

    def __init__(self):
        self._active_batches: Dict[str, NCRPBatchResult] = {}

    def create_batch(self, complaints: List[Dict[str, Any]]) -> str:
        """Creates a new batch triage job and returns batch_id."""
        batch_id = f"NCRP-BATCH-{uuid.uuid4().hex[:8].upper()}"
        batch = NCRPBatchResult(
            batch_id=batch_id,
            total_complaints=len(complaints),
            status="PENDING",
        )
        self._active_batches[batch_id] = batch
        return batch_id

    def get_batch(self, batch_id: str) -> Optional[NCRPBatchResult]:
        """Returns batch result by ID."""
        return self._active_batches.get(batch_id)

    async def process_batch(self, batch_id: str, complaints: List[Dict[str, Any]]) -> NCRPBatchResult:
        """
        Process a batch of NCRP complaints asynchronously.
        Evaluates each complaint and computes flight-risk scores.
        """
        batch = self._active_batches.get(batch_id)
        if not batch:
            batch = NCRPBatchResult(batch_id=batch_id, total_complaints=len(complaints))
            self._active_batches[batch_id] = batch

        batch.status = "PROCESSING"

        for complaint in complaints:
            try:
                result = await self._evaluate_complaint(complaint)
                batch.results.append(result)
                batch.processed += 1

                # Update counts
                if result.priority == "CRITICAL":
                    batch.critical_count += 1
                elif result.priority == "HIGH":
                    batch.high_count += 1
                elif result.priority == "MEDIUM":
                    batch.medium_count += 1
                else:
                    batch.cold_count += 1

            except Exception as e:
                logger.error(f"Error processing complaint {complaint.get('complaint_id', '?')}: {e}")
                batch.results.append(NCRPComplaintResult(
                    complaint_id=complaint.get("complaint_id", "UNKNOWN"),
                    suspect_wallet=complaint.get("suspect_wallet", ""),
                    flight_risk_score=0,
                    priority="COLD",
                    priority_badge="⚪",
                    analysis_notes=f"Processing error: {str(e)}",
                ))
                batch.cold_count += 1
                batch.processed += 1

        batch.status = "COMPLETED"
        batch.completed_at = datetime.now(timezone.utc).isoformat()

        # Sort results by flight risk score (highest first)
        batch.results.sort(key=lambda r: r.flight_risk_score, reverse=True)

        logger.info(
            f"NCRP Batch {batch_id} complete: {batch.total_complaints} complaints. "
            f"🔴 CRITICAL={batch.critical_count}, 🟡 HIGH={batch.high_count}, "
            f"🟠 MEDIUM={batch.medium_count}, ⚪ COLD={batch.cold_count}"
        )
        return batch

    async def _evaluate_complaint(self, complaint: Dict[str, Any]) -> NCRPComplaintResult:
        """Evaluates a single NCRP complaint and computes flight-risk score."""
        from backend.app.core.address_validator import (
            is_valid_crypto_address,
            normalize_address,
            detect_blockchain,
        )
        from backend.app.services.labels.store import label_store

        complaint_id = complaint.get("complaint_id", "UNKNOWN")
        suspect_wallet = complaint.get("suspect_wallet", "").strip()
        defrauded_inr = float(complaint.get("victim_loss_inr", complaint.get("defrauded_amount_inr", 0)))

        # Validate address
        if not suspect_wallet or not is_valid_crypto_address(suspect_wallet):
            return NCRPComplaintResult(
                complaint_id=complaint_id,
                suspect_wallet=suspect_wallet,
                flight_risk_score=0,
                priority="COLD",
                priority_badge="⚪",
                defrauded_amount_inr=defrauded_inr,
                analysis_notes="Invalid wallet address format.",
            )

        norm_addr = normalize_address(suspect_wallet)
        chain = detect_blockchain(norm_addr)
        score = 0
        notes_parts = []

        # --- Hop 0: Direct label store lookup ---
        label = label_store.lookup(norm_addr, chain=chain)
        if label:
            nearest_vasp = label.entity
            vasp_category = label.category
            is_vasp = label.is_vasp

            if is_vasp and nearest_vasp in INDIAN_FIU_VASPS:
                # CRITICAL: Direct hit on Indian FIU VASP
                score = 95
                notes_parts.append(f"CRITICAL: Suspect wallet IS a known {nearest_vasp} address (Indian FIU VASP). Immediate freeze action possible.")
                return NCRPComplaintResult(
                    complaint_id=complaint_id,
                    suspect_wallet=norm_addr,
                    chain=chain,
                    flight_risk_score=score,
                    priority="CRITICAL",
                    priority_badge="🔴",
                    nearest_vasp=nearest_vasp,
                    vasp_hop_distance=0,
                    vasp_category=vasp_category,
                    is_indian_fiu_vasp=True,
                    defrauded_amount_inr=defrauded_inr,
                    analysis_notes=" ".join(notes_parts),
                )

            if is_vasp and nearest_vasp in INTERNATIONAL_CEXS:
                score = 70
                notes_parts.append(f"HIGH: Suspect wallet IS a known {nearest_vasp} address (International CEX).")
                return NCRPComplaintResult(
                    complaint_id=complaint_id,
                    suspect_wallet=norm_addr,
                    chain=chain,
                    flight_risk_score=score,
                    priority="HIGH",
                    priority_badge="🟡",
                    nearest_vasp=nearest_vasp,
                    vasp_hop_distance=0,
                    vasp_category=vasp_category,
                    defrauded_amount_inr=defrauded_inr,
                    analysis_notes=" ".join(notes_parts),
                )

            if is_vasp and nearest_vasp in INSTANT_SWAP_DESKS:
                score = 75
                notes_parts.append(f"HIGH: Suspect wallet IS a known {nearest_vasp} address (Non-KYC Instant Swap).")
                return NCRPComplaintResult(
                    complaint_id=complaint_id,
                    suspect_wallet=norm_addr,
                    chain=chain,
                    flight_risk_score=score,
                    priority="HIGH",
                    priority_badge="🟡",
                    nearest_vasp=nearest_vasp,
                    vasp_hop_distance=0,
                    vasp_category=vasp_category,
                    is_instant_swap=True,
                    defrauded_amount_inr=defrauded_inr,
                    analysis_notes=" ".join(notes_parts),
                )

            if label.risk_level == "CRITICAL":
                score = 65
                notes_parts.append(f"HIGH: Suspect wallet flagged as {label.category} ({label.entity}).")
                return NCRPComplaintResult(
                    complaint_id=complaint_id,
                    suspect_wallet=norm_addr,
                    chain=chain,
                    flight_risk_score=score,
                    priority="HIGH",
                    priority_badge="🟡",
                    nearest_vasp=nearest_vasp,
                    vasp_hop_distance=0,
                    vasp_category=vasp_category,
                    defrauded_amount_inr=defrauded_inr,
                    analysis_notes=" ".join(notes_parts),
                )

        # --- No direct label hit: Unknown wallet, assign MEDIUM score ---
        # In production, this would trigger Hop 1 & Hop 2 trace
        score = 45
        notes_parts.append("MEDIUM: Suspect wallet not found in label store. Funds likely in unhosted intermediate wallet. Deeper trace recommended.")

        return NCRPComplaintResult(
            complaint_id=complaint_id,
            suspect_wallet=norm_addr,
            chain=chain,
            flight_risk_score=score,
            priority="MEDIUM",
            priority_badge="🟠",
            defrauded_amount_inr=defrauded_inr,
            analysis_notes=" ".join(notes_parts),
        )


# Global singleton
ncrp_triage_worker = NCRPTriageWorker()
