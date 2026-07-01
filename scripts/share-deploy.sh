#!/usr/bin/env bash
# share-deploy.sh — publish the CO3 Customer Portal handbook to share.co3.io as a
# CLEAN MIRROR of the local site.
#
# Strategy (like `aws s3 sync --delete`):
#   1. Upload every local file (overwriting same-named files in place).
#   2. Prune: delete any REMOTE file that no longer exists locally.
# This keeps the project exactly in sync — renamed images, moved/removed files
# and structural changes leave no stale leftovers — WITHOUT ever emptying the
# live site mid-deploy (uploads happen before any delete).
#
# API (same contract as the Playwright repo's scripts/share-upload.sh):
#   POST   {BASE}/api/v1/projects/{PROJECT}/files            X-Api-Key, file=@…, path=…
#   GET    {BASE}/api/v1/projects/{PROJECT}/files          → JSON [{path,size,…}]
#   DELETE {BASE}/api/v1/projects/{PROJECT}/files/{path}
#
# Usage:
#   SHARE_API_KEY=<key> scripts/share-deploy.sh [dir]     # default dir: .
#   scripts/share-deploy.sh --dry-run                     # preview, no changes
#   scripts/share-deploy.sh --no-prune [dir]              # upload only, keep stale
#
# Env:  SHARE_PROJECT   destination project (default: portal-customer-guide)
# Exit: 0 ok · 1 no key · 2 bad dir · 3 upload failed · 4 prune failed
set -euo pipefail

PROJECT="${SHARE_PROJECT:-portal-customer-guide}"
BASE_URL="https://share.co3.io"
SRC="."
DRY_RUN=0
PRUNE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-prune) PRUNE=0; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) SRC="${1%/}"; shift ;;
  esac
done

if [[ "$DRY_RUN" -eq 0 && -z "${SHARE_API_KEY:-}" ]]; then
  echo "ERROR: SHARE_API_KEY is not set. Export it or pass via env." >&2
  exit 1
fi
if [[ ! -f "$SRC/index.html" ]]; then
  echo "ERROR: no index.html in '$SRC' — point at the guide directory." >&2
  exit 2
fi

# Repo-only bits that must never be published.
SKIP_RE='(^\./\.git/|^\./\.github/|^\./scripts/|/README\.md$|/\.nojekyll$|/\.DS_Store$)'
API="${BASE_URL}/api/v1/projects/${PROJECT}/files"

echo "── share.co3.io deploy (clean mirror) ──────────────────────────"
echo "  Project : $PROJECT"
echo "  Source  : $SRC"
echo "  Target  : ${BASE_URL}/${PROJECT}/ (project root)"
echo "  Prune   : $([[ "$PRUNE" -eq 1 ]] && echo 'yes — remove stale remote files' || echo no)"
echo "  Dry run : $([[ "$DRY_RUN" -eq 1 ]] && echo yes || echo no)"
echo

# ── Collect local files ─────────────────────────────────────────────────────
local_list=$(mktemp)
while IFS= read -r -d '' f; do
  printf '%s\n' "${f#./}" >> "$local_list"
done < <(cd "$SRC" && find . -type f -print0 | grep -zEv "$SKIP_RE")
local_count=$(wc -l < "$local_list" | tr -d ' ')

# ── Upload phase ────────────────────────────────────────────────────────────
up_ok=0; up_fail=0
echo "Uploading $local_count file(s):"
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  if [[ "$DRY_RUN" -eq 1 ]]; then printf '  → %s\n' "$rel"; up_ok=$((up_ok+1)); continue; fi
  resp=$(mktemp)
  code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
    -H "X-Api-Key: $SHARE_API_KEY" -F "file=@$SRC/$rel" -F "path=$rel" "$API") || code=000
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    printf '  ✓ %s\n' "$rel"; up_ok=$((up_ok+1))
  else
    printf '  ✗ %s (HTTP %s) %s\n' "$rel" "$code" "$(head -c 160 "$resp")"; up_fail=$((up_fail+1))
  fi
  rm -f "$resp"
done < "$local_list"

# ── Prune phase (delete remote files not present locally) ───────────────────
pr_del=0; pr_fail=0
if [[ "$PRUNE" -eq 1 ]]; then
  echo
  echo "Pruning stale remote files:"
  if [[ "$DRY_RUN" -eq 1 && -z "${SHARE_API_KEY:-}" ]]; then
    echo "  (dry-run without SHARE_API_KEY — cannot list remote; prune skipped)"
  else
    rlist=$(mktemp); remote_paths=$(mktemp)
    lcode=$(curl -sS -o "$rlist" -w '%{http_code}' -H "X-Api-Key: ${SHARE_API_KEY:-}" "$API") || lcode=000
    if [[ "$lcode" != "200" ]]; then
      echo "  ✗ could not list remote files (HTTP $lcode) — prune skipped" >&2
      pr_fail=$((pr_fail+1))
    else
      grep -oE '"path":"[^"]+"' "$rlist" | sed 's/^"path":"//; s/"$//' > "$remote_paths"
      any=0
      while IFS= read -r rp; do
        [[ -z "$rp" ]] && continue
        grep -qxF "$rp" "$local_list" && continue   # still present locally → keep
        any=1
        enc=$(printf '%s' "$rp" | sed 's/ /%20/g')
        if [[ "$DRY_RUN" -eq 1 ]]; then printf '  ⌫ would delete %s\n' "$rp"; continue; fi
        dcode=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "X-Api-Key: $SHARE_API_KEY" "$API/$enc") || dcode=000
        if [[ "$dcode" == "204" || "$dcode" == "200" ]]; then
          printf '  ⌫ deleted %s\n' "$rp"; pr_del=$((pr_del+1))
        else
          printf '  ✗ delete %s (HTTP %s)\n' "$rp" "$dcode"; pr_fail=$((pr_fail+1))
        fi
      done < "$remote_paths"
      [[ "$any" -eq 0 ]] && echo "  nothing stale — remote already matches local"
    fi
    rm -f "$rlist" "$remote_paths"
  fi
fi
rm -f "$local_list"

echo
echo "── Summary ─────────────────────────────────────────────────────"
echo "  Uploaded : ${up_ok}$([[ "$up_fail" -gt 0 ]] && echo " (failed: $up_fail)")"
[[ "$PRUNE" -eq 1 ]] && echo "  Pruned   : ${pr_del}$([[ "$pr_fail" -gt 0 ]] && echo " (failed: $pr_fail)")"
if [[ "$DRY_RUN" -eq 0 && "$up_ok" -gt 0 && "$up_fail" -eq 0 ]]; then
  echo
  echo "Viewer URL (Keycloak sign-in required):"
  echo "  ${BASE_URL}/${PROJECT}/index.html"
fi

[[ "$up_fail" -gt 0 ]] && exit 3
[[ "$pr_fail" -gt 0 ]] && exit 4
exit 0
