import matplotlib.pyplot as plt
import numpy as np
import os

# Configure styling
plt.rcParams['font.sans-serif'] = 'Arial'
plt.rcParams['axes.edgecolor'] = '#CBD5E1'
plt.rcParams['axes.linewidth'] = 1.0

# 1-2 words only per metric (clean and punchy)
categories = [
    "Tracing\nDelay",
    "Escaped\nFunds",
    "Manual\nWorkload",
    "Chain\nBlindspots",
    "Misfired\nNotices"
]

manual_process = [25, 35, 40, 30, 28]
with_setu = [3, 12, 15, 6, 4]

x = np.arange(len(categories))
bar_width = 0.32

fig, ax = plt.subplots(figsize=(8.5, 5.0), dpi=300)

# Colors matching the slide's palette
color_manual = '#1E6BB8'   # Primary Slide Navy Blue
color_setu = '#0D7A53'     # Slide Forest Green

bars1 = ax.bar(x - bar_width/2, manual_process, bar_width, label='Manual Process', color=color_manual, edgecolor='none', zorder=3)
bars2 = ax.bar(x + bar_width/2, with_setu, bar_width, label='With SETU', color=color_setu, edgecolor='none', zorder=3)

# Formatting
ax.set_ylabel('Inefficiency & Failure Rate (%)', fontsize=12, fontweight='bold', color='#1E293B', labelpad=8)
ax.set_title('Forensic Bottlenecks: Manual Process vs. With SETU', fontsize=15, fontweight='bold', color='#0F172A', pad=18)
ax.set_xticks(x)
ax.set_xticklabels(categories, fontsize=11, fontweight='bold', color='#334155')
ax.set_ylim(0, 52)
ax.set_yticks(np.arange(0, 55, 10))

# Add exact percentage numbers directly on top of bars
for bar in bars1:
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2, h + 1.2, f'{int(h)}%', ha='center', va='bottom', fontsize=10.5, fontweight='bold', color=color_manual)

for bar in bars2:
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2, h + 1.2, f'{int(h)}%', ha='center', va='bottom', fontsize=10.5, fontweight='bold', color=color_setu)

# Subtle horizontal gridlines
ax.grid(axis='y', linestyle='--', alpha=0.5, color='#E2E8F0', zorder=0)

# Clean minimalist spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CBD5E1')
ax.spines['bottom'].set_color('#CBD5E1')

# Legend
legend = ax.legend(loc='upper right', frameon=True, facecolor='#FFFFFF', edgecolor='#E2E8F0', fontsize=11)
legend.get_frame().set_boxstyle('round,pad=0.4')

plt.tight_layout()

# Save both white and transparent versions
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
output_white = os.path.join(output_dir, "setu_impact_barchart.png")
output_trans = os.path.join(output_dir, "setu_impact_barchart_transparent.png")

plt.savefig(output_white, dpi=300, bbox_inches='tight', facecolor='white')
plt.savefig(output_trans, dpi=300, bbox_inches='tight', transparent=True)
print(f"Generated charts:\n  - {output_white}\n  - {output_trans}")
