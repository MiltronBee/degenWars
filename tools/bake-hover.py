"""
Bake a NON-humanoid flying unit (no rig) into sprite frames, procedurally animated (run inside Blender):

    blender -b --python tools/bake-hover.py -- drone [--out frames-v2]
    PROBE=/tmp/x.png YAW=145 blender -b --python tools/bake-hover.py -- drone      one idle still

Reads   assets/units/<unit>/model.glb   (Meshy model, no rig)
        data/bake.json -> <unit>.hover  {yaw, length_m, hover_m, rotor_z, eyes_x...}
Writes  assets/units/<unit>/<out>/<clip>_<i>.png + meta.json, same layout as tools/bake-unit.py,
        so tools/pack-unit.py packs it the same way (--look field).

Uses the field look from tools/bake-unit.py (imported as a module, nothing duplicated): the painting as HDRI,
field lights, albedo pull, AgX. The world scale matches the humanoid units: the frame spans REF_H * SPAN metres,
REF_H = the Grunt's height, so a drone of length_m reads at the right size next to the mechs.

Rotors: Meshy merges everything into one mesh; the rotor rings are split off by position (vertices above
rotor_z, one group per side of the body's long axis), each gets a pivot at its centroid with its spin axis
from a PCA of its vertices (the ring's normal), and spins every frame. The body moves as a rigid whole:
hover bob, flight pitch, recoil, hit jolt, a tumbling death and a little victory loop.
"""
import importlib.util, json, math, os, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parent.parent
_argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
UNIT = _argv[0]
OUT = _argv[_argv.index('--out') + 1] if '--out' in _argv else 'frames-v2'
TINT = _argv[_argv.index('--tint') + 1] if '--tint' in _argv else None   # a key of hover.tints: role colour variant

# import bake-unit.py as a library with the field look on and no units to bake
_saved = sys.argv; sys.argv = ['blender', '--', '--look', 'field']
_spec = importlib.util.spec_from_file_location('bake_unit', ROOT / 'tools' / 'bake-unit.py')
BU = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(BU)
sys.argv = _saved

CFG = BU.CFG[UNIT]; HV = CFG.get('hover', {})
REF_H = HV.get('ref_h', 2.6)


def split_rotors(body):
    """Separate the rotor geometry (above rotor_z, in world units of the imported model) into one object per side."""
    me = body.data
    zs = [v.co.z for v in me.vertices]; lo, hi = min(zs), max(zs)
    zcut = lo + (hi - lo) * HV.get('rotor_z', 0.81)          # everything this high is rotor
    zcut2 = lo + (hi - lo) * HV.get('rotor_z_outer', 0.74)   # lower, but only well out to the side (tilted ring rims)
    ymax = max(abs(v.co[HV.get('side_axis', 1)]) for v in me.vertices)
    side_axis = HV.get('side_axis', 1)            # rotors sit either side of the body along this local axis (1 = Y)
    rotors = []
    for sign in (1, -1):
        bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
        bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(me)
        for v in bm.verts: v.select = False
        for f in bm.faces:
            c = f.calc_center_median()
            side = c[side_axis] * sign
            f.select = side > HV.get('side_gap', 0.03) and (c.z > zcut or (c.z > zcut2 and side > ymax * 0.5))
        bmesh.update_edit_mesh(me)
        bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        new = [o for o in bpy.context.selected_objects if o is not body]
        if not new: continue
        r = new[0]; pts = [r.matrix_world @ v.co for v in r.data.vertices]
        if len(pts) < 20: continue
        c = sum(pts, Vector()) / len(pts)
        # spin axis = direction of least spread (the ring's normal)
        import numpy as np
        a = np.array([p - c for p in pts]); w, vec = np.linalg.eigh(a.T @ a); n = Vector(vec[:, 0])
        if n.z < 0: n = -n
        piv = bpy.data.objects.new(f'rotor_piv_{len(rotors)}', None); bpy.context.scene.collection.objects.link(piv)
        piv.matrix_world = Matrix.Translation(c) @ n.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bpy.context.view_layer.update()
        r.parent = piv; r.matrix_parent_inverse = piv.matrix_world.inverted()
        rotors.append(piv); print('ROTOR', len(pts), 'verts at', [round(x, 3) for x in c], 'axis', [round(x, 2) for x in n])
    return rotors


def tint(name):
    """Role colour variant: a Hue/Saturation node after the base colour (hue 0.5 = unchanged, +-0.5 = half the wheel)."""
    t = HV['tints'][name]
    for m in bpy.data.materials:
        if not m.use_nodes or m.name == 'lens_glow': continue
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not b or not b.inputs['Base Color'].links: continue
        nt = m.node_tree; src = b.inputs['Base Color'].links[0].from_socket
        h = nt.nodes.new('ShaderNodeHueSaturation')
        h.inputs['Hue'].default_value = t.get('hue', 0.5); h.inputs['Saturation'].default_value = t.get('sat', 1.0)
        h.inputs['Value'].default_value = t.get('val', 1.0)
        nt.links.new(src, h.inputs['Color']); nt.links.new(h.outputs['Color'], b.inputs['Base Color'])
    print('TINT', name, t)


def lens_discs(s, body, k, c):
    """Signature lenses: glowing amber discs at hover.eyes3d = [[x, y, z, r], ...] in the raw model.glb space
    (found by raycasting picks on a nose close-up), carried through the same scale + centring as the body."""
    ey = HV.get('eyes3d'); ecfg = CFG.get('eyes', {})
    if not ey: return
    col = tuple((HV.get('tints', {}).get(TINT, {}).get('lens') if TINT else None) or ecfg.get('color', (1.0, 0.32, 0.04))) + (1,)
    mat = bpy.data.materials.new('lens_glow'); mat.use_nodes = True
    bs = mat.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = col
    (bs.inputs.get('Emission Color') or bs.inputs.get('Emission')).default_value = col
    bs.inputs['Emission Strength'].default_value = ecfg.get('disc_strength', 0.45)
    nose = Vector(HV.get('nose', (-1, 0, 0)))
    for x, y, z, r in ey:
        p = Vector((x, y, z)) * k - c; rad = r * k * ecfg.get('disc_scale', 0.9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rad, location=p + nose * rad * 0.2, segments=16, ring_count=8)
        d = bpy.context.active_object; d.data.materials.append(mat)
        d.parent = body; d.matrix_parent_inverse = body.matrix_world.inverted()
    print('LENS discs', len(ey))


def build():
    s = BU.reset()
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets' / 'units' / UNIT / 'model.glb'))
    body = next(o for o in s.objects if o.type == 'MESH')
    BU.matte()
    if TINT: tint(TINT)
    # scale to the intended size, centre it, then split the rotors off in model space
    dims = body.dimensions; k = HV.get('length_m', 1.5) / max(dims)
    body.scale = (k, k, k); bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lo, hi = BU.bounds([body]); c = (lo + hi) / 2
    body.location -= c; bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    lens_discs(s, body, k, c)
    rotors = split_rotors(body) if HV.get('rotors', True) else []
    # craft = everything that moves as one; yaw turns its nose toward screen-right (three-quarter view)
    craft = bpy.data.objects.new('craft', None); s.collection.objects.link(craft)
    for o in [body] + rotors:
        o.parent = craft; o.matrix_parent_inverse = Matrix()
    yaw = bpy.data.objects.new('yaw', None); s.collection.objects.link(yaw)
    craft.parent = yaw
    yaw.rotation_euler = (0, 0, math.radians(float(os.environ.get('YAW', HV.get('yaw', 145)))))
    lo, hi = BU.bounds([body]); size = hi.z - lo.z
    base_z = HV.get('hover_m', 1.25) + size / 2        # hover height of the craft's centre above the ground (z = 0)
    return s, body, craft, rotors, base_z


def camera(s):
    h = REF_H; elev = math.radians(CFG.get('elev', 12)); span = h * BU.SPAN
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = span
    co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
    look = Vector((0, 0, (BU.FOOT_Y - 0.5) * span / math.cos(elev)))
    co.location = look + Vector((0, -math.cos(elev), math.sin(elev))) * h * 12
    co.rotation_euler = (math.pi / 2 - elev, 0, 0)
    cam.clip_start, cam.clip_end = 0.01 * h, h * 40
    px = CFG.get('frame', 256); s.render.resolution_x = s.render.resolution_y = px * BU.SS
    FL = BU.FIELD_LOOK
    BU.light('key', float(FL['key']), (math.radians(-62), 0, math.radians(55)), (1.0, 0.70, 0.42), math.radians(6))
    BU.light('front', float(FL['front']), (math.radians(70), 0, math.radians(-30)), (0.95, 0.80, 0.62), math.radians(30))
    BU.light('rim', float(FL['rim']), (math.radians(-50), 0, math.radians(-45)), (0.50, 0.72, 0.68), math.radians(12))
    return px


# ---- procedural clips: t in [0,1) -> (x, z, pitch, roll, yaw_extra, rotor_speed) -------------------------------
# pitch > 0 = nose down (the craft's nose is its local -X before yaw; pitch rotates about local Y)
def clip(name, t, base_z):
    s2 = math.sin(2 * math.pi * t); c2 = math.cos(2 * math.pi * t)
    if name == 'idle':  return 0, base_z + 0.05 * s2, 3 + 1.5 * c2, 2 * s2, 0, 1.0
    if name == 'fly':   return 0, base_z + 0.03 * s2, 14 + 2 * c2, 3 * s2, 0, 1.4
    if name == 'shoot':                                    # recoil: nose kicks up, slides back, settles
        k = math.exp(-6 * t) * math.sin(math.pi * min(1, t * 3))
        return -0.30 * k, base_z + 0.06 * k, 3 - 22 * k, 0, 0, 1.1
    if name == 'hit':
        k = math.exp(-5 * t) * math.sin(math.pi * min(1, t * 4))
        return -0.28 * k, base_z - 0.18 * k, -14 * k, 38 * k, 0, 1.0
    if name == 'death':                                    # stalls, tumbles, falls to the ground
        z = base_z * (1 - t ** 1.7) + 0.25 * t ** 1.7
        return 0.35 * t, max(z, 0.25), 3 + 70 * t ** 1.4, 40 * t ** 1.2, 0, max(0.0, 1 - t * 1.3)
    if name == 'win':                                      # a hop and a full twirl
        return 0, base_z + 0.25 * math.sin(math.pi * t), 3, 0, 360 * t, 1.6
    raise KeyError(name)


def bake():
    s, body, craft, rotors, base_z = build()
    px = camera(s)
    out = ROOT / 'assets' / 'units' / UNIT / OUT; out.mkdir(exist_ok=True)
    meta = {'frame': px, 'h': REF_H, 'foot': [0.5, BU.FOOT_Y], 'look': 'field', 'flying': True, 'clips': {}}
    spin_step = HV.get('spin_deg', 47)                     # per frame; not a divisor of 90 so blades never look frozen
    frame_no = [0]

    def pose(name, t):
        x, z, pitch, roll, yaw_x, sp = clip(name, t, base_z)
        craft.location = (x, 0, z)
        craft.rotation_euler = Euler((math.radians(roll), -math.radians(pitch), math.radians(yaw_x)), 'ZYX')   # nose is local -X: negative Y-rotation dips it
        frame_no[0] += 1
        for i, r in enumerate(rotors):
            r.rotation_euler = (0, 0, math.radians(frame_no[0] * spin_step * sp * (1 if i % 2 else -1)))
        bpy.context.view_layer.update()

    if os.environ.get('PROBE'):
        pose('idle', 0); s.render.filepath = os.environ['PROBE']; bpy.ops.render.render(write_still=True); return
    for old in out.glob('*.png'): old.unlink()
    for name, n, loop in CFG['clips']:
        for i in range(n):
            t = i / n if loop else i / (n - 1)
            pose(name, t); s.render.filepath = str(out / f'{name}_{i}.png'); bpy.ops.render.render(write_still=True)
        meta['clips'][name] = {'n': n, 'loop': loop, 'fps': CFG.get('fps', {}).get(name, 10)}
    (out / 'meta.json').write_text(json.dumps(meta))
    print('BAKED', UNIT, meta)


bake()
