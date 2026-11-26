"""Procedural weapon props for the roster (Meshy drops held weapons, so they are separate pieces on the forearm/hand).

    blender -b --python tools/make-weapons.py

Writes assets/props/{railrifle,pike,shield,sword}.glb. The LONG axis of each is Z (tools/bake-unit.py attach_prop aligns
the longest axis with the forearm). Low-poly, flat-shaded, art-brief palette; the field look grimes them in the bake.
"""
import bpy, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, metal=0.3, rough=0.65):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    return m


def part(kind, mat_, loc=(0, 0, 0), rot=(0, 0, 0), **kw):
    getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(location=loc, rotation=rot, **kw)
    o = bpy.context.object; o.data.materials.append(mat_); return o


def box(m, size, loc, rot=(0, 0, 0)):
    o = part('cube', m, loc, rot, size=1); o.scale = size; return o


def save(name, parts):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join(); bpy.ops.object.shade_flat()
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets' / 'props' / f'{name}.glb'), export_format='GLB')
    print('wrote', name)


STEEL = (0.40, 0.40, 0.38); DARK = (0.08, 0.08, 0.07); OLIVE = (0.21, 0.22, 0.14); OXIDE = (0.36, 0.16, 0.10)
BRASS = (0.45, 0.33, 0.14); ORANGE = (0.85, 0.40, 0.08)

# --- rail rifle: long barrel with cooling fins, boxy receiver, scope, muzzle brake (Longshot) ---------------------
reset(); s, d, o = mat('steel', STEEL, 0.8, 0.45), mat('dark', DARK, 0.4, 0.6), mat('olive', OLIVE, 0.2, 0.7)
ps = [part('cylinder', s, (0, 0, 0.55), vertices=10, radius=0.028, depth=1.1),            # barrel
      box(o, (0.10, 0.08, 0.32), (0, 0, -0.10)),                                          # receiver
      box(d, (0.06, 0.05, 0.16), (0, -0.07, -0.18)),                                      # magazine
      part('cylinder', d, (0, 0, 1.12), vertices=8, radius=0.05, depth=0.10),            # muzzle brake
      part('cylinder', d, (0.075, 0, 0.0), vertices=10, radius=0.03, depth=0.26),        # scope
      part('cylinder', mat('orange', ORANGE, 0.1, 0.5), (0.075, 0, 0.14), vertices=10, radius=0.034, depth=0.02)]
for i in range(6): ps.append(part('cylinder', d, (0, 0, 0.18 + i * 0.07), vertices=10, radius=0.045, depth=0.018))   # fins
save('railrifle', ps)

# --- drill pike: long shaft, drill head with spiral flutes, guard prongs, butt drill (Lancer) -------------------
reset(); s, d, o = mat('steel', STEEL, 0.8, 0.45), mat('dark', DARK, 0.4, 0.6), mat('olive', OLIVE, 0.2, 0.7)
ps = [part('cylinder', o, (0, 0, 0), vertices=8, radius=0.03, depth=2.2),
      part('cone', s, (0, 0, 1.30), vertices=8, radius1=0.075, radius2=0.0, depth=0.40),
      part('cone', s, (0, 0, -1.20), vertices=8, radius1=0.0, radius2=0.05, depth=0.22),
      part('cylinder', d, (0, 0, 1.08), vertices=8, radius=0.05, depth=0.08)]
for side in (-1, 1): ps.append(box(d, (0.16, 0.025, 0.04), (side * 0.07, 0, 1.02)))
for i in range(3):
    a = i * 2 * math.pi / 3
    ps.append(part('cone', s, (0.035 * math.cos(a), 0.035 * math.sin(a), 1.28), (0.15 * math.sin(a), -0.15 * math.cos(a), a), vertices=4, radius1=0.025, radius2=0.0, depth=0.32))
save('pike', ps)

# --- tower shield: tall riveted boiler-plate slab, oxide-red band, bolted grip (Lancer) --------------------------
reset(); s, d, o, r = mat('steel', STEEL, 0.6, 0.5), mat('dark', DARK, 0.4, 0.6), mat("olive", (0.15, 0.16, 0.10), 0.3, 0.7), mat('oxide', OXIDE, 0.2, 0.7)
ps = [box(o, (0.46, 0.05, 1.25), (0, 0, 0)),
      box(o, (0.40, 0.03, 1.20), (0, -0.035, 0)),                                         # inner plate step
      box(r, (0.465, 0.055, 0.14), (0, 0, 0.10)),                                         # oxide-red band
      box(d, (0.06, 0.08, 0.30), (0, 0.06, 0))]                                           # grip bracket (behind)
for x in (-0.20, 0.20):
    for z in (-0.55, -0.27, 0.0, 0.27, 0.55):
        ps.append(part('uv_sphere', s, (x, -0.03, z), segments=6, ring_count=4, radius=0.018))
ps.append(box(o, (0.46, 0.05, 0.02), (0, -0.01, 0.0)))                                    # horizontal seam
save('shield', ps)

# --- sword: long heavy blade made from a sharpened machine part, brass guard (Commander) --------------------------
reset(); s, d, b = mat('steel', (0.50, 0.50, 0.48), 0.85, 0.35), mat('dark', DARK, 0.4, 0.6), mat('brass', BRASS, 0.8, 0.4)
blade = box(s, (0.11, 0.022, 1.05), (0, 0, 0.62))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
for v in blade.data.vertices:                                                             # clipped point at the tip
    if v.co.z > 0.4 and v.co.x > 0: v.co.z -= 0.18
ps = [blade, box(b, (0.24, 0.06, 0.04), (0, 0, 0.08)),                                    # guard
      part('cylinder', d, (0, 0, -0.06), vertices=8, radius=0.025, depth=0.22),          # grip
      part('uv_sphere', b, (0, 0, -0.19), segments=8, ring_count=6, radius=0.035)]       # pommel
for i in range(4): ps.append(box(d, (0.03, 0.026, 0.05), (-0.035, 0, 0.3 + i * 0.18)))   # machined slots
save('sword', ps)
