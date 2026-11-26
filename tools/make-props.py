"""Simple procedural props for units whose weapon Meshy dropped (A-pose renders lose held/attached weapons).

    blender -b --python tools/make-props.py

Writes assets/props/drill.glb: the Outrider ram spike, a fluted steel drill cone on a riveted olive collar.
The long axis is +Z; tools/bake-unit.py attach_prop aligns the longest axis with the forearm.
"""
import bpy, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, metal, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m

steel = mat("steel", (0.42, 0.42, 0.40), 0.8, 0.45)
olive = mat("olive", (0.20, 0.21, 0.13), 0.2, 0.7)
dark = mat("dark", (0.07, 0.07, 0.06), 0.4, 0.6)
parts = []
# collar housing (mounts on the forearm)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.11, depth=0.30, location=(0, 0, 0.15)); o = bpy.context.object; o.data.materials.append(olive); parts.append(o)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.125, depth=0.05, location=(0, 0, 0.30)); o = bpy.context.object; o.data.materials.append(dark); parts.append(o)
# fluted drill cone
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.10, radius2=0.0, depth=0.55, location=(0, 0, 0.60)); o = bpy.context.object
o.rotation_euler = (0, 0, math.radians(22)); o.data.materials.append(steel); parts.append(o)
bpy.ops.object.modifier_add(type="SCREW") if False else None
# spiral flute ridges
for i in range(3):
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.035, radius2=0.0, depth=0.42, location=(0, 0, 0.55)); r = bpy.context.object
    a = i * 2 * math.pi / 3; r.location = (0.055 * math.cos(a), 0.055 * math.sin(a), 0.55); r.rotation_euler = (0.18 * math.sin(a), -0.18 * math.cos(a), a)
    r.data.materials.append(steel); parts.append(r)
for p in parts: p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); bpy.ops.object.shade_flat()
bpy.ops.export_scene.gltf(filepath=str(ROOT / "assets/props/drill.glb"), export_format="GLB")
print("wrote drill.glb")
