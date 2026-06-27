#!/usr/bin/env python3
"""Detect flat letterbox bands (top/bottom) on a banner. Read-only analysis."""
import sys
from PIL import Image

def detect_bands(path, flat_std=3.0, color_tol=6):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    # sample columns across width for speed
    xs = range(0, w, max(1, w // 64))
    def row_stats(y):
        vals = [px[x, y] for x in xs]
        n = len(vals)
        means = [sum(v[c] for v in vals) / n for c in range(3)]
        var = sum(max(abs(v[c] - means[c]) for c in range(3)) for v in vals) / n
        return means, var
    corner, _ = row_stats(0)
    def is_band(y):
        means, var = row_stats(y)
        flat = var < flat_std
        close = max(abs(means[c] - corner[c]) for c in range(3)) < color_tol
        return flat and close
    top = 0
    while top < h and is_band(top):
        top += 1
    bot = h
    botcorner, _ = row_stats(h - 1)
    def is_band_bot(y):
        means, var = row_stats(y)
        return var < flat_std and max(abs(means[c] - botcorner[c]) for c in range(3)) < color_tol
    while bot > top and is_band_bot(bot - 1):
        bot -= 1
    return w, h, top, h - bot, bot - top, tuple(round(c) for c in corner)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            w, h, t, b, ch, col = detect_bands(p)
            ar = round(w / ch, 3) if ch else 0
            print(f'{p.split("/")[-1]:42s} {w}x{h}  top={t:4d} bot={b:4d}  content={w}x{ch} ({ar}:1)  band={col}')
        except Exception as e:
            print(f'{p}  ERR {e}')
