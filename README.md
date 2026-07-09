<p align="center">
  <img src="docs/assets/escoffier-fleet-kit-social-preview.jpg" alt="escoffier-fleet-kit banner" width="900">
</p>

<h1 align="center">escoffier-fleet-kit</h1>

<p align="center">
  <img src="docs/assets/marks/escoffier-fleet-kit-circle.svg" alt="" width="40" height="40">
</p>

<p align="center">
  <strong>One theme for every Escoffier site. Keep the fleet from drifting.</strong>
</p>

<p align="center">
  Shared OG card template, version sync from GitHub releases, and hands-off publishing for the *-site fleet. Change the kitchen style once; regenerate all.
</p>

<p align="center">
  <a href="#install">Install</a> &middot; <a href="#what-it-does">What it does</a>
</p>

<p align="center">
  <img src="https://shieldcn.dev/github/ci/escoffier-labs/escoffier-fleet-kit.svg?branch=main&workflow=ci.yml" alt="CI status">
  <img src="https://shieldcn.dev/badge/license-MIT-green.svg" alt="MIT license">
</p>

## Install

```bash
git clone https://github.com/escoffier-labs/escoffier-fleet-kit.git
cd escoffier-fleet-kit
npm install
# render OG cards / sync versions — see bin/ and package.json scripts
```

## What it does

| | Job | What you get |
|---|---|---|
| **Theme** | One OG template | Dark-ledger kitchen style for every product card |
| **Sync** | Versions from releases | SITE.version stays current without hand edits |
| **Publish** | Fleet script | Fast-forward, regenerate, commit only what changed |

<p align="center">
  <img src="docs/og-card-sample.png" alt="Sample OG card" width="760">
</p>

<p align="center"><em>One template, every site.</em></p>


## Layout

```
DESIGN.md            canonical aesthetic reference for every fleet site
README-SPINE.md      the fleet README contract: section order, proof, badges
sites.config.json    per-site version source (gh-release | skill-count | manual)
og/
  template.html      the one OG card template (dark ledger + cream artifact)
  sites.json         per-site OG copy (kicker, headline, subtitle, footer, card)
  render.mjs         renders cards to each repo's public/og-card.png (2x, no server)
fleet/
  FleetLinks.astro   shared cross-link section, synced into every site
  fleet.ts           the site registry FleetLinks reads
  islands/           jal-co/ui island glue (opt-in per site, see docs/ISLANDS.md)
    shadcn-alias.css   shadcn -> ledger token bridge (islands theme for free)
    github-data.ts     build-time GitHub fetchers (commits, release, CI)
    JalcoProjectBadgesStatic.tsx  static release + CI badges
    ShieldcnChart.astro           dark/light shieldcn chart wrapper
docs/
  ISLANDS.md         recipe: add jal-co/ui React islands to a fleet Astro site
bin/
  sync-versions.mjs  read tool versions, patch SITE.version in each site repo
  fleet-sync.sh      the headless routine: pull, sync, render, commit, push
  adopt-islands.sh   copy the island glue into a site, then follow ISLANDS.md
  publishing-watchdog.mjs  ClawHub/Printing Press publishing status report
publishing/
  manifest.json      public skill and CLI publishing inventory
```

## Use

```bash
npm install                 # playwright-core (uses an existing Chromium build)

npm run og                  # regenerate every OG card from the shared theme
npm run og -- skillet-site  # just one
npm run sync:dry            # preview version changes, write nothing
npm run sync                # apply version bumps into each site repo
npm run fleet               # the full routine: pull + sync + render + commit + push
npm run publishing:watch    # report ClawHub/Printing Press publishing status
```

## Adding a site

1. Add an entry to `og/sites.json` (kicker, h1, h2, sub, foot, card).
2. Add an entry to `sites.config.json` (repo + version source).
3. Run `npm run og -- <slug>` to render its card.

## Routine automation

`bin/fleet-sync.sh` is meant to run unattended (cron or an OpenClaw scheduled
job). It only pushes repos with real changes and prints a one-line-per-repo
summary suitable for relaying to a chat channel. New release out? The next run
bumps the site and redeploys via Vercel, no terminal required.

The sites all deploy on Vercel from `git push` to their default branch, so a
push from this kit is a deploy.

## Publishing watchdog

`publishing/manifest.json` is the source of truth for public skill and CLI
publishing. Entries track the source repo/path, current status, publish policy,
published version, source commit, and any blocker such as a taken ClawHub slug
or a rate-limit retry.

`npm run publishing:watch` writes receipts under the current user's OpenClaw
workspace logs and prints a short report for Discord. OpenClaw runs it weekly
into the private `#escoffier-stats` channel on Solomon's machine.
