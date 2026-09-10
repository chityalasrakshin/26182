"""
Forensic Bitcoin Change Address Detector.

Implements battle-tested change disambiguation heuristics from:
VincenzoImp/bitcoin-address-clustering (Section 4.5 Heuristics) & Meiklejohn et al.:
1. Address Reuse Heuristic (same address in input & output)
2. Optimal Change Heuristic (unnecessary input aggregation)
3. Round Value Heuristic (decimal payment vs irregular satoshi change)
4. Script Type Consistency (SegWit vs Legacy output format matching inputs)
"""

import logging
from typing import List, Dict, Optional, Tuple, Set
from datetime import datetime

from backend.app.schemas.heuristics import (
    UTXOTransaction,
    UTXOInput,
    UTXOOutput,
    ChangeAddressDetectionResult
)
from backend.app.core.address_validator import get_btc_address_type, normalize_address

logger = logging.getLogger(__name__)


def count_decimal_places(val: float) -> int:
    """Returns number of meaningful decimal places after stripping trailing zeros."""
    formatted = f"{val:.8f}".rstrip("0")
    if "." not in formatted:
        return 0
    return len(formatted.split(".")[1])


def is_round_btc_amount(val: float) -> bool:
    """
    Checks if a BTC amount is a common human-selected round payment.
    e.g., 1.0, 0.5, 0.25, 0.1, 0.05, 0.01, 0.005, 0.001 BTC.
    """
    if val <= 0:
        return False
    # Check if value has <= 3 decimal places
    if count_decimal_places(val) <= 3:
        return True
    # Check if value is close to round satoshi denominations
    satoshis = round(val * 1e8)
    for denom in [10_000_000, 5_000_000, 1_000_000, 500_000, 100_000, 50_000, 10_000]:
        if satoshis % denom == 0:
            return True
    return False


def safe_normalize_address(addr: str) -> str:
    """Safely normalizes address without throwing on unconventional test strings."""
    if not addr:
        return ""
    try:
        return normalize_address(addr)
    except Exception:
        clean = addr.strip()
        return clean.lower() if clean.startswith("0x") else clean


class ChangeAddressDetector:
    """
    Detector for disambiguating between recipient payment and sender change outputs
    in Bitcoin UTXO transactions.
    """

    def __init__(self):
        pass

    def detect_change(
        self,
        tx: UTXOTransaction,
        known_cluster: Optional[Set[str]] = None
    ) -> Optional[ChangeAddressDetectionResult]:
        """
        Evaluates a UTXO transaction (typically 2-output payment) to identify
        which output is the intended payment and which is change back to sender.

        Returns ChangeAddressDetectionResult or None if indeterminate.
        """
        # Change disambiguation requires standard payment structure with exactly 2 outputs
        if len(tx.outputs) != 2 or len(tx.inputs) == 0:
            return None

        out0 = tx.outputs[0]
        out1 = tx.outputs[1]

        # Ignore self-transfers or duplicate output addresses
        if out0.address == out1.address:
            return None

        # Gather inputs and cluster context
        input_addrs = {safe_normalize_address(inp.address) for inp in tx.inputs if inp.address}
        if known_cluster:
            input_addrs.update(safe_normalize_address(a) for a in known_cluster)

        norm_out0 = safe_normalize_address(out0.address)
        norm_out1 = safe_normalize_address(out1.address)

        # ----------------------------------------------------------------------
        # Heuristic 1: Address Reuse (VincenzoImp Heuristic 1)
        # If an output address previously appeared as an input, it is definitively change.
        # ----------------------------------------------------------------------
        in0 = norm_out0 in input_addrs
        in1 = norm_out1 in input_addrs

        if in0 and not in1:
            out0.is_change = True
            out1.is_change = False
            return ChangeAddressDetectionResult(
                tx_hash=tx.tx_hash,
                chain=tx.chain,
                timestamp=tx.timestamp,
                payment_address=out1.address,
                payment_amount_btc=out1.amount_btc,
                change_address=out0.address,
                change_amount_btc=out0.amount_btc,
                heuristic_rule="ADDRESS_REUSE",
                confidence_score=0.98,
                explanation=(
                    f"Address reuse heuristic: Output {out0.address[:10]}... appeared in transaction inputs, "
                    f"confirming it as sender change returned to {out0.address}."
                )
            )
        elif in1 and not in0:
            out1.is_change = True
            out0.is_change = False
            return ChangeAddressDetectionResult(
                tx_hash=tx.tx_hash,
                chain=tx.chain,
                timestamp=tx.timestamp,
                payment_address=out0.address,
                payment_amount_btc=out0.amount_btc,
                change_address=out1.address,
                change_amount_btc=out1.amount_btc,
                heuristic_rule="ADDRESS_REUSE",
                confidence_score=0.98,
                explanation=(
                    f"Address reuse heuristic: Output {out1.address[:10]}... appeared in transaction inputs, "
                    f"confirming it as sender change returned to {out1.address}."
                )
            )

        # ----------------------------------------------------------------------
        # Heuristic 2: Optimal Change Heuristic (VincenzoImp Heuristic 2 / Unnecessary Input)
        # If sender aggregated multiple inputs and one output is smaller than the
        # smallest input, the larger output required aggregation and is the payment.
        # ----------------------------------------------------------------------
        votes = []  # List of tuples: (change_idx, payment_idx, rule, confidence, explanation)

        if len(tx.inputs) >= 2:
            min_input = min(inp.amount_btc for inp in tx.inputs if inp.amount_btc > 0)
            if out0.amount_btc < min_input and out1.amount_btc >= min_input:
                votes.append((
                    0, 1,
                    "OPTIMAL_CHANGE",
                    0.92,
                    f"Optimal change heuristic: Output 0 ({out0.amount_btc:.6f} BTC) is smaller than the smallest input "
                    f"({min_input:.6f} BTC); Output 1 ({out1.amount_btc:.6f} BTC) necessitated input aggregation."
                ))
            elif out1.amount_btc < min_input and out0.amount_btc >= min_input:
                votes.append((
                    1, 0,
                    "OPTIMAL_CHANGE",
                    0.92,
                    f"Optimal change heuristic: Output 1 ({out1.amount_btc:.6f} BTC) is smaller than the smallest input "
                    f"({min_input:.6f} BTC); Output 0 ({out0.amount_btc:.6f} BTC) necessitated input aggregation."
                ))

        # ----------------------------------------------------------------------
        # Heuristic 3: Round Value / Decimal Heuristic (VincenzoImp Heuristic 3)
        # Identifies round payment amounts (e.g. 1.0, 0.5, 0.05 BTC) with irregular satoshi change.
        # ----------------------------------------------------------------------
        dec0 = count_decimal_places(out0.amount_btc)
        dec1 = count_decimal_places(out1.amount_btc)
        round0 = is_round_btc_amount(out0.amount_btc)
        round1 = is_round_btc_amount(out1.amount_btc)

        if round0 and not round1 and (dec1 - dec0 >= 2 or dec1 >= 5):
            votes.append((
                1, 0,
                "ROUND_PAYMENT",
                0.85,
                f"Round payment heuristic: Output 0 has clean payment amount ({out0.amount_btc} BTC, {dec0} dec) "
                f"while Output 1 has irregular change residue ({out1.amount_btc} BTC, {dec1} dec)."
            ))
        elif round1 and not round0 and (dec0 - dec1 >= 2 or dec0 >= 5):
            votes.append((
                0, 1,
                "ROUND_PAYMENT",
                0.85,
                f"Round payment heuristic: Output 1 has clean payment amount ({out1.amount_btc} BTC, {dec1} dec) "
                f"while Output 0 has irregular change residue ({out0.amount_btc} BTC, {dec0} dec)."
            ))

        # ----------------------------------------------------------------------
        # Heuristic 4: Script Type Consistency
        # Output sharing the input script format (SegWit bc1 vs Legacy 1 vs P2SH 3)
        # is more likely to be change generated by the sender's wallet software.
        # ----------------------------------------------------------------------
        input_script_types = {get_btc_address_type(inp.address) for inp in tx.inputs if inp.address}
        input_script_types.discard(None)

        if len(input_script_types) == 1:
            inp_script = list(input_script_types)[0]
            script0 = get_btc_address_type(out0.address)
            script1 = get_btc_address_type(out1.address)

            if script0 == inp_script and script1 != inp_script:
                votes.append((
                    0, 1,
                    "SCRIPT_TYPE_CONSISTENCY",
                    0.78,
                    f"Script consistency heuristic: Output 0 matches input script format '{inp_script}', "
                    f"while Output 1 format '{script1}' differs."
                ))
            elif script1 == inp_script and script0 != inp_script:
                votes.append((
                    1, 0,
                    "SCRIPT_TYPE_CONSISTENCY",
                    0.78,
                    f"Script consistency heuristic: Output 1 matches input script format '{inp_script}', "
                    f"while Output 0 format '{script0}' differs."
                ))

        if not votes:
            return None

        # Aggregate votes: determine winning change index
        votes_for_0 = [v for v in votes if v[0] == 0]
        votes_for_1 = [v for v in votes if v[0] == 1]

        if votes_for_0 and not votes_for_1:
            winning_idx, paying_idx = 0, 1
            winning_votes = votes_for_0
        elif votes_for_1 and not votes_for_0:
            winning_idx, paying_idx = 1, 0
            winning_votes = votes_for_1
        else:
            # Conflicting heuristics: choose highest confidence vote
            best_0 = max((v[3] for v in votes_for_0), default=0.0)
            best_1 = max((v[3] for v in votes_for_1), default=0.0)
            if best_0 > best_1:
                winning_idx, paying_idx = 0, 1
                winning_votes = votes_for_0
            elif best_1 > best_0:
                winning_idx, paying_idx = 1, 0
                winning_votes = votes_for_1
            else:
                return None

        change_out = tx.outputs[winning_idx]
        payment_out = tx.outputs[paying_idx]
        change_out.is_change = True
        payment_out.is_change = False

        # Calculate composite confidence
        max_conf = max(v[3] for v in winning_votes)
        composite_conf = min(0.99, max_conf + (0.05 if len(winning_votes) > 1 else 0.0))
        rule_name = winning_votes[0][2] if len(winning_votes) == 1 else "COMPOSITE"
        combined_explanation = " | ".join(v[4] for v in winning_votes)

        return ChangeAddressDetectionResult(
            tx_hash=tx.tx_hash,
            chain=tx.chain,
            timestamp=tx.timestamp,
            payment_address=payment_out.address,
            payment_amount_btc=payment_out.amount_btc,
            change_address=change_out.address,
            change_amount_btc=change_out.amount_btc,
            heuristic_rule=rule_name,
            confidence_score=round(composite_conf, 2),
            explanation=combined_explanation
        )

    def analyze_transactions(
        self,
        transactions: List[UTXOTransaction],
        known_cluster: Optional[Set[str]] = None
    ) -> List[ChangeAddressDetectionResult]:
        """Analyzes a list of UTXO transactions and returns all identified change detections."""
        results = []
        for tx in transactions:
            res = self.detect_change(tx, known_cluster=known_cluster)
            if res:
                results.append(res)
        return results


# Global singleton instance
change_detector = ChangeAddressDetector()
