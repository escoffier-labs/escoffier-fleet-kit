#!/usr/bin/env python3
"""Strip flat letterbox bands from fleet banners and normalize to a uniform 21:9 frame.

Per image: detect top/bottom flat bands, crop to the target aspect anchored at the
top-left, resize to exactly TARGET_W x TARGET_H, save JPEG. Originals are read-only;
output goes to a separate path so results can be reviewed before replacing.

The crop is anchored top-left because the amber `[ NAME . STATION ]` kicker lives in
that corner. A centered crop trims both edges and eats the opening bracket.

Usage: crop-bands.py OUT_DIR IMG [IMG ...]
"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

TARGET_W, TARGET_H = 2048, 878          # 21:9-ish, even height
TARGET_AR = TARGET_W / TARGET_H
ASPECT_TOL = 0.01                       # relative; within this the frame is already 21:9

def plan_crop(w, h, top, bot, target_ar=TARGET_AR, tol=ASPECT_TOL):
    """Box (left, upper, right, lower) to take from a raw render. Pure geometry, no PIL.

    gpt-image-2 returns ~1915x821, which is already 21:9 within tolerance, but band
    detection still reports a thin top band on it. Stripping that band makes the frame
    too wide, and the width crop that follows would clip the kicker. So: if the raw
    frame is already at target aspect, take it whole and let the resize do the work.
    Otherwise strip the detected bands and trim the overhang off the right or bottom
    only, never off the left or top.
    """
    if abs(w / h - target_ar) / target_ar <= tol:
        return (0, 0, w, h)
    cw, ch = w, h - top - bot
    ar = cw / ch
    if ar > target_ar:           # too wide -> trim width off the right
        cw = round(ch * target_ar)
    elif ar < target_ar:         # too tall -> trim height off the bottom
        ch = round(cw / target_ar)
    return (0, top, cw, top + ch)

def process(path, out_path):
    from PIL import Image
    from analyze_bands import detect_bands
    w, h, top, bot, _ch, _band = detect_bands(path)
    box = plan_crop(w, h, top, bot)
    im = Image.open(path).convert('RGB')
    out = im.crop(box).resize((TARGET_W, TARGET_H), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, 'JPEG', quality=92)
    kept = 'whole frame' if box == (0, 0, w, h) else f'strip(t{top},b{bot}) crop{box}'
    print(f'{os.path.basename(path):42s} {w}x{h} -> {kept} -> {TARGET_W}x{TARGET_H}  {out_path}')

if __name__ == '__main__':
    out_dir = sys.argv[1]
    for p in sys.argv[2:]:
        process(p, os.path.join(out_dir, os.path.basename(p)))
