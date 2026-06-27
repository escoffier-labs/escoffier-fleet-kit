#!/usr/bin/env python3
"""Strip flat letterbox bands from fleet banners and normalize to a uniform 21:9 frame.

Per image: detect top/bottom flat bands, crop them, center-crop the remainder to the
target aspect, resize to exactly TARGET_W x TARGET_H, save JPEG. Originals are read-only;
output goes to a separate path so results can be reviewed before replacing.

Usage: crop-bands.py OUT_DIR IMG [IMG ...]
"""
import sys, os
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_bands import detect_bands  # noqa: E402

TARGET_W, TARGET_H = 2048, 878          # 21:9-ish, even height
TARGET_AR = TARGET_W / TARGET_H

def process(path, out_path):
    w, h, top, bot, _ch, _band = detect_bands(path)
    im = Image.open(path).convert('RGB')
    # 1. strip detected bands
    content = im.crop((0, top, w, h - bot))
    cw, ch = content.size
    # 2. center-crop the longer axis to hit target aspect exactly
    ar = cw / ch
    if ar > TARGET_AR:           # too wide -> trim width
        new_w = round(ch * TARGET_AR)
        x0 = (cw - new_w) // 2
        content = content.crop((x0, 0, x0 + new_w, ch))
    elif ar < TARGET_AR:         # too tall -> trim height
        new_h = round(cw / TARGET_AR)
        y0 = (ch - new_h) // 2
        content = content.crop((0, y0, cw, y0 + new_h))
    # 3. normalize to exact dimensions
    out = content.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, 'JPEG', quality=92)
    print(f'{os.path.basename(path):42s} {w}x{h} -> strip(t{top},b{bot}) -> {TARGET_W}x{TARGET_H}  {out_path}')

if __name__ == '__main__':
    out_dir = sys.argv[1]
    for p in sys.argv[2:]:
        process(p, os.path.join(out_dir, os.path.basename(p)))
