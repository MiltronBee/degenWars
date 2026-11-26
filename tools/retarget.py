"""Retarget Universal Animation Library clips onto a Meshy-rigged unit (degenWars).

    blender -b --python tools/retarget.py -- rigged.glb UAL1.glb anim.glb unit=soldier \
        idle=Idle_Loop walk=Walk_Loop shoot=Pistol_Shoot ...

A fork of ~/solFighter/scripts/retarget-anims.py (read that docstring for the basics: world-space,
per-bone, `C = src_rest^-1 * tgt_rest`, `tgt_pose = src_pose * C`; keep= / damp= / trans= work the same).
This version adds REST-POSE ALIGNMENT, which the original lacks and Meshy rigs need.

WHY. `C` makes the target bone swing as far from ITS rest as the source bone swung from ITS rest. That is
only right when both rigs rest in the same pose. UAL rests in a T-pose (upper arm along +-X). Meshy's
auto-rig binds in an A-pose - on the soldier the upper arms rest ~70 degrees BELOW horizontal. So every
clip carried that 70 degrees along: when the source arm hangs at the side (90 degrees down from T), the
soldier's arm was driven 70 degrees further, through the hips and across the body. Idle, walk, shoot: all
of them had the arms crossed in front of / inside the torso.

FIX. For the aligned bones, find the smallest world rotation R that turns the target's rest bone direction
(head -> child head) onto the source's rest direction, and use the "as if it had been bound in the source's
pose" rest instead:

    C = src_rest^-1 * (R * tgt_rest)

Now the target bone points exactly where the source bone points, in every frame, whatever pose the target
was bound in. Nothing is re-bound and the mesh is untouched - it is only a different constant. A bone with
no mapped child (the hand) inherits its parent's R.

WHICH BONES. `align=arms` (default): upper arm, forearm, hand. `align=arms+legs`, `align=all`, `align=none`
(= the old behaviour). Legs are NOT aligned by default on purpose: a mech bound with bent, digitigrade legs
should keep that stance, and the offset-preserving maths does exactly that. Clavicles are never aligned -
they carry the pauldrons, and swinging them to the source's clavicle angle would move the shoulder joint.

ARM SPREAD. A bulky torso is wider than the mannequin's, so an arm hanging straight down can still sink
into the hull. `spread=<degrees>` swings each arm chain outwards about the chest's forward axis, weighted by
how much the upper arm hangs DOWN (full when hanging, zero at or above horizontal), so aiming and raised
arms are not disturbed. `fwd=<degrees>` does the same about the chest's side axis (arms slightly forward).

JOINED CLIPS. `attack2=Melee_Hook+Melee_Hook_Rec` plays the source clips back to back as ONE output clip (UAL2
ships a strike and its recovery as two clips; a sprite attack needs both). The first frame of each later part
is dropped - it repeats the last frame of the part before it. `heavy=Sword_Heavy_Combo@50-104` takes only source
frames 50..104 of a clip (a long combo often holds one good blow); ranges and joins combine: `A@0-10+B@4-20`.

PER-UNIT CONFIG. `unit=<name>` reads data/bake.json -> <name>.retarget: {"align": "arms", "arm_spread": 14,
"arm_forward": 0}. Explicit align= / spread= / fwd= arguments win.

WATCH THE SPINE. The chain runs Hips -> Spine02 -> Spine01 -> Spine, so `Spine02` is the LOWEST spine bone
and `Spine` is the chest. Mapping spine_01 to `Spine` folds the character in half.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
TARGET_GLB, SOURCE_GLB, OUT_GLB = argv[0], argv[1], argv[2]
SPECS = argv[3:]

# UAL2 (Unreal naming)  ->  villager (Mixamo-ish). Fingers and the UAL2 `root`
# have no counterpart and are dropped; the villager has no fingers at all.
BONE_MAP = {
    'pelvis': 'Hips',
    'spine_01': 'Spine02',      # lowest — see the warning above
    'spine_02': 'Spine01',
    'spine_03': 'Spine',        # chest
    'neck_01': 'neck',
    'Head': 'Head',
    'clavicle_l': 'LeftShoulder',
    'upperarm_l': 'LeftArm',
    'lowerarm_l': 'LeftForeArm',
    'hand_l': 'LeftHand',
    'clavicle_r': 'RightShoulder',
    'upperarm_r': 'RightArm',
    'lowerarm_r': 'RightForeArm',
    'hand_r': 'RightHand',
    'thigh_l': 'LeftUpLeg',
    'calf_l': 'LeftLeg',
    'foot_l': 'LeftFoot',
    'ball_l': 'LeftToeBase',
    'thigh_r': 'RightUpLeg',
    'calf_r': 'RightLeg',
    'foot_r': 'RightFoot',
    'ball_r': 'RightToeBase',
}

ROOT_BONE = 'pelvis'
CHEST = 'Spine'

# Target bones whose rest DIRECTION is aligned to the source's (see the docstring).
ALIGN_SETS = {
    'arms': ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'],
    'legs': ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
    'spine': ['Spine02', 'Spine01', 'Spine', 'neck', 'Head'],
}
ARM_CHAINS = {'L': ['LeftArm', 'LeftForeArm', 'LeftHand'], 'R': ['RightArm', 'RightForeArm', 'RightHand']}

OPT = {'align': 'arms', 'spread': 0.0, 'fwd': 0.0}
OPT_KEYS = ('unit', 'align', 'spread', 'fwd')
for _spec in SPECS:
    _k, _, _v = _spec.partition('=')
    if _k == 'unit':
        _cfg = json.loads((Path(__file__).resolve().parent.parent / 'data' / 'bake.json').read_text())
        _r = _cfg.get(_v, {}).get('retarget', {})
        OPT['align'] = _r.get('align', OPT['align'])
        OPT['spread'] = float(_r.get('arm_spread', OPT['spread']))
        OPT['fwd'] = float(_r.get('arm_forward', OPT['fwd']))
for _spec in SPECS:
    _k, _, _v = _spec.partition('=')
    if _k == 'align': OPT['align'] = _v
    elif _k in ('spread', 'fwd'): OPT[_k] = float(_v)
SPECS = [x for x in SPECS if x.partition('=')[0] not in OPT_KEYS]
_names = list(ALIGN_SETS) if OPT['align'] == 'all' else [x for x in OPT['align'].split('+') if x and x != 'none']
ALIGN = set(b for n in _names for b in ALIGN_SETS[n])
print('options:', OPT)


def find_action(pool, name):
    """Blender's glTF importer APPENDS the armature name to every action, so
    'walk' arrives as 'walk_Armature' and 'TreeChopping_Loop' as
    'TreeChopping_Loop_Armature.001'. Match the stem, not the whole string."""
    if name in pool:
        return pool[name]
    for k, v in pool.items():
        if k == name or k.startswith(name + '_') or k.endswith('|' + name):
            return v
    return None


def armature_in(objs):
    return next((o for o in objs if o.type == 'ARMATURE'), None)


def imported(before):
    return [o for o in bpy.data.objects if o not in before]


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# --- target: the villager -------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=TARGET_GLB)
tgt_objs = imported(before)
TGT = armature_in(tgt_objs)
print('target armature:', TGT.name, len(TGT.data.bones), 'bones')

# Remember the villager's own actions before the source file adds 43 more.
own_actions = {a.name: a for a in bpy.data.actions}

# --- source: the animation library ----------------------------------------
# SOURCE_GLB may be a comma-separated list (e.g. UAL1.glb,UAL2_Standard.glb). The first file's armature is
# sampled; the others only contribute their actions, which drive it by bone name (same Quaternius skeleton).
_sources = SOURCE_GLB.split(',')
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=_sources[0])
src_objs = imported(before)
SRC = armature_in(src_objs)
for _extra in _sources[1:]:
    _b = set(bpy.data.objects); _acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=_extra)
    for _a in set(bpy.data.actions) - _acts: _a.use_fake_user = True
    for _o in imported(_b): bpy.data.objects.remove(_o, do_unlink=True)
    print('extra source actions from', _extra)
print('source armature:', SRC.name, len(SRC.data.bones), 'bones')

missing = [b for b in BONE_MAP if b not in SRC.pose.bones]
missing += [b for b in BONE_MAP.values() if b not in TGT.pose.bones]
if missing:
    print('!! bones missing from rigs:', missing)

# --- constant per-bone correction, from the rest poses ---------------------
# Everything in WORLD space so the two armatures' own object transforms (glTF
# import adds its own) cannot leak into the result.
CORR = {}
for s, t in BONE_MAP.items():
    if s not in SRC.data.bones or t not in TGT.data.bones:
        continue
    s_rest = (SRC.matrix_world @ SRC.data.bones[s].matrix_local).to_quaternion()
    t_rest = (TGT.matrix_world @ TGT.data.bones[t].matrix_local).to_quaternion()
    CORR[(s, t)] = s_rest.inverted() @ t_rest

# --- rest-pose alignment ---------------------------------------------------
T2S = {t: s for s, t in BONE_MAP.items()}


def rest_dir(arm, name, mapped):
    """World direction of a bone at rest, measured head -> first MAPPED child's head. Not head -> tail: the
    glTF importer invents tails, and a tail can point anywhere."""
    b = arm.data.bones[name]
    for c in b.children:
        if c.name in mapped:
            d = (arm.matrix_world @ c.head_local) - (arm.matrix_world @ b.head_local)
            if d.length > 1e-6:
                return d.normalized()
    return None


ALIGN_R = {}


def align_rot(t):
    """Smallest world rotation taking target bone t's rest direction onto its source bone's."""
    if t in ALIGN_R:
        return ALIGN_R[t]
    r = Quaternion()
    if t in ALIGN and t in T2S and T2S[t] in SRC.data.bones:
        dt = rest_dir(TGT, t, set(T2S))
        ds = rest_dir(SRC, T2S[t], set(BONE_MAP))
        if dt is not None and ds is not None:
            r = dt.rotation_difference(ds)
        else:                                    # leaf (hand, toe): ride along with the parent
            p = TGT.data.bones[t].parent
            r = align_rot(p.name) if p is not None else Quaternion()
    ALIGN_R[t] = r
    return r


for (s, t) in list(CORR):
    r = align_rot(t)
    if r.angle > 1e-4:
        t_rest = (TGT.matrix_world @ TGT.data.bones[t].matrix_local).to_quaternion()
        s_rest = (SRC.matrix_world @ SRC.data.bones[s].matrix_local).to_quaternion()
        CORR[(s, t)] = s_rest.inverted() @ (r @ t_rest)
        print('  align %-14s rest is %5.1f deg off the source rest' % (t, math.degrees(r.angle)))

# The character's own axes at rest (world): used to express "outwards" and "forwards" for the arm spread
# in the CHEST's frame, so the correction follows the body when it leans, turns or falls over.
_hd = TGT.data.bones
_side = ((TGT.matrix_world @ _hd['LeftArm'].head_local) - (TGT.matrix_world @ _hd['RightArm'].head_local)) \
    if 'LeftArm' in _hd and 'RightArm' in _hd else Vector((1, 0, 0))
REST_LEFT = Vector((_side.x, _side.y, 0)).normalized()          # character's left
REST_UP = Vector((0, 0, 1))
REST_FWD = REST_UP.cross(REST_LEFT).normalized() * -1            # up x left = back, so negate
CHEST_REST_Q = (TGT.matrix_world @ _hd[CHEST].matrix_local).to_quaternion() if CHEST in _hd else None
print('  character axes at rest: left', [round(x, 2) for x in REST_LEFT], 'forward', [round(x, 2) for x in REST_FWD])

# Height ratio, for scaling hip translation between rigs of different sizes.
def rig_height(arm):
    zs = [(arm.matrix_world @ b.matrix_local).translation.z for b in arm.data.bones]
    return max(max(zs) - min(zs), 1e-6)

SCALE = rig_height(TGT) / rig_height(SRC)
print('height ratio target/source = %.4f' % SCALE)

SRC_REST_HIP = (SRC.matrix_world @ SRC.data.bones[ROOT_BONE].matrix_local).translation.copy()
TGT_REST_HIP = (TGT.matrix_world @ TGT.data.bones[BONE_MAP[ROOT_BONE]].matrix_local).translation.copy()

# Target bones, parents first: setting pose_bone.matrix on a child before its
# parent is set gives the child the parent's OLD orientation.
ORDER = []
def add_chain(bone):
    for s, t in BONE_MAP.items():
        if t == bone.name and (s, t) in CORR:
            ORDER.append((s, t))
    for c in bone.children:
        add_chain(c)
for root in [b for b in TGT.data.bones if b.parent is None]:
    add_chain(root)

for pb in TGT.pose.bones:
    pb.rotation_mode = 'QUATERNION'


"""Per-clip damping, as `damp=<clip>:<Bone>+<Bone>:<amount>`.

WHY THIS IS NEEDED, and why it is not a fudge:

TreeChopping_Loop is a TWO-HANDED axe swing. In the source the off-hand grips
the shaft, so its path is not really animation at all — it is a constraint, the
hand going wherever the axe puts it. Retarget that onto a rig with different arm
proportions and no axe in its hands and the constraint is gone: the arm swings
through 64 degrees of empty space with nothing to hold, which reads as one arm
waddling while the other chops.

Damping blends that arm back toward its pose at frame 0 of the same clip, so it
holds a steady brace instead of flailing. The dominant arm is untouched.

The real fix is a tool merged into the rig and skinned to the hand — but the
crowd baker assumes ONE skinned mesh with one material, and an axe brings a
second material with it, so that is a bigger change than it looks.
"""
DAMP = {}


def parse_damp(spec):
    clip, _, rest = spec.partition(':')
    bones, _, amount = rest.partition(':')
    DAMP.setdefault(clip, []).append((set(bones.split('+')), float(amount)))


def damp_for(clip, bone):
    for bones, amount in DAMP.get(clip, []):
        if bone in bones:
            return amount
    return 0.0


def retarget(out_name, src_actions):
    """src_actions: one action, or a list played back to back (see JOINED CLIPS in the docstring)."""
    if not isinstance(src_actions, (list, tuple)):
        src_actions = [src_actions]
    SRC.animation_data_create()
    TGT.animation_data_create()
    act = bpy.data.actions.new(out_name)
    act.use_fake_user = True

    # (source action, source frame, output frame); a single action keys at its own frame numbers, as before
    plan = []
    for i, a in enumerate(src_actions):
        a, lo, hi = a if isinstance(a, tuple) else (a, None, None)
        a0, a1 = (int(round(x)) for x in a.frame_range)
        a0, a1 = (a0 if lo is None else max(a0, lo)), (a1 if hi is None else min(a1, hi))
        print('  %-8s <- %-24s frames %d..%d' % (out_name, a.name, a0, a1))
        first = a0 if i == 0 else a0 + 1
        base = a0 if i == 0 else plan[-1][2] + 1
        plan += [(a, sf, base + (sf - first)) for sf in range(first, a1 + 1)]
    f0 = plan[0][2]

    ref = {}
    for src_action, sf, f in plan:
        if SRC.animation_data.action is not src_action:
            SRC.animation_data.action = src_action
        TGT.animation_data.action = act
        scene.frame_set(sf)
        bpy.context.view_layer.update()
        spread_q = {}

        for s, t in ORDER:
            s_pb = SRC.pose.bones[s]
            t_pb = TGT.pose.bones[t]

            s_world = SRC.matrix_world @ s_pb.matrix
            want_q = s_world.to_quaternion() @ CORR[(s, t)]

            # Constant arm spread, decided at the upper arm and shared by the whole chain so the elbow and
            # wrist angles the clip asked for are untouched - the arm just hangs a little wider.
            if (OPT['spread'] or OPT['fwd']) and CHEST_REST_Q is not None:
                for side, chain in ARM_CHAINS.items():
                    if t == chain[0]:
                        chest_q = (TGT.matrix_world @ TGT.pose.bones[CHEST].matrix).to_quaternion()
                        delta = chest_q @ CHEST_REST_Q.inverted()            # how the chest has turned, world
                        fwd, up, left = delta @ REST_FWD, delta @ REST_UP, delta @ REST_LEFT
                        arm_dir = want_q @ Vector((0, 1, 0))                 # Blender bones run along +Y
                        w = max(0.0, min(1.0, arm_dir.dot(-up)))             # 1 hanging, 0 at/above horizontal
                        sgn = 1.0 if side == 'L' else -1.0
                        spread_q[side] = (Quaternion(fwd, sgn * math.radians(OPT['spread']) * w)
                                          @ Quaternion(left, -math.radians(OPT['fwd']) * w))
                    if t in chain and side in spread_q:
                        want_q = spread_q[side] @ want_q

            cur_world = TGT.matrix_world @ t_pb.matrix
            loc = cur_world.translation.copy()

            if s == ROOT_BONE:
                # Hips carry the body: follow the source's displacement from its
                # own rest, rescaled, rather than its absolute position.
                loc = TGT_REST_HIP + (s_world.translation - SRC_REST_HIP) * SCALE

            d = damp_for(out_name, t)
            if d > 0:
                if f == f0:
                    ref[t] = want_q.copy()
                elif t in ref:
                    want_q = want_q.slerp(ref[t], d)

            m = Matrix.Translation(loc) @ want_q.to_matrix().to_4x4()
            t_pb.matrix = TGT.matrix_world.inverted() @ m
            bpy.context.view_layer.update()

            t_pb.keyframe_insert('rotation_quaternion', frame=f)
            if s == ROOT_BONE:
                t_pb.keyframe_insert('location', frame=f)

    TGT.animation_data.action = None
    return act


# --- run the requested clips ----------------------------------------------
# Damping is read FIRST: the clips are retargeted in argument order, so a
# `damp=` appearing after its clip would silently do nothing.
for spec in SPECS:
    if spec.startswith('damp='):
        parse_damp(spec.partition('=')[2])
if DAMP:
    print('damping:', {k: [(sorted(b), a) for b, a in v] for k, v in DAMP.items()})

final = []
for spec in SPECS:
    out_name, _, src_name = spec.partition('=')
    if out_name == 'trans':
        continue                    # handled after every clip exists
    if out_name == 'damp':
        parse_damp(src_name)
        continue
    if out_name == 'keep':
        a = find_action(own_actions, src_name)
        if a:
            a.use_fake_user = True
            final.append((src_name, a))
            print('  keep     %s' % a.name)
        else:
            print('!! no existing action named', src_name)
        continue

    _pool = {a.name: a for a in bpy.data.actions}
    src_action = []
    for _part in src_name.split('+'):
        _n, _, _rng = _part.partition('@')
        _a = find_action(_pool, _n)
        if _a and _rng:
            _lo, _, _hi = _rng.partition('-')
            _a = (_a, int(_lo), int(_hi))
        src_action.append(_a)
    if not all(src_action):
        print('!! no source clip named', src_name)
        continue
    final.append((out_name, retarget(out_name, src_action)))

# --- generated transition clips -------------------------------------------
# WHY THESE EXIST: walk, chop and carry are wildly different poses — walk is
# upright, chop is crouched — so cutting between them pops badly. Choosing a
# smarter cut FRAME does not help: measured across every pair, the best-matching
# frame in the destination clip is 1.6 units away against 0.19 of natural motion
# per frame, i.e. eight frames' worth of jump no matter where you cut. There is
# simply no frame of chop that resembles any frame of walk.
#
# A real cross-fade would mean sampling the animation texture twice per vertex
# and blending — deep surgery on Babylon's bones shader. Baking the blend
# offline instead costs nothing at runtime: a transition is just another clip,
# and the VAT plays it like any other.
#
# Each transition runs from clip A's frame 0 to clip B's frame 0, so the runtime
# must LEAVE A at its loop point (play whole cycles) and ENTER B at its start.
# main.js does both by controlling the per-instance frame offset.

def sample_pose(action, frame):
    TGT.animation_data_create()
    TGT.animation_data.action = action
    scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy())
            for pb in TGT.pose.bones}


def make_transition(name, act_a, act_b, frames):
    pose_a = sample_pose(act_a, act_a.frame_range[0])
    pose_b = sample_pose(act_b, act_b.frame_range[0])

    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    TGT.animation_data.action = act

    for i in range(frames + 1):
        t = i / frames
        t = t * t * (3.0 - 2.0 * t)          # smoothstep: ease in and out
        for pb in TGT.pose.bones:
            qa, la = pose_a.get(pb.name, (None, None))
            qb, lb = pose_b.get(pb.name, (None, None))
            if qa is None or qb is None:
                continue
            pb.rotation_quaternion = qa.slerp(qb, t)
            pb.location = la.lerp(lb, t)
            pb.keyframe_insert('rotation_quaternion', frame=i)
            pb.keyframe_insert('location', frame=i)

    TGT.animation_data.action = None
    print('  %-14s %s -> %s over %d frames' % (name, act_a.name, act_b.name, frames))
    return act


by_name = dict(final)
for spec in SPECS:
    key, _, val = spec.partition('=')
    if key != 'trans':
        continue
    pair, _, nframes = val.partition(':')
    a_name, _, b_name = pair.partition('>')
    a, b = by_name.get(a_name), by_name.get(b_name)
    if not a or not b:
        print('!! transition needs both clips:', pair)
        continue
    out_name = '%s_to_%s' % (a_name, b_name)
    final.append((out_name, make_transition(out_name, a, b, int(nframes or 15))))

# --- keep only the villager, with exactly the clips we asked for ----------
for o in src_objs:
    bpy.data.objects.remove(o, do_unlink=True)

if TGT.animation_data:
    for trk in list(TGT.animation_data.nla_tracks):
        TGT.animation_data.nla_tracks.remove(trk)
TGT.animation_data_create()
TGT.animation_data.action = None

# One NLA track per clip: the glTF exporter emits one animation per track, and
# names it after the track, which is what the vertex baker looks clips up by.
for name, act in final:
    trk = TGT.animation_data.nla_tracks.new()
    trk.name = name
    strip = trk.strips.new(name, int(act.frame_range[0]), act)
    strip.name = name

print('exporting:', [n for n, _ in final])
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_nla_strips=True,
    export_skins=True,
    export_yup=True,
)
print('wrote', OUT_GLB)
