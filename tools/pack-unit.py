#!/usr/bin/env python3
"""
Pack a unit's baked frames into a Phaser sprite sheet, with a painterly pass so the pre-rendered
3D reads as painted (docs/art-brief.md) instead of glossy CGI.

    python3 tools/pack-unit.py soldier [--size 192] [--raw]
    python3 tools/pack-unit.py soldier --look field --frames frames-v2 --name sheet-v2 --size 224

Options (defaults reproduce the original sheet):
  --look painted|field   'field' = the blend pass (docs/blend.md): fills transparent fringes, a light Kuwahara oil-paint
                         filter at 2x, a gradient map into the art-brief palette (accents kept), value compression
                         (carbon blacks, no highlight above aged ivory), the field's own impasto texture transferred
                         onto the unit, mud creeping up the feet, and a broken carbon contour on the shadow side only.
  --frames <dir>         input frames folder (default 'frames')
  --name <name>          output basename: writes <name>.webp and <name>.json (default 'sheet' / 'sheet-raw')

Reads   assets/units/<unit>/frames/<clip>_<i>.png + meta.json
Writes  assets/units/<unit>/sheet.webp   frames laid out in one row per clip
        assets/units/<unit>/sheet.json   {frameWidth, frameHeight, foot, ppm, clips: {name: {row, n, fps, loop}}}   (ppm = sheet px per metre)
        (--raw writes sheet-raw.webp, without the paint pass, for comparison)
"""
import json, pathlib, random, sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
INK = (33, 30, 27)          # carbon black #211E1B, contaminated: never pure black


def paint(im, seed):
    """Painterly pass: tamed whites, a raw-umber glaze, mild pigment clumping, a warm broken contour, canvas grain."""
    import numpy as np
    a = im.getchannel('A')
    px = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = px.mean(axis=2, keepdims=True); sat = px.max(axis=2, keepdims=True) - px.min(axis=2, keepdims=True)
    white = np.clip((lum - 170) / 60, 0, 1) * np.clip(1 - sat / 40, 0, 1)        # glaring, desaturated highlights
    px = px * (1 - white) + px * np.array([0.80, 0.77, 0.68]) * white            # -> aged ivory / bone, never pure white
    rgb = Image.fromarray(np.clip(px, 0, 255).astype('uint8'))
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    rgb = ImageEnhance.Color(rgb).enhance(0.86)
    glaze = Image.new('RGB', rgb.size, (165, 143, 112))                           # raw umber
    rgb = Image.blend(rgb, ImageChops.multiply(rgb, glaze), 0.14)
    grain = Image.effect_noise(rgb.size, 14).convert('RGB')
    rgb = Image.blend(rgb, ImageChops.overlay(rgb, grain), 0.07)
    # contour: a 1-2 px warm carbon line under the figure, slightly uneven
    edge = a.filter(ImageFilter.MaxFilter(3))
    rnd = random.Random(seed)
    jitter = Image.effect_noise(rgb.size, 40).point(lambda v: 255 if v > 60 + rnd.randint(-5, 5) else 170).convert('L')
    edge = ImageChops.multiply(edge, jitter)
    out = Image.new('RGBA', rgb.size, INK + (0,)); out.putalpha(edge)
    out.alpha_composite(Image.merge('RGBA', (*rgb.split(), a)))
    return out


# art-brief palette as a value ramp: carbon black -> burnt umber -> military olive -> raw umber -> dirty khaki -> aged ivory
RAMP = [(0.00, (33, 30, 27)), (0.22, (70, 56, 44)), (0.42, (98, 96, 74)), (0.62, (150, 131, 102)), (0.82, (182, 173, 148)), (1.0, (212, 201, 173))]
MUD = (58, 46, 33)
# blend-pass strengths; override for tuning with FIELD_PACK='{"kuwahara":2}'
FP = {"kuwahara": 2, "gradmap": 0.15, "floor": 4, "gain": 1.0, "knee": 165, "tex": 0.06, "mud": 0.6, "contour": 0.9}
import os as _os
FP.update(json.loads(_os.environ.get("FIELD_PACK", "{}")))


def _fill_rgb(rgb, a):
    """Spread colour into transparent pixels so filters near the silhouette don't drag in black."""
    import cv2, numpy as np
    w = cv2.blur(a, (17, 17))[..., None]
    fill = cv2.blur(rgb * a[..., None], (17, 17)) / np.maximum(w, 1e-4)
    return np.where(a[..., None] > 0.5, rgb, fill)


def kuwahara(rgb, r):
    """Classic 4-quadrant Kuwahara: flattens surfaces into strokes while keeping edges hard, like a loaded brush."""
    import cv2, numpy as np
    k = r + 1; h = r // 2
    lum = rgb.mean(axis=2)
    m = cv2.blur(rgb, (k, k)); ml = cv2.blur(lum, (k, k)); v = cv2.blur(lum * lum, (k, k)) - ml * ml
    best = None; bv = None
    for dy, dx in ((-h, -h), (-h, h), (h, -h), (h, h)):
        mm = np.roll(m, (dy, dx), (0, 1)); vv = np.roll(v, (dy, dx), (0, 1))
        if best is None: best, bv = mm.copy(), vv.copy()
        else:
            take = vv < bv; best[take] = mm[take]; bv[take] = vv[take]
    return best


def field_texture(size, scale=0.72, seed=0):
    """High-pass of art/field.webp (impasto ridges, canvas grain): the painting's own brushwork, unit-sized."""
    import cv2, numpy as np
    f = np.asarray(Image.open(ROOT / 'art' / 'field.webp').convert('L')).astype(np.float32)
    f = cv2.resize(f, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    hp = f - cv2.GaussianBlur(f, (0, 0), 5); hp /= hp.std() + 1e-6
    H, W = hp.shape; w, h = size; rnd = random.Random(seed)
    y0 = rnd.randint(int(H * 0.45), H - h - 1) if H - h - 1 > int(H * 0.45) else 0; x0 = rnd.randint(0, max(0, W - w - 1))
    t = hp[y0:y0 + w, x0:x0 + h].T[::-1]   # rotated 90 deg so its strokes cross the field's, never line up with them
    if t.shape != (h, w): t = cv2.resize(hp, (w, h))
    return np.ascontiguousarray(t)


def paint_field(big, size, foot_y, tex, seed):
    """The blend pass. big = the frame at 2x; size = final (w, h); foot_y = ground line in final px."""
    import cv2, numpy as np
    a = np.asarray(big.getchannel('A')).astype(np.float32) / 255
    rgb = np.asarray(big.convert('RGB')).astype(np.float32)
    rgb = _fill_rgb(rgb, a)
    rgb = kuwahara(rgb, FP["kuwahara"]) if FP["kuwahara"] else rgb                                                    # oil-paint clumping at 2x
    rgb = cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)
    a = cv2.resize(a, size, interpolation=cv2.INTER_AREA)
    lum = rgb @ np.array([0.30, 0.59, 0.11], np.float32)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # gradient map into the palette (15%), but leave saturated accents (warning orange, oxide red) alone
    xs = [p for p, _ in RAMP]; ramp = np.array([c for _, c in RAMP], np.float32)
    t = np.clip(lum / 235, 0, 1)
    mapped = np.stack([np.interp(t, xs, ramp[:, c]) for c in range(3)], axis=2)
    accent = np.clip((sat - 55) / 50, 0, 1)[..., None]
    rgb = rgb + (mapped - rgb) * FP["gradmap"] * (1 - accent)
    # value compression: lifted floor (never pure black), soft knee so nothing glares above aged ivory
    rgb = FP["floor"] + rgb * FP["gain"]
    knee = float(FP["knee"]); rgb = np.where(rgb > knee, knee + (rgb - knee) * 0.45, rgb)
    # the field's brushwork transferred onto the unit (multiplicative, both directions)
    rgb = rgb * (1 + FP["tex"] * np.clip(tex, -2.5, 2.5)[..., None])   # keep it low: the same marks as the field read as see-through
    # mud: the lowest ~9% above the ground line darkens into the field's mud
    h = size[1]; ys = np.arange(h, dtype=np.float32)[:, None, None]
    g = np.clip((ys - (foot_y - 0.09 * h)) / (0.09 * h), 0, 1) ** 1.4
    rgb = rgb + (np.array(MUD, np.float32) - rgb) * FP["mud"] * g
    # broken carbon contour on the shadow side only (outside lies right / below; the key is back-left)
    ab = cv2.GaussianBlur(a, (0, 0), 1.0)
    gx = cv2.Sobel(ab, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(ab, cv2.CV_32F, 0, 1, ksize=3)
    n = np.sqrt(gx * gx + gy * gy) + 1e-6; nx, ny = gx / n, gy / n          # points into the figure
    ring = np.clip(cv2.dilate(a, np.ones((3, 3), np.uint8)) - a, 0, 1)
    side = np.clip(0.15 - 0.85 * nx - 0.35 * ny, 0, 1)
    rnd = np.random.default_rng(seed)
    broken = cv2.resize((rnd.random((h // 3 + 1, size[0] // 3 + 1)) > 0.3).astype(np.float32), size, interpolation=cv2.INTER_LINEAR)
    line = np.clip(ring * side * broken * FP["contour"], 0, 1)
    # slightly soft, ragged silhouette: atmospheric edge instead of a CG cut-out
    a = cv2.GaussianBlur(a, (0, 0), 0.6); edge = (a > 0.02) & (a < 0.98)
    a = np.clip(np.where(edge, a * (0.75 + 0.25 * rnd.random(a.shape)), a), 0, 1)
    a = np.maximum(a, 0)
    ink = np.array(INK, np.float32)
    out_a = a + line * (1 - a)
    out_rgb = (rgb * a[..., None] + ink * (line * (1 - a))[..., None]) / np.maximum(out_a[..., None], 1e-4)
    out = np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a * 255, 0, 255)]).astype('uint8')
    return Image.fromarray(out, 'RGBA')


def opt(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main():
    unit = sys.argv[1]; size = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 192
    raw = '--raw' in sys.argv; look = opt('--look', 'painted')
    d = ROOT / 'assets' / 'units' / unit; fr = d / opt('--frames', 'frames')
    meta = json.loads((fr / 'meta.json').read_text())
    clips = list(meta['clips'].items())
    ims = {(c, i): Image.open(fr / f'{c}_{i}.png').convert('RGBA') for c, m in clips for i in range(m['n'])}
    # one crop box for every frame, so the foot point stays put
    box = None
    for im in ims.values():
        b = im.getbbox()
        if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    W0, H0 = next(iter(ims.values())).size
    pad = 8; box = (max(0, box[0] - pad), max(0, box[1] - pad), min(W0, box[2] + pad), min(H0, box[3] + pad))
    bw, bh = box[2] - box[0], box[3] - box[1]
    s = size / max(bw, bh); fw, fh = round(bw * s), round(bh * s)
    cols = max(m['n'] for _, m in clips)
    sheet = Image.new('RGBA', (cols * fw, len(clips) * fh), (0, 0, 0, 0))
    out = {'frameWidth': fw, 'frameHeight': fh, 'cols': cols,
           'foot': [round(((W0 * 0.5) - box[0]) / bw, 4), round(((H0 * meta['foot'][1]) - box[1]) / bh, 4)], 'clips': {}}
    # sheet pixels per metre: lets the game draw every unit at one world scale, whatever its crop box turned out to be
    out['ppm'] = round(W0 / (meta.get('span', 1.35) * meta['h']) * s, 3)
    tex = field_texture((fw, fh), seed=len(unit)) if look == 'field' else None
    for r, (c, m) in enumerate(clips):
        for i in range(m['n']):
            if look == 'field' and not raw:
                big = ims[(c, i)].crop(box).resize((fw * 2, fh * 2), Image.LANCZOS)
                f = paint_field(big, (fw, fh), out['foot'][1] * fh, tex, (hash((unit, c, i)) & 0xffff))
            else:
                f = ims[(c, i)].crop(box).resize((fw, fh), Image.LANCZOS)
                if not raw: f = paint(f, hash((unit, c, i)) & 0xffff)
            sheet.alpha_composite(f, (i * fw, r * fh))
        out['clips'][c] = {'row': r, 'n': m['n'], 'fps': m['fps'], 'loop': m['loop']}
    name = opt('--name', 'sheet-raw' if raw else 'sheet')
    sheet.save(d / f'{name}.webp', 'WEBP', quality=88, method=4, alpha_quality=95)
    if '--name' in sys.argv: out['look'] = 'raw' if raw else look; (d / f'{name}.json').write_text(json.dumps(out, indent=1))
    elif not raw: (d / 'sheet.json').write_text(json.dumps(out, indent=1))
    print(f'{unit}: {name}.webp {sheet.size[0]}x{sheet.size[1]}, frame {fw}x{fh}, {(d / (name + ".webp")).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
