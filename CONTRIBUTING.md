# Contributing

escoffier-fleet-kit keeps the Escoffier Labs website fleet looking the same and
staying current from one place. The bar is "every site converges on the shared
theme, and nothing gets pushed without a no-op being a true no-op."

## Layout

- `DESIGN.md` - the canonical aesthetic, copied into each site repo
- `og/` - one OG card template + per-site copy + a Chromium renderer
- `bin/` - the sync / render / publish scripts (`fleet-sync.sh` is the routine)
- `sites.config.json` - per-site version source
- CI in `.github/workflows/` (build + SEO validation)

## What lands easily

- Theme refinements in `DESIGN.md` / the OG template
- A new site entry in `sites.config.json` / `og/sites.json`
- Bug fixes, with a note on what you ran

## What needs a conversation first

Open an issue before a PR for:

- Changes to the publish/push behavior in `bin/fleet-sync.sh` or
  `bin/content-sync.mjs` (these write to real repos)
- Anything that could make a no-op run push, or push copy to a site's `main`
  without the review-gate PR

## Rules

- Keep runs idempotent: a no-op must touch nothing.
- No tokens, secrets, or machine-specific paths in committed files.
- Conventional commits, no AI co-authorship trailers.
