"""Find a unit's signature lenses in texture space, for the "eyes" block in data/bake.json.

    blender -b --python tools/find-lenses.py -- <unit> render                 front close-up of the head -> /tmp/<unit>-head.png
    blender -b --python tools/find-lenses.py -- <unit> pick x,y,r x,y,r ...   pixel picks on that image -> lenses in texture px

Uses model.glb in rest pose with an orthographic front camera (Meshy models face -Y), framed on the top 26% of the body.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
a = sys.argv[sys.argv.index("--") + 1:]; unit, mode = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True); s = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(ROOT / "assets/units" / unit / "model.glb"))
ms = [o for o in s.objects if o.type == "MESH"]
lo = Vector((1e9,) * 3); hi = -lo
for o in ms:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
h = hi.z - lo.z; RES = 768; SPAN = h * float(__import__("os").environ.get("FRAC", 0.26))
ctr = Vector(((lo.x + hi.x) / 2, 0, hi.z - SPAN * 0.5))
cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = SPAN
co = bpy.data.objects.new("c", cam); s.collection.objects.link(co); s.camera = co
co.location = Vector((ctr.x, lo.y - h * 3, ctr.z)); co.rotation_euler = (1.5708, 0, 0)
s.render.resolution_x = s.render.resolution_y = RES

if mode == "render":
    s.render.engine = "BLENDER_EEVEE_NEXT"
    w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 1.5; s.world = w
    s.render.filepath = f"/tmp/{unit}-head.png"; bpy.ops.render.render(write_still=True); print("RENDERED", s.render.filepath)
else:
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    tex = next(n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
    W, H = tex.size

    def ray(px, py):
        wx = ctr.x + (px / RES - 0.5) * SPAN; wz = ctr.z + (0.5 - py / RES) * SPAN
        hit, loc, nrm, fi, ob, _ = s.ray_cast(dg, Vector((wx, co.location.y, wz)), Vector((0, 1, 0)))
        if not hit: return None
        me = ob.evaluated_get(dg).data; poly = me.polygons[fi]; uvl = me.uv_layers.active.data
        p = ob.matrix_world.inverted() @ loc
        ws = [(1 / ((me.vertices[me.loops[li].vertex_index].co - p).length + 1e-6), uvl[li].uv) for li in poly.loop_indices]
        t = sum(w for w, _ in ws)
        return sum(w * uv[0] for w, uv in ws) / t, sum(w * uv[1] for w, uv in ws) / t

    for spec in a[2:]:
        x, y, r = map(float, spec.split(","))
        c = ray(x, y); e = ray(x + r, y)
        if not c: print("MISS", spec); continue
        rad = ((c[0] - e[0]) ** 2 + (c[1] - e[1]) ** 2) ** 0.5 * W if e else 12
        out.append([round(c[0] * W), round((1 - c[1]) * H), max(6, round(rad))])
    print("LENSES", json.dumps(out))
