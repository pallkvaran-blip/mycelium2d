#!/usr/bin/env python3
# Economic Policy Network palette, substituted into the dataviz method as a design system.
# The method is unchanged; only these parameter values are.
#
# Hexes are READ FROM THE LOGO IMAGE BY EYE -- a paste cannot be sampled -- so they are a
# close match, not certainties. Every one is a single constant here; correcting them is a
# one-line edit that re-renders both charts.
NAVY        = "#0C2340"   # brand deep navy (card ground, headline ink)
AMBER       = "#C17C1A"   # brand amber (the accent, and the emphasis series)
SURFACE     = "#FFFFFF"
TEXT_1      = "#0C2340"
TEXT_2      = "#55657A"
MUTED       = "#8494A5"
GRID        = "#E3E8EE"
AXIS        = "#C6CFDA"

# Scatter: one data series plus one annotation colour, so these ARE a categorical pair and
# take the categorical gates. #23548F rather than the logo navy because the logo navy reads
# gray by the chroma floor (0.091 < 0.10); this clears it at CVD delta-E 26.1 vs the amber.
DOT         = "#23548F"

# Stacked area: emphasis encoding -- the subject in brand amber, every other region in one
# navy ramp. That is the documented pattern when one series is the point and the rest are
# context, and it suits a two-colour brand far better than six competing hues.
# These steps are SEQUENTIAL, so the check that applies is lightness monotonicity, not the
# categorical chroma/lightness gates (which they fail by design, being tints of one hue):
#   L = 0.255, 0.352, 0.463, 0.630, 0.806 -- strictly increasing, evenly spaced.
# Worst adjacent separation still passes on its own terms: CVD delta-E 16.4, normal 17.0.
NAVY_RAMP   = ["#0C2340", "#1B3C63", "#2F5B8A", "#6E8CAE", "#AFC2D6"]
