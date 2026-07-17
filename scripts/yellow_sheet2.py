#!/usr/bin/env python3
# Comparison sheet of ALL yellow leaf options, each measured for dominant HUE and
# sorted yellowest->reddest, so the owner can pick the ones that truly separate from
# the orange cache piles. Marks the 5 currently in the piles.
import colorsys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
OPT = ROOT / "assets" / "leaf_options"
OUT = "/tmp/claude-0/-home-user-mycelium2d/e43b2131-64d6-51a4-b68f-76b2b5524080/scratchpad/yellow_options2.png"

CURRENT = {"yellow_ginkgo","yellow_maple","yellow_poplar","yellow_aspen","yellow_elm"}
FILES = sorted([p for p in OPT.glob("*.png") if p.stem.startswith(("yellow_","yellow6_","y12_"))])

def mean_hue(im):
    im = im.convert("RGBA"); px = im.load(); w,h = im.size
    hs=[]; ss=[]; vs=[]
    step = max(1, min(w,h)//60)
    for y in range(0,h,step):
        for x in range(0,w,step):
            r,g,b,a = px[x,y]
            if a < 160: continue
            hh,ss2,vv = colorsys.rgb_to_hsv(r/255,g/255,b/255)
            if vv < 0.15 or ss2 < 0.15: continue   # skip near-black/near-grey
            hs.append(hh*360); ss.append(ss2); vs.append(vv)
    if not hs: return 0,0,0
    hs.sort(); s=sorted(ss); v=sorted(vs)
    return hs[len(hs)//2], s[len(s)//2], v[len(v)//2]   # median hue/sat/val

def label_for(hue):
    if hue >= 50: return "PURE YELLOW", (150,235,120)
    if hue >= 43: return "yellow-gold", (210,225,120)
    if hue >= 36: return "gold/amber", (230,200,110)
    if hue >= 28: return "orange-ish", (240,170,90)
    return "red/orange", (240,130,90)

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(p).exists(): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

items=[]
for p in FILES:
    hue,sat,val = mean_hue(Image.open(p))
    items.append((hue, p))
items.sort(key=lambda t:-t[0])   # yellowest first

COLS=5; CW,CH=280,300; rows=(len(items)+COLS-1)//COLS
W,H=COLS*CW, rows*CH+40
sheet=Image.new("RGBA",(W,H),(58,42,30,255))
d=ImageDraw.Draw(sheet)
title=font(26); fnm=font(19); fhue=font(16)
d.text((16,8), f"All {len(items)} yellow options — sorted YELLOWEST -> reddest (green border = in piles now)", font=title, fill=(230,225,215))
for i,(hue,p) in enumerate(items):
    cx=(i%COLS)*CW; cy=(i//COLS)*CH+40
    now = p.stem in CURRENT
    d.rectangle([cx+4,cy+4,cx+CW-4,cy+CH-4], fill=(70,52,36,255) if now else (52,38,28,255),
                outline=(120,200,140,255) if now else (90,74,56,255), width=3)
    im=Image.open(p).convert("RGBA"); im.thumbnail((CW-70,CH-96))
    x=cx+(CW-im.width)//2; y=cy+12+(CH-96-im.height)//2
    sheet.alpha_composite(im,(x,y))
    name=p.stem.replace("yellow6_","").replace("yellow_","").replace("y12_","")
    lab,col=label_for(hue)
    nm=name.capitalize()+("  ✔" if now else "")
    d.text((cx+14, cy+CH-58), nm, font=fnm, fill=(235,230,220))
    d.text((cx+14, cy+CH-34), f"{lab}  ({int(hue)}°)", font=fhue, fill=col)
sheet.convert("RGB").save(OUT,"PNG")
print("wrote",OUT,"count",len(items))
