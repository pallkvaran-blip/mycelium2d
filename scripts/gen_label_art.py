#!/usr/bin/env python3
# Generate the vector illustration pieces the three label directions need, via
# recraft-v3-svg (proven true-vector by scripts/recraft_test.py).
#
# Recraft ignores a requested palette, so prompts here ask for the STYLE and the
# SUBJECT only; brand colour is applied afterwards by the recolour pass in the label
# builder. Asking for colour here just wastes renders.
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from recraft_test import run, OUT, inspect

PIECES = {
    # premium botanical
    "hero-botanical": ("1024x1365",
        "Two ripe mangoes hanging on a branch with leaves, botanical illustration in flat "
        "vector, elegant hand-drawn line work, fine engraved leaf veins, confident dark "
        "outline, restrained flat colour, centred on a plain background, vintage fruit "
        "crate label engraving style"),
    "wreath-botanical": ("1024x1024",
        "A decorative oval wreath of tropical mango leaves and small blossoms, botanical "
        "vector illustration, symmetrical, elegant fine line work, flat colour, open centre, "
        "plain background, vintage label ornament"),
    # bold flat modern
    "mango-graphic": ("1024x1024",
        "One single mango, bold flat graphic vector icon, extremely simple geometric shapes, "
        "no outline, two flat colours only, modern minimal craft soda branding, centred on a "
        "plain background"),
    "leaf-graphic": ("1024x1024",
        "Two simple tropical leaves, bold flat graphic vector shapes, extremely simple, no "
        "outline, single flat colour, modern minimal branding mark, plain background"),
    # vivid mass-market
    "mango-cluster": ("1024x1024",
        "A cluster of three ripe mangoes with glossy leaves, lively flat vector illustration "
        "for a fruit juice label, bold clean shapes, confident dark outline, cheerful and "
        "appetising, centred on a plain background"),
    "splash": ("1024x1024",
        "A dynamic juice splash crown with droplets, flat vector illustration, bold clean "
        "shapes, simple flat colour, side view, plain background"),
}

if __name__ == "__main__":
    if not os.environ.get("REPLICATE_API_TOKEN"): sys.exit("REPLICATE_API_TOKEN not set")
    made = []
    for name, (size, prompt) in PIECES.items():
        p = run(name, size, prompt)
        if p: made.append(p)
    print("\n--- inspection ---")
    for p in made: inspect(p)
