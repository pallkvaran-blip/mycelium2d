#!/usr/bin/env python3
# Regenerate a more true-to-life Common Earthball (Scleroderma citrinum) portrait.
# Produces N candidates in scratchpad for review (pick one, then rebuild bundle).
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scratchpad"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = "/tmp/earthball_redo.log"
MODEL = "black-forest-labs/flux-dev"
N = 3

PROMPT = ("A photorealistic close-up nature macro photograph of Scleroderma "
  "citrinum, the common earthball or pigskin poison puffball: firm rounded "
  "potato-shaped fungal balls with no stalk, dirty ochre-yellow to pale "
  "yellow-brown, the thick hard rind densely covered in coarse flattened "
  "dark-brown scaly warts forming a cracked pigskin-like pattern, two or three "
  "of them sitting half-buried in dark woodland soil among fallen leaves and "
  "moss, damp autumn forest floor, soft overcast natural light, shallow depth "
  "of field, naturalistic documentary photograph, highly detailed, no text, "
  "no watermark")

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create():
    body = json.dumps({"input":{"prompt":PROMPT,"aspect_ratio":"3:4","num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(u):
    for _ in range(75):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",u]); st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_jpg(url, dest, width=560, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB"); h = round(im.height*width/im.width)
    im.resize((width,h), Image.LANCZOS).save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for i in range(1, N+1):
        for _ in range(2):
            d = create(); u = (d.get("urls") or {}).get("get")
            if not u: log(f"cand{i} create fail"); time.sleep(4); continue
            r = poll(u); out = r.get("output")
            if r.get("status")=="succeeded" and out:
                url = out[0] if isinstance(out,list) else out
                dest = OUT / f"earthball_{i}.jpg"
                try: download_jpg(url, dest); log(f"OK cand{i} -> {dest}"); break
                except Exception as e: log(f"cand{i} dl err {e}")
            else: log(f"cand{i} {r.get('status')}"); time.sleep(3)
    log("DONE")

if __name__ == "__main__": main()
