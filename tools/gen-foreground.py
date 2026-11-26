#!/usr/bin/env python3
"""
Painted foreground clumps (dry grass, mud clods, debris) that overlap unit feet in the battle scene (docs/blend.md).

    python3 tools/gen-foreground.py [--force]

One Gemini image (key read at runtime from ~/solSoccer/.env ALT=, never printed) of separate clumps on flat magenta
-> tools/.src/fg-tufts.png -> keyed, split into connected clumps -> art/fg-tufts.webp (atlas) + art/fg-tufts.json
"""
import importlib.util, json, pathlib, sys
import numpy as np, cv2
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('genart', ROOT / 'tools' / 'gen-art.py'); G = importlib.util.module_from_spec(spec); spec.loader.exec_module(G)

PROMPT = (G.STYLE +
  'A game asset sheet: eight to ten SEPARATE small clumps of battlefield foreground, arranged in two loose rows with clear empty space between every clump. '
  'Each clump is a low, wide tuft of dead dry grass and reeds growing out of a lump of churned mud, some with a broken plank, a bent rebar, '
  'a rusted shell casing or a scrap of barbed wire. Side-on view at ground level, flat bottoms. Painted with loaded, dragged, directional brushstrokes, '
  'dark and muted: burnt umber, carbon black, military olive, raw umber, a few dirty khaki highlight strokes on the grass tips. '
  'Like the dark foreground grass of a gestural oil painting of a muddy no-man\'s-land.' + G.chroma('m') + G.NOTXT)


def main():
    raw = G.SRC / 'fg-tufts.png'
    if '--force' in sys.argv or not raw.exists():
        key = G.env('~/solSoccer/.env', 'ALT')
        G.gen('fg-tufts', {'prompt': PROMPT, 'ar': '16:9'}, key)
    im = Image.open(raw).convert('RGB')
    keyed = G.key_out(im, 'm')
    a = np.asarray(keyed.getchannel('A'))
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate((a > 30).astype(np.uint8), np.ones((9, 9), np.uint8)))
    clumps = []
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < 1500 or w < 40: continue
        m = (lab[y:y + h, x:x + w] == i)
        c = np.asarray(keyed.crop((x, y, x + w, y + h))).copy(); c[..., 3] = np.where(m, c[..., 3], 0)
        clumps.append(Image.fromarray(c))
    # scale so the tallest clump is ~110 px, pack on rows
    s = min(1.0, 110 / max(c.height for c in clumps))
    clumps = [c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS) for c in clumps]
    W = 1024; x = y = rowh = 0; frames = []
    for c in clumps:
        if x + c.width > W: x, y, rowh = 0, y + rowh + 2, 0
        frames.append([x, y, c.width, c.height]); x += c.width + 2; rowh = max(rowh, c.height)
    atlas = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for c, (fx, fy, _, _) in zip(clumps, frames): atlas.alpha_composite(c, (fx, fy))
    atlas.save(ROOT / 'art' / 'fg-tufts.webp', quality=84, method=6)
    (ROOT / 'art' / 'fg-tufts.json').write_text(json.dumps({'frames': frames}))
    print('fg-tufts:', len(frames), 'clumps, atlas', atlas.size)


if __name__ == '__main__':
    main()
