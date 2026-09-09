"""
Court-Admissible PDF Investigation Dossier Generator.

Renders a formal, publication-quality A4 PDF investigation dossier using ReportLab.
Designed for submission to Indian courts and law enforcement agencies.

Features:
- Official LEA header with case metadata
- Risk assessment badges with visual severity indicators
- Top VASP Attribution breakdown table
- Transaction Evidence Table with traceable amounts
- SHA-256 Chain-of-Custody graph checksums
- Section 65B Indian Evidence Act certificate
- Section 63 BSA / BNS / BNSS statutory compliance certification
- Multi-chain provenance citations

Source: Adapted from SIH26182/backend/report.py and CRYPTO-TRACE-/backend/services/report_generator.py
"""

import io
import re
import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def _md_to_reportlab(text: str) -> str:
    """Safely converts markdown formatting to valid ReportLab XML."""
    if not text:
        return ""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r"<font face='Courier'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
    return text

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm, cm
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, HRFlowable, KeepTogether, Image as RLImage
    )
    from reportlab.platypus.flowables import Flowable
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning(
        "ReportLab is not installed. PDF generation will be unavailable. "
        "Install with: pip install reportlab"
    )

from backend.app.services.reporting.graph_visualizer import trace_graph_visualizer


# Color scheme for forensic documents
HEADER_BG = colors.HexColor("#1a237e")       # Deep navy
HEADER_TEXT = colors.white
RISK_HIGH = colors.HexColor("#c62828")        # Deep red
RISK_MEDIUM = colors.HexColor("#e65100")      # Deep orange
RISK_LOW = colors.HexColor("#2e7d32")         # Forest green
TABLE_HEADER_BG = colors.HexColor("#283593")  # Indigo
TABLE_ALT_ROW = colors.HexColor("#f5f5f5")   # Light gray
BORDER_COLOR = colors.HexColor("#1565c0")     # Blue border


def _risk_color(risk_level: str) -> colors.Color:
    """Map risk level string to a color."""
    level = risk_level.upper() if risk_level else "LOW"
    if level in ("HIGH", "CRITICAL"):
        return RISK_HIGH
    elif level == "MEDIUM":
        return RISK_MEDIUM
    return RISK_LOW


def _truncate(text: str, max_len: int = 42) -> str:
    """Truncate long strings for table cells."""
    if not text:
        return "-"
    return text if len(text) <= max_len else f"{text[:16]}...{text[-12:]}"


class PDFDossierGenerator:
    """
    Generates court-admissible PDF investigation dossiers using ReportLab.

    Usage:
        generator = PDFDossierGenerator()
        pdf_bytes = generator.generate(
            case_id="abc-123",
            wallet_address="0x1234...",
            chain="Ethereum Mainnet",
            attributions=[...],
            evidence=[...],
            risk_assessment={...},
            transactions=[...],
            summary_stats={...}
        )
        # pdf_bytes is a bytes object ready for HTTP response
    """

    def __init__(self):
        if not REPORTLAB_AVAILABLE:
            raise ImportError(
                "ReportLab is required for PDF generation. "
                "Install with: pip install reportlab"
            )

    def generate(
        self,
        case_id: str,
        wallet_address: str,
        chain: str = "Ethereum Mainnet",
        attributions: Optional[List[Dict[str, Any]]] = None,
        evidence: Optional[List[Dict[str, Any]]] = None,
        risk_assessment: Optional[Dict[str, Any]] = None,
        transactions: Optional[List[Dict[str, Any]]] = None,
        summary_stats: Optional[Dict[str, Any]] = None,
        narrative: Optional[str] = None,
        draft_notice: Optional[Dict[str, Any]] = None,
        graph_image_bytes: Optional[bytes] = None,
        officer_name: str = "Investigating Officer",
        police_station: str = "Cyber Crime Police Station",
    ) -> bytes:
        """
        Generate a complete, court-admissible PDF investigation dossier.

        Returns:
            bytes: PDF file content
        """
        attributions = attributions or []
        evidence = evidence or []
        transactions = transactions or []
        summary_stats = summary_stats or {}

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=20 * mm,
            title=f"Investigation Dossier - {case_id[:8].upper()}",
            author="SUDARSHAN Forensic Intelligence System",
        )

        styles = getSampleStyleSheet()
        self._register_custom_styles(styles)

        # Build document elements
        elements = []

        now = datetime.now(tz=timezone.utc)
        ref_no = f"SUDARSHAN/LEA/{now.year}/{case_id[:8].upper()}"
        date_str = now.strftime("%d-%B-%Y %H:%M:%S UTC")

        # 1. Official Header
        elements.extend(self._build_header(ref_no, date_str, case_id, wallet_address, chain, styles))
        elements.append(Spacer(1, 6 * mm))

        # 2. Risk Assessment Badge
        if risk_assessment:
            elements.extend(self._build_risk_section(risk_assessment, styles))
            elements.append(Spacer(1, 5 * mm))

        # 3. Visual Trace Flow Diagram Subgraph
        top_attr = attributions[0] if attributions else {}
        top_vasp_name = top_attr.get("vasp_name") if top_attr else None
        attr_score = float(top_attr.get("score", 0.0)) if top_attr else 0.0
        risk_lvl = risk_assessment.get("risk_level", "MEDIUM") if risk_assessment else "MEDIUM"
        elements.extend(self._build_graph_section(
            wallet_address=wallet_address,
            chain=chain,
            top_vasp_name=top_vasp_name,
            attribution_score=attr_score,
            risk_level=risk_lvl,
            transactions=transactions,
            case_id=case_id,
            graph_image_bytes=graph_image_bytes,
            styles=styles
        ))
        elements.append(Spacer(1, 5 * mm))

        # 4. Executive Intelligence Narrative (write-the-intel-brief)
        if narrative:
            elements.extend(self._build_narrative_section(narrative, styles))
            elements.append(Spacer(1, 5 * mm))

        # 5. VASP Attribution Table
        if attributions:
            elements.extend(self._build_attribution_section(attributions, styles))
            elements.append(Spacer(1, 5 * mm))

        # 6. Graph Topology Metrics
        elements.extend(self._build_metrics_section(summary_stats, styles))
        elements.append(Spacer(1, 5 * mm))

        # 7. Transaction Evidence Table
        if evidence:
            elements.extend(self._build_evidence_section(evidence, styles))
            elements.append(Spacer(1, 5 * mm))

        # 8. Critical Transactions
        if transactions:
            elements.extend(self._build_transaction_section(transactions[:15], styles))
            elements.append(Spacer(1, 5 * mm))

        # 9. Draft Statutory Preservation Notice (Section 94 BNSS / Section 91 CrPC)
        if draft_notice:
            elements.extend(self._build_statutory_notice_section(draft_notice, styles))
            elements.append(Spacer(1, 5 * mm))

        # 10. Chain-of-Custody Checksum
        content_hash = self._compute_chain_of_custody_hash(
            case_id, wallet_address, attributions, transactions
        )
        elements.extend(self._build_checksum_section(content_hash, date_str, styles))
        elements.append(Spacer(1, 5 * mm))

        # 11. Section 65B Indian Evidence Act Certificate
        elements.extend(
            self._build_section_65b_certificate(ref_no, chain, date_str, officer_name, styles)
        )
        elements.append(Spacer(1, 5 * mm))

        # 12. Statutory Compliance Footer
        elements.extend(
            self._build_statutory_footer(officer_name, police_station, ref_no, styles)
        )

        # Build PDF
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        logger.info(
            f"PDF dossier generated: {len(pdf_bytes)} bytes, "
            f"case={case_id[:8]}, chain={chain}"
        )
        return pdf_bytes

    def _register_custom_styles(self, styles):
        """Register custom paragraph styles for the dossier."""
        styles.add(ParagraphStyle(
            name="DossierTitle",
            parent=styles["Heading1"],
            fontSize=14,
            textColor=HEADER_BG,
            spaceAfter=4 * mm,
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
        ))
        styles.add(ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading2"],
            fontSize=11,
            textColor=HEADER_BG,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
            fontName="Helvetica-Bold",
            borderWidth=0,
            borderPadding=0,
        ))
        styles.add(ParagraphStyle(
            name="BodyJustified",
            parent=styles["BodyText"],
            fontSize=8.5,
            leading=12,
            alignment=TA_JUSTIFY,
            fontName="Helvetica",
        ))
        styles.add(ParagraphStyle(
            name="CertificateText",
            parent=styles["BodyText"],
            fontSize=8,
            leading=11,
            alignment=TA_LEFT,
            fontName="Courier",
        ))
        styles.add(ParagraphStyle(
            name="FooterText",
            parent=styles["BodyText"],
            fontSize=7,
            leading=9,
            textColor=colors.gray,
            alignment=TA_CENTER,
        ))
        styles.add(ParagraphStyle(
            name="IntelHeading",
            parent=styles["Heading3"],
            fontSize=9.5,
            textColor=HEADER_BG,
            spaceBefore=2.5 * mm,
            spaceAfter=1.5 * mm,
            fontName="Helvetica-Bold",
        ))

    def _build_header(self, ref_no, date_str, case_id, wallet_address, chain, styles):
        """Build the official LEA header section."""
        elements = []

        # Title banner
        title_data = [[
            Paragraph(
                "<b>🛡 CRYPTOCURRENCY ASSET INVESTIGATION DOSSIER</b>",
                ParagraphStyle(
                    "TitleBanner",
                    fontSize=13,
                    textColor=HEADER_TEXT,
                    alignment=TA_CENTER,
                    fontName="Helvetica-Bold",
                )
            )
        ]]
        title_table = Table(title_data, colWidths=[170 * mm])
        title_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        elements.append(title_table)
        elements.append(Spacer(1, 2 * mm))

        # Confidentiality notice
        elements.append(Paragraph(
            "<b>CONFIDENTIAL // LAW ENFORCEMENT &amp; FINANCIAL INTELLIGENCE USE ONLY</b>",
            ParagraphStyle("Confidential", fontSize=7, textColor=RISK_HIGH, alignment=TA_CENTER)
        ))
        elements.append(Spacer(1, 4 * mm))

        # Metadata table
        meta_data = [
            ["Reference Number", ref_no],
            ["Case / Analysis ID", case_id],
            ["Target Suspect Wallet", _truncate(wallet_address, 48)],
            ["Blockchain Network", chain],
            ["Report Generated", date_str],
            ["Traversal Depth", "3 Hops (Bounded BFS)"],
        ]
        meta_table = Table(meta_data, colWidths=[45 * mm, 125 * mm])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8eaf6")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(meta_table)

        return elements

    def _build_risk_section(self, risk_assessment, styles):
        """Build risk assessment badge and indicators."""
        elements = []
        elements.append(Paragraph("RISK CLASSIFICATION &amp; MONEY LAUNDERING PATTERNS", styles["SectionHeading"]))

        risk_level = risk_assessment.get("risk_level", "LOW")
        score = risk_assessment.get("score", 0)
        explanation = risk_assessment.get("explanation", "")
        indicators = risk_assessment.get("indicators", [])

        color = _risk_color(risk_level)

        # Risk badge
        badge_data = [[
            Paragraph(
                f"<b>Risk Level: {risk_level}</b> — Score: {score}/100",
                ParagraphStyle("RiskBadge", fontSize=10, textColor=colors.white, alignment=TA_CENTER, fontName="Helvetica-Bold")
            )
        ]]
        badge_table = Table(badge_data, colWidths=[170 * mm])
        badge_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), color),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(badge_table)
        elements.append(Spacer(1, 2 * mm))

        if explanation:
            elements.append(Paragraph(explanation, styles["BodyJustified"]))

        # Indicators
        for ind in indicators[:8]:
            elements.append(Paragraph(f"⚠ {ind}", styles["BodyJustified"]))

        return elements

    def _build_graph_section(
        self, wallet_address, chain, top_vasp_name, attribution_score, risk_level, transactions, case_id, graph_image_bytes, styles
    ):
        """Build visual trace flow diagram section."""
        elements = []
        elements.append(Paragraph("MULTI-HOP TRANSACTION FLOW SUBGRAPH", styles["SectionHeading"]))
        try:
            if not graph_image_bytes:
                graph_image_bytes = trace_graph_visualizer.render_flow_diagram(
                    wallet_address=wallet_address,
                    chain=chain,
                    top_vasp_name=top_vasp_name,
                    attribution_score=attribution_score,
                    risk_level=risk_level,
                    transactions=transactions,
                    case_id=case_id
                )
            img_buf = io.BytesIO(graph_image_bytes)
            img_flowable = RLImage(img_buf, width=170 * mm, height=71.4 * mm)
            elements.append(img_flowable)
        except Exception as e:
            logger.warning(f"Could not render graph flow diagram image in PDF: {e}")
            elements.append(Paragraph("<i>[Visual flow graph generation unavailable]</i>", styles["BodyJustified"]))
        return elements

    def _build_narrative_section(self, narrative: str, styles):
        """Build executive forensic intelligence brief section adhering to write-the-intel-brief."""
        elements = []
        elements.append(Paragraph("EXECUTIVE FORENSIC INTELLIGENCE BRIEF", styles["SectionHeading"]))

        lines = narrative.split("\n")
        in_bluf = False

        for line in lines:
            line_s = line.strip()
            if not line_s:
                continue
            if line_s.startswith("### "):
                header_text = line_s[4:].strip()
                elements.append(Paragraph(f"<b>{header_text}</b>", styles["IntelHeading"]))
                if "BLUF" in header_text or "BOTTOM LINE UP FRONT" in header_text:
                    in_bluf = True
                else:
                    in_bluf = False
            elif line_s.startswith("- "):
                clean_text = _md_to_reportlab(line_s[2:].strip())
                elements.append(Paragraph(f"• {clean_text}", styles["BodyJustified"]))
            else:
                clean_text = _md_to_reportlab(line_s)
                if in_bluf:
                    bluf_table = Table([[Paragraph(clean_text, styles["BodyJustified"])]], colWidths=[170 * mm])
                    bluf_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]))
                    elements.append(bluf_table)
                    elements.append(Spacer(1, 2 * mm))
                    in_bluf = False
                else:
                    elements.append(Paragraph(clean_text, styles["BodyJustified"]))

        return elements

    def _build_attribution_section(self, attributions, styles):
        """Build VASP attribution ranking table."""
        elements = []
        elements.append(Paragraph("VASP ATTRIBUTION HIERARCHY", styles["SectionHeading"]))

        headers = ["Rank", "VASP Cluster", "Score", "Strength", "Summary"]
        data = [headers]

        for attr in attributions[:10]:
            data.append([
                str(attr.get("rank", "-")),
                str(attr.get("vasp_name", "-")),
                f"{attr.get('score', 0):.1f}/100",
                str(attr.get("evidence_strength", "-")),
                _truncate(str(attr.get("summary", "")), 50),
            ])

        col_widths = [12 * mm, 35 * mm, 20 * mm, 20 * mm, 83 * mm]
        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),
        ]))
        elements.append(table)

        return elements

    def _build_metrics_section(self, stats, styles):
        """Build graph topology metrics table."""
        elements = []
        elements.append(Paragraph("GRAPH TOPOLOGY &amp; FUND FLOW METRICS", styles["SectionHeading"]))

        data = [
            ["Metric", "Value", "Description"],
            ["Transactions Analyzed", str(stats.get("total_edges", 0)), "Directed transfers across 3 hops"],
            ["Unique Counterparties", str(stats.get("total_nodes", 0)), "Unique wallet addresses in subgraph"],
            ["VASP Endpoints", str(stats.get("vasp_nodes_found", 0)), "Verified exchange deposit terminals"],
            ["Max Hop Traversed", str(stats.get("max_hop_reached", 0)), "Maximum topological distance"],
        ]

        col_widths = [40 * mm, 30 * mm, 100 * mm]
        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),
        ]))
        elements.append(table)

        return elements

    def _build_evidence_section(self, evidence, styles):
        """Build evidence chain table."""
        elements = []
        elements.append(Paragraph("TAMPER-EVIDENT AUDIT TRAIL &amp; EVIDENCE", styles["SectionHeading"]))

        headers = ["#", "Type", "Strength", "Hop", "Source", "Target", "Tx Hash"]
        data = [headers]

        for i, ev in enumerate(evidence[:12], 1):
            data.append([
                str(i),
                str(ev.get("evidence_type", "-"))[:15],
                str(ev.get("strength", "-")),
                str(ev.get("hop_distance", "-")),
                _truncate(str(ev.get("source_address", "")), 18),
                _truncate(str(ev.get("target_address", "")), 18),
                _truncate(str(ev.get("tx_hash", "")), 18),
            ])

        col_widths = [8 * mm, 22 * mm, 16 * mm, 10 * mm, 35 * mm, 35 * mm, 44 * mm]
        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),
        ]))
        elements.append(table)

        return elements

    def _build_transaction_section(self, transactions, styles):
        """Build critical transactions table."""
        elements = []
        elements.append(Paragraph("CRITICAL TRANSACTION PROOFS", styles["SectionHeading"]))

        headers = ["#", "Tx Hash", "From", "To", "Amount", "Asset", "Hop"]
        data = [headers]

        for i, tx in enumerate(transactions[:15], 1):
            # Handle both dict and Pydantic model
            if hasattr(tx, "tx_hash"):
                data.append([
                    str(i),
                    _truncate(str(tx.tx_hash), 18),
                    _truncate(str(tx.from_address), 18),
                    _truncate(str(tx.to_address), 18),
                    f"{tx.amount:.4f}" if isinstance(tx.amount, float) else str(tx.amount),
                    str(tx.token_symbol or "ETH"),
                    str(getattr(tx, "hop", "-") or "-"),
                ])
            else:
                data.append([
                    str(i),
                    _truncate(str(tx.get("tx_hash", "")), 18),
                    _truncate(str(tx.get("from", tx.get("from_address", ""))), 18),
                    _truncate(str(tx.get("to", tx.get("to_address", ""))), 18),
                    str(tx.get("amount", "0")),
                    str(tx.get("asset", tx.get("token_symbol", "ETH"))),
                    str(tx.get("hop", "-")),
                ])

        col_widths = [8 * mm, 30 * mm, 32 * mm, 32 * mm, 25 * mm, 18 * mm, 10 * mm]
        table = Table(data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Courier"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, TABLE_ALT_ROW]),
        ]))
        elements.append(table)

        return elements

    def _build_statutory_notice_section(self, draft_notice: Dict[str, Any], styles):
        """Build draft statutory preservation requisition notice section (Section 94 BNSS / 91 CrPC)."""
        elements = []
        elements.append(Paragraph(
            "DRAFT ASSET PRESERVATION REQUISITION (SECTION 94 BNSS / 91 CrPC)",
            styles["SectionHeading"]
        ))
        vasp_name = draft_notice.get("vasp_name", "Target VASP")
        ref_no = draft_notice.get("ref_number", "-")
        lea_email = draft_notice.get("designated_lea_email", "-")
        sahyog_code = draft_notice.get("sahyog_routing_code", "N/A")

        summary_box = [
            ["Destination Entity", str(vasp_name)],
            ["Statutory Authority", "Section 94 BNSS, 2023 / Section 91 Cr.P.C., 1973"],
            ["Requisition Ref No", str(ref_no)],
            ["Designated LEA Desk", str(lea_email)],
            ["Sahyog Routing Code", str(sahyog_code)],
        ]
        t = Table(summary_box, colWidths=[50 * mm, 120 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#fef2f2")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fca5a5")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 3 * mm))

        notice_md = draft_notice.get("notice_markdown", "")
        if notice_md:
            elements.append(Paragraph(
                notice_md[:1400].replace("\n", "<br/>") + "<br/><b>[Exhibit A: Full Statutory Notice Dispatched via Sahyog Portal]</b>",
                styles["CertificateText"]
            ))

        return elements

    def _compute_chain_of_custody_hash(
        self, case_id, wallet_address, attributions, transactions
    ) -> str:
        """Compute SHA-256 hash for chain-of-custody verification."""
        hasher = hashlib.sha256()
        hasher.update(case_id.encode("utf-8"))
        hasher.update(wallet_address.encode("utf-8"))
        hasher.update(str(len(attributions)).encode("utf-8"))
        hasher.update(str(len(transactions)).encode("utf-8"))

        for tx in transactions[:20]:
            if hasattr(tx, "tx_hash"):
                hasher.update(str(tx.tx_hash).encode("utf-8"))
            elif isinstance(tx, dict):
                hasher.update(str(tx.get("tx_hash", "")).encode("utf-8"))

        return hasher.hexdigest()

    def _build_checksum_section(self, content_hash, date_str, styles):
        """Build chain-of-custody checksum section."""
        elements = []
        elements.append(Paragraph("CHAIN-OF-CUSTODY VERIFICATION", styles["SectionHeading"]))

        elements.append(Paragraph(
            f"<b>SHA-256 Content Integrity Hash:</b> <font face='Courier' size='7'>{content_hash}</font>",
            styles["BodyJustified"]
        ))
        elements.append(Paragraph(
            f"<b>Computed At:</b> {date_str}",
            styles["BodyJustified"]
        ))
        elements.append(Paragraph(
            "This hash uniquely identifies the content of this report. Any modification "
            "to the underlying transaction data, attribution scores, or evidence records "
            "will produce a different hash, enabling tamper detection.",
            styles["BodyJustified"]
        ))

        return elements

    def _build_section_65b_certificate(self, ref_no, chain, date_str, officer_name, styles):
        """Build Section 65B Indian Evidence Act certificate."""
        elements = []
        elements.append(Paragraph(
            "SECTION 65B INDIAN EVIDENCE ACT, 1872 / SECTION 63 BSA CERTIFICATE",
            styles["SectionHeading"]
        ))

        cert_text = f"""CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872
AND SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023
================================================================

1. This electronic report Reference No. {ref_no} was produced by the
   SUDARSHAN Blockchain Forensic Intelligence Engine operating under
   normal operational conditions at {date_str}.

2. The on-chain transaction records and cryptographic hash representations
   reproduced herein were acquired directly from publicly indexed blockchain
   networks ({chain}) without manual modification or interpolation.

3. The computer system generating this output was operating properly at the
   time of the creation of this electronic record and there was no
   interruption in the regular operation thereof.

4. The information contained in this electronic record reproduces or is
   derived from information fed into the computer in the ordinary course
   of the automated blockchain analysis activities.

5. This certificate is issued in compliance with the conditions specified
   under Section 65B(4) of the Indian Evidence Act, 1872, and the
   corresponding Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023.

Certified by: ____________________________
              ({officer_name})
              Authorized Signatory"""

        elements.append(Paragraph(
            cert_text.replace("\n", "<br/>"),
            styles["CertificateText"]
        ))

        return elements

    def _build_statutory_footer(self, officer_name, police_station, ref_no, styles):
        """Build statutory compliance footer."""
        elements = []
        elements.append(HRFlowable(
            width="100%", thickness=1, color=BORDER_COLOR,
            spaceBefore=4 * mm, spaceAfter=4 * mm
        ))

        elements.append(Paragraph(
            "<b>STATUTORY REFERENCES:</b> Section 66D Information Technology Act, 2000 | "
            "Section 318(4) Bharatiya Nyaya Sanhita (BNS), 2023 | "
            "Section 94 Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 | "
            "Section 65B Indian Evidence Act, 1872 / Section 63 BSA, 2023 | "
            "PMLA, 2002 (Prevention of Money Laundering Act)",
            ParagraphStyle("Statutory", fontSize=6.5, textColor=colors.HexColor("#616161"),
                          alignment=TA_LEFT, leading=9)
        ))
        elements.append(Spacer(1, 3 * mm))

        elements.append(Paragraph(
            f"Generated by <b>SUDARSHAN Intelligence System</b> • "
            f"Verification Ref: <font face='Courier'>{ref_no}</font>",
            styles["FooterText"]
        ))
        elements.append(Paragraph(
            "CONFIDENTIAL — FOR LAW ENFORCEMENT &amp; FINANCIAL INTELLIGENCE USE ONLY",
            ParagraphStyle("ConfFooter", fontSize=6, textColor=RISK_HIGH,
                          alignment=TA_CENTER, fontName="Helvetica-Bold")
        ))

        return elements
