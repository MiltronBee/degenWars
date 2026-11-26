"""
Bake one rigged unit into side-view sprite frames, Donkey Kong Country style (run inside Blender):

  blender -b --python tools/bake-unit.py -- soldier
  blender -b --python tools/bake-unit.py -- soldier --look field --out frames-v2

Options (after --, any order; the defaults reproduce the original bake):
  --look default|field   'field' lights the unit like art/field.webp (docs/blend.md): the painting itself as the
                         world HDRI, a low warm key from back-left (the horizon glow), a teal sky rim from back-right,
                         albedo pulled down into the field palette, cavity grime (AO) and AgX tone mapping.
  --out <dir>            frames folder inside assets/units/<unit>/ (default 'frames')
  --face right|left      left = bake the enemy facing instead of mirroring the sheet (default right)

Reads   assets/units/<unit>/anim.glb   (rigged + UAL clips, see tools/meshy-unit.py and retarget-anims.py)
        data/bake.json                 per-unit options: prop, yaw, elevation, clips
Writes  assets/units/<unit>/frames/<clip>_<i>.png + meta.json   (tools/pack-unit.py turns them into the sheet)

One facing only: the unit faces screen-right; enemies are mirrored in the game. The MODEL is rotated, not the
camera, so the light always comes from the same screen direction. Orthographic camera, low elevation, so the
battlefield reads as a side-on 2.5D stage.
"""
import json, math, os, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, geometry

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / 'data' / 'bake.json').read_text())
SS = 2            # supersampling; the packer downsizes
FOOT_Y = 0.84     # ground point, as a fraction of the frame from the top
SPAN = 1.35       # frame width/height in unit-heights (room for weapons and death falls); data/bake.json <unit>.span overrides it

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = {'look': 'default', 'out': 'frames'}
UNITS = []
_i = 0
while _i < len(ARGV):
    if ARGV[_i].startswith('--'): OPT[ARGV[_i][2:]] = ARGV[_i + 1]; _i += 2
    else: UNITS.append(ARGV[_i]); _i += 1
FIELD = OPT['look'] == 'field'
# 'field' look, measured from art/field.webp: ground under the lanes has median luminance ~42/255, the old
# bake ~100. These numbers pull the unit into the painting's value range and colour temperature.
FIELD_LOOK = {
    'albedo': (0.60, 0.57, 0.50),     # multiply every base colour: kills the bone-white tanks, warms toward raw umber
    'grime': 0.55,                    # AO strength: crevices go to burnt umber, like accumulated dirt
    'grime_rgb': (0.36, 0.28, 0.21),  # burnt umber #5C4838
    'hdri': 'art/field.webp', 'hdri_strength': 0.55, 'hdri_rot': 130,
    'exposure': 0.25,
    'key': 7.0, 'front': 1.1, 'rim': 5.0,   # sun strengths
}
FIELD_LOOK.update(json.loads(os.environ.get('FIELD_LOOK', '{}')))   # tuning overrides, e.g. FIELD_LOOK='{"exposure":0}'


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind; prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices: d.use = d.type == kind
                s.cycles.device = 'GPU'; break
        except Exception:  # noqa: BLE001
            continue
    s.cycles.samples = 48; s.cycles.use_denoising = True; s.cycles.max_bounces = 3
    s.render.use_persistent_data = True
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.66, 0.62, 0.55, 1)   # dusty warm ambient
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.7
    s.world = w
    if FIELD:   # the painting itself as the environment: its sky and mud colour the ambient and the bounce
        nt = w.node_tree; bg = nt.nodes['Background']
        env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(str(ROOT / FIELD_LOOK['hdri']))
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(FIELD_LOOK['hdri_rot']))
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        nt.links.new(env.outputs['Color'], bg.inputs[0]); bg.inputs[1].default_value = FIELD_LOOK['hdri_strength']
        s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Base Contrast'
        s.view_settings.exposure = FIELD_LOOK['exposure']
    return s


def light(name, energy, rot, color, angle):
    l = bpy.data.lights.new(name, 'SUN'); l.energy = energy; l.color = color; l.angle = angle
    o = bpy.data.objects.new(name, l); o.rotation_euler = rot; bpy.context.scene.collection.objects.link(o)


def bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get(); lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    return lo, hi


def matte():
    """Matte + field look on every material not yet treated (safe to call again after props are imported)."""
    for m in bpy.data.materials:
        if m.get('matted') or m.name == 'lens_glow': continue
        m['matted'] = True
        if m.use_nodes:
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b:
                b.inputs['Roughness'].default_value = 0.7
                b.inputs['Metallic'].default_value = 0.15
                if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0.3
                if FIELD: field_albedo(m.node_tree, b)
                if EYES and EYES.get('lenses'): eyes(m.node_tree, b)


EYES = None   # set per unit from data/bake.json "eyes"


def eyes(nt, b):
    """Signature lenses: an emission mask painted in texture space (circles in pixel coords of the base-colour map,
    y down as in an image editor), so the face survives the dark field look. The plate around them goes gunmetal."""
    import numpy as np
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0), None)
    if tex is None: return
    W, H = tex.image.size
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    iy = H - 1 - yy                       # Blender pixel rows start at the bottom
    glow = np.zeros((H, W), np.float32); plate = np.zeros((H, W), np.float32)
    for x, y, r in EYES['lenses']:
        d = np.sqrt((xx - x) ** 2 + (iy - y) ** 2) / r
        glow = np.maximum(glow, np.clip(1.15 - d, 0, 1) ** 0.6)
    x0, y0, x1, y1 = EYES['plate']
    plate[(xx >= x0) & (xx <= x1) & (iy >= y0) & (iy <= y1)] = 1
    rgba = np.stack([glow, plate, np.zeros_like(glow), np.ones_like(glow)], -1).ravel()
    img = bpy.data.images.new('eyes_mask', W, H, float_buffer=True); img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba)
    mt = nt.nodes.new('ShaderNodeTexImage'); mt.image = img; mt.interpolation = 'Linear'
    if tex.inputs['Vector'].links: nt.links.new(tex.inputs['Vector'].links[0].from_socket, mt.inputs['Vector'])
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(mt.outputs['Color'], sep.inputs[0])
    sock = b.inputs['Base Color']; src = sock.links[0].from_socket if sock.links else None
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'
    nt.links.new(sep.outputs[1], mix.inputs['Fac'])
    mix.inputs['Color2'].default_value = tuple(EYES.get('plate_rgb', (0.35, 0.34, 0.33))) + (1,)
    if src: nt.links.new(src, mix.inputs['Color1'])
    else: mix.inputs['Color1'].default_value = tuple(sock.default_value)
    mix2 = nt.nodes.new('ShaderNodeMixRGB'); mix2.blend_type = 'MIX'
    nt.links.new(sep.outputs[0], mix2.inputs['Fac']); nt.links.new(mix.outputs['Color'], mix2.inputs['Color1'])
    mix2.inputs['Color2'].default_value = tuple(EYES['color']) + (1,)
    for l in list(sock.links): nt.links.remove(l)
    nt.links.new(mix2.outputs['Color'], sock)
    em = b.inputs.get('Emission Color') or b.inputs.get('Emission')
    em.default_value = tuple(EYES['color']) + (1,)
    st = nt.nodes.new('ShaderNodeMath'); st.operation = 'MULTIPLY'; st.inputs[1].default_value = EYES.get('strength', 6)
    nt.links.new(sep.outputs[0], st.inputs[0]); nt.links.new(st.outputs[0], b.inputs['Emission Strength'])


def lens_front(s, arm, body):
    """Glowing lens discs from picks on a FRONT close-up (tools/find-lenses.py render, 768 px, top 26% of the body).
    eyes.front = [[x, y, r], ...] in that image's pixels. Raycast on the REST pose of the rig, so the framing matches the
    tool, then parent each disc to the head bone and return to the posed rig."""
    cfg = EYES; col = tuple(cfg['color']) + (1,)
    mat = bpy.data.materials.new('lens_glow'); mat.use_nodes = True
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = col
    (bs.inputs.get('Emission Color') or bs.inputs.get('Emission')).default_value = col
    bs.inputs['Emission Strength'].default_value = cfg.get('disc_strength', 0.45)
    piv = arm.parent; saved = piv.rotation_euler.copy() if piv else None
    if piv: piv.rotation_euler = (0, 0, 0)
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    lo, hi = bounds(body); h = hi.z - lo.z; RES = 768; SPAN = h * 0.26
    cx, cz = (lo.x + hi.x) / 2, hi.z - SPAN * 0.5
    dg = bpy.context.evaluated_depsgraph_get(); made = []
    hide = []
    for x, y, r in cfg['front']:
        wx = cx + (x / RES - 0.5) * SPAN; wz = cz + (0.5 - y / RES) * SPAN
        hit, loc, nrm, fi, ob, _ = s.ray_cast(dg, Vector((wx, lo.y - h, wz)), Vector((0, 1, 0)))
        if not hit: print('LENS miss', x, y); continue
        rad = r / RES * SPAN * cfg.get('disc_scale', 0.9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rad, location=loc + Vector((0, rad * 0.3, 0)), segments=16, ring_count=8)
        sph = bpy.context.active_object; sph.data.materials.append(mat); made.append(sph)
    bpy.context.view_layer.update()
    for sph in made:
        keep = sph.matrix_world.copy()
        sph.parent = arm; sph.parent_type = 'BONE'; sph.parent_bone = cfg.get('bone', 'Head')
        bpy.context.view_layer.update(); sph.matrix_world = keep
    arm.data.pose_position = 'POSE'
    if piv:
        # discs were placed in the un-rotated frame; re-parent them under the same pivot rotation as the body
        piv.rotation_euler = saved
    bpy.context.view_layer.update()
    print('LENS discs', len(made))
    return made


def lens_lights(s, arm, body):
    """Fill each lens ring with a glowing disc parented to the head bone. The ring centre and radius come from the
    mesh vertices whose UVs fall inside each lens circle of the eyes config, measured on the current pose."""
    import bmesh
    cfg = EYES; col = tuple(cfg['color']) + (1,)
    mat = bpy.data.materials.new('lens_glow'); mat.use_nodes = True
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = col
    (bs.inputs.get('Emission Color') or bs.inputs.get('Emission')).default_value = col
    bs.inputs['Emission Strength'].default_value = cfg.get('disc_strength', cfg.get('strength', 6))
    dg = bpy.context.evaluated_depsgraph_get(); made = []
    for o in body:
        ev = o.evaluated_get(dg); me = ev.to_mesh(); me.calc_loop_triangles()
        uvl = me.uv_layers.active
        tex = next((n.image for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes
                    if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0), None)
        if uvl is None or tex is None: ev.to_mesh_clear(); continue
        W, H = tex.size
        for x, y, r in cfg['lenses']:
            u0, v0, ru = x / W, 1 - y / H, r / W
            # sample the ring in UV space and carry each sample to 3D through the triangle that contains it
            samples = [Vector((u0 + ru * 0.85 * math.cos(t * math.pi / 8), v0 + ru * 0.85 * math.sin(t * math.pi / 8), 0)) for t in range(16)]
            ws = []
            for tri in me.loop_triangles:
                uv = [Vector((*uvl.data[li].uv, 0)) for li in tri.loops]
                if max(abs(q.x - u0) for q in uv) > 0.2 or max(abs(q.y - v0) for q in uv) > 0.2: continue
                for sp in samples:
                    if geometry.intersect_point_tri_2d(sp, *uv):
                        co = [ev.matrix_world @ me.vertices[vi].co for vi in tri.vertices]
                        ws.append(geometry.barycentric_transform(sp, *uv, *co))
            if len(ws) < 6: continue
            c = sum(ws, Vector()) / len(ws)
            rad = sum((w - c).length for w in ws) / len(ws)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=rad * cfg.get('disc_scale', 0.9), location=c, segments=16, ring_count=8)
            sph = bpy.context.active_object; sph.data.materials.append(mat); made.append(sph)
        ev.to_mesh_clear()
    bpy.context.view_layer.update()
    for sph in made:
        keep = sph.matrix_world.copy()
        sph.parent = arm; sph.parent_type = 'BONE'; sph.parent_bone = cfg.get('bone', 'Head')
        bpy.context.view_layer.update(); sph.matrix_world = keep
    print('LENS discs', len(made))
    return made


def field_albedo(nt, b):
    """base colour x field tint, then x cavity grime: mix toward burnt umber where AO is low."""
    sock = b.inputs['Base Color']
    src = sock.links[0].from_socket if sock.links else None
    rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = tuple(sock.default_value)
    src = src or rgb.outputs[0]
    mul = nt.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs['Fac'].default_value = 1.0
    nt.links.new(src, mul.inputs['Color1']); mul.inputs['Color2'].default_value = tuple(FIELD_LOOK["albedo"]) + (1,)
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.samples = 8; ao.inputs['Distance'].default_value = 0.06
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'MULTIPLY_ADD'
    nt.links.new(ao.outputs['AO'], inv.inputs[0]); inv.inputs[1].default_value = -FIELD_LOOK['grime']; inv.inputs[2].default_value = FIELD_LOOK['grime']
    grime = nt.nodes.new('ShaderNodeMixRGB'); grime.blend_type = 'MIX'
    nt.links.new(inv.outputs[0], grime.inputs['Fac']); nt.links.new(mul.outputs['Color'], grime.inputs['Color1'])
    grime.inputs['Color2'].default_value = tuple(FIELD_LOOK["grime_rgb"]) + (1,)
    for l in list(sock.links): nt.links.remove(l)
    nt.links.new(grime.outputs['Color'], sock)


def attach_prop(s, arm, spec, unit_h):
    """Import a prop (e.g. the Quaternius rifle), align its long axis with the forearm in the given pose, parent it to the hand."""
    before = set(s.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(spec['file']).expanduser()))
    new = [o for o in s.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    root = bpy.data.objects.new('prop', None); s.collection.objects.link(root)
    for o in new:
        if o.parent is None or o.parent not in new: o.parent = root
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes); size = hi - lo
    ax = max(range(3), key=lambda i: size[i])            # the barrel runs along the longest axis
    scale = spec.get('length', 0.5) * unit_h / size[ax]
    # centre the prop in its own space, then scale
    ctr = (lo + hi) / 2
    for o in new:
        if o.parent == root: o.location -= ctr
    root.scale = (scale,) * 3
    # pose: put the arm in the aiming clip
    ad = arm.animation_data
    act = next((a for a in bpy.data.actions if a.name.startswith(spec.get('pose', 'aim'))), None)
    if act: ad.action = act; s.frame_set(int(sum(act.frame_range) / 2))
    bpy.context.view_layer.update()
    pb_h, pb_f = arm.pose.bones[spec.get('bone', 'RightHand')], arm.pose.bones[spec.get('from', 'RightForeArm')]
    mw = arm.matrix_world
    hand = mw @ pb_h.head; fore = mw @ pb_f.head
    d = (hand - fore).normalized()
    axis = Vector([1 if i == ax else 0 for i in range(3)]) * (spec.get('flip', 1))
    rot = axis.rotation_difference(d).to_matrix().to_4x4()
    roll = Matrix.Rotation(math.radians(spec.get('roll', 0)), 4, d)
    root.matrix_world = Matrix.Translation(hand + d * spec.get('forward', 0.18) * unit_h * spec.get('length', 0.5)) @ roll @ rot @ Matrix.Diagonal((scale, scale, scale, 1))
    bpy.context.view_layer.update()
    keep = root.matrix_world.copy()
    root.parent = arm; root.parent_type = 'BONE'; root.parent_bone = spec.get('parent', spec.get('bone', 'RightHand'))
    bpy.context.view_layer.update()
    root.matrix_world = keep
    return meshes


def bake(unit):
    global EYES
    cfg = CFG[unit]; d = ROOT / 'assets' / 'units' / unit
    EYES = cfg.get('eyes') if os.environ.get('EYES', '1') != '0' else None
    out = d / OPT['out']; out.mkdir(exist_ok=True)
    for old in out.glob('*.png'): old.unlink()
    s = reset()
    bpy.ops.import_scene.gltf(filepath=str(d / 'anim.glb'))
    arm = next(o for o in s.objects if o.type == 'ARMATURE')
    for o in [o for o in s.objects if o.type == 'MESH' and o.find_armature() is None]:
        bpy.data.objects.remove(o, do_unlink=True)          # stray bone-shape meshes
    body = [o for o in s.objects if o.type == 'MESH']
    matte()
    ad = arm.animation_data or arm.animation_data_create()
    for tr in ad.nla_tracks: tr.mute = True
    acts = {a.name.split('_Armature')[0]: a for a in bpy.data.actions}
    # measure on the idle pose, facing screen-right
    pivot = bpy.data.objects.new('pivot', None); s.collection.objects.link(pivot)
    for o in list(s.objects):
        if o.parent is None and o is not pivot and o.type in ('ARMATURE', 'MESH', 'EMPTY'): o.parent = pivot
    yaw = float(os.environ.get('YAW', cfg.get('yaw', 65)))
    if OPT.get("face") == "left": yaw = -yaw   # a real left-facing bake keeps the field light on the correct side (flipX would swap it)
    pivot.rotation_euler = (0, 0, math.radians(yaw))
    ad.action = acts['idle']; s.frame_set(int(acts['idle'].frame_range[0])); bpy.context.view_layer.update()
    lo, hi = bounds(body); h = hi.z - lo.z
    specs = cfg.get('props') or ([cfg['prop']] if cfg.get('prop') else [])   # 'props': a list, e.g. pike + shield
    props = [m for sp in specs for m in attach_prop(s, arm, sp, h)]
    if props: matte()                          # props get the same matte + field look as the body
    if EYES: (lens_front if EYES.get('front') else lens_lights)(s, arm, body)
    if props:
        bpy.context.view_layer.update(); plo, phi = bounds(props); print('PROP bounds', [round(x,2) for x in plo], [round(x,2) for x in phi], 'unit h', round(h,2), 'hand', [round(x,2) for x in (arm.matrix_world @ arm.pose.bones[specs[0].get('bone', 'RightHand')].head)])
    ad.action = acts['idle']; s.frame_set(int(acts['idle'].frame_range[0])); bpy.context.view_layer.update()
    lo, hi = bounds(body)
    c = (lo + hi) / 2
    pivot.location = Vector((-c.x, -c.y, -lo.z)) + pivot.location
    # camera
    elev = math.radians(cfg.get('elev', 12)); span = h * cfg.get('span', SPAN)   # per-unit "span": wider frame for long reaches (default SPAN)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = span
    co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
    look = Vector((0, 0, (FOOT_Y - 0.5) * span / math.cos(elev)))
    co.location = look + Vector((0, -math.cos(elev), math.sin(elev))) * h * 12
    co.rotation_euler = (math.pi / 2 - elev, 0, 0)
    cam.clip_start, cam.clip_end = 0.01 * h, h * 40
    px = cfg.get('frame', 256)
    s.render.resolution_x = s.render.resolution_y = px * SS
    if FIELD:   # the field's light: low glowing horizon at back-left, teal smoke sky at right, mud bounce below
        light("key", float(FIELD_LOOK["key"]), (math.radians(-62), 0, math.radians(55)), (1.0, 0.70, 0.42), math.radians(6))    # ochre horizon glow, back-left
        light("front", float(FIELD_LOOK["front"]), (math.radians(70), 0, math.radians(-30)), (0.95, 0.80, 0.62), math.radians(30))  # weak warm front so forms read
        light("rim", float(FIELD_LOOK["rim"]), (math.radians(-50), 0, math.radians(-45)), (0.50, 0.72, 0.68), math.radians(12))  # teal sky rim, back-right
    else:
        light('key', 3.6, (math.radians(50), 0, math.radians(-40)), (1.0, 0.93, 0.82), math.radians(8))     # warm low sun, upper left
        light('fill', 0.7, (math.radians(65), 0, math.radians(75)), (0.78, 0.84, 0.9), math.radians(35))    # cold ash fill
        light('rim', 2.2, (math.radians(-55), 0, math.radians(170)), (0.95, 0.85, 0.7), math.radians(10))   # dusty rim from behind
    meta = {'frame': px, 'h': h, 'span': cfg.get('span', SPAN), 'foot': [0.5, FOOT_Y], 'look': OPT['look'], 'clips': {}}
    if os.environ.get('PROBE'):   # one idle still per yaw, for picking the angle
        ad.action = acts['idle']; s.frame_set(int(acts['idle'].frame_range[0]))
        s.render.filepath = os.environ['PROBE']; bpy.ops.render.render(write_still=True); return
    for clip, n, loop in cfg['clips']:
        act = acts.get(clip)
        if act is None: print('MISSING', clip, list(acts)); continue
        ad.action = act
        a, b = act.frame_range
        frames = [a + (b - a) * i / n for i in range(n)] if loop else [a + (b - a) * i / (n - 1) for i in range(n)]
        for i, f in enumerate(frames):
            s.frame_set(int(f), subframe=f - int(f))
            s.render.filepath = str(out / f'{clip}_{i}.png'); bpy.ops.render.render(write_still=True)
        meta['clips'][clip] = {'n': n, 'loop': loop, 'fps': cfg.get('fps', {}).get(clip, 10)}
    (out / 'meta.json').write_text(json.dumps(meta))
    print('BAKED', unit, meta)


for u in UNITS:
    bake(u)
