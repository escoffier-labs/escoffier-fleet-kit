# Escoffier Labs Web Design System

Canonical aesthetic reference for all Escoffier Labs websites (brigade.tools,
the agentpantry site, and any future project site). Copy this file into each
site repo and keep it in sync; brigade-site is the reference implementation.

## Identity: the ledger and the receipt

Two surfaces carry the whole brand:

- **The ledger** is the page itself: dark ink ground, amber accent, quiet
  hairlines, mono labels. It reads like a well-kept book of record. This is
  the default surface and most sections live on it.
- **The receipt** is the artifact: cream paper, ink text, slight tilt, real
  file formats. Paper artifacts are evidence, so they only appear when the
  section is literally about an artifact (a handoff, a card, a receipt, a
  ticket, a certificate).

The kitchen is the vocabulary (brigade, stations, the pass, 86'd, mise en
place), not the decoration. Say it in copy freely; show it sparingly.

## The prop budget

Kitchen-themed visuals are rationed. A page gets at most three or four paper
or kitchen props total, each tied to a concept it genuinely explains:

- index cards for file-format examples
- ticket rail for a review queue
- inspection placard for readiness evidence
- 86 board for hard boundaries

Engineer-facing sections (capability grids, command references, harness
matrices) always stay on the plain ledger. If every section has a prop, none
of them land. When in doubt, leave it on the ledger.

## Tokens

Defined as CSS variables in `src/styles/global.css`. Never hardcode these
values in components; the two themes depend on the variables.

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `--bg` | `#0d1014` | `#f5f2ea` | page ground |
| `--bg-panel` | `#11161c` | `#fffdf8` | cards, nodes |
| `--bg-panel-2` | `#0f1318` | `#f0ece1` | alternating section bands |
| `--text` | `#dde3ea` | `#1d1a14` | body text |
| `--text-muted` | `#9aa4b2` | `#5c5448` | secondary text |
| `--text-dim` | `#7d8590` | `#857b6c` | captions, footers |
| `--accent` | `#e0a45c` | `#a8703a` | the amber; links, kickers, pipes |
| `--hairline` | `#1e242c` | `#ddd5c4` | borders |
| `--hairline-strong` | `#2a323d` | `#c9bfa9` | emphasized borders |
| `--term-bg` | `#0f1318` | `#fffdf8` | terminal panels |
| `--receipt-paper` | `#f5f2ea` | `#ffffff` | paper artifacts |
| `--receipt-ink` | `#1d1a14` | same | text on paper |
| `--receipt-dim` | `#8a7c64` | same | secondary text on paper |
| `--receipt-rule` | `#b9b2a4` | `#d8d2c4` | dashed rules on paper |
| `--on-accent` | `#0d1014` | `#f5f2ea` | text on amber buttons |

Ink-stamp colors (used on paper only, never on the ledger):

- green ink `#4e7247` for pass / promote / filed
- amber ink `#a8703a` for defer / caution
- red ink `#b03a2a` for needs-review / dupe / redaction

## Typography

- **Display**: Inter Variable, weight 700, `letter-spacing: -0.03em`
  (`.font-display`). Headlines only.
- **Mono**: IBM Plex Mono 400/500/600 (`.font-mono`). Labels, file paths,
  code, captions, kickers, anything machine-flavored.
- **Handwriting**: Caveat 600. ONLY on paper/chalk artifacts (card titles,
  86-board items). Never in body copy, headlines, or UI.

## Section conventions

- Every homepage section starts with a kicker:
  `[ NN · SECTION NAME ]` in `.kicker` (mono, uppercase, amber, centered).
  Numbering is sequential down the page; renumber when inserting.
- Sections alternate `--bg` and `--bg-panel-2` bands, separated by a
  `border-t` hairline.
- Centered `h2.font-display` headline, then a `--text-muted` standfirst
  capped at `max-w-2xl`.
- Footer captions in mono `--text-dim`, sometimes with
  `tracking-[0.15em]` and `·` separators.

## Shared primitives

- **Flowchart** (`.flowchart`, `.flow-node`, `.flow-pipe`): vertical node
  chain with an animated amber pulse traveling each pipe. `gate` nodes are
  dashed amber (manual approval), `end` nodes solid amber. Defined globally
  in `global.css`.
- **Paper artifacts**: cream `--receipt-paper`, slight rotation (0.6 to
  2.2 deg, alternate signs across a row), heavy soft shadow, straighten on
  hover. Tape strips or clips attach them to the page. See
  `RecipeCard.astro` (index card), `LocalLoop.astro` (ticket rail),
  `ContentGuard.astro` (placard), `Boundaries.astro` (86 board).
- **Stamps**: mono uppercase, letterspaced, `border: 2px double
  currentColor`, rotated a few degrees, `mix-blend-mode: multiply`, a
  radial-gradient mask for the worn-ink look.
- **Index card anatomy**: Caveat title plus mono filename on the header
  row, a red top rule (`rgba(186,74,56,.55)` double line), faint blue rule
  lines every 22px matched to an 11px/22px mono `pre`.

## Motion rules

- CSS-only. One subtle idle animation per page maximum (the flow pulse).
- Hover states may translate or straighten; keep transitions near 0.25s.
- Every animation and hover transform gets a
  `@media (prefers-reduced-motion: reduce)` fallback that freezes it.

## Accessibility (WCAG AA, verified by Lighthouse)

The fleet holds Lighthouse accessibility at 100. Keep it there:

- **Light-theme contrast.** On the cream ground the accent and dim text must
  clear 4.5:1. Compliant values, already in every `global.css`: light
  `--accent: #925f2b`, light `--text-dim: #736a5c`, `--receipt-dim: #75694f`.
  Do not revert to the old `#a8703a` / `#857b6c` / `#8a7c64` (all ~3.7:1).
- **Headings descend.** Page is one `h1` (hero), then each section opens with
  an `h2` (the kicker label is the `h2` on skeleton sites: `<h2 class="kicker
  m-0">`), then cards use `h3`. Never skip a level.
- **Links are not color-only.** Inline accent-colored text links carry an
  underline. The global rule `a[style*="color: var(--accent)"]` handles it;
  accent-background buttons use `color: var(--on-accent)` so they are exempt.
- **ARIA lists are real lists.** A `role="list"` must contain only
  `role="listitem"` children; prefer a native `<ul>` with `aria-label` over
  faking it on a wrapper `<div>`.
- Decorative artifact text gets `aria-hidden="true"`; every meaningful image
  or icon-only control has a label.

## Content rules

- Artifact examples show REAL formats from the product, pinned by tests so
  they cannot drift (see `recipe-cards.test.ts`). Never invent a format for
  looks.
- Never render a plausible secret, token, or private hostname, even a fake
  one. Redact visually instead (red ink bar).
- No em dashes in site copy. Use commas, periods, or a spaced hyphen.
- No personal hostnames, private IPs, or account identifiers anywhere.
  RFC 5737 addresses (`192.0.2.x`) if an IP example is unavoidable.

## Stack

Astro + Tailwind 4 (vite plugin), fonts via Fontsource
(`@fontsource-variable/inter`, `@fontsource/ibm-plex-mono`,
`@fontsource/caveat`), vitest for content-contract tests, deployed on
Vercel. Components are `.astro` files with scoped styles; shared primitives
live in `global.css`.
