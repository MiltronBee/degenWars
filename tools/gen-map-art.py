#!/usr/bin/env python3
"""
War Table (lab/map) painted textures.   python3 tools/gen-map-art.py [--force name,...]
Reuses gen() from tools/gen-art.py (key read at runtime from ~/solSoccer/.env ALT=, never printed).
Raw -> tools/.src/map-<name>.png ; assets -> lab/art/<name>.webp
"""
import importlib.util, pathlib, sys
import numpy as np
from PIL import Image, ImageOps, ImageFilter
ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('ga', ROOT / 'tools' / 'gen-art.py'); ga = importlib.util.module_from_spec(spec); spec.loader.exec_module(ga)
OUT = ROOT / 'lab' / 'art'; OUT.mkdir(parents=True, exist_ok=True)
S, N = ga.STYLE, ga.NOTXT
JOBS = {
 'table': dict(ar='1:1', w=1024, q=72, prompt=S + 'Straight top-down view of the surface of an old military war-room map table: dark oiled walnut planks, '
   'scratched and worn, faint water rings, scattered tobacco ash, a few dull brass tacks and the edge of a tarnished brass rail, warm lamplight pooling '
   'softly in the centre and falling off into deep umber shadow at the corners. Even texture, no objects in the middle, flat orthographic view, fills the frame.' + N),
 'paint': dict(ar='1:1', w=768, q=70, grey=True, prompt='Close-up of a thick impasto oil paint surface in a single neutral mid-grey colour, '
   'loaded gestural brushstrokes going in many directions, palette-knife ridges, canvas weave faintly visible, evenly lit from the upper left, '
   'uniform density over the whole frame, abstract texture, seamless, no objects.' + N),
 'paper': dict(ar='3:4', w=640, q=74, prompt='Flat scan of a blank sheet of paper, texture only, no objects, no figures, no machines, no people, no landscape. Recovered military archive document texture: a sheet of aged ivory (#D4C9AD) and dirty khaki (#B6AD94) field-order paper seen flat from above, '
   'filling the whole frame edge to edge with no border and no burnt edges, soft creases, faint foxing, scumbled thin raw umber wash in places, a faint charcoal construction grid, '
   'a few faded illegible stencil marks and registration ticks near the edges only, the centre calm and mostly empty, restrained desaturated palette, no glossy gradients. '
   'No readable words.' + N),
}
if __name__ == '__main__':
    force = set(sys.argv[sys.argv.index('--force') + 1].split(',')) if '--force' in sys.argv else set()
    key = None
    for n, j in JOBS.items():
        raw = ga.SRC / f'map-{n}.png'
        if n in force: raw.unlink(missing_ok=True)
        if not raw.exists():
            key = key or ga.env('~/solSoccer/.env', 'ALT')
            ga.gen(f'map-{n}', j, key)
        if not raw.exists(): continue
        im = Image.open(raw).convert('RGB')
        im = im.resize((j['w'], round(im.height * j['w'] / im.width)), Image.LANCZOS)
        if j.get('grey'):
            g = ImageOps.grayscale(im); g = ImageOps.autocontrast(g, cutoff=1)
            im = g.convert('RGB')
        im.save(OUT / f'{n}.webp', quality=j['q'], method=6)
        print('built', n, im.size, (OUT / f'{n}.webp').stat().st_size // 1024, 'KB', flush=True)
