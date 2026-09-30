import matplotlib.pyplot as plt
import numpy as np
import os

# Set global typography & visual styling
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#B0BEC5'
plt.rcParams['axes.linewidth'] = 0.9

def generate_charts():
    output_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(output_dir, ".."))

    # High-impact comparative metrics directly aligned with CryptoTrace problem statement & deliverables
    categories = [
        "Tracing Latency\n(48-72h vs <15 min)",
        "Pre-Freeze Cash-Outs\n(Stolen Asset Losses)",
        "Manual Workload\n(Investigation Hours)",
        "Cross-Chain Blindspots\n(Unmapped Hops)",
        "Misdirected Notices\n(Statutory Delays)"
    ]

    # Benchmark metrics: Current Manual Workflow vs. CryptoTrace Platform
    current_crisis = [95, 85, 80, 70, 60]
    with_cryptotrace = [2, 12, 16, 6, 4]

    y = np.arange(len(categories))
    bar_height = 0.35

    # 1. Generate Main High-Resolution Presentation Chart (White Background)
    fig, ax = plt.subplots(figsize=(10.5, 6.2), dpi=300)

    # Plot paired horizontal bars
    bars_current = ax.barh(y + bar_height/2, current_crisis, bar_height, 
                           label='Current Crisis (Manual Tracing)', color='#1976D2', edgecolor='none')
    bars_proposed = ax.barh(y - bar_height/2, with_cryptotrace, bar_height, 
                            label='With CryptoTrace (Automated Engine)', color='#78909C', edgecolor='none')

    # Formatting axes and labels
    ax.set_xlabel('Percentage (%)', fontsize=12, fontweight='bold', labelpad=10, color='#37474F')
    ax.set_title('Crypto Crime Investigation in India – Current vs. With CryptoTrace', 
                 fontsize=14.5, fontweight='bold', pad=22, color='#1A237E')
    ax.set_yticks(y)
    ax.set_yticklabels(categories, fontsize=10.5, color='#263238')
    ax.set_xlim(0, 112)
    ax.set_ylim(-0.6, len(categories) - 0.4 + 0.3)

    # Add subtle vertical gridlines
    ax.grid(axis='x', linestyle='--', alpha=0.6, color='#CFD8DC')
    ax.set_axisbelow(True)

    # Remove top and right spines for a clean, modern look
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#B0BEC5')
    ax.spines['bottom'].set_color('#B0BEC5')

    # Add exact percentage labels on the ends of bars
    for bar in bars_current:
        width = bar.get_width()
        ax.text(width + 1.2, bar.get_y() + bar.get_height()/2, f'{width}%',
                ha='left', va='center', fontsize=10, fontweight='bold', color='#0D47A1')

    for bar in bars_proposed:
        width = bar.get_width()
        ax.text(width + 1.2, bar.get_y() + bar.get_height()/2, f'{width}%',
                ha='left', va='center', fontsize=10, fontweight='bold', color='#37474F')

    # Clean upper-right legend
    legend = ax.legend(loc='upper right', frameon=True, facecolor='#FFFFFF', edgecolor='#CFD8DC', fontsize=10.5)
    legend.get_frame().set_alpha(0.95)

    plt.tight_layout()
    
    # Save standard white background version (for direct presentation slides / reports)
    chart_path = os.path.join(project_root, "cryptotrace_impact_chart.png")
    plt.savefig(chart_path, dpi=300, bbox_inches='tight', facecolor='white')
    
    # Save transparent background version (for flexible overlay on custom colored slides)
    transparent_path = os.path.join(project_root, "cryptotrace_impact_chart_transparent.png")
    legend.get_frame().set_facecolor('#FFFFFF')
    plt.savefig(transparent_path, dpi=300, bbox_inches='tight', transparent=True)
    
    plt.close()
    print(f"[OK] Saved chart to:\n  - {chart_path}\n  - {transparent_path}")

if __name__ == "__main__":
    generate_charts()
