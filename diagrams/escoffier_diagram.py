#!/usr/bin/env python3
"""
Escoffier Labs house diagram generator.

One engine for the fleet's flow diagrams so they all share the brigade.tools /
escoffierlabs.dev visual language instead of drifting per render. Emits a
self-contained HTML file; rasterize it with headless Chrome at 2x.

Design language (pulled from the live sites, encoded once here):
  - Inter for display: heavy weight, tight tracking, last title line in amber.
  - IBM Plex Mono for every label: uppercase, letter-spaced, amber.
  - Nodes are SUBTLE (panel fill + faint hairline). Only KEY nodes get an amber
    border, mirroring the canonical-source box on the Brigade hero.
  - Connectors are THIN amber lines that fan from a point, with small crisp
    auto-oriented arrowheads. No pills, no chunky boxes.
  - Stat / list rows are plain mono with middots, not chips.
  - Cream receipt, dashed rules, slight tilt.

Tokens are copied from brigade-site/src/styles/global.css (dark theme). Fonts are
vendored under ./fonts so the tool is self-contained.

Usage:
  python3 escoffier_diagram.py [out.html]
  google-chrome --headless=new --force-device-scale-factor=2 \
    --window-size=1600,900 --screenshot=out.png "file://$PWD/out.html"

To make a new diagram, copy build_brigade_run() and change the content. The
BRAND block and the txt/node/line/receipt primitives stay put.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")

# --- brand tokens (brigade-site/src/styles/global.css, dark theme) ---
BG = "#0d1014"; PANEL = "#11161c"; TEXT = "#dde3ea"; MUT = "#9aa4b2"; DIM = "#7d8590"
ACC = "#e0a45c"; HAIR = "#232a33"
PAPER = "#f4f1e8"; INK = "#22201a"; RRULE = "#c3bca9"; RDIM = "#8a7f66"


def _esc(s):
    return s.replace("&", "&amp;")


class Canvas:
    """A 1600x900 SVG canvas with the house primitives."""

    def __init__(self, w=1600, h=900):
        self.w, self.h = w, h
        self.body = []

    def txt(self, x, y, s, size, fill, anchor="middle", weight="400", ls=0, mono=False):
        a = f' text-anchor="{anchor}"' if anchor else ""
        l = f' letter-spacing="{ls}"' if ls else ""
        cls = "m" if mono else "d"
        self.body.append(
            f'<text x="{x}" y="{y}"{a} class="{cls}" font-size="{size}" '
            f'font-weight="{weight}"{l} fill="{fill}">{_esc(s)}</text>'
        )

    def node(self, x, y, w, h, key=False):
        self.body.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{12 if key else 10}" '
            f'fill="{PANEL}" stroke="{ACC if key else HAIR}" stroke-width="{1.5 if key else 1}"/>'
        )

    def line(self, x1, y1, x2, y2):
        self.body.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{ACC}" stroke-width="1.5" marker-end="url(#a)"/>'
        )

    def raw(self, s):
        self.body.append(s)

    def receipt(self, x, y, w, h, head, rows, foot, tilt=1.3):
        cx, cy = x + w / 2, y + h / 2
        self.raw(f'<g transform="rotate({tilt} {cx} {cy})">')
        self.raw(
            f'<path d="M{x} {y} L{x + w - 22} {y} L{x + w} {y + 22} L{x + w} {y + h} '
            f'L{x} {y + h} Z" fill="{PAPER}" stroke="#d8d2c2" stroke-width="1.2"/>'
        )
        self.raw(f'<path d="M{x + w - 22} {y} L{x + w} {y + 22} L{x + w - 22} {y + 22} Z" fill="#ddd6c4"/>')
        self.txt(cx, y + 34, head, 14, INK, weight="600", ls=1, mono=True)
        self.raw(f'<line x1="{x + 20}" y1="{y + 48}" x2="{x + w - 20}" y2="{y + 48}" stroke="{RRULE}" stroke-dasharray="4 4"/>')
        for i, (k, v) in enumerate(rows):
            self.txt(x + 22, y + 76 + i * 22, k, 14, INK, anchor="start", mono=True)
            self.txt(x + w - 22, y + 76 + i * 22, v, 14, RDIM, anchor="end", mono=True)
        self.raw(f'<line x1="{x + 20}" y1="{y + h - 30}" x2="{x + w - 20}" y2="{y + h - 30}" stroke="{RRULE}" stroke-dasharray="4 4"/>')
        self.txt(cx, y + h - 12, foot, 11, RDIM, weight="600", ls=1, mono=True)
        self.raw("</g>")

    def html(self):
        face = (
            f"@font-face{{font-family:'Inter';src:url('file://{FONTS}/inter-latin-wght-normal.woff2') format('woff2');font-weight:100 900;}}"
            + "".join(
                f"@font-face{{font-family:'IPM';src:url('file://{FONTS}/ibm-plex-mono-latin-{w}-normal.woff2') format('woff2');font-weight:{w};}}"
                for w in (400, 500, 600)
            )
        )
        return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
{face}
html,body{{margin:0;background:{BG};}} text{{-webkit-font-smoothing:antialiased;}}
.d{{font-family:'Inter',sans-serif;}} .m{{font-family:'IPM',monospace;}}
</style></head><body>
<svg width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" xmlns="http://www.w3.org/2000/svg">
<defs>
 <radialGradient id="g" cx="30%" cy="30%" r="65%">
  <stop offset="0%" stop-color="{ACC}" stop-opacity="0.08"/><stop offset="70%" stop-color="{ACC}" stop-opacity="0"/>
 </radialGradient>
 <marker id="a" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10.5" refY="6" orient="auto">
  <path d="M0.5,1.5 L11,6 L0.5,10.5 Z" fill="{ACC}"/>
 </marker>
</defs>
<rect width="{self.w}" height="{self.h}" fill="{BG}"/><rect width="{self.w}" height="{self.h}" fill="url(#g)"/>
{chr(10).join(self.body)}
</svg></body></html>"""


def build_brigade_run():
    """The 'brigade run' diagram. Copy this to author a new fleet diagram."""
    c = Canvas()
    # header
    c.txt(64, 76, "[ BRIGADE RUN · YOUR ROSTER, YOUR MODELS ]", 16, ACC, anchor="start", weight="600", ls=2.3, mono=True)
    c.txt(62, 150, "Pick the roster.", 48, TEXT, anchor="start", weight="800", ls=-1.4)
    c.txt(62, 206, "Pin any model.", 48, TEXT, anchor="start", weight="800", ls=-1.4)
    c.txt(62, 262, "Keep the receipts.", 48, ACC, anchor="start", weight="800", ls=-1.4)
    c.txt(64, 306, "You choose who plans, who works, who reviews, and pin a model on each role.", 20, MUT, anchor="start")
    c.txt(64, 333, "The models below are one example roster. Swap any box for a CLI you already run.", 17, DIM, anchor="start")

    CY = 594
    c.line(274, CY, 356, CY)
    for wy in (500, CY, 688):
        c.line(584, CY, 676, wy)
    for wy in (500, CY, 688):
        c.line(960, wy, 1052, CY)
    c.line(1276, CY, 1336, CY)

    c.node(64, CY - 60, 210, 120)
    c.txt(169, CY - 18, "task + roster", 21, TEXT, weight="700")
    c.txt(169, CY + 12, "models · roles", 15, MUT, mono=True)
    c.txt(169, CY + 36, "timeouts", 15, MUT, mono=True)

    c.node(360, CY - 76, 224, 152, key=True)
    c.txt(472, CY - 40, "ORCHESTRATOR", 14, ACC, weight="600", ls=1.5, mono=True)
    c.txt(472, CY + 2, "Fable", 29, ACC, weight="800", ls=-0.6)
    c.txt(472, CY + 36, "plans · routes workers", 14, MUT, mono=True)

    c.txt(820, 446, "PARALLEL WORKERS", 14, ACC, weight="600", ls=2.4, mono=True)
    for wy, role, model in [(500, "research pass", "e.g. Composer 2.5"), (CY, "code + tests", "e.g. GPT 5.5"), (688, "review pass", "e.g. GPT 5.5 or Composer")]:
        c.node(676, wy - 34, 284, 68)
        c.txt(818, wy - 4, role, 20, TEXT, weight="700")
        c.txt(818, wy + 21, model, 15, ACC, weight="500", mono=True)

    c.node(1052, CY - 76, 224, 152, key=True)
    c.txt(1164, CY - 40, "SYNTHESIS", 14, ACC, weight="600", ls=1.5, mono=True)
    c.txt(1164, CY + 2, "Fable", 29, ACC, weight="800", ls=-0.6)
    c.txt(1164, CY + 36, "merges · explains outcome", 14, MUT, mono=True)

    c.receipt(1338, CY - 96, 214, 192, "·· BRIGADE RECEIPT ··",
              [("artifacts", "ok"), ("changes.patch", "ok"), ("handoff", "ok"), ("logs", "ok")],
              "NOTHING LEFT THE MACHINE")

    c.txt(64, 808, "PIN A MODEL PER CLI", 14, ACC, anchor="start", weight="600", ls=2, mono=True)
    c.txt(64, 842, "claude · codex · grok · opencode · pi · kimi · cursor · antigravity   ·   + local ollama",
          18, MUT, anchor="start", ls=0.3, mono=True)
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "brigade-run.html")
    with open(out, "w") as f:
        f.write(build_brigade_run().html())
    print("wrote", out)
