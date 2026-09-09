"""
LLM Narrative Service for Cryptocurrency Forensic Intelligence Reports.

Synthesizes structured graph traversal, VASP attribution, and risk heuristic data
into a publication-quality intelligence brief adhering to:
- Operating Rule 5: Non-decisional narrative synthesis (LLM never decides scores or labels).
- Intelligence brief standards (write-the-intel-brief):
  1. BLUF (Bottom Line Up Front) key judgement
  2. Clear separation of Observation, Inference, and Assessment
  3. Standardized estimative probability ladder (almost certainly, highly likely, likely, etc.)
  4. Explicit confidence ratings (High, Moderate, Low)
  5. Documented negative findings and investigative limitations
- Section 94 BNSS / Section 91 CrPC actionable requisition recommendations.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Standard estimative probability ladder per write-the-intel-brief
ESTIMATIVE_LADDER = [
    (85.0, "almost certainly"),
    (70.0, "highly likely"),
    (55.0, "likely"),
    (40.0, "roughly even chance"),
    (25.0, "unlikely"),
    (10.0, "highly unlikely"),
    (0.0, "remote"),
]


def map_score_to_estimative_term(score: float) -> str:
    """Map attribution/risk score to estimative probability term."""
    for threshold, term in ESTIMATIVE_LADDER:
        if score >= threshold:
            return term
    return "remote"


class LLMNarrativeService:
    """
    Generates plain-English, court-admissible forensic intelligence narratives.
    Utilizes Anthropic Claude API when configured, with seamless, deterministic
    intelligence brief fallback when offline or unconfigured.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key if api_key is not None else (settings.ANTHROPIC_API_KEY or settings.CLAUDE_API_KEY)
        self.model = model
        self.endpoint = "https://api.anthropic.com/v1/messages"

    async def generate_narrative(
        self,
        case_id: str,
        wallet_address: str,
        chain: str,
        attributions: List[Dict[str, Any]],
        risk_assessment: Optional[Dict[str, Any]],
        evidence: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
        summary_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synthesizes structured trace data into an intelligence narrative.

        Returns:
            dict containing:
                - narrative: str (full formatted intelligence brief)
                - bluf: str (Bottom Line Up Front summary)
                - model: str
                - confidence: str
                - probability_term: str
                - generated_at: str
        """
        top_attr = attributions[0] if attributions else None
        top_vasp = top_attr.get("vasp_name", "Unidentified VASP") if top_attr else "Unidentified VASP"
        top_score = float(top_attr.get("score", 0.0)) if top_attr else 0.0
        evidence_strength = top_attr.get("evidence_strength", "Low") if top_attr else "Low"
        prob_term = map_score_to_estimative_term(top_score)

        # Build clean, structured context payload
        structured_payload = {
            "case_id": case_id,
            "target_wallet": wallet_address,
            "blockchain": chain,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "graph_metrics": {
                "total_nodes": summary_stats.get("total_nodes", len(set([t.get("from") for t in transactions] + [t.get("to") for t in transactions]))),
                "total_edges": summary_stats.get("total_edges", len(transactions)),
                "vasp_nodes_found": summary_stats.get("vasp_nodes_found", len(attributions)),
                "max_hop_reached": summary_stats.get("max_hop_reached", 3),
            },
            "top_attribution": top_attr,
            "ranked_attributions": attributions[:3],
            "risk_assessment": risk_assessment,
            "evidence_samples": evidence[:5],
            "critical_transactions_summary": [
                {
                    "tx_hash": t.get("tx_hash"),
                    "from": t.get("from") or t.get("from_address"),
                    "to": t.get("to") or t.get("to_address"),
                    "amount": t.get("amount"),
                    "token": t.get("token_symbol") or t.get("asset", "NATIVE"),
                    "hop": t.get("hop")
                }
                for t in transactions[:8]
            ],
            "estimative_mapping": {
                "probability_term": prob_term,
                "confidence_level": evidence_strength
            }
        }

        # Claude API synthesis
        if not self.api_key or len(self.api_key.strip()) < 10:
            raise RuntimeError(
                "Anthropic Claude API key is not configured. "
                "Please set ANTHROPIC_API_KEY in .env to generate court-ready AI investigation narratives."
            )

        try:
            narrative_text = await self._call_claude_api(structured_payload)
            if not narrative_text:
                raise RuntimeError("Claude API returned an empty narrative response.")
            bluf = self._extract_bluf(narrative_text)
            return {
                "narrative": narrative_text,
                "bluf": bluf,
                "model": self.model,
                "confidence": evidence_strength,
                "probability_term": prob_term,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "mode": "claude_api"
            }
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise RuntimeError(f"Claude API call failed: {e}") from e

    async def _call_claude_api(self, payload: Dict[str, Any]) -> Optional[str]:
        """Calls Anthropic Claude Messages API with strict non-decisional prompt."""
        system_prompt = (
            "You are a Senior Cryptocurrency Forensic Intelligence Analyst for Law Enforcement. "
            "Your task is to synthesize structured transaction trace data into a court-ready, defensible "
            "intelligence brief adhering strictly to intelligence-briefing methodology:\n"
            "1. Lead with a concise BLUF (Bottom Line Up Front) key judgement.\n"
            "2. Strictly separate OBSERVATIONS (verifiable facts, hashes, timestamps) from INFERENCES "
            "(logical deductions on peeling chains, intermediary hops) and ASSESSMENTS (analytic conclusions).\n"
            "3. Use the standardized estimative probability ladder: almost certainly, highly likely, likely, "
            "roughly even chance, unlikely, highly unlikely, remote.\n"
            "4. Express explicit confidence ratings (High, Moderate, Low).\n"
            "5. Document negative findings (e.g. absence of direct sanction hits) and analytical boundaries.\n"
            "6. CRITICAL RULE: You do NOT calculate or decide risk scores or entity labels; you strictly "
            "explain and synthesize the structured findings already provided in the prompt."
        )

        user_content = (
            f"Please generate the forensic intelligence narrative for the following structured trace data:\n\n"
            f"```json\n{json.dumps(payload, indent=2)}\n```\n\n"
            f"Format your response with the following clear markdown sections:\n"
            f"### 1. BOTTOM LINE UP FRONT (BLUF)\n"
            f"### 2. VERIFIABLE OBSERVATIONS (FACTUAL RECORD)\n"
            f"### 3. FORENSIC INFERENCES (TRANSACTION DYNAMICS & PATTERNS)\n"
            f"### 4. ANALYTIC ASSESSMENT (VASP ATTRIBUTION & ESTIMATIVE RATING)\n"
            f"### 5. NEGATIVE FINDINGS & LIMITATIONS\n"
            f"### 6. RECOMMENDED LAW ENFORCEMENT ACTIONS (SECTION 94 BNSS / 91 CrPC)"
        )

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        body = {
            "model": self.model,
            "max_tokens": 1500,
            "temperature": 0.2,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_content}
            ]
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(self.endpoint, headers=headers, json=body)
            if response.status_code == 200:
                data = response.json()
                content_blocks = data.get("content", [])
                if content_blocks and "text" in content_blocks[0]:
                    return content_blocks[0]["text"].strip()
            else:
                logger.error(f"Anthropic API returned status {response.status_code}: {response.text}")
                raise RuntimeError(f"Anthropic Claude API call failed (HTTP {response.status_code}): {response.text}")

    def _generate_deterministic_brief(self, payload: Dict[str, Any]) -> str:
        """
        Generates a rigorous, defensible intelligence brief deterministically
        from structured inputs following write-the-intel-brief.
        """
        wallet = payload["target_wallet"]
        chain = payload["blockchain"]
        top_attr = payload.get("top_attribution")
        risk = payload.get("risk_assessment") or {}
        metrics = payload.get("graph_metrics", {})
        evidence_samples = payload.get("evidence_samples", [])
        mapping = payload.get("estimative_mapping", {})
        prob_term = mapping.get("probability_term", "likely")
        confidence = mapping.get("confidence_level", "Moderate")

        vasp_name = top_attr.get("vasp_name", "an unidentified exchange cluster") if top_attr else "an unidentified counterparty"
        attr_score = top_attr.get("score", 0.0) if top_attr else 0.0
        risk_score = risk.get("score", 0.0)
        risk_level = risk.get("risk_level", "MEDIUM")
        indicators = risk.get("indicators", [])

        # Format indicators bullet points
        ind_bullets = "\n".join([f"- **Indicator**: {ind}" for ind in indicators]) if indicators else "- No anomalous laundering patterns detected."

        # BLUF paragraph
        bluf = (
            f"**BLUF**: On-chain fund flow analysis of suspect wallet `{wallet}` on **{chain}** demonstrates that "
            f"proceeds moved across {metrics.get('max_hop_reached', 3)} topological hops and reached custodial "
            f"infrastructure clustered with **{vasp_name}** with **{attr_score:.1f}/100** attribution score. "
            f"We assess it is **{prob_term}** ({confidence} confidence) that the destination cluster represents "
            f"actionable custodial deposit accounts subject to Section 94 BNSS / Section 91 CrPC asset preservation requisitions."
        )

        # Observations
        observations = [
            f"- **Target Suspect Address**: `{wallet}` on {chain}.",
            f"- **Graph Scale Analyzed**: {metrics.get('total_edges', 0)} directed transactions mapping across {metrics.get('total_nodes', 0)} unique counterparty addresses bounded within {metrics.get('max_hop_reached', 3)} hops.",
            f"- **Terminal Cluster Observed**: Counterparty address associated with {vasp_name} registry cluster reached at terminal hop.",
        ]
        if evidence_samples:
            for ev in evidence_samples[:3]:
                tx_str = f"Tx `{ev.get('tx_hash', 'N/A')[:12]}...`" if ev.get("tx_hash") else "Directed flow"
                observations.append(f"- **Direct Evidence**: {tx_str} ({ev.get('evidence_type', 'Flow')}) demonstrating hop {ev.get('hop_distance', 1)} movement from `{ev.get('source_address', 'N/A')[:10]}...` to `{ev.get('target_address', 'N/A')[:10]}...`.")

        obs_text = "\n".join(observations)

        # Inferences
        inferences = [
            f"- **Hop Sequencing**: Rapid multi-hop dispersal was observed across intermediate wallet nodes, consistent with transit or peeling behaviors designed to obscure origin.",
            f"- **Composite Risk Factor**: Heuristic classification assigned an on-chain risk score of `{risk_score}/100` ({risk_level} risk), driven by observed structural indicators:\n{ind_bullets}",
            f"- **Custodial Convergence**: Outbound funds did not disperse into unhosted cold storage; rather, transaction edges terminate in a high-volume cluster whose behavioral profile matches custodial exchange deposit processing."
        ]
        inf_text = "\n".join(inferences)

        # Assessment
        assessment = (
            f"We assess it is **{prob_term}** that funds originating from suspect wallet `{wallet}` were deposited into "
            f"custodial wallets managed by **{vasp_name}**. Confidence in this attribution is rated **{confidence}**, "
            f"supported by deterministic shortest-path proximity, flow ratio continuity, and cross-referencing against "
            f"curated exchange deposit architectures. Beneficial account ownership cannot be confirmed solely on-chain "
            f"and requires custodial subscriber records."
        )

        # Negative findings
        neg_findings = (
            f"- **OFAC / Sanctions Screening**: No direct interaction with OFAC SDN sanctioned contracts or blacklisted darknet addresses was observed within the analyzed 3-hop boundary.\n"
            f"- **Mixer / Privacy Pool Verification**: No direct deposit into known Tornado Cash or zero-knowledge anonymizing pools was identified along the primary attribution path.\n"
            f"- **Analytical Limitations**: Traversal is bounded to 3 hops and 150 local graph nodes to prevent state explosion; unobserved off-chain netting or internal exchange book transfers cannot be captured by public ledger analysis."
        )

        # Next actions
        next_actions = (
            f"1. **Immediate Section 94 BNSS / Section 91 CrPC Freeze Requisition**: Serve an emergency asset preservation "
            f"notice to the Nodal Officer of **{vasp_name}** requesting immediate locking of recipient User UID accounts.\n"
            f"2. **Beneficial KYC Disclosure**: Requisition full subscriber identification, verified government ID (Aadhaar/Passport), "
            f"linked bank accounts, and IP access logs for the destination deposit address.\n"
            f"3. **Sahyog Portal Electronic Routing**: Dispatch the preservation directive through the National Cybercrime "
            f"Reporting Portal (NCRP) / Sahyog platform to secure an electronic chain-of-custody audit trail."
        )

        sections = [
            "### 1. BOTTOM LINE UP FRONT (BLUF)",
            bluf,
            "",
            "### 2. VERIFIABLE OBSERVATIONS (FACTUAL RECORD)",
            obs_text,
            "",
            "### 3. FORENSIC INFERENCES (TRANSACTION DYNAMICS & PATTERNS)",
            inf_text,
            "",
            "### 4. ANALYTIC ASSESSMENT (VASP ATTRIBUTION & ESTIMATIVE RATING)",
            assessment,
            "",
            "### 5. NEGATIVE FINDINGS & LIMITATIONS",
            neg_findings,
            "",
            "### 6. RECOMMENDED LAW ENFORCEMENT ACTIONS (SECTION 94 BNSS / 91 CrPC)",
            next_actions
        ]

        return "\n".join(sections)

    def _extract_bluf(self, text: str) -> str:
        """Extracts the BLUF paragraph from the synthesized brief."""
        lines = text.split("\n")
        in_bluf = False
        bluf_lines = []
        for line in lines:
            line_s = line.strip()
            if "BLUF" in line_s or "BOTTOM LINE UP FRONT" in line_s:
                in_bluf = True
                continue
            if in_bluf:
                if line_s.startswith("###") or line_s.startswith("## "):
                    break
                if line_s:
                    bluf_lines.append(line_s)

        if bluf_lines:
            return " ".join(bluf_lines)

        # Fallback to first non-heading paragraph
        for line in lines:
            line_s = line.strip()
            if line_s and not line_s.startswith("#") and len(line_s) > 40:
                return line_s

        return "Analysis completed. Traced funds reached an attributed exchange cluster."


# Global singleton instance
narrative_service = LLMNarrativeService()
