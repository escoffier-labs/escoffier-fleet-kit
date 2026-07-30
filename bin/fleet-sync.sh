#!/usr/bin/env bash
# Routine fleet sync, designed to run headless from cron with no human in the loop.
#
# For every Escoffier Labs site repo it:
#   1. fast-forwards the local checkout from its configured tracked upstream
#   2. refreshes SITE.version from each tool's latest release (or skill count)
#   3. regenerates every OG card from the one shared template
#   4. commits and pushes only the repos that actually changed
#   5. prints a one-line-per-repo summary (so an OpenClaw cron can relay it)
#
# Safe to run repeatedly: a no-op run touches nothing and pushes nothing.
# A failed pull, dirty checkout, detached HEAD, or status error aborts before
# generation. Commit/push failures are aggregated per site; unpublished local
# commits (e.g. after a previous push failure) are retried on later runs.
set -euo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="$(cd "$KIT/.." && pwd)"
cd "$KIT" || { echo "KIT dir missing" >&2; exit 1; }

SITES=$(node -e "const c=require('./sites.config.json');console.log(Object.keys(c).filter(k=>!k.startsWith('_')).join(' '))")

echo "== fleet-sync $(date -u +%Y-%m-%dT%H:%MZ)"

# 1. validate every checkout before changing any of them
PREFLIGHT_FAILED=""
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || { echo "  $s: MISSING"; continue; }

  # status --porcelain must succeed; failure is not "clean"
  if ! status_out=$(git -C "$d" status --porcelain 2>&1); then
    echo "  $s: STATUS FAILED"
    PREFLIGHT_FAILED="$PREFLIGHT_FAILED $s"
    continue
  fi
  if [ -n "$status_out" ]; then
    echo "  $s: dirty"
    PREFLIGHT_FAILED="$PREFLIGHT_FAILED $s"
    continue
  fi

  # Reject detached HEAD before generation or commit
  if ! branch=$(git -C "$d" rev-parse --abbrev-ref HEAD 2>&1); then
    echo "  $s: STATUS FAILED"
    PREFLIGHT_FAILED="$PREFLIGHT_FAILED $s"
    continue
  fi
  if [ "$branch" = "HEAD" ]; then
    echo "  $s: detached HEAD"
    PREFLIGHT_FAILED="$PREFLIGHT_FAILED $s"
    continue
  fi
done

if [ -n "$PREFLIGHT_FAILED" ]; then
  echo "== failed: preflight: $(echo "$PREFLIGHT_FAILED" | xargs)"
  exit 1
fi

# All present checkouts are clean and on a branch; refresh from tracked upstream.
# git pull with no remote/branch uses the branch's configured upstream only.
# A missing or failed tracked-upstream pull is a real failure for that site.
PULL_FAILED=""
for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || continue
  if git -C "$d" pull --ff-only --quiet; then
    :
  else
    echo "  $s: PULL FAILED"
    PULL_FAILED="$PULL_FAILED $s"
  fi
done

if [ -n "$PULL_FAILED" ]; then
  echo "== failed: pull failed: $(echo "$PULL_FAILED" | xargs)"
  exit 1
fi

# 2. version sync (writes SITE.version in place)
echo "== version sync"
node bin/sync-versions.mjs | tee /tmp/fleet-sync-versions.json

# 3. regenerate all OG cards from the shared template
echo "== og render"
node og/render.mjs >/dev/null

# 4. commit + push changed repos; also retry sites that still have unpublished commits
echo "== publish"
PUSHED=0
PUSHED_NAMES=""
FAILED_NAMES=""

# How many commits is HEAD ahead of its configured tracked upstream (@{u})?
# Returns non-zero if @{u} cannot be resolved or publication state cannot be
# determined; never falls back to origin/<branch> and never lies with 0.
commits_ahead() {
  local d="$1"
  local branch upstream count
  branch=$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null) || return 1
  if [ "$branch" = "HEAD" ]; then
    return 1
  fi
  upstream=$(git -C "$d" rev-parse --abbrev-ref '@{u}' 2>/dev/null) || return 1
  count=$(git -C "$d" rev-list --count "$upstream..HEAD" 2>/dev/null) || return 1
  # rev-list must print a non-empty integer; empty/garbage is undetermined state
  case "$count" in
    ''|*[!0-9]*) return 1 ;;
  esac
  printf '%s\n' "$count"
}

for s in $SITES; do
  d="$REPOS/$s"
  [ -d "$d/.git" ] || continue

  if ! status_out=$(git -C "$d" status --porcelain 2>&1); then
    echo "  $s: STATUS FAILED"
    FAILED_NAMES="$FAILED_NAMES $s"
    continue
  fi

  if ! branch=$(git -C "$d" rev-parse --abbrev-ref HEAD 2>&1); then
    echo "  $s: STATUS FAILED"
    FAILED_NAMES="$FAILED_NAMES $s"
    continue
  fi
  if [ "$branch" = "HEAD" ]; then
    echo "  $s: detached HEAD"
    FAILED_NAMES="$FAILED_NAMES $s"
    continue
  fi

  need_commit=0
  need_push=0

  if [ -n "$status_out" ]; then
    need_commit=1
    need_push=1
  else
    if ! ahead=$(commits_ahead "$d"); then
      echo "  $s: AHEAD CHECK FAILED"
      FAILED_NAMES="$FAILED_NAMES $s"
      continue
    fi
    # strip whitespace
    ahead=$(echo "$ahead" | tr -d '[:space:]')
    if [ -n "$ahead" ] && [ "$ahead" -gt 0 ] 2>/dev/null; then
      need_push=1
      echo "  $s: $ahead unpublished commit(s); retrying push"
    else
      echo "  $s: no change"
      continue
    fi
  fi

  if [ "$need_commit" -eq 1 ]; then
    if ! git -C "$d" add -A || ! git -C "$d" commit --quiet -m "chore: routine fleet sync (versions + preview cards)"; then
      echo "  $s: COMMIT FAILED"
      FAILED_NAMES="$FAILED_NAMES $s"
      continue
    fi
  fi

  if [ "$need_push" -eq 1 ]; then
    if git -C "$d" push --quiet origin "$branch" 2>/dev/null; then
      echo "  $s: PUSHED ($branch)"
      PUSHED=$((PUSHED+1))
      PUSHED_NAMES="$PUSHED_NAMES ${s%-site}"
    else
      if [ "$need_commit" -eq 1 ]; then
        echo "  $s: committed, PUSH FAILED"
      else
        echo "  $s: PUSH FAILED"
      fi
      FAILED_NAMES="$FAILED_NAMES $s"
    fi
  fi
done

if [ -n "$FAILED_NAMES" ]; then
  echo "== done: $PUSHED repo(s) pushed; failed: $(echo "$FAILED_NAMES" | xargs)"
else
  echo "== done: $PUSHED repo(s) pushed"
fi

# Best-effort chat ping. Silent no-op until agent-notify has a channel configured.
# Only counts confirmed pushes (failed sites are never listed as redeploying).
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
