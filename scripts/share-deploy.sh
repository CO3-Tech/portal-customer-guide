#!/usr/bin/env bash
# share-deploy.sh — publish the CO3 Customer Portal handbook to share.co3.io.
#
# Same upload contract as the Playwright repo's scripts/share-upload.sh:
#   POST {BASE}/api/v1/projects/{PROJECT}/files
#   headers: X-Api-Key: $SHARE_API_KEY
#   body   : multipart  file=@<localfile>  path=<destination>
# …but this publishes to the PROJECT ROOT (no Run_<timestamp>/ folder) so the
# URL is stable and re-running simply REPLACES the files in place.
#
# Usage:
#   SHARE_API_KEY=<key> scripts/share-deploy.sh              # deploy ./ (repo root)
#   SHARE_API_KEY=<key> scripts/share-deploy.sh /path/to/dir # deploy a specific dir
#   scripts/share-deploy.sh --dry-run                        # list files, no POSTs
#
# Env:
#   SHARE_PROJECT   destination project slug (default: portal-customer-guide)
#
# Exit codes: 0 ok · 1 no API key · 2 bad source dir · 3 one+ upload failed
set -euo pipefail

PROJECT="${SHARE_PROJECT:-portal-customer-guide}"
BASE_URL="https://share.co3.io"
SRC="."
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) SRC="${1%/}"; shift ;;
  esac
done

if [[ "$DRY_RUN" -eq 0 && -z "${SHARE_API_KEY:-}" ]]; then
  echo "ERROR: SHARE_API_KEY is not set. Export it or pass via env." >&2
  echo "  Hint: SHARE_API_KEY=<key> $0" >&2
  exit 1
fi
if [[ ! -f "$SRC/index.html" ]]; then
  echo "ERROR: no index.html in '$SRC' — point at the guide directory." >&2
  exit 2
fi

# Publish everything except repo-only bits (git, CI, tooling, docs, OS cruft).
SKIP_RE='(^\./\.git/|^\./\.github/|^\./scripts/|/README\.md$|/\.nojekyll$|/\.DS_Store$)'

echo "── share.co3.io deploy ─────────────────────────────────────────"
echo "  Project : $PROJECT"
echo "  Source  : $SRC"
echo "  Target  : ${BASE_URL}/${PROJECT}/ (project root, in place)"
echo "  Dry run : $([[ "$DRY_RUN" -eq 1 ]] && echo yes || echo no)"
echo

failed=0
total=0
while IFS= read -r -d '' f; do
  rel="${f#./}"
  total=$((total + 1))
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '  → %s\n' "$rel"
    continue
  fi
  resp=$(mktemp)
  code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
    -H "X-Api-Key: $SHARE_API_KEY" \
    -F "file=@$SRC/$rel" \
    -F "path=$rel" \
    "${BASE_URL}/api/v1/projects/${PROJECT}/files") || code=000
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    printf '  ✓ %s  (HTTP %s)\n' "$rel" "$code"
  else
    printf '  ✗ %s  (HTTP %s)  %s\n' "$rel" "$code" "$(head -c 200 "$resp")"
    failed=$((failed + 1))
  fi
  rm -f "$resp"
done < <(cd "$SRC" && find . -type f -print0 | grep -zEv "$SKIP_RE")

echo
echo "── Summary ─────────────────────────────────────────────────────"
echo "  Uploaded : $((total - failed))/$total"
echo "  Failed   : $failed"
if [[ "$DRY_RUN" -eq 0 && "$total" -gt 0 && "$failed" -lt "$total" ]]; then
  echo
  echo "Viewer URL (Keycloak sign-in required):"
  echo "  ${BASE_URL}/${PROJECT}/index.html"
fi
[[ "$failed" -gt 0 ]] && exit 3 || exit 0
