# Security Policy

## Reporting a vulnerability

Report privately, not in a public issue:

- GitHub: **Security → Report a vulnerability** (private advisory) on this repo, or
- contact the maintainer privately via [@solomonneas](https://github.com/solomonneas)

escoffier-fleet-kit is an operator tool: it fast-forwards, regenerates, and
**commits and pushes** changes to the website fleet. The issues that matter most
are anything that could push wrong or unintended content, write outside the
configured site repos, or leak a token used by the publishing/CI steps. Include
the script and a synthetic `sites.config.json` that reproduces.

## Scope

In scope: the sync/render/publish scripts in `bin/`, the OG template and config,
and the CI workflows.

Out of scope: the individual `*-site` repos and the upstream tools whose versions
are synced (report to their own projects).

## Notes

The kit is review-gated where it matters: `bin/content-sync.mjs` drafts copy with
an LLM but never pushes it to a site's `main` - it opens a PR for a human to merge.
Routine version/OG/SEO sync is mechanical and idempotent; a no-op run pushes
nothing.
