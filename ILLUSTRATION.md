# Escoffier Labs Illustration & Image Style

Canonical reference for the fleet's images. Companion to `DESIGN.md` (the web
design system). Source of truth for constants is `banner/style.json`; this doc
explains the intent.

## Principle: the frame is the constant, the animal is the variable

Brand cohesion comes from the kitchen frame (palette, type, kicker grammar,
loose-watercolor treatment), not from any one mascot. Mascots are per-project
and apt. This keeps the fleet harness-agnostic: the lobster is OpenClaw's
mascot and must not become the universal fleet mascot.

## Shared brand DNA

- Palette (from `DESIGN.md`): ink `#0d1014`, amber `#e0a45c`, cream `#f5f2ea`,
  slate-navy ink `#1d2733`. Two accents maximum per image.
- Type: Inter (display), IBM Plex Mono (kickers/labels), Caveat (paper only).
- Kicker: `[ NN · PROJECT · CATEGORY ]`, amber mono caps, top-left.

## Two artifacts, one DNA

- og-card: code-rendered (`og/render.mjs`, HTML to PNG). Text-led. Never
  AI-generated. This is why it never drifts.
- README banner: GPT Image 2 watercolor. Character-led, one mascot in the
  frame, open wash background. Built via `banner/`.

## Why banners used to drift (the hexagonal pattern)

Reusing generated banners as image references made the model latch onto
watercolor granulation plus literal background grids (machine walls, node
meshes) as one tiled-cell feature and regularize it toward honeycomb, worse
each generation. The fix is the frozen anchor set plus the exclusion clause.

## Generating a banner

1. `npm run banner -- <slug>` (prints the prompt, writes a `.prompt.txt`
   provenance sidecar next to the target banner).
2. Feed that prompt to GPT Image 2 via Codex or OpenClaw, attaching exactly one
   frozen anchor from `banner/anchors-v1/` (`banner/briefs.json` says which).
3. Gate at 280px: reject any repeating cell texture, muddy digital paint, or an
   unidentifiable subject. On reject, regenerate from the anchor, never from the
   bad output.
4. Replace the repo's banner and commit it there.

See `banner/ROLLOUT.md` for the current queue and `banner/anchors-v1/README.md`
for the immutability rule.
