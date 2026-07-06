#!/usr/bin/env bash
# Adopt the fleet jal-co/ui island glue into a site repo.
#
# Copies the four shared files from fleet/islands/ into the target site, in the
# same locations brigade-site uses, then prints the remaining manual steps.
# Justin's actual components are NOT vendored here: install them per site with
# `npx shadcn@latest add @jalco/<name>` (see docs/ISLANDS.md).
#
# Usage:
#   bin/adopt-islands.sh <site-dir-name>     # e.g. bin/adopt-islands.sh lidless-site
#   bin/adopt-islands.sh /abs/path/to/site
set -euo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$KIT/fleet/islands"

[ $# -eq 1 ] || { echo "usage: $(basename "$0") <site-dir-name|path>" >&2; exit 1; }

# Resolve the site dir: absolute path, or a sibling under ~/repos.
if [ -d "$1" ]; then
  SITE="$(cd "$1" && pwd)"
else
  SITE="$(cd "$KIT/.." && pwd)/$1"
fi
[ -d "$SITE/src" ] || { echo "no src/ in $SITE (is this an Astro site?)" >&2; exit 1; }

mkdir -p "$SITE/src/lib" "$SITE/src/components" "$SITE/src/styles"
cp "$SRC/github-data.ts"                "$SITE/src/lib/github-data.ts"
cp "$SRC/JalcoProjectBadgesStatic.tsx"  "$SITE/src/components/JalcoProjectBadgesStatic.tsx"
cp "$SRC/ShieldcnChart.astro"           "$SITE/src/components/ShieldcnChart.astro"
cp "$SRC/shadcn-alias.css"              "$SITE/src/styles/shadcn-alias.css"

echo "copied island glue into $SITE:"
echo "  src/lib/github-data.ts"
echo "  src/components/JalcoProjectBadgesStatic.tsx"
echo "  src/components/ShieldcnChart.astro"
echo "  src/styles/shadcn-alias.css"
echo
echo "next (see docs/ISLANDS.md):"
echo "  1. paste src/styles/shadcn-alias.css into src/styles/global.css (or @import it)"
echo "  2. components.json -> add: \"registries\": { \"@jalco\": \"https://ui.justinlevine.me/r/{name}.json\" }"
echo "  3. npx shadcn@latest add @jalco/commit-graph @jalco/release-badge @jalco/ci-badge --yes"
echo "  4. if you add @jalco/activity-graph, set src/lib/github.ts to: export * from './github-data';"
echo "  5. mount: CommitGraph client:idle, badges static (no client directive)"
