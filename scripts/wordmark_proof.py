#!/usr/bin/env python3
# Wordmark proof: set TANDA in real OFL display faces and outline it with fontTools, so it
# can be compared against the monoline stroke-font version from the first pass.
#
# Every candidate is SIL Open Font License -- free for commercial use, embedding and
# outlining, which matters for a product label.
#
# The layered logo effect is fill+stroke on the SAME outlined path, drawn widest first:
# stroking a filled glyph expands it outward, so three passes at decreasing widths give
# the cream/plum/orange stack without any manual path offsetting.
import re, subprocess, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT  = Path(__file__).resolve().parents[1]
CACHE = Path("/tmp/claude-0/-home-user-mycelium2d/91519050-5269-59c0-aa35-618c65c0316f/scratchpad/fonts")
CACHE.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"

CANDIDATES = [
    ("Titan One",    None),
    ("Luckiest Guy", None),
    ("Bowlby One",   None),
    ("Baloo 2",      800),
    ("Fredoka",      700),
    ("Lilita One",   None),
]

def fetch(family, weight=None):
    slug = family.replace(" ", "") + (f"-{weight}" if weight else "")
    dest = CACHE / f"{slug}.ttf"
    if dest.exists():
        return dest
    spec = family.replace(" ", "+") + (f":wght@{weight}" if weight else "")
    css = subprocess.run(["curl", "-sS", "--max-time", "40", "--cacert", CA,
                          f"https://fonts.googleapis.com/css2?family={spec}"],
                         capture_output=True, text=True).stdout
    m = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css)
    if not m:
        print(f"  ! no ttf url for {family}"); return None
    subprocess.run(["curl", "-sS", "--max-time", "60", "--cacert", CA, "-o", str(dest), m.group(1)], check=True)
    return dest

class Face:
    def __init__(self, path):
        self.f = TTFont(str(path))
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upem = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]

    def word(self, s, tracking=0):
        """Glyph outlines plus the pen-x advance, in font units."""
        out, x = [], 0
        for ch in s:
            g = self.cmap.get(ord(ch))
            if g is None:
                x += self.upem * 0.3; continue
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(pen)
            d = pen.getCommands()
            if d:
                out.append((d, x))
            x += self.hmtx[g][0] + tracking
        return out, x - tracking

def wordmark(face, text, cx, baseline, target_w, layers, tracking=0):
    glyphs, adv = face.word(text, tracking)
    if adv <= 0:
        return ""
    s = target_w / adv                     # scale so the word is exactly target_w wide
    body = "".join(f'<path d="{d}" transform="translate({x},0)"/>' for d, x in glyphs)
    out = []
    for w, colour in layers:               # widest first; stroke expands the filled glyph
        out.append(f'<g transform="translate({cx - target_w/2},{baseline}) scale({s},{-s})" '
                   f'fill="{colour}" stroke="{colour}" stroke-width="{w/s:.1f}" '
                   f'stroke-linejoin="round">{body}</g>')
    return "\n".join(out)

if __name__ == "__main__":
    W, ROW = 900, 250
    rows, y = [], 40
    faces = []
    for fam, wt in CANDIDATES:
        p = fetch(fam, wt)
        if p:
            faces.append((f"{fam}{' ' + str(wt) if wt else ''}", Face(p)))
            print(f"  fetched {fam}")
    H = 60 + ROW * len(faces)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
           f'<rect width="{W}" height="{H}" fill="#F0921F"/>']
    for name, face in faces:
        svg.append(wordmark(face, "TANDA", W/2, y + 150, 640,
                            [(34, "#FFF6E2"), (20, "#5B2A62"), (0.001, "#F9AE33")]))
        svg.append(f'<text x="18" y="{y+28}" font-family="monospace" font-size="20" '
                   f'fill="#5B2A62">{name}</text>')
        y += ROW
    svg.append("</svg>")
    f = ROOT / "assets" / "tanda_options" / "wordmark-proof.svg"
    f.write_text("\n".join(svg))
    print(f"-> {f}")

def comparison():
    """Old monoline stroke-font wordmark above the real-typeface candidates."""
    sys.path.insert(0, str(ROOT / "scripts"))
    import gen_tanda_label as old
    W, ROW = 900, 215
    picks = [("Titan One", None), ("Baloo 2", 800), ("Luckiest Guy", None), ("Bowlby One", None)]
    H = 40 + ROW * (len(picks) + 1)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
           f'<rect width="{W}" height="{H}" fill="#F0921F"/>']
    def label(t, y, colour="#5B2A62"):
        return (f'<text x="24" y="{y}" font-family="monospace" font-size="19" '
                f'font-weight="bold" fill="{colour}">{t}</text>')
    # old: stroke skeleton, sized by the same rule the label used
    sz, tr = old.fit("TANDA", 640, 0.30)
    svg.append(label("BEFORE - monoline stroke font (what I shipped)", 34, "#7A2E12"))
    svg.append(old.word("TANDA", W/2, 78, sz, tr,
                        [(sz*0.62, "#FFF6E2"), (sz*0.50, "#5B2A62"), (sz*0.34, "#F9AE33")]))
    y = ROW
    for fam, wt in picks:
        p = fetch(fam, wt)
        if not p: continue
        svg.append(label(f"AFTER - {fam}{' ' + str(wt) if wt else ''} (SIL OFL)", y + 34))
        svg.append(wordmark(Face(p), "TANDA", W/2, y + 168, 640,
                            [(32, "#FFF6E2"), (19, "#5B2A62"), (0.001, "#F9AE33")]))
        y += ROW
    svg.append("</svg>")
    f = ROOT / "assets" / "tanda_options" / "wordmark-before-after.svg"
    f.write_text("\n".join(svg))
    return f
