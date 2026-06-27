#!/usr/bin/env bash
# Generate a transparent sprite: FLUX (on a plain white background) -> BiRefNet
# matting (proper subject segmentation; drops drop-shadows, keeps thin branches)
# -> assets/<key>.png. Falls back to a local white-key if matting is unavailable.
#
#   REPLICATE_API_TOKEN=... scripts/gensprite.sh <key> "<prompt>" [aspect]
#
# Self-paces around Replicate's 429 throttle (low-credit accounts ~6/min burst 1).
set -euo pipefail

KEY="${1:?usage: gensprite.sh <key> <prompt> [aspect]}"
PROMPT="${2:?prompt required}"
ASPECT="${3:-1:1}"
GEN_MODEL="black-forest-labs/flux-schnell"
RMBG_MODEL="${4:-men1scus/birefnet}"
: "${REPLICATE_API_TOKEN:?set REPLICATE_API_TOKEN}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/$KEY.png"
TMP="$ROOT/assets/.raw_$KEY.png"
AUTH=(-H "Authorization: Bearer $REPLICATE_API_TOKEN" -H "Content-Type: application/json")

pick() { python3 -c 'import json,sys; d=json.load(sys.stdin); o=d.get("output"); u=o[0] if isinstance(o,list) and o else (o if isinstance(o,str) else ""); print(d.get("status",""), u)'; }

# POST a prediction (to $1 = full URL) with body $2, waiting out 429 throttling.
create() {
  local url="$1" body="$2" resp ra
  for i in 1 2 3 4 5 6 7 8; do
    resp=$(curl -sS -X POST "$url" "${AUTH[@]}" -H "Prefer: wait" -d "$body")
    if printf '%s' "$resp" | grep -q '"status":429'; then
      ra=$(printf '%s' "$resp" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("retry_after",10))' 2>/dev/null || echo 10)
      sleep $((ra + 2)); continue
    fi
    printf '%s' "$resp" | pick; return 0
  done
  echo " "; return 0
}

# 1) generate the art (official-model endpoint)
gbody=$(python3 -c 'import json,sys; print(json.dumps({"input":{"prompt":sys.argv[1],"aspect_ratio":sys.argv[2],"output_format":"png","num_outputs":1}}))' "$PROMPT" "$ASPECT")
read -r gstatus gurl < <(create "https://api.replicate.com/v1/models/$GEN_MODEL/predictions" "$gbody")
if [ -z "${gurl:-}" ]; then echo "generate failed (status=${gstatus:-?})"; exit 1; fi

sleep 12  # respect burst-of-1 before the next prediction

# 2) matting via versioned community model (/v1/predictions with version hash)
ver=$(curl -sS "${AUTH[@]}" "https://api.replicate.com/v1/models/$RMBG_MODEL" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("latest_version") or {}).get("id",""))' 2>/dev/null || echo "")
rurl=""
if [ -n "$ver" ]; then
  rbody=$(python3 -c 'import json,sys; print(json.dumps({"version":sys.argv[2],"input":{"image":sys.argv[1]}}))' "$gurl" "$ver")
  read -r rstatus rurl < <(create "https://api.replicate.com/v1/predictions" "$rbody")
fi

if [ -n "${rurl:-}" ]; then
  curl -sS -L -o "$OUT" "$rurl"
  echo "wrote $OUT ($(wc -c < "$OUT") bytes), gen=$gstatus matte=${rstatus:-?}"
else
  echo "matting unavailable — local white-key fallback"
  curl -sS -L -o "$TMP" "$gurl"
  python3 "$ROOT/scripts/keywhite.py" "$TMP" "$OUT"; rm -f "$TMP"
  echo "wrote $OUT (local key)"
fi
