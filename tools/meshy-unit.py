#!/usr/bin/env python3
"""
Meshy stages for ONE degenWars unit at a time (the owner signs off between stages).

    python3 tools/meshy-unit.py <unit> model     image-to-3D from the approved variant's Meshy render
    python3 tools/meshy-unit.py <unit> rig       auto-rig (only after the model is approved)
    python3 tools/meshy-unit.py balance

Input   art/concepts/<unit>/<unit>-<approved>-meshy.png   (approved variant from data/concepts-status.json)
Output  assets/units/<unit>/model.glb, thumb.png, rigged.glb, walk.glb, run.glb, state.json
Status  data/concepts-status.json  -> <unit>.model / .rig = true
Key: `meshy=` line in ~/memeHunter/.env, read at runtime, never printed.
Tasks are resumable: a re-run picks up the stored task id instead of paying again.
"""
import base64, json, pathlib, re, sys, time
import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = 'https://api.meshy.ai/openapi'
KEY = re.search(r'^meshy=(.+)$', (pathlib.Path.home() / 'memeHunter' / '.env').read_text(), re.M).group(1).strip().strip('"')
H = {'Authorization': f'Bearer {KEY}'}
STATUS = ROOT / 'data' / 'concepts-status.json'

def balance():
    return requests.get(f'{API}/v1/balance', headers=H, timeout=30).json().get('balance')

def task(state, sfile, key, endpoint, payload):
    if key not in state:
        r = requests.post(f'{API}/{endpoint}', headers=H, json=payload, timeout=120)
        if not r.ok:
            raise SystemExit(f'{key} create HTTP {r.status_code}: {r.text[:300]}')
        state[key] = r.json()['result']; sfile.write_text(json.dumps(state, indent=1))
        print(f'{key} task created', flush=True)
    url = f'{API}/{endpoint}/{state[key]}'
    t0 = time.time(); last = -1
    while time.time() - t0 < 3600:
        try:
            r = requests.get(url, headers=H, timeout=30)
        except requests.RequestException:
            time.sleep(5); continue
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(int(r.headers.get('Retry-After', 5))); continue
        r.raise_for_status(); t = r.json()
        if t.get('progress', 0) // 20 != last:
            last = t.get('progress', 0) // 20; print(f"{key} {t['status']} {t.get('progress', 0)}%", flush=True)
        if t['status'] == 'SUCCEEDED':
            return t
        if t['status'] in ('FAILED', 'CANCELED'):
            del state[key]; sfile.write_text(json.dumps(state, indent=1))
            raise SystemExit(f"{key} {t['status']}: {(t.get('task_error') or {}).get('message', '')}")
        time.sleep(int(r.headers.get('Retry-After', 5)))
    raise SystemExit(f'{key} still running after an hour; re-run to resume')

def fetch(url, path):
    path.write_bytes(requests.get(url, timeout=300).content)

def mark(unit, **kv):
    st = json.loads(STATUS.read_text()); st[unit].update(kv); st[unit]['updated'] = int(time.time())
    STATUS.write_text(json.dumps(st, indent=1))

def main():
    if sys.argv[1] == 'balance':
        print('Meshy balance', balance()); return
    unit, stage = sys.argv[1], sys.argv[2]
    st = json.loads(STATUS.read_text())[unit]
    v = st.get('approved') or sys.exit(f'{unit}: no approved variant yet')
    out = ROOT / 'assets' / 'units' / unit; out.mkdir(parents=True, exist_ok=True)
    sfile = out / 'state.json'; state = json.loads(sfile.read_text()) if sfile.exists() else {}
    before = balance()
    if stage == 'model':
        img = ROOT / 'art' / 'concepts' / unit / f'{unit}-{v}-meshy.png'
        b64 = base64.b64encode(img.read_bytes()).decode()
        payload = {'image_url': f'data:image/png;base64,{b64}', 'model_type': 'smart-topology', 'ai_model': 'meshy-t2.5',
                   'target_polycount': 30000, 'should_texture': True, 'texture_model': 'meshy-n1', 'pose_mode': 'a-pose'}
        t = task(state, sfile, 'model', 'v1/image-to-3d', payload)
        fetch(t['model_urls']['glb'], out / 'model.glb')
        if t.get('thumbnail_url'):
            fetch(t['thumbnail_url'], out / 'thumb.png')
        mark(unit, model=True)
    elif stage == 'rig':
        st_all = json.loads(STATUS.read_text())[unit]
        if not st_all.get('model_approved'):
            sys.exit(f'{unit}: the 3D model has not been approved by the owner yet')
        t = task(state, sfile, 'rig', 'v1/rigging', {'input_task_id': state['model'], 'height_meters': st_all.get('height', 2.6)})
        res = t['result']
        fetch(res['rigged_character_glb_url'], out / 'rigged.glb')
        ba = res.get('basic_animations') or {}
        for k, name in (('walking_glb_url', 'walk.glb'), ('running_glb_url', 'run.glb')):
            if ba.get(k):
                fetch(ba[k], out / name)
        mark(unit, rig=True)
    after = balance()
    print(f'{unit} {stage} done · credits used {before - after} · balance {after}', flush=True)

if __name__ == '__main__':
    main()
