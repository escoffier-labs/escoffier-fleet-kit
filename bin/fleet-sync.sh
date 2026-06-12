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
set -uo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="$(cd "$KIT/.." && pwd)"
cd "$KIT"

SITES=$(node -e "const c=require('./sites.config.json');console.log(Object.keys(c).filter(k=>!k.startsWith('_')).join(' '))")

echo "== fleet-sync $(date -u +%Y-%m-%dT%H:%MZ)"

# 1. refresh checkouts (only if clean, never clobber local work)
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || { echo "  $s: MISSING"; continue; }
  if [ -n "$(git -C "$d" status --porcelain)" ]; then
    echo "  $s: dirty, skipping pull"
  else
    git -C "$d" pull --ff-only --quiet origin main 2>/dev/null || git -C "$d" pull --ff-only --quiet origin master 2>/dev/null || true
  fi
done

# 2. version sync (writes SITE.version in place)
echo "== version sync"
node bin/sync-versions.mjs | tee /tmp/fleet-sync-versions.json

# 3. regenerate all OG cards from the shared template
echo "== og render"
node og/render.mjs >/dev/null

# 4. commit + push changed repos
echo "== publish"
CHANGED=0
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || continue
  if [ -z "$(git -C "$d" status --porcelain)" ]; then
    echo "  $s: no change"
    continue
  fi
  CHANGED=$((CHANGED+1))
  git -C "$d" add -A
  git -C "$d" commit --quiet -m "chore: routine fleet sync (versions + preview cards)"
  branch=$(git -C "$d" rev-parse --abbrev-ref HEAD)
  if git -C "$d" push --quiet origin "$branch" 2>/dev/null; then
    echo "  $s: PUSHED ($branch)"
  else
    echo "  $s: committed, PUSH FAILED"
  fi
done

echo "== done: $CHANGED repo(s) updated"

# Best-effort chat ping. Silent no-op until agent-notify has a channel configured.
if [ "$CHANGED" -gt 0 ] && command -v agent-notify >/dev/null 2>&1; then
  printf '{"message":"fleet-sync: %s site(s) updated and redeploying"}' "$CHANGED" \
    | agent-notify --hook custom >/dev/null 2>&1 || true
fi
