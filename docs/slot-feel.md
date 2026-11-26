# degenWars: Slot Feel ("dopamine per spin")

Lab prototype: `http://localhost:8811/lab/slot.html` (`lab/slot.html`, `slot.css`, `slot.js`; no build step, no libraries).
Open **DEBUG** (top right, or press `D`) to force each outcome tier, rig the next nudge/blast, and watch the cue log.

This document covers the diagnosis, the techniques and their tuning, the honesty rules, the audio cue list and the merge plan into `index.html`.

---

## 1. Diagnosis: where the dopamine is missing today

The machine already has good bones: a painted cabinet, chasing bulbs, a reel strip with wind-up and overshoot, a tease on reel 3 and re-paying lines. What's missing is mostly **contrast and escalation**. A one-line win, a three-line combo and a dead spin all feel about the same.

- **Spin cost feels abstract.** Energy drops in a HUD pill after the fact. You never see what you're about to spend, and the 50% escalation only shows up as a number on the button. Because the commitment isn't felt, the spin doesn't feel like a stake.
- **The lever is decoration.** It squashes for 260 ms when you click SPIN. On a phone, the most tactile object on screen does nothing when you touch it.
- **Anticipation is partly there but flat.** Reel 3 teases when two cells of a line match. But the other reels aren't dimmed, there's no payline preview showing what it's waiting for, no bulb change and no haptic. The tease length doesn't scale either: two possible lines tease the same as one.
- **Every win looks the same.** All wins get the same 0.9 s glow. There are no tiers: 1 line, 2 lines, COMBO x3 and a full board (the 1-in-16,600 headline jackpot) all look alike. The only escalation is a "COMBO x2!" toast in a pill at the bottom of the panel, off-screen on phones.
- **No payline is ever drawn.** The player has to work out which line paid. In slots the payline trace is the #1 readability and reward device.
- **The summon has no payoff.** The unit just appears in the army list via a toast. The emblem never travels from the reels to the army, and nothing connects "I hit a line" to "I got a soldier".
- **Combos don't escalate.** Re-paying lines after nudge/blast is the core skill, but the 3rd pay in a chain looks like the 1st. Nothing tracks the run of hits (no heat, no chain counter).
- **Near misses aren't framed, and the information is wasted.** Most 2-of-3 lines are fixable with a nudge or blast, but the game never shows which nudge could pay or what the odds are. The nudge is blind by rule, and that's fine, but the *odds* can still be shown honestly.
- **Nudge and blast are silent.** The nudge is a 330 ms drop with no weight. The blind symbol is visible immediately, so there's no reveal. The blast is a scale-to-zero with no explosion, no debris and no gravity. These are the two skill verbs and they get the least feedback.
- **Idle state is static.** The bulbs chase, but there's no "attract mode" pulling the player back to the lever.
- **The market seed is invisible.** The live SOL price, the most distinctive thing about the machine, isn't on the cabinet at all.
- **Pacing can't be controlled.** You can't slam-stop reels or skip a celebration. Long celebrations without a skip turn juice into friction.

---

## 2. Techniques: what, why, where it comes from, tuning

Every animation uses `transform` / `opacity` (plus one canvas for particles). All of it respects `prefers-reduced-motion` (see §5).

### 2.1 The lever is the hero input (phones first)
**What:** drag the lever knob down. The pull has rubber-band resistance `p = 1 - exp(-1.5·dy / travel)`, where travel = 70% of the lever bay, at least 140 px. There are **4 ratchet notches** at p = .18/.34/.50/.64, each giving a 5 ms buzz, a bezel jolt and a `lever_ratchet` cue. Past **p = .72 the lever is "armed"**: a 16 ms buzz, the bulbs flare and the hint changes to "LET GO". **Release** fires the spin. Releasing before the threshold **cancels** with a soft spring-back and no spin. **Tap** is the fallback: an auto-pull (170 ms ease-in down), then release. **Swipe down on the reel window** drives the same gesture. On desktop you can click or drag the lever, press Space, or use the SPIN button (which plays the lever animation too).
**Release:** a damped spring-back with overshoot (keyframes −72° → +14° → −6° → +2° → 0° over 520 ms), a 28 ms "thump" buzz, cabinet shake (trauma .22 + .28·power), bulbs flare for 380–680 ms, and sparks at the pivot. Pulling while locked (no spins or energy) gives a short rattle, a double-buzz and a `lever_denied` cue.
**Power:** release velocity (px/ms over the last 90 ms) is mapped to `power` 0–1. Power adds up to 8 strip rows and 220 ms to the reel spin. **It's cosmetic only:** the outcome was seeded before the reels move.
**Lever pose:** `perspective(420px) rotateX(-p·72°)` around the pivot, so the knob swings toward the player instead of squashing.
**Why:** the lever is the cabinet's most physical object. When the gesture itself has texture (resistance, notches, a detent), the spin feels *earned* and the player commits to the stake.
**Borrowed from:** Slotomania / Huuuge Casino swipe-to-spin and pull-lever modes (the gesture *is* the spin). Coin Master's oversized central spin control with haptic feedback on every press (we take the size and haptics, **not** the hold-to-autospin). Monopoly GO's roll button: press feedback, then a release that kicks off motion scaled to the input (we copy the feel, **not** its multiplier upsell). iOS/Android pull-to-refresh rubber-banding (the resistance curve). Real Bally/IGT cabinet levers (ratchet clicks, a threshold detent, return-spring overshoot).
**Haptics:** `navigator.vibrate` is feature-detected inside try/catch. It's a no-op on iOS Safari (no errors), and is off under reduced motion. Patterns: grab 8 ms, ratchet 5 ms, armed 16 ms, release 28 ms, reel stop 6 ms, line 12+4k ms, blast [20,30,40].

### 2.2 The stake is physical (cost made visible)
- **Cost bite on the energy bar:** a red-striped segment at the end of the bar shows exactly what the next spin will take. It grows as costs escalate (10 → 15 → 23). *Source:* fighting-game "red health" previews and Hearthstone mana-crystal previews.
- **Feeding the machine:** on pull, up to 8 brass tokens fly from the energy gauge into the lever bay (420 ms, 45 ms stagger), the energy counter ticks down (420 ms cubic ease-out), and the pill jolts. *Source:* coin-drop / credit-meter rollback on real cabinets; Peglin's ball drop.
- **Button copy:** `SPIN · 15 energy · next 23` → `LAST SPIN` → `NO SPINS` / `LOW ENERGY`. Spin lamps (3 bulbs) go out one by one.
- **Why:** escalating cost is only meaningful if it's felt *before* the commitment. Making the spend tangible also makes the reward afterwards feel bigger (contrast).

### 2.3 Market tape seeds the spin
An amber nixie-style strip above the reels shows the SOL price (changed digits flip, coloured by direction), 1m/5m/15m change, volatility, weather, tick number and the current **SEED** hex. On spin, the tape glows and the last 3 price digits **fall into the 3 reels** (360 ms, 50 ms stagger). Then the reels start. If the feed is stale, a red lamp shows "FEED STALE · HOUSE SEED". The label stays "MARKET-SEEDED (UNVERIFIED)" until §7.2 verification exists. Debug-forced spins say "RIGGED (DEBUG)" on the tape.
*Source:* design.md §7.2; stock-ticker tapes; "provably fair" crash games, minus the overclaiming.

### 2.4 Reel spin: wind-up, stagger, clunk
Strip keyframes: wind-up up 0.25 cell (8%), accelerate, linear blur section, decelerate (`cubic-bezier(.25,.6,.35,1)`), **overshoot 0.22 cell** then settle. Stops are staggered at **600 / 860 / 1120 ms** (+ power·220). Each stop gives a bezel jolt (2 px, 160 ms), a dust puff, a 6 ms buzz and a `reel_stop` cue. A reel that lands as a full column lights up at once (`reel_line_preview`), which is an early "something good" signal.
Motion blur is faked with a static stripe overlay plus 85% symbol opacity. CSS `filter: blur` was removed because it's expensive on phones.
*Source:* Vegas stepper reels (staggered stops and the "clunk" overshoot); Disney anticipation principle.

### 2.5 Anticipation tease (only when real)
After reel 2 stops, if any line already has its first two cells matching (rows or diagonals), **reel 3 teases**:
- +1000 ms (one line) or +1500 ms (two or more lines: "double tease", redder glow).
- Long crawl: linear to −5 cells by 1000 ms, then `cubic-bezier(.12,.6,.25,1)` to the stop.
- Reel 3 gets a pulsing ochre ring (opacity anim, 280 ms alternate) and a 1 px jitter. The other reels dim to 38% except the held cells, which glow.
- Dashed warning-orange **payline previews** show which lines are live. Bulbs chase at .55 s (.35 s on a double).
- Cues: `tease_start {lines, double}` and `tease_end`.
*Source:* scatter anticipation on modern video slots (reel 4–5 slow-down); Balatro's held breath before the score total.

### 2.6 Win tiers and escalating celebration
| Tier | Trigger | Hit-stop | Trace gap | Stamp | Shake (trauma) | Tokens/line | Hold |
|---|---|---|---|---|---|---|---|
| 1 | 1 line | 80 ms | — | `LINE` | .20 | 8 + 4·power | 420 ms |
| 2 | 2 lines | 80 ms | 230 ms | `DOUBLE` | .32 | ↑ | 650 ms |
| 3 | 3–7 lines | 80 ms | 170 ms | `COMBO ×N` (cadmium ink) | .50 | ↑ | 950 ms |
| 4 | 8 lines (full board) | 220 ms | 85 ms | `FULL HOUSE` (big, double border) | .90 + screen flash + token shower from the marquee for 1.3 s | ↑ | 1900 ms |

`power = tier + 0.6·(chain−1) + 0.5·rarity` (Mech/Artillery count as rare). It drives bulb chase speed (`.9 − .15·power` s, min .18 s), token count and spread, and the haptic length.
Per line, in order: the **payline is inked** (stroke-dashoffset draw, 260 ms, `cubic-bezier(.4,0,.2,1)`, mustard core with a bone-white dashed core), the 3 symbols **pop** (scale 1.22 with −4° rotation, `cubic-bezier(.3,1.8,.5,1)`, 450 ms) with a warm glow, then brass tokens and sparks burst from the middle cell and a `line_win` cue fires (plus `combo_2…8`).
**The stamp** is a stencil mark on aged-ivory paper with a halftone pit mask. It slams in (scale 2.4 → .93 with ease-in, rebound 1.03 → 1, 220 ms, random ±6° rotation). On impact there's a small shake and dust. The sub-line lists the units summoned.
*Sources:* slot big-win tiers (Big / Mega / Epic win ladders, but here tiers map to *actual* outcome size); Peggle's escalating "Extreme Fever"; Balatro's per-card score pops played in sequence; hit-stop from fighting games and Vlambeer's "art of screenshake"; trauma² shake from Squirrel Eiserloh, GDC 2016.

### 2.7 The summon payoff: emblem flies to the army
For each line, the unit emblem lifts out of the middle cell (scale 1.35, −8°, rising ≥ 50 px), then dives along an arc into the next **army slot** (640 ms, 130 ms stagger per line). The slot stamps in (scale 1.5 → 1 with a brightness flash, `cubic-bezier(.3,1.6,.5,1)`), the counter bumps, sparks and dust fire, and a `summon` cue plays.
**Army full:** the emblem hits the counter, the slots rattle, it becomes soot, and a **grey** stamp reads "ARMY FULL · Soldier scrapped · +3 credits". It's deliberately not a celebration.
*Source:* Coin Master / Monopoly GO "collect" flights (reward travels to its counter); Luck be a Landlord's coin fly-to-total; Vampire Survivors' gem pickup.

### 2.8 Combo chain + heat (the core skill gets louder)
- **Chain** = consecutive *paying* actions on the same board (spin → nudge → blast). It resets on a new spin or on any action that pays nothing (`chain_break` cue). From chain 2, an ochre **`CHAIN ×N`** stamp is added under the tier stamp (with "nudge paid" / "blast paid"), and each chain step adds +0.6 power to the whole celebration.
- **Heat meter**: 12 segments under the reels, +1 per line paid this turn, reset at end of turn. Levels: COLD / WARM (3) / HOT (6) / RED LINE (10), with colours mustard → warning orange → cadmium. Crossing a level vents soot puffs from the gauge and fires `heat_level_N`.
- Heat is **cosmetic in the lab**. See Decisions.
*Source:* Balatro's flaming score (chips × mult on fire); Peggle fever meter; Tetris Effect / Puyo chain counters; Hades' "damage numbers grow" combos.

### 2.9 Nudge: show the odds, keep it blind, make the reveal a moment
- **Honest preview on every button:** each nudge button shows what the nudge will do: `1 sure line` (a line that pays no matter what drops in), `34% to hit` (exact probability from the symbol weights that the unknown symbol completes a line), or `blind`. Hover/focus draws those lines on the glass: solid for sure, dashed for chance. This doesn't break the blind rule: the incoming symbol is still unknown.
- **Clunk:** a 300 ms drop with a small lift first (anticipation), overshoot 0.1 cell, settle. Cabinet shake .16, dust, 14 ms buzz, `nudge_clunk`.
- **Blind reveal:** the new top cell arrives under a brass **shutter marked "?"** that rattles for 420 ms, then flips away (`rotateX −95°`, 240 ms) and fires `nudge_reveal {sym}`. Only then are lines evaluated. The gamble gets its own beat.
*Source:* Fruit-machine "nudge" and "hold" features (UK AWPs) with their reveal flicker; gacha "card flip" reveals (borrowing only the reveal beat, not the monetisation); Slay the Spire's intent preview (transparent information makes risky choices feel fair).

### 2.10 Blast: explosion, debris, gravity
Every copy of the symbol charges (flicker, 160 ms), then explodes: 16 sparks, 4 soot puffs and 10 debris chips per cell in palette colours, 25 ms stagger. A screen flash (.35), shake (.3 + .04·count) and a [20,30,40] buzz follow. After 300 ms, survivors **fall under gravity** into the gaps and fresh symbols drop from above. Duration is `200 + 110·√rows` ms with `cubic-bezier(.55,0,1,.45)` (accelerating), then one 7% bounce. Stagger is 55 ms per column and 30 ms per row, bottom-up. Dust puffs on landing, then `blast_land`, then evaluation. In blast mode, hovering a symbol marks every copy and the marquee reads "BLAST 4 × Soldier".
*Source:* match-3 cascades (Candy Crush / Bejeweled gravity refill); Peglin's peg explosions.

### 2.11 Near miss: honest framing
Only when the tease actually ran (reel 3 was waiting on a live line) and missed: a **grey** dashed payline, a small grey "ONE SHORT · nudge or blast it" stamp, and the nudge buttons with real odds pulse twice. There's no win sound or colour, it's over in about 1.1 s, and input is never blocked.
*Why:* the information is actionable (the player has tools to fix it), so it's gameplay, not a lure. See §3.

### 2.12 Dud spin
The bulbs sag for 260 ms. No fanfare, no stamp, a `dud` cue, and control returns immediately. A fast loss feels better than a slow one.

### 2.13 Slam stop / skip (player controls pacing)
Tapping the window, the lever, SPIN or Space while the machine is busy runs every reel and celebration at 6× (`slam_stop` cue). Waits shrink to 30 ms. The outcome is unchanged.
*Source:* the "slam stop" button on real cabinets; Balatro's game-speed setting; Marvel Snap's skippable reveals.

### 2.14 Idle attract mode
After 9 s without input, the bulbs switch to a slow random twinkle, ghost paylines are inked one after another across the glass (every 1.4 s), the marquee blinks "PULL THE LEVER" (or "END THE TURN"), and the lever does a small beckoning half-pull every 2.2 s. Any input stops it. Cues: `attract_start` / `attract_stop`.
*Source:* arcade and slot attract loops; Monopoly GO's breathing roll button.

### 2.15 Button press depth
3D buttons with a hard bottom shadow (6 px SPIN, 5 px secondary, 4 px nudge) collapse to 1 px and translate down on press. A JS `.pressed` class handles iOS, where `:active` is unreliable, and fires `button_press`.

### 2.16 Art direction rules for juice (per `art-brief.md`)
Palette tokens: aged ivory `#D4C9AD`, ochre `#AF9561`, oxide `#864F3B`, charcoal `#30312F`, steel `#485354`, bone `#DDD9CE`, carbon `#211E1B`, plus accents used **only for wins**: cadmium `#B3261E`, warning orange `#D9772B`, faded mustard `#C9A23A`.
Effects must be physical: brass tokens with grime specks, soot (charcoal smoke), khaki dust, palette debris chips, orange sparks, stencil stamps with pitted ink (CSS radial-gradient mask) on ivory paper. No neon, no clean gradients on effects, no white glare (the full-board flash is a warm bone-to-orange wash, not white). Bulbs stay warm and dirty, and one in seven is dead.

---

## 3. Dark patterns we deliberately avoid
There's no real money, but these mechanics are exactly the ones regulators flagged in gambling. Keep the game punishing **and** honest:
1. **No Losses Disguised as Wins.** Celebration size follows the *actual* gain (lines and units summoned), never the spin. A scrapped over-cap summon gets a grey "ARMY FULL" stamp, not a win stamp. If spins ever return part of their cost, a return below cost must not play win effects.
2. **No fabricated near misses.** Reel filler is drawn from the same weights as the result, and the needed symbol is never parked just above or below the payline. The tease and the "ONE SHORT" framing only happen when the near miss arose naturally. (Real slots weighting virtual reels to over-produce near misses is the classic abuse.)
3. **Near misses are framed as information, not as "almost won".** Grey, quiet, actionable (the odds are shown). A near miss never uses win colours or win audio.
4. **The cost is always visible before you commit.** The bar bite, "next 23" and "LAST SPIN" are always shown.
5. **No autospin, and no hold-to-spin loops.** Every spin is a deliberate pull. (We borrow Coin Master's big button, not its autospin.)
6. **No fake urgency or loss aversion.** No "spin again before it's gone!" and no timers. The attract mode only invites when a spin is actually possible.
7. **Skippable everything.** Celebrations never hold the player hostage.
8. **Odds are shown, not hidden.** The nudge chance is the exact probability. Debug-rigged spins are labelled on the tape. Don't say "provably fair" until §7.2 verification ships.
9. **Haptics and motion respect the OS settings** (reduced motion disables both).

---

## 4. Audio cue bus (for SFX/music later)
`window.degenCues` is a tiny event bus: `on(name, fn)` returns an unsubscribe function, and `on('*', fn)` receives every cue. To add audio, subscribe, e.g. `degenCues.on('reel_stop', d => sfx.play('clunk', {pan: d.col - 1}))`. The debug panel shows a live cue log.

| Cue | Payload | Suggested sound |
|---|---|---|
| `lever_grab` | `{src}` lever/window/tap/space/button/api | hand on a cold steel knob |
| `lever_ratchet` | `{notch}` 1–4 | ratchet pawl clicks, rising pitch |
| `lever_armed` | | heavier detent clack, spring tension creak |
| `lever_release` | `{power}` 0–1 | spring slam + cabinet thump (louder with power) |
| `lever_cancel` | `{p}` | soft spring return |
| `lever_denied` | `{reason}` | dull locked rattle |
| `button_press` | `{id}` | bakelite button |
| `energy_spend` | `{cost,left}` | tokens into a coin chute |
| `seed_drop` | `{seed,price}` | ticker-tape chatter |
| `market_tick` | `{price}` | faint split-flap |
| `spin_start` | `{cost,seed,nonce,power,forced}` | reel motor spool-up (start of the loop) |
| `reel_stop` | `{col,tease}` | mechanical clunk, panned L/C/R |
| `reel_line_preview` | `{col}` | small bell |
| `tease_start` / `tease_end` | `{lines,double}` | rising tension drone / cut |
| `near_miss` | `{lines}` | muted descending tone (not a win sound) |
| `dud` | | lights-sag hum dip |
| `win_start` | `{lines,tier,chain,src,power}` | sting choice by tier |
| `line_win` | `{index,of,sym,line}` | bell per line, pitch up with index |
| `combo_2` … `combo_8` | `{lines}` | escalating chord layers |
| `jackpot` | | full-board fanfare, bulb buzz, coin hopper |
| `stamp` | `{text,cls}` | rubber-stamp thunk |
| `chain_2` … `chain_6` | `{chain}` | chain riser |
| `chain_break` | `{chain}` | steam release |
| `summon_fly` / `summon` | `{unit}` / `{unit,rarity,army}` | whoosh / unit "reporting" stamp + per-unit voice |
| `army_full` | `{unit,credits}` | rejected clank, coins |
| `heat_up` / `heat_level_1..3` | `{heat,level}` | boiler pressure rising / whistle |
| `nudge` / `nudge_clunk` / `nudge_reveal` | `{col}` / `{col}` / `{col,sym}` | motor, heavy clunk, shutter flip |
| `blast_arm` / `blast` / `blast_boom` / `blast_land` | `{sym,count}` | arming click, fuse, explosion, debris settle |
| `slam_stop` | | brake squeal |
| `turn_end` / `turn_start` | `{turn,energy}` | stamp + march sting / reactor hum |
| `attract_start` / `attract_stop` | | attract jingle loop (low volume) |
| `ready` | | |

Music: bring a low cabinet hum up with heat level (stem layering by `heat_level_N`, the Peggle / Balatro adaptive-intensity approach) and duck it on `jackpot`.

---

## 5. Reduced motion and performance
- **Reduced motion** (`prefers-reduced-motion`, or the lab toggle): no reel strip (cells resolve left to right, 140 ms apart), no shake, no particles, no flights (army slots fill directly), no haptics, stamps appear without the slam, bulbs stay steady and the tape doesn't scroll. All information (stamps, paylines, odds, cues) is kept.
- **Performance:** only `transform` / `opacity` are animated. The particle canvas sleeps when empty, is capped at 380 particles with DPR ≤ 2, and draws pre-rendered sprites. CSS `filter: blur` was dropped from the reel strip. The shake is applied to one element. No layout reads inside animation loops (rects are read once per effect).

---

## 6. Merge plan into `index.html`
Each item is independent. Do them in this order (highest dopamine per line of code first).

| # | Technique | Changes in `index.html` |
|---|---|---|
| 1 | **Cue bus** | Add the `bus` object (from `slot.js`) near STATE; `window.degenCues = bus`. Emit cues from every function listed below. |
| 2 | **Lever gesture + haptics** | CSS: replace `.lever`, `.lever img`, `.lever.pull img` with `.leverbay`/`.lslot`/`.lever`/`.lhint` from `slot.css`; widen it to `flex:0 0 clamp(46px,15vw,70px)` on phones. `renderSlotCol()`: wrap the lever in `.leverbay`, remove `$('#lever').onclick`, and call `bindGesture(bay,'lever')` and `bindGesture($('.window'),'window')`. Add `LV`, `grab/drag/releaseLever/autoPull/fire/buzz`. `spin()` gains a `power` arg and loses the `.pull` class code. The `#spin` button calls `autoPull('button')`. Add a Space key handler. |
| 3 | **Win tiers + payline trace + stamp + shake + particles** | Add `<svg class="paylines">` and `<div class="stamps">` inside `.window` in `renderSlotCol()`; add `<canvas id="fx">` and `<div class="flash">` to `<body>`. Rewrite `evalLines()` as `evaluate(src)` + `celebrate(pay)` (async); replace the `.sym.win` CSS with the `pop/glow` version; drop the "COMBO x" toast. Add the particle module, `shake()`, `stamp()`, `traceLine()`, `wait()`/`skipNow()`. `evalLines()` currently sets `busy` and calls `render()` after 650 ms: switch to `await celebrate()` then `render()`. |
| 4 | **Summon flight to the army counter** | `summon(type)` gains a `fromEl` arg: fly the emblem to `#hudUnits` (desktop) or the Battlefield tab (phone, `#tabs [data-t=field]`), then bump the counter. The over-cap branch becomes the grey "ARMY FULL" stamp instead of a toast. |
| 5 | **Tease upgrade** | `spinReels()`: keep the strip, drop `filter: blur` from the keyframes, add the `.spinning` stripe overlay, use the tease keyframes (+1000/+1500 ms), call `startTease()` when reel 2 lands (dim the others, ghost paylines, bulbs `--chase`), and call `setReelCol()` per reel on landing. Replace the CSS `.reel.tease`. Add `nearMiss()` / `dud()` after the spin when nothing paid. |
| 6 | **Nudge preview + clunk + shutter reveal** | `renderControls()`: nudge buttons get the `nudgePreview(col)` label and hover lines. `nudge(col,dir)`: strip animation with lift/overshoot, `.sym.shut` shutter, 420 ms reveal, then `evaluate('nudge')`. With Reverse Gear (`dir<0`) the shutter goes on the bottom cell. |
| 7 | **Blast explosion + gravity** | `blastSym(i)`: charge → `explode()` per cell → `refill()` with per-cell `fall` → WAAPI gravity drop → `evaluate('blast')`. Replace `.sym.gone` / `.sym.drop` CSS. |
| 8 | **Chain + heat meter** | New `R.chain`, `R.heat` in `newRun()`; reset in `nextTurn()`. Add a `.heat` row after `#nudges` in `renderSlotCol()`. |
| 9 | **Visible cost** | HUD energy stat: add `.ebar` with `#ecost`. `spin()`: `payEnergy()` (token flight + tween). `renderControls()`: new SPIN copy (`LAST SPIN`, `next N`) + spin lamps. |
| 10 | **Market tape + seeded RNG** | Add `.tape` under `.marquee` in `renderSlotCol()`. Add `poll()` (every 4 s), `seedSpin()`, `cyrb53`/`mulberry`. `randSym()` takes an `rng` (the default stays `Math.random` for non-reel rolls). `spin()`, `nudge()` and `blastSym()` draw from `S.rng`. Keep the "unverified" label. |
| 11 | **Attract mode, press depth, slam stop** | `armIdle/startAttract/stopAttract` + `.attract` CSS; `pressDepth()`; window/lever pointerdown → `skipNow()` while busy. |
| 12 | **Reduced motion** | Replace the global `@media(prefers-reduced-motion)` rule with the slot.css version (it keeps information on screen), and add `RM()` checks in JS for shake, particles, flights and haptics. |
| 13 | **Palette** | Add the art-brief tokens to `:root`; win accents (cadmium / orange / mustard) only on wins. |

Watch out:
- `render()` rebuilds `#app` with innerHTML. Celebrations must finish (or move to a top-level layer, `body > #fx`, `.flash`, flyers) before any `render()` call, or they get cut off. The lab keeps flyers and particles outside `#app` for this reason.
- `busy` must cover the whole celebration, or a battle can start mid-flight. Slam stop is the escape hatch.

---

## 7. Decisions for the owner
1. **What does "pay again" mean?** Today *every* standing line re-pays after any change. That means a standing column line pays on every nudge of the other two reels: a free summon per nudge. The lab has a toggle (Repay: all standing / only new lines). Recommendation: **only lines that the change created or re-formed pay**, so combos stay a skill instead of a loop.
2. **Should heat do something mechanical?** E.g. at RED LINE the next spin costs 0, or the next summon is +1 rarity. Right now it's cosmetic. A small mechanical edge makes the combo skill visible in the economy; leaving it cosmetic keeps balance untouched.
3. **Show nudge odds?** It keeps nudges blind but takes away the mystery. Recommendation: yes. It's the honest version, and it teaches the combo game. It could be gated behind a Cabinet Workshop node.
4. **Haptics on by default?** Android only. Recommendation: yes, plus a settings toggle.
5. **The lever's spot on phones:** right side, 15vw wide. Left-handed players might want a mirror option.

---

## Merged into index.html (2026-11-25)
All 13 steps of §6 are in `index.html` (backup: `index.pre-slotfeel.html`). Owner decisions applied: **repay = every standing line re-pays after any nudge or blast** (the owner overrode the §7.1 recommendation; there's no toggle, and the nudge "sure line" preview counts every complete line), heat is cosmetic, nudge odds are shown, haptics are on, and the lever is on the right.

Adapted:
- **Roster:** the lab's units are gone. "Rare" for the power formula is now `commander` / `hacker` (rarity 2, the lowest weights). Sniper / outrider / drone are 1, and soldier / lancer are 0.
- **Art:** slot cells, emblem flights and stamps use the `art/s-<id>.webp` emblems. `sprite(t)` portraits (home squad, class modal) now use `art/u-<id>.webp`.
- **No army slot strip:** the game has no 8-slot army bar. The emblem flies to `#hudUnits` on desktop or the Battlefield tab on phones (≤979px), and the counter bumps. On desktop the unit also appears on the field when the flight lands. ARMY FULL is the grey stamp plus a rattle on the counter. Shop "Recruit Papers" summons have no reel to fly from, so they keep the old toast.
- **Render issue:** slot actions no longer call `render()` mid-flow. At the end, `refresh()` rebuilds the HUD, reels, controls and field in place, so the stamps and near-miss lines in `.window` survive. `busy` covers the whole celebration, flights included (the lab released `busy` before the flights landed). `#fx`, `.flash`, flyers, coins and tape digits live on `body`.
- **No END TURN / "TO BATTLE" stamp:** the turn ends with BATTLE!, so `turn_end` fires from `startBattle()` and `turn_start` from `nextTurn()`. Attract mode only starts when a spin is possible (no "END THE TURN" prompt).
- **Reverse Gear:** the ▲ buttons get their own odds label. The shutter goes on the bottom cell.
- **RNG:** reel results, nudge symbols and blast refills come from the market-seeded `SL.rng`. Reel filler and all non-reel rolls use `Math.random`. Under file:// or with a dead feed, the tape shows FEED STALE · HOUSE SEED.
- **Debug:** the lab's debug drawer wasn't ported. A test hook `?slottest=line1|line2|combo|near|full|dud|nudge|blast|idle[&army=N][&gear=1]` forces outcomes for headless screenshots (forced spins are labelled RIGGED (DEBUG) on the tape), and it exposes `window.dwSlot`.
- **Not ported:** the lab's reduced-motion toggle (the OS setting only) and the haptics settings toggle (§7.4 suggests one; there's no settings screen yet).
