#!/usr/bin/env python3
# Presentation rebuild of "global population in extreme poverty, by region".
#
# Form: stacked area -- part-to-whole over time, which is what the source is. Two things
# the original leaves implicit and this makes explicit:
#   1. FORECAST vs OBSERVED. The source marks it with a faint dashed rule; here the
#      projected years also carry a hatch, so nobody reads a projection as a measurement.
#   2. The story. Asia's collapse is why the total fell; what remains is increasingly one
#      region, and it is projected to GROW. The headline says so.
#
# Values are approximate, reconstructed from the source image (the owner said exact points
# need not match). The footnote says so.
#
#   python3 scripts/gen_poverty_regions.py
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "chart_options"
OUT.mkdir(parents=True, exist_ok=True)
FONTS = Path("/tmp/claude-0/-home-user-mycelium2d/91519050-5269-59c0-aa35-618c65c0316f/scratchpad/fonts")

import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand_palette as B
SURFACE, TEXT_1, TEXT_2 = B.SURFACE, B.TEXT_1, B.TEXT_2
MUTED, GRID, AXIS = B.MUTED, B.GRID, B.AXIS
SPLIT = 2022          # observations to here; World Bank projections beyond

# Categorical slots in FIXED order. Slot 1 (blue) goes to Sub-Saharan Africa because that
# is the story; the rest follow the documented order. Aqua/yellow/magenta sit below 3:1 on
# this surface, so the validator's relief rule applies -- every series carries a visible
# label, via the legend and the in-band labels below.
REGIONS = [   # (name, colour, anchors {year: millions}), listed bottom-to-top in the stack
    ("Europe & Central Asia", B.NAVY_RAMP[0],
     {1990: 50, 1994: 90, 1999: 85, 2005: 40, 2010: 20, 2015: 12, 2019: 9, 2020: 11,
      2025: 8, 2030: 7, 2040: 6}),
    ("Latin America & Caribbean", B.NAVY_RAMP[3],
     {1990: 78, 1996: 85, 2002: 90, 2008: 55, 2013: 40, 2019: 28, 2020: 36, 2025: 28,
      2030: 24, 2040: 21}),
    ("Middle East & North Africa", B.NAVY_RAMP[2],
     {1990: 95, 2000: 88, 2010: 55, 2013: 58, 2016: 75, 2019: 85, 2020: 95, 2025: 105,
      2030: 112, 2040: 128}),
    ("Sub-Saharan Africa", B.AMBER,
     {1990: 285, 1996: 330, 2002: 375, 2008: 395, 2013: 390, 2015: 400, 2019: 428,
      2020: 470, 2022: 462, 2025: 505, 2030: 545, 2035: 620, 2040: 700}),
    ("East Asia & Pacific", B.NAVY_RAMP[1],
     {1990: 1250, 1993: 1120, 1996: 960, 1999: 880, 2002: 740, 2005: 600, 2008: 400,
      2011: 250, 2013: 150, 2015: 85, 2017: 50, 2019: 32, 2020: 42, 2025: 20, 2030: 14,
      2040: 9}),
    ("South Asia", B.NAVY_RAMP[4],
     {1990: 500, 1993: 515, 1996: 520, 1999: 525, 2002: 510, 2005: 495, 2008: 450,
      2011: 400, 2013: 320, 2015: 255, 2017: 210, 2019: 175, 2020: 230, 2022: 195,
      2025: 130, 2030: 85, 2035: 62, 2040: 48}),
]

def series(anchors, xs):
    ks = sorted(anchors)
    return np.clip(PchipInterpolator(ks, [anchors[k] for k in ks])(xs), 0, None)

def style():
    for f in ("Inter-400.ttf", "Inter-700.ttf"):
        if (FONTS / f).exists(): font_manager.fontManager.addfont(str(FONTS / f))
    plt.rcParams.update({
        "font.family": "Inter" if (FONTS / "Inter-400.ttf").exists() else "DejaVu Sans",
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "text.color": TEXT_1, "axes.edgecolor": AXIS, "axes.labelcolor": TEXT_2,
        "xtick.color": MUTED, "ytick.color": MUTED,
        "xtick.labelsize": 13, "ytick.labelsize": 13,
    })

def build():
    style()
    xs = np.arange(1990, 2040.01, 0.25)
    ys = [series(a, xs) for _, _, a in REGIONS]
    names = [n for n, _, _ in REGIONS]
    cols  = [c for _, c, _ in REGIONS]
    total = np.sum(ys, axis=0)

    fig, ax = plt.subplots(figsize=(13.6, 7.4), dpi=200)
    fig.subplots_adjust(left=0.075, right=0.715, top=0.775, bottom=0.115)

    stack = ax.stackplot(xs, *ys, colors=cols, labels=names, lw=0)
    # 2px surface gap between touching fills, per the mark spec
    cum = np.cumsum(ys, axis=0)
    for i in range(len(ys) - 1):
        ax.plot(xs, cum[i], color=SURFACE, lw=2.0, zorder=3)

    # --- forecast relief: hatch the projected years so a projection never reads as data
    fx = xs >= SPLIT
    ax.fill_between(xs[fx], 0, total[fx], facecolor="none", edgecolor=SURFACE,
                    hatch="////", lw=0, alpha=0.30, zorder=4)
    ax.axvline(SPLIT, color=MUTED, lw=1.4, ls=(0, (5, 4)), zorder=5)
    ax.text(SPLIT + 0.6, 2395, "World Bank projections", fontsize=12.5, color=MUTED,
            ha="left", va="top", style="italic")

    ax.set_xlim(1990, 2040); ax.set_ylim(0, 2500)
    ax.set_xticks([1990, 2000, 2010, 2020, 2030, 2040])
    ax.set_yticks([0, 500, 1000, 1500, 2000, 2500])
    ax.yaxis.set_major_formatter(FuncFormatter(
        lambda v, _: "0" if v == 0 else (f"{v:.0f}m" if v < 1000 else f"{v/1000:g}bn")))
    ax.set_axisbelow(False)
    ax.grid(True, axis="y", color="#ffffff", lw=1.0, ls="-", zorder=6, alpha=0.34)
    for side in ("top", "right"): ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(AXIS); ax.spines[side].set_linewidth(1.0)

    # in-band, where those two dominate and their right-edge position would be unfindable
    for nm, xpos, ypos, col in [("East Asia & Pacific", 1997.0, 1050, "#ffffff"),
                                ("South Asia", 2001.5, 1620, B.TEXT_1)]:
        ax.text(xpos, ypos, nm, fontsize=14.5, fontweight="bold", color=col,
                ha="center", va="center", zorder=8)

    # end labels for the four still present in 2040, de-overlapped upward from their true
    # band midpoints -- the three small regions sit within ~150m of the axis and would
    # otherwise print on top of one another
    cum40 = np.cumsum([y[-1] for y in ys])
    mids = {names[i]: (cum40[i] - ys[i][-1] / 2) for i in range(len(names))}
    ends = [("Europe & Central Asia", 4), ("Latin America & Caribbean", 3),
            ("Middle East & North Africa", 2), ("Sub-Saharan Africa", 5)]
    placed, floor_y = [], 0
    for nm, _ in ends:
        y = max(mids[nm], floor_y + 145)
        placed.append((nm, mids[nm], y)); floor_y = y
    for nm, y_true, y_lab in placed:
        col = B.AMBER if nm == "Sub-Saharan Africa" else B.TEXT_2
        wgt = "bold" if nm == "Sub-Saharan Africa" else "normal"
        ax.plot([2040.3, 2042.2, 2043.6], [y_true, y_lab, y_lab], color=AXIS, lw=1.1,
                clip_on=False, zorder=9, solid_capstyle="round")
        ax.text(2044.3, y_lab, nm, fontsize=12.5, color=col, fontweight=wgt,
                ha="left", va="center", clip_on=False, zorder=9)

    # --- headline
    fig.text(0.075, 0.955, "Extreme poverty is becoming a Sub-Saharan African story",
             fontsize=24, fontweight="bold", color=TEXT_1, ha="left", va="top")
    fig.text(0.075, 0.888,
             "Asia's collapse drove the global fall. What remains is concentrating in one "
             "region — and is projected to grow.",
             fontsize=14.5, color=TEXT_2, ha="left", va="top")

    fig.text(0.075, 0.028,
             "Values approximate, reconstructed from the source chart. Projections beyond "
             f"{SPLIT} shown hatched.",
             fontsize=10.5, color=MUTED, ha="left", va="bottom")

    for ext in ("png", "svg"):
        fig.savefig(OUT / f"poverty-regions-brand.{ext}", format=ext)
    plt.close(fig)
    for yr in (1990, 2020, 2030, 2040):
        print(f"  {yr}: total {total[np.argmin(abs(xs-yr))]:.0f}m")
    print("wrote poverty-regions-brand.png / .svg")

if __name__ == "__main__":
    build()
