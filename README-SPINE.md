# README Spine

The fleet contract for every public repo README. `DESIGN.md` owns the visual system and `ILLUSTRATION.md` owns the art; this file owns the README itself: section order, placement, and the conventions that keep two dozen repos reading like one shop.

The reference implementation is [`escoffier-labs/brigade`](https://github.com/escoffier-labs/brigade). When this document and a repo disagree, fix the repo; when this document and brigade disagree, fix this document.

## Why this exists

Adoption = user benefit + repeated promotion + visible trust. The README is the product page: a visitor decides in the first screen whether the tool is for them. Every section below either proves the tool works, tells the visitor whether it fits, or gets out of the way.

## Section order

Required sections, in this order. Feature sections in the middle are free-form; everything else keeps its slot.

| # | Section | Notes |
|---|---|---|
| 1 | Banner | `<p align="center"><img src="docs/assets/<name>-social-preview.jpg" width="900"></p>` |
| 2 | `<h1 align="center">Name</h1>` | Product name only, no tagline |
| 3 | Bold one-liner | `<p align="center"><strong>…</strong></p>` - one sentence: what it does, for whom, how it differs |
| 4 | Links line | `<p align="center">` Website · Docs · Quickstart anchor · Cookbook, `&middot;`-separated |
| 5 | Badges | shieldcn, see badge order below |
| 6 | Hook line | One short plain-prose sentence. Optional but encouraged. |
| 7 | Proof asset + caption | The tool visibly doing its headline job. See proof table. |
| 8 | `## What it does` | First 3 sentences carry WHAT / WHY / HOW-IT-DIFFERS. One paragraph, no bullets. |
| 9 | `## Install` | The install command(s) a reader actually runs. |
| 10 | `## Try it in 60 seconds` | Copy-paste block, verified against the published artifact, ending in visible output. |
| 11 | Feature sections | Free-form. Each major claim gets a real fenced output block or diagram. |
| 12 | `## Why not <alternatives>?` | Honest comparison, named alternatives, no straw men. |
| 13 | `## What <Name> is not` | Boundaries. What it refuses to do and why that is the point. |
| 14 | `## Why I built this` | Optional. The watercolor brand art lives here as a secondary image. |
| 15 | `## Docs` | Optional. Links into `docs/`. |
| 16 | `## License` | License + project identity line (org, site, registry, command). |

Heading case is sentence case with a leading capital: `## Install`, never `## install`.

## Proof, not decoration

The asset in slot 7 shows the tool doing the one thing the README promises. Setup, `--help`, and status output are not proof; the headline action is. Match the proof to the tool:

| Tool type | Proof |
|---|---|
| CLI | plating terminal SVG (`plating render <spec>`, spec lives in the [plating gallery](https://github.com/escoffier-labs/plating/tree/main/examples)) |
| Web UI | Real screenshot with sample data |
| Image tool | Before/after cards |
| MCP server | Inspector `tools/list` plus one real call with its result |
| Docs / skills repo | Catalog table, no image needed |

Every image proof gets a caption directly beneath it:

```html
<p align="center"><em>`command` does the thing and reports the result, in seconds.</em></p>
```

One line, naming the command and the outcome. Alt text on recordings starts with `Recording:` and describes what happens. Keep terminal recordings at or under 90 columns.

## Badges

shieldcn (`shieldcn.dev`), in this order: CI, registry version, language, license. `size=xs`. `img.shields.io` is retired fleet-wide.

```html
<img src="https://shieldcn.dev/github/ci/escoffier-labs/<name>.svg?workflow=ci.yml&branch=<default>&label=ci&size=xs" alt="CI status">
```

## Banner assets

- README banner: `docs/assets/<name>-social-preview.jpg`, 2048x878 (21:9), embedded at `width="900"`.
- The `-banner.jpg` naming is retired; rename on touch.
- Art follows `ILLUSTRATION.md`. The banner is identity, never the sole proof - slot 7 does that job.
- New banners come from the fleet-kit banner system (`banner/briefs.json` -> prompt -> crop) with a `.prompt.txt` provenance sidecar.

## Allowed deviations

| Repo | Deviation | Why |
|---|---|---|
| skillet, solos-cookbook | Catalog table instead of proof image | Docs/skills repos; the catalog is the product |
| cloche, mise-en-scene | Screenshot / before-after proof | UI and image tools, per the proof table |
| Forks (token-glace) | Adds `## What this fork changes` after What it does | Credit and delta belong up front |
| shortlist (pre-code) | Minimal status README | No runnable commands may be claimed before code exists |

Anything else that needs to deviate gets a row here first.

## Gates before merge

- CI: workflows carry `paths-ignore` for `docs/**`, `*.md`, `LICENSE`, `.gitignore` so docs changes do not burn Actions minutes.
- Leaks: content-guard on the README and every new asset; no home paths, usernames, hostnames, or private IPs anywhere, RFC 5737 IPs only in examples.
- Quickstart verified against the published artifact in a clean env, not the local checkout.
- Docs-only PRs: no CodeRabbit, no release. Releases happen on request only.
