# Fleet diagrams

One generator so every Escoffier Labs flow diagram shares the brigade.tools /
escoffierlabs.dev visual language instead of drifting per render.

## Why this exists

Diagrams kept getting redrawn by hand with fallback fonts, chunky orange boxes,
and pill labels that did not match the sites. This encodes the real house style
once: the tokens come straight from `brigade-site/src/styles/global.css`, and the
fonts (Inter + IBM Plex Mono) are vendored under `fonts/` so the tool is
self-contained.

## The house language

- **Inter** for display text: heavy weight, tight tracking, the last title line
  in amber (like the site heroes).
- **IBM Plex Mono** for every label: uppercase, letter-spaced, amber.
- **Nodes are subtle** (panel fill `#11161c` + faint hairline). Only *key* nodes
  get an amber border, mirroring the canonical-source box on the Brigade hero.
- **Connectors are thin amber lines that fan from a point**, with small crisp
  auto-oriented arrowheads. No pills. No chunky boxes.
- **Stat / list rows are plain mono** with middots, not chips.
- **Receipt**: cream paper, dashed rules, slight tilt.

## Render

```bash
python3 escoffier_diagram.py brigade-run.html
google-chrome --headless=new --force-device-scale-factor=2 \
  --window-size=1600,900 --screenshot=brigade-run.png "file://$PWD/brigade-run.html"
```

`--force-device-scale-factor=2` yields a 3200x1800 PNG. Any Chromium works
(`chromium`, `google-chrome`).

## Make a new diagram

Copy `build_brigade_run()` in `escoffier_diagram.py`, rename it, and change the
content. The `BRAND` tokens and the `Canvas` primitives (`txt`, `node`, `line`,
`receipt`) stay put, so a new diagram is just node placement plus a few `line()`
calls. Keep key nodes to the ones that matter (usually the planner and the
output) and let the rest stay subtle.
