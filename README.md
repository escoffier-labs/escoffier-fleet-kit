# escoffier-fleet-kit

Shared theme and routine maintenance for the Escoffier Labs website fleet. One
place to keep every `*-site` looking the same and staying current, so the
sites do not drift and do not need a hand-driven LLM session to update.

## What it does

- **One OG preview theme.** Every site's link-preview card is rendered from a
  single template (`og/template.html`) and a content map (`og/sites.json`), in
  the shared dark-ledger kitchen style. Change the theme once, regenerate all.
- **Version sync.** Reads each tool's latest GitHub release (or skill count)
  and writes it into that site's `SITE.version`, so the sites never lag the
  tools they market.
- **Hands-off publishing.** `bin/fleet-sync.sh` fast-forwards each checkout,
  syncs versions, regenerates the cards, and commits and pushes only the repos
  that actually changed. Safe to run on a timer; a no-op run touches nothing.
- **Tool publishing watchdog.** `bin/publishing-watchdog.mjs` reads
  `publishing/manifest.json`, checks local source state, pulls live ClawHub
  stats for published skills, and prints a Discord-ready report with a JSON
  receipt.
- **Content-aware (review-gated).** `bin/content-sync.mjs` detects new
  releases, drafts a one-line kitchen-voice blurb from each changelog (via
  `codex exec`), refreshes the "fresh from the kitchen" specials board on
  escoffierlabs.dev, and opens ONE review PR plus a Discord ping. It never
  pushes copy to main: an LLM-drafted line always gets a human merge. Idempotent
  (one draft per release, cached in `.content-state.json`), with a graceful
  fallback when a changelog is too thin to summarize.

The canonical design system lives in `DESIGN.md` (copied into each site repo).

## Layout

```
DESIGN.md            canonical aesthetic reference for every fleet site
sites.config.json    per-site version source (gh-release | skill-count | manual)
og/
  template.html      the one OG card template (dark ledger + cream artifact)
  sites.json         per-site OG copy (kicker, headline, subtitle, footer, card)
  render.mjs         renders cards to each repo's public/og-card.png (2x, no server)
bin/
  sync-versions.mjs  read tool versions, patch SITE.version in each site repo
  fleet-sync.sh      the headless routine: pull, sync, render, commit, push
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
