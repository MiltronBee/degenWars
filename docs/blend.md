# Blending units into the field

*25 Nov 2026. Lab: http://localhost:8811/lab/blend.html (presets Current / Recommended / Rec + post FX, plus an A/B flip). Screenshots: `shots/blend-*.jpg`.*

## Diagnosis

Measured on `art/field.webp`: the ground under the battle lanes has a median luminance of **42/255**. The v1 Soldier had a median of **~100**, with bone-white tanks at ~200, a cool even key from the front, hard CG edges and nothing touching the ground except a flat ellipse. It was twice as bright as the place it stood, lit from the wrong side, and floating. The paint pass could not fix that: the problem is the **light**, not the surface.

## Recommended stack

Most of the gain comes from the first layer. Each later layer is smaller and cheaper.

| Layer | What | Why | Cost |
|---|---|---|---|
| **1. Bake** `--look field` | Light the unit the way the painting is lit. The painting itself is the world HDRI (ambient comes from its sky and mud). A low warm-ochre key comes from the **back-left** (the horizon glow), a teal rim from the back-right (the smoke sky), and a weak warm front fill. Albedo is multiplied by (0.60, 0.57, 0.50), cavity AO grime is mixed toward burnt umber, and AgX tone mapping is used. | Puts the unit in the field's value range (median 39 vs ground 42) and colour temperature, and gives the backlit silhouette with a warm edge that the painted giant mech has. **This is 70% of the result.** | +0 runtime. Bake ≈1 min/unit on the 3090; the first run compiles the AO kernel (~2.5 min, once). |
| **2. Pack** `--look field` | A light Kuwahara at 2x (paint clumping), a 15% gradient map into the art-brief palette (saturated accents kept), a soft highlight knee (nothing above aged ivory), the field's own impasto texture at 6%, **mud creeping up the bottom 9% of the feet**, a broken carbon contour **only on the shadow side**, and a soft ragged alpha edge. | Removes the cut-out edge and the CG smoothness, and grounds the feet. | +0 runtime. About 2 s/unit. |
| **3. Runtime** (all batched sprites, **no full-screen passes**) | **Light-probe tint**: each frame, `setTint` toward the colour of the painting behind the unit, read from a 40×23 blurred copy. Units warm up near the glow and cool down in the teal smoke, and the near lanes darken a little. **Soft cast shadow** thrown forward-right (away from the back-left light) plus a tight contact blob. **Painted foreground clumps** (`art/fg-tufts.webp`) overlapping the feet on each lane, plus a dark band at the screen bottom. **Lane haze**: a tint-filled twin sprite in the local air colour, 0–14% on far lanes. **Drifting smoke**: one tilesprite between the lanes. | Ties each unit to the place where it stands and the time it stands there. Foreground overlap is the classic DKC depth cue. | Per unit: 1 twin sprite + 2 shadow sprites + 1 `setTint`. Scene: ~10–15 clump sprites + 1 tilesprite. All batch on WebGL, so this is safe on mobile. |

**Optional, not recommended by default:**
- **Post FX** (camera `colorMatrix` grade + `vignette`): two full-screen framebuffer passes. These cost real fill-rate on low-end phones. They unify slightly more, but they also re-grade the painting. Use only on desktop or high-tier devices.
- **Light overlay** (screen-blended glow and dark foreground quads): this re-lights the painting itself and washes it out. Rejected.

## Tried and rejected

- **Strong pack-time painting** (Kuwahara r4, 40% gradient map, lifted blacks, 16% field texture): the unit went grey and looked **translucent**. The field's own brush marks on the unit read as see-through. Kept only light versions: texture at 6%, rotated 90° so its strokes cross the field's.
- **Procedural canvas grass**: comb-like and vector-clean, against the brief. Replaced with one Gemini-painted clump sheet (`tools/gen-foreground.py`, one image, keyed and split into 9 clumps).
- **True left-facing enemy bake** (`--face left`, implemented): it keeps the light on the correct side, but at this camera the rotated model shows its back and gun arm and reads as "walking away". FlipX of the right-facing sheet reads better, costs no second sheet, and the rim swap is hard to notice at game scale. **Keep flipX.**
- **Toon / Shader-to-RGB look**: Eevee-only and needs a GL context on the headless box. The brief wants painterly, not cel. Not pursued.
- **Per-sprite preFX colorMatrix for lane grading**: one FBO pass per sprite, which is bad on mobile. Replaced by `setTint` + tint-fill twin, which give the same result for these small amounts.

## Pipeline for every future unit

```
blender -b --python tools/bake-unit.py -- <unit> --look field --out frames-v2
python3 tools/pack-unit.py <unit> --look field --frames frames-v2 --name sheet-v2 --size 224
```
- Bake with `--look field`. Leave the light directions alone: they encode the field's light (glow back-left, teal right). A **new battlefield painting with different light** needs a new light set. Sample it the same way: field median luminance, glow position, sky hue.
- Very pale or very saturated Meshy textures: tune `FIELD_LOOK='{"albedo":[...]}'` per unit until the sheet's median luminance sits at **35–55** (ground is 42).
- Pack at `--size 224` (the display height is ~270 logical px, and 192 was upscaled soft). Memory: ~2.0k×1.3k RGBA ≈ 10 MB VRAM per unit type. Mirrored enemies are free with flipX.
- Runtime: copy the probe / shadow / haze / tuft code from `lab/blend.html` (`sample()`, `update()`, `buildTufts()`) into the game scene. Shadows always fall to screen-right, for both sides.
- Tuning hooks: `FIELD_LOOK` (bake) and `FIELD_PACK` (pack) env JSON overrides. Defaults reproduce the old outputs when `--look` is omitted.

## Owner decisions

1. **Readability vs blend.** The recommended units are much closer to the painting and therefore quieter. If they need to pop more in fights, raise the bake `exposure` (0.25 → 0.5) or lower the probe darkening. The lab makes it easy to judge.
2. **Post FX on desktop only?** Yes or no. The default is off.
3. **Adopt `sheet-v2` in the game** (`index.html` untouched): swap the sheet name and port the runtime bits.


## Signature lights survive the field look (`eyes` in data/bake.json)

The field look darkens everything, so the Grunt's three-lens face vanished. Per-unit `eyes` config:
`lenses` = [[x, y, r], ...] circles in pixels of the base-colour texture (y down, as in an image editor),
`plate` = [x0, y0, x1, y1] area darkened to gunmetal (`plate_rgb`), `color`, `strength` (texture-mask
emission), `disc_strength` / `disc_scale` (a glowing disc dropped into each lens ring, mapped from UV to 3D
through the mesh and parented to the `bone`, default Head). Keep emission LOW (disc ~0.45): AgX bleaches
bright emission to white and the pack knee caps it, so a strong glow reads as a white dot, not amber.
Soldier: three amber lenses [1.0, 0.32, 0.04]. Disable with EYES=0. Idea: lens colour = faction colour.
