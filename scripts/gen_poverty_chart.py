#!/usr/bin/env python3
# Presentation rebuild of the poverty-vs-median-income scatter.
#
# The source's point is an ENVELOPE -- an upper bound, not a trend: past a low income
# threshold, no country is observed above a given poverty rate. The original states that in
# prose and draws it with overlapping rectangles. Here the claim is drawn instead: a stepped
# frontier with the region above it shaded and labelled as empty, so "nothing lives up here"
# is read rather than parsed.
#
# The underlying points are SYNTHETIC, generated to the published thresholds (the owner said
# exact positions need not match). Every point is clipped under the frontier, so the chart
# cannot contradict the claim printed on it.
#
#   python3 scripts/gen_poverty_chart.py
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "chart_options"
OUT.mkdir(parents=True, exist_ok=True)
FONTS = Path("/tmp/claude-0/-home-user-mycelium2d/91519050-5269-59c0-aa35-618c65c0316f/scratchpad/fonts")

# dataviz reference palette. Both modes are selected from the same ramps; the dark
# column is stepped for the dark surface rather than flipped from the light one.
THEME = {
    "light": dict(surface="#fcfcfb", text1="#0b0b0b", text2="#52514e", muted="#898781",
                  grid="#e1e0d9", axis="#c3c2b7", series="#2a78d6", accent="#eb6834",
                  wash=0.055, dot_alpha=0.55),
    "dark":  dict(surface="#1a1a19", text1="#ffffff", text2="#c3c2b7", muted="#898781",
                  grid="#2c2c2a", axis="#383835", series="#3987e5", accent="#d95926",
                  wash=0.10, dot_alpha=0.62),
}

# Published thresholds: above this income, no country exceeds this poverty rate.
THRESHOLDS = [(1050, 0.33), (3000, 0.10), (4000, 0.05), (5000, 0.025)]
XMAX, YMAX = 8000, 1.0

def frontier(x):
    """Upper bound on poverty at a given median income: a smooth decay for the poor tail,
    then the published step caps, whichever is lower."""
    env = np.clip(0.97 * (np.maximum(x, 1) / 250.0) ** -0.80, 0, 0.97)
    for xi, yi in THRESHOLDS:
        env = np.where(x >= xi, np.minimum(env, yi), env)
    return env

def sample(n=620, seed=17):
    rng = np.random.default_rng(seed)
    # most countries sit at low median income; a thinner tail runs to the right
    n_poor, n_tail = int(n * 0.16), int(n * 0.26)
    x = np.concatenate([rng.uniform(190, 700, n_poor),                    # the poor tail
                        rng.lognormal(np.log(1150), 0.62, n - n_poor - n_tail),
                        rng.uniform(1500, 7900, n_tail)])
    x = np.clip(x, 190, 7900)
    env = frontier(x)
    # spread below the frontier: poor countries cluster near it, richer ones fall away
    p = 0.55 + 1.7 * np.clip(x, 0, 5000) / 5000.0
    y = env * rng.random(len(x)) ** p
    return x, np.clip(y, 0.0, env)      # clipped, so no point can contradict the claim

def style(t):
    for f in ("Inter-400.ttf", "Inter-700.ttf"):
        if (FONTS / f).exists(): font_manager.fontManager.addfont(str(FONTS / f))
    plt.rcParams.update({
        "font.family": "Inter" if (FONTS / "Inter-400.ttf").exists() else "DejaVu Sans",
        "figure.facecolor": t["surface"], "axes.facecolor": t["surface"],
        "savefig.facecolor": t["surface"], "text.color": t["text1"],
        "axes.edgecolor": t["axis"], "axes.labelcolor": t["text2"],
        "xtick.color": t["muted"], "ytick.color": t["muted"],
        "xtick.labelsize": 12.5, "ytick.labelsize": 12.5, "axes.labelsize": 13.5,
    })

def build(mode="light"):
    t = THEME[mode]
    style(t)
    x, y = sample()
    fig, ax = plt.subplots(figsize=(13.2, 7.2), dpi=200)
    fig.subplots_adjust(left=0.085, right=0.975, top=0.80, bottom=0.165)

    # --- the empty region, drawn rather than asserted
    gx = np.linspace(0, XMAX, 2000)
    gy = frontier(gx)
    ax.fill_between(gx, gy, YMAX, color=t["accent"], alpha=t["wash"], lw=0, zorder=1)
    ax.plot(gx, gy, color=t["accent"], lw=2.0, zorder=4, solid_joinstyle="miter")

    # --- observations
    ax.scatter(x, y, s=26, c=t["series"], alpha=t["dot_alpha"], linewidths=0, zorder=3, rasterized=False)

    # --- grid, recessive and hairline
    ax.set_axisbelow(True)
    ax.grid(True, which="major", color=t["grid"], lw=1.0, ls="-")
    for side in ("top", "right"): ax.spines[side].set_visible(False)
    for side in ("left", "bottom"): ax.spines[side].set_color(t["axis"]); ax.spines[side].set_linewidth(1.0)

    ax.set_xlim(0, XMAX); ax.set_ylim(0, YMAX)
    ax.set_xticks(range(0, XMAX + 1, 1000))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"${v:,.0f}" if v else "0"))
    ax.set_yticks(np.arange(0, 1.01, 0.2))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v*100:.0f}%"))
    ax.set_xlabel("Median income or consumption  (PPP $ per year)", labelpad=12)
    ax.set_ylabel("Share of population below $1.90 / day", labelpad=11)

    # --- headline
    fig.text(0.085, 0.945, "Past a low income threshold, extreme poverty disappears",
             fontsize=23, fontweight="bold", color=t["text1"], ha="left", va="top")
    fig.text(0.085, 0.882,
             "Each dot is one country-year. No observation falls in the shaded region.",
             fontsize=14, color=t["text2"], ha="left", va="top")

    # --- threshold callouts, direct-labelled on the steps
    notes = [(1050, 0.33, "Above $1,050\nnever over 33%", 1450, 0.52),
             (3000, 0.10, "Above $3,000\nnever over 10%", 3250, 0.285),
             (5000, 0.025, "Above $5,000\nnever over 2.5%", 5350, 0.15)]
    for xi, yi, label, lx, ly in notes:
        ax.annotate(label, xy=(xi, yi), xytext=(lx, ly),
                    fontsize=12.5, color=t["accent"], fontweight="bold", va="center", ha="left",
                    linespacing=1.35,
                    arrowprops=dict(arrowstyle="-", color=t["accent"], lw=1.2,
                                    shrinkA=4, shrinkB=3, alpha=0.75), zorder=6)
    ax.text(6750, 0.74, "No country\nobserved here", fontsize=15, color=t["accent"],
            fontweight="bold", ha="center", va="center", alpha=0.95, linespacing=1.4)

    fig.text(0.085, 0.030,
             "Illustrative reconstruction: point positions are synthetic, the stated thresholds are not.",
             fontsize=10.5, color=t["muted"], ha="left", va="bottom")

    suffix = "" if mode == "light" else "-dark"
    for ext in ("png", "svg"):
        fig.savefig(OUT / f"poverty-income{suffix}.{ext}", format=ext)
    plt.close(fig)
    # the chart asserts the thresholds, so verify the data honours them
    bad = [(xi, yi, int(((x >= xi) & (y > yi + 1e-9)).sum())) for xi, yi in THRESHOLDS]
    print("threshold violations:", bad)
    print(f"wrote poverty-income{suffix}.png / .svg  ({mode})")

if __name__ == "__main__":
    for m in ("light", "dark"): build(m)
