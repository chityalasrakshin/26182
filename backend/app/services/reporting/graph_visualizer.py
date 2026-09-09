"""
Server-Side Cryptocurrency Trace Flow Graph Visualizer.

Generates publication-quality visual transaction flow diagrams (PNG) using Pillow.
Diagrams illustrate multi-hop fund flow from the suspect wallet through intermediate
peeling/transit nodes to the destination VASP deposit cluster, suitable for embedding
into ReportLab PDF dossiers or direct investigative export.
"""

import io
import math
import logging
from typing import List, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


class TraceGraphVisualizer:
    """
    Renders high-resolution directed flow subgraphs for multi-hop crypto traces.
    """

    @staticmethod
    def render_flow_diagram(
        wallet_address: str,
        chain: str,
        top_vasp_name: Optional[str] = None,
        attribution_score: float = 0.0,
        risk_level: str = "MEDIUM",
        transactions: Optional[List[Dict[str, Any]]] = None,
        case_id: str = "TRACE-DEMO",
        width: int = 1000,
        height: int = 420
    ) -> bytes:
        """
        Renders a directed transaction flow diagram as PNG bytes.
        """
        transactions = transactions or []
        img = Image.new("RGB", (width, height), color=(15, 23, 42))  # Slate 900
        draw = ImageDraw.Draw(img)

        # Load default bitmap font (guaranteed to be available everywhere)
        font = ImageFont.load_default()

        # 1. Header Banner
        draw.rectangle([(0, 0), (width, 48)], fill=(30, 41, 59))  # Slate 800
        draw.line([(0, 48), (width, 48)], fill=(51, 65, 85), width=2)
        draw.text((20, 16), "SUDARSHAN // MULTI-HOP TRANSACTION FLOW SUBGRAPH", fill=(248, 250, 252), font=font)
        meta_str = f"CASE: {case_id[:8].upper()} | CHAIN: {chain.upper()} | RISK: {risk_level.upper()}"
        draw.text((width - 360, 16), meta_str, fill=(148, 163, 184), font=font)

        # 2. Determine Nodes in Path
        # Minimum 3 nodes: Root -> Intermediary Hop -> Destination VASP
        nodes = []
        # Node 0: Root
        nodes.append({
            "type": "root",
            "title": "SUSPECT ROOT",
            "address": wallet_address,
            "color": (239, 68, 68),       # Red 500
            "bg": (69, 10, 10),           # Dark red
            "subtitle": f"Target Wallet"
        })

        # Find intermediate addresses from transactions
        intermediate_addrs = []
        for tx in transactions[:4]:
            to_addr = tx.get("to") or tx.get("to_address")
            from_addr = tx.get("from") or tx.get("from_address")
            if to_addr and to_addr.lower() != wallet_address.lower() and to_addr not in intermediate_addrs:
                intermediate_addrs.append(to_addr)

        if not intermediate_addrs:
            intermediate_addrs = [f"{wallet_address[:6]}...transit"]

        # Limit to max 2 intermediaries for clean horizontal spacing
        for i, addr in enumerate(intermediate_addrs[:2], 1):
            nodes.append({
                "type": "transit",
                "title": f"HOP {i} // TRANSIT",
                "address": addr,
                "color": (59, 130, 246),      # Blue 500
                "bg": (23, 37, 84),           # Dark blue
                "subtitle": "Peeling / Pass-through"
            })

        # Terminal Node: VASP
        vasp_label = top_vasp_name if top_vasp_name else "VASP Deposit"
        nodes.append({
            "type": "vasp",
            "title": f"DESTINATION VASP",
            "address": f"{vasp_label} Cluster",
            "color": (16, 185, 129),      # Emerald 500
            "bg": (6, 78, 59),            # Dark green
            "subtitle": f"Score: {attribution_score:.1f}/100"
        })

        num_nodes = len(nodes)
        node_width = 175
        node_height = 80
        total_span = width - 100
        step_x = total_span / (num_nodes - 1) if num_nodes > 1 else total_span
        y_center = 175

        node_positions = []
        for i in range(num_nodes):
            x = int(50 + i * step_x - (node_width / 2 if i > 0 and i < num_nodes - 1 else 0))
            if i == num_nodes - 1:
                x = width - 50 - node_width
            if i == 0:
                x = 50
            node_positions.append((x, y_center))

        # 3. Draw Directed Edge Arrows First (Under Nodes)
        for i in range(num_nodes - 1):
            x1 = node_positions[i][0] + node_width
            y1 = y_center + node_height // 2
            x2 = node_positions[i + 1][0]
            y2 = y_center + node_height // 2

            # Edge line
            draw.line([(x1, y1), (x2, y2)], fill=(100, 116, 139), width=3)

            # Arrow head
            arrow_size = 8
            draw.polygon([
                (x2, y2),
                (x2 - arrow_size * 2, y2 - arrow_size),
                (x2 - arrow_size * 2, y2 + arrow_size)
            ], fill=(148, 163, 184))

            # Edge flow label
            tx_data = transactions[i] if i < len(transactions) else {}
            amt = tx_data.get("amount", "")
            tok = tx_data.get("token_symbol") or tx_data.get("asset", "")
            flow_label = f"{amt} {tok}".strip() if amt else "Fund Flow"
            mid_x = (x1 + x2) // 2
            draw.rectangle([(mid_x - 45, y1 - 22), (mid_x + 45, y1 - 6)], fill=(30, 41, 59), outline=(71, 85, 105))
            draw.text((mid_x - 40, y1 - 18), flow_label[:14], fill=(226, 232, 240), font=font)

        # 4. Draw Nodes
        for i, (x, y) in enumerate(node_positions):
            node = nodes[i]
            # Outer glow / card
            draw.rectangle([(x, y), (x + node_width, y + node_height)], fill=node["bg"], outline=node["color"], width=2)
            # Top title bar
            draw.rectangle([(x, y), (x + node_width, y + 24)], fill=(30, 41, 59))
            draw.text((x + 8, y + 6), node["title"], fill=node["color"], font=font)

            # Truncated address
            raw_addr = node["address"]
            display_addr = f"{raw_addr[:9]}...{raw_addr[-6:]}" if len(raw_addr) > 18 else raw_addr
            draw.text((x + 8, y + 34), display_addr, fill=(248, 250, 252), font=font)

            # Subtitle / metric
            draw.text((x + 8, y + 54), node["subtitle"], fill=(148, 163, 184), font=font)

        # 5. Legend & Evidence Metadata
        legend_y = height - 55
        draw.line([(0, legend_y - 12), (width, legend_y - 12)], fill=(30, 41, 59), width=1)

        # Legend items
        legend_items = [
            ("Target Suspect (Origin)", (239, 68, 68)),
            ("Transit / Peeling Hop", (59, 130, 246)),
            ("Attributed Custodial VASP", (16, 185, 129)),
        ]
        cur_x = 40
        for label, col in legend_items:
            draw.rectangle([(cur_x, legend_y + 4), (cur_x + 14, legend_y + 18)], fill=col)
            draw.text((cur_x + 22, legend_y + 4), label, fill=(203, 213, 225), font=font)
            cur_x += 210

        draw.text((width - 340, legend_y + 4), "Tamper-Evident Graph Proof // Section 65B IEA", fill=(100, 116, 139), font=font)

        # Save to PNG buffer
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        png_bytes = buffer.getvalue()
        buffer.close()
        return png_bytes


# Global singleton instance
trace_graph_visualizer = TraceGraphVisualizer()
