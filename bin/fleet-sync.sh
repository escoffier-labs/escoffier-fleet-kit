#!/usr/bin/env bash
# Routine fleet sync, designed to run headless from cron with no human in the loop.
#
# For every Escoffier Labs site repo it:
#   1. fast-forwards the local checkout to origin/main
#   2. refreshes SITE.version from each tool's latest release (or skill count)
#   3. regenerates every OG card from the one shared template
#   4. commits and pushes only the repos that actually changed
#   5. prints a one-line-per-repo summary (so an OpenClaw cron can relay it)
#
# Safe to run repeatedly: a no-op run touches nothing and pushes nothing.
set -euo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="$(cd "$KIT/.." && pwd)"
cd "$KIT" || { echo "KIT dir missing" >&2; exit 1; }

SITES=$(node -e "const c=require('./sites.config.json');console.log(Object.keys(c).filter(k=>!k.startsWith('_')).join(' '))")

echo "== fleet-sync $(date -u +%Y-%m-%dT%H:%MZ)"

# 1. validate every checkout before changing any of them
DIRTY_SITES=""
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || { echo "  $s: MISSING"; continue; }
  if [ -n "$(git -C "$d" status --porcelain)" ]; then
    echo "  $s: dirty"
    DIRTY_SITES="$DIRTY_SITES $s"
  fi
done

if [ -n "$DIRTY_SITES" ]; then
  echo "== failed: dirty checkout(s): $(echo "$DIRTY_SITES" | xargs)"
  exit 1
fi

# All present checkouts are clean, so they can now be refreshed.
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || continue
  git -C "$d" pull --ff-only --quiet origin main 2>/dev/null || git -C "$d" pull --ff-only --quiet origin master 2>/dev/null || true
done

# 2. version sync (writes SITE.version in place)
echo "== version sync"
node bin/sync-versions.mjs | tee /tmp/fleet-sync-versions.json

# 3. regenerate all OG cards from the shared template
echo "== og render"
node og/render.mjs >/dev/null

# 4. commit + push changed repos
echo "== publish"
PUSHED=0
PUSHED_NAMES=""
FAILED_NAMES=""
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || continue
  if [ -z "$(git -C "$d" status --porcelain)" ]; then
    echo "  $s: no change"
    continue
  fi
  if ! git -C "$d" add -A || ! git -C "$d" commit --quiet -m "chore: routine fleet sync (versions + preview cards)"; then
    echo "  $s: COMMIT FAILED"
    FAILED_NAMES="$FAILED_NAMES $s"
    continue
  fi
  branch=$(git -C "$d" rev-parse --abbrev-ref HEAD)
  if git -C "$d" push --quiet origin "$branch" 2>/dev/null; then
    echo "  $s: PUSHED ($branch)"
    PUSHED=$((PUSHED+1))
    PUSHED_NAMES="$PUSHED_NAMES ${s%-site}"
  else
    echo "  $s: committed, PUSH FAILED"
    FAILED_NAMES="$FAILED_NAMES $s"
  fi
done

if [ -n "$FAILED_NAMES" ]; then
  echo "== done: $PUSHED repo(s) pushed; failed: $(echo "$FAILED_NAMES" | xargs)"
else
  echo "== done: $PUSHED repo(s) pushed"
fi

# Best-effort chat ping. Silent no-op until agent-notify has a channel configured.
if [ "$PUSHED" -gt 0 ] && command -v agent-notify >/dev/null 2>&1; then
  agent-notify "fleet-sync: $PUSHED site(s) redeploying ($(echo "$PUSHED_NAMES" | xargs))" >/dev/null 2>&1 || true
fi

# 5. content-aware: draft a specials-board refresh from new release notes.
# Opens a review PR (never auto-publishes); best-effort, never blocks the sync.
echo "== content sync"
node "$KIT/bin/content-sync.mjs" 2>&1 || echo "  content-sync skipped/failed"

if [ -n "$FAILED_NAMES" ]; then
  exit 1
fi
