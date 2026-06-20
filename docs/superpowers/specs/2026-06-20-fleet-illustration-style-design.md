# Fleet Illustration & Image Style (design spec)

Status: draft for review
Date: 2026-06-20
Scope: all Escoffier Labs / agent-tool repos that ship a social og-card and/or a
README banner image. Companion to `DESIGN.md` (the web design system). Once
approved this graduates into a canonical `ILLUSTRATION.md` next to `DESIGN.md`.

## Problem

Two image families ship across the fleet and they do not look related:

1. **og-cards** (`*-site/public/og-card.png`): code-rendered from one HTML
   template via `escoffier-fleet-kit/og/`. Crisp, perfectly consistent,
   on-brand. No issues.
2. **README / repo banners** (`docs/assets/*-banner.jpg`): freeform
   AI-generated watercolor. No spec, no frozen reference, wide quality
   variance, and a spreading "hexagonal / honeycomb" texture artifact.

Goal: make both families read as one brand, fix the hex artifact at the root,
and do it without branding the whole fleet as an OpenClaw product.

## Root cause of the hexagonal pattern

It is reference-chain feedback contamination, not a prompt typo:

- Real watercolor granulation (cauliflower bleed) is a clustered-blob texture.
  That is the seed.
- Reusing generated banners as **image/style references** made the model latch
  onto that high-frequency texture as an intentional style cue, and fuse it with
  any **literal background grid** in the scene (machine walls, brick, node
  meshes, glowing-dot piles) into a single "tiled cell" feature. The model
  regularizes tiling toward hexagons because hex packing is the cheapest plane
  fill.
- Each generation that ingested a contaminated reference amplified it (a
  feedback loop with gain > 1). That is why it "got worse."

Evidence: hex severity tracks scene **density and darkness**, not the watercolor
medium. Worst offenders are the cramped dark dioramas (`n8n-ops`, `postiz`).
The clean images (`jellyfin-mcp`, `usage-tracker`, `tokenjuice`, all og-cards)
have open space and no rendered grids.

## Core principle

**The unifying constant is the kitchen frame, not the animal.**

- The brand is carried by palette + type + kicker grammar + watercolor
  treatment. That is harness-agnostic by construction: a kitchen is not a
  harness.
- The mascot/character is **per-project and variable**. Variety reads as "a
  studio with a house style," not "OpenClaw's mascot on everything." This
  protects the harness-agnostic positioning (the lobster is OpenClaw's mascot;
  it must not become the universal fleet mascot).

## Shared brand DNA (identical across og-cards and banners)

Sourced from `DESIGN.md`. Never hardcode new values; reuse these.

- **Palette:** dark ink ground `#0d1014`, amber accent `#e0a45c`, cream paper
  `#f5f2ea`, slate-navy ink for linework. Two accents maximum per image (the
  amber plus at most one cool accent: teal/cyan or electric violet, chosen by
  tool category).
- **Type:** Inter (display, 700, `-0.03em`), IBM Plex Mono (labels/kickers),
  Caveat (paper artifacts only).
- **Kicker:** `[ NN · PROJECT · CATEGORY ]`, mono, uppercase, amber, letterspaced.
  Top-left on banners; top of card on og-cards.
- **Treatment:** loose watercolor, real soft-edge bleed, generous negative space,
  one clear focal subject. Never an edge-to-edge diorama.

## The two artifacts

| | og-card (social, 1200x630 / 2400x1260) | README banner (~2048x877) |
|---|---|---|
| Renderer | code (HTML to PNG), unchanged | watercolor, anchored on frozen set |
| Layout | text-led: kicker + headline + cream menu-card | character-led: one mascot in the frame + kicker |
| Constant | palette, type, kicker grammar | same |

An og-card and its banner should look like they came from the same kitchen
without being the same thing.

### og-card spec
No change to the existing pipeline. It is the gold standard for the typographic
sub-family. Keep it template-rendered (never AI-generated): that is exactly why
it never drifts and never grows hex.

### README banner spec
- One clear focal character occupying ~40-55% of frame, off-center, doing one
  legible task tied to the tool.
- At least ~30% of the frame is near-empty paper or quiet wash.
- Background is a flat paper or single soft wash. **No** rendered grids: no
  machine walls, panel arrays, brickwork, city grids, or dense node/dot fields.
- Kicker top-left in the shared grammar; clear space for it.
- Must read at 280px thumbnail width.

## Mascot policy (decision: keep mascots everywhere, per-project and apt)

- Each project keeps its own apt character. The character earns its place by a
  real connection to the tool. Confirmed intentional and correct:
  - `code-search` -> **llama** (runs on ollama)
  - `vervet` -> **vervet monkey** (the project is named for it)
  - `agentpantry` -> **lobster chef** checking the pantry
  - `usage-tracker` -> bookkeeper lobster with scales
  - `jellyfin-mcp` -> lobster in headphones
- The lobster/crab is used **where it is apt** (kitchen-y tools, OpenClaw-specific
  tools), not as a default. Do not make every banner a crustacean.
- Mascots are a rendering-quality bar, not a concept ban. The failures so far are
  execution: the lobster reads as a rodent (`agentpantry`) or an ant (`n8n-ops`)
  because the painting is muddy. Fix the rendering, keep the concept.
- A character is optional only when no apt one exists (e.g. pure flatlay tools);
  those lean on the frame + a clear hero object instead of a forced mascot.

## Anti-hex generation pipeline (the actual fix)

Production path: **GPT Image 2** (OpenAI), driven via **Codex CLI** or
**OpenClaw** native image generation. GPT Image 2 is prompt-driven with optional
image *inputs*; it has no Midjourney/SDXL-style numeric style-weight slider, no
dedicated negative-prompt field, and (as of its current API) no seed for
reproducibility. The recipe below adapts the anti-hex strategy to that reality.
Verify exact API capabilities (seed, multi-image input, edit vs. generate
endpoint) when wiring, and pin whatever the model actually supports.

1. **Frozen reference set, immutable:** `jellyfin-mcp-banner`,
   `usage-tracker-banner`, `tokenjuice` source. A shipped banner MUST NOT
   re-enter the reference pool. Store under a read-only `refs/anchors-v1/` and
   checksum it.
2. **Style in TEXT, references used sparingly.** With no style-weight slider, the
   safest control is to describe the watercolor look in words ("loose wet-on-wet
   washes, soft feathered edges, bare cream paper, slate-navy ink linework") and
   pass at most ONE clean frozen anchor as an image input, or none. Never pass
   multiple references or a recent output: that is how pixel-level texture
   (the granulation that becomes honeycomb) gets copied.
3. **Fold exclusions into the prompt (no negative field).** End every prompt
   with an explicit exclusion clause; GPT Image 2 honors natural-language
   negation reasonably well: "Flat open background of bare cream paper. No
   honeycomb, no hexagonal or tiled pattern, no repeating cells, no mosaic or
   mesh, no brickwork, no mechanical panels, no dense dotted grid, no
   barnacle/lichen speckle. Not over-rendered digital painting."
4. **Ban literal background grids in the brief:** backgrounds are open washes.
   If a diagram is needed, draw a few large loose hand-inked nodes, never a
   dense field of identical small cells.
5. **Thumbnail + legibility gate before accept:** view at 280px; reject if any
   repeating cell texture is visible, if watercolor fidelity is low (muddy
   digital paint), or if the creature is not instantly identifiable. On reject,
   regenerate from the frozen anchors. Never "fix" by feeding the bad output back
   in.
6. **Provenance note per banner:** model + version, the exact prompt, and which
   frozen anchor (if any) was used as input. Seed is likely unavailable, so
   prompt + reference discipline is the reproducibility story. Log it next to the
   asset (a sidecar `<banner>.prompt.txt` or a fleet manifest entry).
7. **Grain in post, not in the model:** if paper grain is wanted, overlay it at
   low opacity as a post step. The model cannot add texture without trying to
   tile it.

## Per-repo rollout plan

Keep (already on-target, no work):
- `jellyfin-mcp`, `usage-tracker`, the four typographic og-cards
  (`escoffier-site`, `skillet-site`, `cloche-site`, `miseledger-site` and the
  rest of the og-card family), and the cleanest light flatlays: `wazuh-mcp`,
  `misp-mcp`.

Re-render, same concept (execution was muddy or hex-wrecked):
- `n8n-ops` (lobster must read as a lobster; kill the honeycomb wall)
- `agentpantry` (lobster chef legible; drop the 3-panel comic format)
- `postiz` (de-mud, remove tiled panel wall)
- `watchtower` (give it a clear hero; lose the generic sci-fi network)
- `hotwash` (de-mud the parchment, keep the war-room lobster)
- `content-guard` (de-mud the dark letterpress scene; keep the inspector crab)
- `code-search` (keep the llama, bring it into the shared frame)

Re-render to match the family (concept fine, medium off):
- `vervet` (monkeys correct, but re-paint in watercolor instead of flat cartoon)

Light-fix candidates (clean overall but a hex/blob texture to clear):
- `maltego-mcp` (drop the literal hex icon + clustered map washes)
- `cortex-mcp` (clear the honeycomb in the lower chip tiles)
- `zeek-mcp` (calm the clustered-blob map wash; give it a clearer anchor)
- `prompt-library` (slightly declutter; keep the card-catalog lobster)

## Non-goals

- Not rebranding the kitchen-brigade theme or the `DESIGN.md` tokens.
- Not forcing a single mascot species.
- Not converting og-cards to AI watercolor (keeps text crisp and consistent).

## Decisions locked

- **Generator:** GPT Image 2 (OpenAI), driven via Codex CLI or OpenClaw native
  image generation. Recipe adapted above for the no-slider / no-negative-field /
  no-seed reality.
- **Mascot model:** keep mascots everywhere, per-project and apt (option A).

## Open questions

- Do we want a small script in `escoffier-fleet-kit` (sibling to `og/render.mjs`)
  that wraps the GPT Image 2 call: takes a project brief, injects the standing
  exclusion clause + style language, attaches the chosen frozen anchor, and
  writes the banner plus a provenance sidecar? This would standardize banners the
  way `og/render.mjs` standardizes cards.
- Verify GPT Image 2 specifics when wiring: does the current API expose a seed,
  how many image inputs it accepts, and edit-endpoint vs. generate-endpoint
  behavior for reference conditioning. Pin the recipe to what it actually
  supports.
