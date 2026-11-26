#!/usr/bin/env python3
"""
degenWars painted art.   python3 tools/gen-art.py [--force name[,name]] [--only name[,name]] [--rekey]
Raw model output -> tools/.src/<name>.png ; game assets -> art/<name>.webp
Image model key is read at runtime from ~/solSoccer/.env (ALT=...). Never printed, never stored here.
"""
import base64, pathlib, sys, time, requests
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / 'art'; ART.mkdir(exist_ok=True)
SRC = ROOT / 'tools' / '.src'; SRC.mkdir(parents=True, exist_ok=True)
MODEL = 'gemini-3.1-flash-image'

def env(path, key):
    for line in pathlib.Path(path).expanduser().read_text().splitlines():
        if line.startswith(key + '='): return line.split('=', 1)[1].strip().strip('"\'')

STYLE = ('Expressive, gestural oil painting. Retrofuturistic military, analog science fiction, dystopian war illustration. '
         'Muted earth tones, oxidized metals, heavy painterly texture, visible loaded brushstrokes, calligraphic marks, '
         'selective detail, cinematic chiaroscuro, figurative neo-expressionism, tactile, melancholic. ')
NOTXT = ' No text, no letters, no numbers, no logos, no watermark, no signature, no frame, no border.'

def chroma(key):
    col = 'pure chroma-key green (#00FF00)' if key == 'g' else 'pure chroma-key magenta (#FF00FF)'
    return (f' The background must be a perfectly flat, uniform, solid {col} colour filling the whole canvas edge to edge: '
            'no texture, no brushstrokes, no gradient, no ground, no cast shadow, no scenery in the background. '
            'The subject is isolated, centred, fully inside the frame with margin on all sides, with a crisp clear outer silhouette. '
            f'Do not use that {"green" if key == "g" else "magenta"} colour anywhere on the subject.')

SPR = ('Single full-body game character sprite, 3/4 side view, facing RIGHT, standing on nothing, '
       'bold readable silhouette with strong light/dark value contrast so it reads at 60 pixels tall, chunky simple shapes, '
       'not too much fine detail, warm rim light from the upper left. ')

def unit(desc, key='g'):
    return dict(prompt=STYLE + SPR + desc + chroma(key) + NOTXT, ar='1:1', kind='sprite', key=key, max=320)

def sym(desc, key='g'):
    return dict(prompt=STYLE + 'A bold painted emblem icon for a slot machine reel symbol, centred, front view, '
                'one simple iconic shape that is instantly recognisable when tiny (70 pixels), thick shapes, strong dark outline brushwork, '
                + desc + chroma(key) + NOTXT, ar='1:1', kind='sprite', key=key, max=256)

def item(desc, key='m'):
    return dict(prompt=STYLE + 'A small painted game item icon, centred, simple bold iconic object readable at 40 pixels, thick shapes, strong dark outline brushwork, '
                + desc + chroma(key) + NOTXT, ar='1:1', kind='sprite', key=key, max=128)

def core(desc, glow, key='g'):
    return dict(prompt=STYLE + 'A small painted game icon of a slot-machine CORE CARTRIDGE, centred, front three-quarter view: a squat round tarnished brass '
                'canister with riveted bands and a domed thick glass window on the front, ' + glow + ' light glowing from inside the dome; inside the glass, '
                + desc + ' Bold simple shapes readable at 48 pixels, strong dark outline brushwork, heavy painterly texture.' + chroma(key) + NOTXT,
                ar='1:1', kind='sprite', key=key, max=256)

# ---- UI art (buttons, menus, icons): see docs/style.md "Art" ----
TEX = ('A flat, straight-on, evenly lit surface texture filling the entire frame edge to edge, abstract, no objects, no perspective, no vignette, '
       'no central focal point: the middle of the frame is calm, quiet and low in contrast so text can sit on top of it; '
       'any wear, scratches and stains are small, soft and spread evenly. Suitable as a tileable background texture behind game UI. ')
PLATE = ('A flat, straight-on, evenly lit close-up of a single surface filling the entire frame edge to edge, like the face of a heavy industrial push-button plate, '
         'abstract, no objects, no bolts or rivets in the middle, no perspective, no vignette, no frame; the middle is smooth and even in tone so a word can be printed on it, '
         'with fine painterly brush texture, light scuffs and slight edge wear only near the borders. ')
def tex(desc, ar='1:1', w=640):
    return dict(kind='bg', ar=ar, w=w, prompt=STYLE + TEX + desc + NOTXT)
def plate(desc):
    return dict(kind='bg', ar='21:9', w=560, prompt=STYLE + PLATE + desc + NOTXT)
def uic(desc, key='m'):
    return dict(prompt=STYLE + 'A small painted game UI icon, centred, one single bold iconic object seen front-on, a chunky simple silhouette that is instantly '
                'readable at 24 pixels, very thick shapes, strong dark umber outline brushwork, strong light-dark value contrast, limited palette of aged ivory, '
                'tarnished brass ochre and gunmetal steel with at most one small accent colour, warm light from the upper left. Same style as a matching set of icons. '
                + desc + chroma(key) + NOTXT, ar='1:1', kind='sprite', key=key, max=128)

JOBS = {

 # ---- UI: panel and menu textures ----
 'ui-steel': tex('A nearly uniform dark gunmetal steel plate, very dark charcoal (#26282a) with subtle cold steel-blue grey, smooth horizontal dry-brushed paint strokes of almost the same value, '
   'only faint fine scratches; no rust patches, no large blotches, no bright spots anywhere; very low contrast, quiet and even like a calm painted wall of steel.', '4:3', 800),
 'ui-paper': tex('Aged manila / ivory military field document paper (#D4C9AD and dirty khaki #B6AD94), faint fibres, soft coffee-brown foxing spots and stains spread thinly, '
   'very slight crease lines, light and calm, low contrast, no writing, no printed lines.', '4:3', 640),
 'ui-crate': tex('Painted olive drab military ammunition crate wood (#62644C), horizontal planks with thin dark gaps between them, chipped olive paint showing raw umber wood, '
   'scuffs and grime, even and calm, muted, low contrast.', '4:3', 640),
 'ui-canvas': tex('Heavy weathered olive-khaki military canvas tarpaulin, coarse woven fabric grain, soft dirt stains and faded water marks, slightly sagging soft folds, '
   'dark muted tones, low contrast.', '16:9', 800),
 # ---- UI: button plates ----
 'ui-btn-red': plate('Glossy chipped cadmium-red enamel paint (#B3261E) on steel, deep saturated red with slightly darker red at the bottom, a few tiny chips showing dark metal at the very edges.'),
 'ui-btn-oxide': plate('Oxide-red rust-coloured painted war plate (#864F3B to deep brown-red #5e2216), pitted rusty iron, dry-brushed orange-brown rust, darker towards the bottom.'),
 'ui-btn-steel': plate('Cold brushed gunmetal steel (#56605f to #353c3d), mid-grey steel-blue, dry-brushed horizontal strokes, light scuffs, slightly darker towards the bottom.'),
 'ui-btn-brass': plate('Worn polished brass plate, warm mustard gold (#C9A23A to darker #8a6a2c), brushed metal strokes, light tarnish at the edges, slightly darker towards the bottom.'),
 # ---- UI: icons (rail / action bar) ----
 'ui-i-codex': uic('A thick closed military field dossier book bound in aged ivory card with a dark leather spine and a small red stamp mark on the cover.'),
 'ui-i-shop': uic('A small heavy black-market canvas coin sack tied at the neck with rope, bulging, with a single brass coin leaning against it.'),
 'ui-i-kit': uic('A chunky steel toolbox with a brass handle on top, lid slightly open, a large cog gear and a wrench sticking out.'),
 'ui-i-speed': uic('A round brass pressure gauge dial with an ivory face, a bold dark needle pointing to the upper right, tick marks only, no numbers.'),
 'ui-i-battle': uic('Two heavy machine-made broad blades crossed in an X, gunmetal steel with brass hilts and a small cadmium-red tassel.'),
 # ---- UI: icons (resource strip) ----
 'ui-i-energy': uic('A squat cylindrical power cell battery with brass end caps and a bold ivory lightning bolt painted on its dark side.'),
 'ui-i-credit': uic('A single thick stamped brass coin chit seen front-on, with a square hole punched through its centre and a notched rim.'),
 'ui-i-chip': uic('A single poker chip seen front-on, steel-blue grey (#7d9294) with ivory edge stripes, and three small round amber lenses arranged in a triangle in the middle.', 'g'),
 'ui-i-units': uic('An olive-green steel army helmet seen from the front-side, dented, with a small ivory stencil stripe.'),
 'ui-i-wave': uic('A tattered triangular war pennant flag on a short pole, oxide-red cloth, flying to the right.', 'g'),
 # ---- battlefield ----
 'field': dict(kind='bg', ar='16:9', w=1600, prompt=STYLE +
   'Wide ground-level view across a ruined no-man\'s-land battlefield, seen from a low side-on angle like a side-scrolling game backdrop. '
   'A broad flat expanse of churned mud, ash and dead grass occupies the lower two thirds: keep that middle and lower band calm, '
   'low-detail and open (atmospheric negative space) so small figures can stand on it. Distant horizon in the top quarter: '
   'silhouettes of broken industrial towers, a toppled radio mast, the rusted hulk of a giant derelict war walker, smoke columns. '
   'Scattered sparse debris only at the far edges: a coil of barbed wire, a few crater rims, a half-buried helmet. '
   'Left side warmer: ochre, umber, dusty sepia haze with a low sun. Right side darker and colder: oxidized teal-grey fog, '
   'sickly green-grey murk, deep shadow. Overcast smoky sky.' + NOTXT),
 'field-tall': dict(kind='bg', ar='4:5', w=1000, prompt=STYLE +
   'Ground-level view across a ruined no-man\'s-land battlefield, a broad flat expanse of churned mud, ash and dead grass filling most of the frame '
   '(calm, low-detail, open negative space so small figures read on it). Thin distant horizon at the very top with broken industrial towers, '
   'a derelict giant war walker silhouette and smoke. Left side warmer ochre and umber haze, right side colder oxidized teal-grey fog and deep shadow.' + NOTXT),
 # ---- slot symbols: battle roster v1 (old six kept under 'old-s-*' names; their raws are in tools/.src) ----
 's-soldier': sym('a small battered robot head with three small round glowing amber lenses arranged in a triangle (the signature face of the army), wearing an olive-green steel army helmet, with a stubby forearm cannon crossed behind it, olive green dominant colour.', 'm'),
 's-lancer': sym('a tall riveted mustard-ochre tower shield with one oxide-red horizontal band, a long drill-tipped pike crossed diagonally behind it, yellow-ochre dominant colour.'),
 's-sniper': sym('a round oxidized-teal sniper scope crosshair reticle laid over a long rail-rifle barrel with cooling fins, teal dominant colour, cold and bright.', 'm'),
 's-outrider': sym('a fat spiral steel drill-ram cone pointing to the right with a burnt-orange armoured collar and speed streaks behind it, burnt orange dominant colour.'),
 's-drone': sym('a wasp-shaped flying war drone seen from above, two spinning rotor rings, a segmented abdomen with hazard yellow and black stripes, three glowing amber lenses on the nose, pale hazard-yellow dominant colour.', 'm'),
 's-hacker': sym('a small battered robot head with three small round glowing amber lenses arranged in a triangle (the signature face of the army) on a small round rose-red body, with three small glowing orbs orbiting it on a thin dashed orbit ring (one steel-blue orb, one red orb, one amber orb), rose-red dominant colour.'),
 's-commander': sym('a heavy machine-made broadsword pointing up in front of a tattered faded violet-plum war banner, with a brass three-lens crest at the cross-guard, violet-plum dominant colour.'),
 # ---- slot cores (battle roster v1 core set, docs/design.md 6.1) ----
 'c-penny': core('a single worn copper penny coin standing on edge.', 'soft warm ivory-white'),
 'c-deadcat': core('a tiny skeletal cat silhouette bouncing off a downward red chart line.', 'soft warm ivory-white'),
 'c-nudgemotor': core('a small electric motor with a spinning gear and a downward arrow.', 'soft warm ivory-white'),
 'c-loose': core('a little pile of scattered brass coins and bolts.', 'soft warm ivory-white'),
 'c-oilcan': core('a small dented oil can dripping a single drop of oil.', 'soft warm ivory-white'),
 'c-fuse': core('a coiled spare fuse with a tiny spark at its tip.', 'soft warm ivory-white'),
 'c-vault': core('a miniature round bank vault door with a spoked wheel handle.', 'soft warm ivory-white'),
 'c-whale': core('a small iron whale shape with a horseshoe magnet above it.', 'oxidised teal-green'),
 'c-airdrop': core('a supply crate hanging under a small parachute.', 'oxidised teal-green'),
 'c-magnet': core('a red horseshoe magnet pulling three small slot reel cells into a row.', 'oxidised teal-green'),
 'c-recycler': core('three bent arrows in a loop around a spinning cog.', 'oxidised teal-green'),
 'c-hotstreak': core('a row of three small flames rising in height.', 'oxidised teal-green'),
 'c-rally': core('a tattered war banner on a pole with a three-lens crest.', 'oxidised teal-green'),
 'c-sticky': core('a single slot reel cell pinned in place by a big brass clamp.', 'oxidised teal-green'),
 'c-chain': core('a chain of three linked small explosions.', 'deep violet-plum'),
 'c-holdlever': core('a slot machine lever locked with a heavy padlock.', 'deep violet-plum'),
 'c-orderbook': core('an open ledger book with an all-seeing eye glowing above it.', 'deep violet-plum'),
 'c-fullboard': core('a 3 by 3 grid of nine identical glowing symbols.', 'rich molten gold'),
 'c-gilded': core('a stamping press minting a gleaming gold coin.', 'rich molten gold'),
 # ---- item cartridges (plugged into the cabinet sockets) ----
 'i-cell': item('a glowing cylindrical power cell battery with brass end caps and a sickly green-yellow glowing core.'),
 'i-gear': item('a heavy iron cog gear with a curved reverse arrow painted on it, gunmetal and brass.'),
 'i-coil': item('a copper electromagnetic coil wound around an iron core, small blue spark, copper dominant.', 'g'),
 'i-damp': item('a brass pressure regulator valve with a round gauge dial and red needle, brass dominant.'),
 'i-kevlar': item('a folded square of woven drab olive armour fabric with a stitched shield badge, olive dominant.', 'm'),
 'i-over': item('a red-hot glowing vacuum tube valve with an orange filament, red-orange dominant.'),
 'i-charge': item('a bundle of three red dynamite sticks with a lit fuse, red dominant.'),
 'i-recruit': item('a rolled paper conscription scroll tied with a red ribbon and a wax seal, aged ivory paper dominant.'),
 'i-battery': item('a chunky military field battery pack with two brass terminals and a lightning bolt stencil, teal-grey dominant.', 'm'),
 # ---- cabinet ----
 'cabinet-steel': dict(kind='bg', ar='3:4', w=800, prompt=STYLE +
   'A flat front-facing panel texture of a battered military slot machine cabinet body made of dark gunmetal and charcoal-grey steel plates: '
   'riveted seams, oxidised edges with small rust blooms, scratches, oil grime, faded stencilled serial numbers and a few chipped hazard stripes near the bottom edge, '
   'cold desaturated steel-blue grey with only small warm rust accents. Even lighting, abstract, no central object, suitable as a background texture behind UI.' + NOTXT),
 'mq-bot': dict(kind='sprite', ar='1:1', key='g', max=420, prompt=STYLE +
   'Front view of a battered retrofuturist war robot head, the mascot of a robot army, centred, filling most of the frame: a squat riveted gunmetal helmet-head '
   'with a dented visor plate and three round glass lenses arranged in a triangle (two on top, one below) glowing warm amber-orange, small antenna, worn olive and steel paint, '
   'bold readable silhouette, strong dark outline brushwork, heroic and a bit menacing.' + chroma('g') + NOTXT),
 'marquee': dict(kind='bg', cut=1, ar='21:9', w=1100, prompt=STYLE +
   'The wide, shallow arched marquee topper of an old Las Vegas casino slot machine, seen straight on, filling the whole frame edge to edge: '
   'a tarnished brass and oxidized chrome frame with a gentle low arch and small art-deco fins at both ends, a single row of round marquee light bulbs '
   'running along the arch and down both sides (a few glowing warm amber, most dim or broken), and one very large plain empty dark glass sign panel '
   '(smoky deep red-brown, completely blank) spanning about 75 percent of the width and 55 percent of the height in the middle, where a title would go. '
   'Grime, rust streaks, dents and bullet scratches. Symmetrical. Fills the whole frame, symmetrical, dark background corners.' + NOTXT),
 'cabinet': dict(kind='bg', ar='3:4', w=800, prompt=STYLE +
   'A flat front-facing panel texture of an old battered slot machine cabinet body: dark oxblood-red and umber lacquered metal, '
   'scratched, rust blooms, grime, worn brass trim fragments at the edges, smoky shadows. Abstract, even, no central objects, '
   'suitable as a background texture.' + NOTXT),
 'lever': dict(kind='sprite', ar='9:16', key='m', max=360, prompt=STYLE +
   'The side pull lever of a vintage Las Vegas slot machine, isolated, seen from the front: a long vertical oxidized chrome shaft rising from '
   'a round tarnished brass hub mount at the bottom, topped with a big glossy blood-red ball knob. Tall and thin, vertical.' + chroma('m') + NOTXT),
}

def gen(name, job, key):
    raw = SRC / f'{name}.png'
    body = {'contents': [{'role': 'user', 'parts': [{'text': job['prompt']}]}],
            'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': job['ar']}}}
    for attempt in range(4):
        try:
            r = requests.post(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}', json=body, timeout=240)
            j = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
            part = next((p for p in (j.get('candidates') or [{}])[0].get('content', {}).get('parts', []) if 'inlineData' in p), None)
            if r.ok and part:
                raw.write_bytes(base64.b64decode(part['inlineData']['data'])); print('gen', name, flush=True); return True
            print('retry', name, r.status_code, str(j.get('error', {}).get('message', ''))[:120], flush=True)
        except Exception as e:
            print('retry', name, type(e).__name__, flush=True)
        time.sleep(6 * (attempt + 1))
    print('FAILED', name, flush=True); return False

def key_out(im, key):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # sample actual bg colour from the border
    bd = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    if key == 'g':
        dom = g - np.maximum(r, b)
        bgd = np.median(bd[:, 1] - np.maximum(bd[:, 0], bd[:, 2]))
    else:
        dom = np.minimum(r, b) - g
        bgd = np.median(np.minimum(bd[:, 0], bd[:, 2]) - bd[:, 1])
    hi, lo = max(60.0, bgd * 0.55), max(25.0, bgd * 0.22)
    alpha = np.clip((hi - dom) / (hi - lo), 0, 1)
    # despill
    if key == 'g':
        g2 = np.minimum(g, np.maximum(r, b) + 8); a[..., 1] = np.where(dom > 0, g2, g)
    else:
        m = np.maximum(g + 8, 0)
        a[..., 0] = np.where(dom > 0, np.minimum(r, m + (r - np.minimum(r, b)) ), r)
        a[..., 2] = np.where(dom > 0, np.minimum(b, m + (b - np.minimum(r, b))), b)
    al = Image.fromarray((alpha * 255).astype(np.uint8))
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))  # shave fringe, soften edge
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA'); out.putalpha(al)
    # drop speckle: zero alpha outside the bbox of significant mass
    A = np.asarray(al) > 40
    rows, cols = np.where(A.any(1))[0], np.where(A.any(0))[0]
    if len(rows) and len(cols):
        # trim using rows/cols with a meaningful number of opaque pixels
        rc, cc = A.sum(1), A.sum(0)
        rr = np.where(rc > 2)[0]; ccx = np.where(cc > 2)[0]
        y0, y1, x0, x1 = rr[0], rr[-1] + 1, ccx[0], ccx[-1] + 1
        pad = 4
        out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(out.width, x1 + pad), min(out.height, y1 + pad)))
    return out

def cut_dark(im, thr=33):
    # make the near-black backdrop around a framed object transparent (flood fill from the borders only)
    from PIL import ImageDraw
    lum = np.asarray(im.convert('L'))
    m = Image.fromarray(np.where(lum < thr, 255, 0).astype(np.uint8)).copy()
    W, H = m.size
    for x in range(0, W, 25):
        for y in (0, H - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, H, 25):
        for x in (0, W - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    bg = Image.fromarray(np.where(np.asarray(m) == 128, 255, 0).astype(np.uint8))
    bg = bg.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
    out = im.convert('RGBA'); out.putalpha(Image.fromarray(255 - np.asarray(bg)))
    return out

def build(name, job):
    raw = SRC / f'{name}.png'
    if not raw.exists(): return
    im = Image.open(raw)
    if job['kind'] == 'bg':
        im = im.convert('RGB'); w = job['w']
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        if job.get('cut'): im = cut_dark(im)
        im.save(ART / f'{name}.webp', quality=78 if not job.get('cut') else 84, method=6)
    else:
        im = key_out(im, job['key']); m = job['max']
        s = m / max(im.size)
        if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(ART / f'{name}.webp', quality=82, method=6)
    print('built', name, im.size, (ART / f'{name}.webp').stat().st_size // 1024, 'KB', flush=True)

def arg(flag):
    if flag in sys.argv: return set(sys.argv[sys.argv.index(flag) + 1].split(','))
    return set()

if __name__ == '__main__':
    force, only = arg('--force'), arg('--only')
    names = [n for n in JOBS if not only or n in only]
    for n in force: (SRC / f'{n}.png').unlink(missing_ok=True)
    todo = [n for n in names if not (SRC / f'{n}.png').exists()]
    if todo:
        key = env('~/solSoccer/.env', 'ALT')
        with ThreadPoolExecutor(5) as ex: list(ex.map(lambda n: gen(n, JOBS[n], key), todo))
    for n in names:
        if '--rekey' in sys.argv or n in todo or not (ART / f'{n}.webp').exists(): build(n, JOBS[n])
