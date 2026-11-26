#!/usr/bin/env python3
"""
Unit concept images for the Meshy pipeline (one unit at a time, owner signs off).

    python3 tools/gen-concept.py <unit> [--force]          painted concepts (art brief style) for every variant
    python3 tools/gen-concept.py <unit> --approve v2       record the owner's pick
    python3 tools/gen-concept.py <unit> --meshy v2         clean 3D-style render of that variant, made FROM the painted image,
                                                           for Meshy image-to-3D (painterly art is not Meshy-friendly)

Reads   data/concepts.json      {unit: {name, tier, variants: {v1: "design description", ...}}}
Writes  art/concepts/<unit>/<unit>-<v>.png   (raw, for Meshy image-to-3D)
        art/concepts/<unit>/<unit>-<v>.webp  (preview for lab/units.html)
        data/concepts-status.json            (what exists, per unit and variant)
The image model key is read at runtime from ~/solSoccer/.env (ALT=...). Never printed or stored.
"""
import base64, io, json, pathlib, sys, time
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = 'gemini-3.1-flash-image'
CONCEPTS = json.loads((ROOT / 'data' / 'concepts.json').read_text())
STATUS = ROOT / 'data' / 'concepts-status.json'

def env(path, key):
    for line in pathlib.Path(path).expanduser().read_text().splitlines():
        if line.startswith(key + '='):
            return line.split('=', 1)[1].strip().strip('"\'')

# Condensed from docs/art-brief.md (painterly military-industrial neo-expressionism).
STYLE = ('Painterly concept art, gestural oil painting, painterly military-industrial neo-expressionism with dieselpunk analog retrofuturism: '
         'visible impasto brushstrokes and dry-brush, scumbled paint, hints of exposed underpainting and charcoal construction lines, '
         'imperfect hand-painted edges. Heavily desaturated palette: military olive #62644C, burnt umber #5C4838, raw umber #A58F70, '
         'yellow ochre #AF9561, oxide red #864F3B, cold ash #898F8C, steel blue #485354, charcoal #30312F, aged ivory #D4C9AD, '
         'with one or two small accents of warning orange or faded mustard on meaningful parts. Colours contaminated by grime, never clean. ')
MACHINE = ('Utilitarian analog-industrial machine design: cylindrical pressure vessels, cast-metal housings, exposed hydraulic pistons, '
           'heavy articulated joints, welded and riveted plates, oversized fasteners, small recessed optical sensors instead of a face, '
           'massive torso and heavy limbs, awkward functional silhouette; looks like twentieth-century military hardware crossed with '
           'agricultural machinery and deep-sea equipment; oxidation, peeling military paint, exposed primer, oil stains, abrasion, '
           'faded partially illegible stencil markings and serial numbers, evidence of field repairs. Heavy rather than sleek, repaired rather than new. '
           'It has a quiet, weary, almost biological presence. ')
MESHY = ('Single subject only, the WHOLE body fully visible from head to feet with margin on all sides, uncropped, centred, '
         'three-quarter front view, standing upright in a neutral A-pose: arms held slightly away from the body, legs straight and apart, '
         'weapon held at its side or built into the arm. Bipedal humanoid proportions with two legs, two arms, a torso and a head unit so it can be '
         'rigged like a humanoid. Plain flat light grey background (#C8C6C0), no scenery, no ground plane, no cast shadow, soft even lighting, '
         'crisp readable silhouette. No readable text, no letters, no logos, no watermark, no signature, no frame. '
         'Avoid glossy CGI, neon, clean vector outlines, generic sci-fi armour and perfect symmetry.')

MESHY_HOVER = ('Single subject only, the WHOLE machine fully visible with margin on all sides, uncropped, centred, three-quarter front view from slightly above, '
         'hovering level, rotors or fans clearly separated from the body. Plain flat light grey background (#C8C6C0), no scenery, no ground plane, no cast shadow, '
         'soft even lighting, crisp readable silhouette. No readable text, no letters, no logos, no watermark, no signature, no frame. '
         'Avoid glossy CGI, neon, clean vector outlines and perfect symmetry.')

MESHY_RENDER = ('Re-render the machine in this reference image as a clean, high-quality 3D game asset render for an image-to-3D tool. '
    'Keep EXACTLY the same design: the same silhouette, proportions, parts, weapon, number of limbs, panel layout, colours and markings. '
    'Style: a modern PBR hard-surface 3D render, NOT a painting: no brushstrokes, no sketch lines, no paint texture on the image itself. '
    'Crisp, well-defined geometry with clear separation between parts and readable bevels; matte painted metal with honest material '
    'definition (worn olive paint, chipped edges showing bare steel, light rust in crevices, rubber hoses, brass fittings), '
    'kept moderate so the forms stay clear. Soft even studio lighting from the front, no harsh shadows, no rim glow, no bloom. '
    'Orthographic-feeling three-quarter front view, the whole body visible from head to feet with margin, centred, standing in a neutral A-pose '
    'with arms slightly away from the body and legs apart. Plain flat very light grey background (#E4E2DC), no floor, no cast shadow, '
    'no scenery, no text, no letters, no logos, no watermark.')

def gen(path, prompt, key, ref=None):
    parts = [{'text': prompt}]
    if ref is not None:
        parts.insert(0, {'inlineData': {'mimeType': 'image/png', 'data': base64.b64encode(ref.read_bytes()).decode()}})
    body = {'contents': [{'parts': parts}],
            'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': '3:4'}}}
    for attempt in range(4):
        try:
            r = requests.post(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}', json=body, timeout=240)
            j = r.json()
            part = next((p for p in (j.get('candidates') or [{}])[0].get('content', {}).get('parts', []) if 'inlineData' in p), None)
            if part:
                path.write_bytes(base64.b64decode(part['inlineData']['data']))
                im = Image.open(path).convert('RGB'); im.thumbnail((900, 1200))
                im.save(path.with_suffix('.webp'), 'WEBP', quality=86)
                return True
            print('  no image in response', (j.get('error') or {}).get('message', '')[:160], flush=True)
        except Exception as e:
            print('  retry after error:', type(e).__name__, flush=True)
        time.sleep(4 * (attempt + 1))
    return False

def flag(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None

def save_status(unit, spec, out, **extra):
    st = json.loads(STATUS.read_text()) if STATUS.exists() else {}
    prev = st.get(unit, {})
    st[unit] = {'name': spec['name'], 'tier': spec.get('tier'), 'role': spec.get('role', ''),
                'variants': {v: {'desc': d, 'png': (out / f'{unit}-{v}.png').exists(),
                                 'meshy': (out / f'{unit}-{v}-meshy.png').exists()} for v, d in spec['variants'].items()},
                'approved': extra.get('approved', prev.get('approved')), 'updated': int(time.time())}
    STATUS.write_text(json.dumps(st, indent=1))

def main():
    unit = sys.argv[1]; force = '--force' in sys.argv
    spec = CONCEPTS[unit]
    out = ROOT / 'art' / 'concepts' / unit; out.mkdir(parents=True, exist_ok=True)
    if flag('--approve'):
        save_status(unit, spec, out, approved=flag('--approve')); print(unit, 'approved', flag('--approve')); return
    key = env('~/solSoccer/.env', 'ALT')
    if flag('--meshy'):
        v = flag('--meshy'); src = out / f'{unit}-{v}.png'; dst = out / f'{unit}-{v}-meshy.png'
        prompt = MESHY_RENDER if spec.get('humanoid', True) else MESHY_RENDER.replace(
            'standing in a neutral A-pose with arms slightly away from the body and legs apart',
            'hovering level with rotors, fans and legs clearly separated from the body, rotor blades drawn as solid blades, not motion-blurred')
        ok = gen(dst, prompt, key, ref=src)
        print(f'{unit} {v} meshy render:', 'ok' if ok else 'FAILED'); save_status(unit, spec, out); return
    jobs = []
    for v, desc in spec['variants'].items():
        p = out / f'{unit}-{v}.png'
        if p.exists() and not force:
            continue
        body = STYLE + (MACHINE if spec.get('tier') in ('mech', 'exosuit') else '') + desc + ' ' + (MESHY if spec.get('humanoid', True) else MESHY_HOVER)
        jobs.append((v, p, body))
    with ThreadPoolExecutor(3) as ex:
        res = list(ex.map(lambda j: (j[0], gen(j[1], j[2], key)), jobs))
    for v, ok in res:
        print(f'{unit} {v}:', 'ok' if ok else 'FAILED', flush=True)
    save_status(unit, spec, out)

if __name__ == '__main__':
    main()
