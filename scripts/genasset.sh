#!/usr/bin/env bash
# Generate an image asset via Replicate (FLUX) and save it into assets/.
#
#   REPLICATE_API_TOKEN=... scripts/genasset.sh <key> "<prompt>" [aspect] [model]
#
# Writes assets/<key>.png. Requires REPLICATE_API_TOKEN in the environment
# (never store it in the repo). Uses "Prefer: wait" so the call returns the
# finished image (FLUX-schnell completes in a few seconds).
set -euo pipefail

KEY="${1:?usage: genasset.sh <key> <prompt> [aspect] [model]}"
PROMPT="${2:?prompt required}"
ASPECT="${3:-1:1}"
MODEL="${4:-black-forest-labs/flux-schnell}"
: "${REPLICATE_API_TOKEN:?set REPLICATE_API_TOKEN}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/$KEY.png"

req=$(python3 -c 'import json,sys; print(json.dumps({"input":{"prompt":sys.argv[1],"aspect_ratio":sys.argv[2],"output_format":"png","num_outputs":1}}))' "$PROMPT" "$ASPECT")

resp=$(curl -sS -X POST "https://api.replicate.com/v1/models/$MODEL/predictions" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait" \
  -d "$req")

read -r status url <<EOF
$(printf '%s' "$resp" | python3 -c 'import json,sys; d=json.load(sys.stdin); o=d.get("output"); u=o[0] if isinstance(o,list) and o else (o if isinstance(o,str) else ""); print(d.get("status",""), u)')
EOF

if [ -z "${url:-}" ]; then
  echo "no image returned (status=${status:-?}):"
  printf '%s' "$resp" | head -c 900
  exit 1
fi

curl -sS -L -o "$OUT" "$url"
echo "wrote $OUT ($(wc -c < "$OUT") bytes), status=$status"
