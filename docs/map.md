# degenWars: The War Table (map spec v1)

*Companion to `design.md` §2. Lab: `/lab/map.html?seed=season-1&r=8`. Code: `lab/map-core.js` (generator and rules, pure, no DOM; meant to become the server engine), `lab/map.js` (renderer and sandbox UI), `lab/map.css`, `lab/art/` (3 painted textures, 330 KB). Pacing numbers below come from `map-core.js` run headless (6 seeds per row).*

## 1. Size: radius 8 (217 hexes) by default

`?r=6..10` is supported; **r8 is the default and the recommendation for launch through a few hundred actives.**

| Radius | Hexes | Land (approx.) | Per biome (land) | Verdict from the sim (90 actives, auto players) |
|---|---|---|---|---|
| 6 | 127 | 110 | ~33 | Too small: 85% of every biome is clean by round 21. The season is solved in week 1 and Lair Week arrives with nothing left to fight for. |
| 7 | 169 | 150 | ~45 | Borderline: 75% clean by about round 40, ~90% owned by the end. Fine for under 40 actives. |
| **8** | **217** | **~192** | **~60** | **A front that moves and holds:** about 40% clean at round 10, 50–60% by round 21, 50–72% by Lair Week (Rotlands hardest, Foundry easiest). Each faction ends near 40 tiles. The deep third around each Lair stays enemy ground for Lair Week. |
| 9 | 271 | ~240 | ~75 | Factions stall near 50% clean. Too much empty board under 150 actives. |
| 10 | 331 | ~300 | ~95 | Stalls at ~40–50%, even at 300 actives. A big board needs other rules (see §9). |

Why r8 is "large but not too large":
- **It's a continent, not a skirmish map.** Each faction starts with 2 biomes at its door, ~60 land hexes per biome, 6 landmarks + 3 Lairs, 18 strategic resources, 12 luxuries, 2–4 rivers, 6 passes, a coast with islands. You can't see it all from your HQ, and there's always a next objective.
- **Still readable on a phone.** The whole board fits a 390 px screen at ~15 px per hex in the strategic view (17 hexes across, flat-top orientation chosen for that reason). One pinch gets you to the tile level.
- **Playable by a small launch population.** With 30 actives (10 per faction) the factions still clear 25–45% of the map and hold ~22 tiles each, so the board never feels empty. With 90–180 actives the front keeps moving all season.
- **Pacing per biome (r8, 90 actives):** a biome holds ~60 land hexes and ~120 corruption levels at the start. Clearing one level takes ~1 typical run at full effect; after per-capita scaling and losses to spread, **a liberated tile costs ~5 runs at 90 actives (2 at 30, 8 at 180)**. Two factions working one biome liberate ~half of it in ~3 weeks (60 rounds) and hold it against spread. The Lair and its 1–2 rings are never cleared before Lair Week. That's the intended arc.

## 2. The template (fixed every season)

```
             Crash Site                 Foundry            biome wedges are seed-permuted;
          L .  .  .  .  ^  .  .  .  .  L                    this is one draw
            .  .  .  .  ^  .  .  .  .
              .  .  .  =  .  .  .  .          ^ mountain spine (along each HQ direction)
                .  .  ^  .  .  .              = pass (2 per spine)
                  .  ^ [V] .  .              [V][R][S] faction HQs on the Exchange ring
                   .  X  X  X  .              X  the Exchange (centre + ring 1)
                  [S]  X  X  [R]
                 .  ^  .  .  .  ^  .
               ~  ~  =  .  .  .  =  .         ~ coast arc around one spine's outer end
              ~  o  ~  .  .  .  .  ^          o island
                       Rotlands  L
```

- **The Exchange**: the centre + ring 1 (7 hexes). Neutral, no battles, and a supply source for everyone (every faction's network may pass through it).
- **Faction HQs** on 3 alternating hexes of ring 1. Bears at 30°, Bulls at −90° (top), Crabs at 150°.
- **Three biome wedges** (120°) centred on the other three directions, **each between two factions**. Every faction borders two enemy types and both rivals, and each biome is shared by exactly two factions.
- **Mountain spines run outward from just behind each HQ** (ring 3 to the edge), so each HQ guards the inner gate between its two biomes, and the outer gates are the passes. Spines wiggle (≤ 1 hex off the line) and grow ridge shoulders.
- **2 passes per spine**: an inner pass equalised by path cost for fairness, and an outer pass at least 2 rings further out.
- **One coast arc** (35–45° wide, rings R−3..R) around the outer end of one spine (seeded). The cape stops at ring R−1, leaving a strait, so "around by sea" is a real route. 1–3 islands, reachable only via Ports.
- **2–4 rivers on hex edges**, starting at a spine and flowing outward to the sea or the board edge. The first one always runs through the Rotlands.
- **Lairs** on the three outer corners, one per wedge.

## 3. Terrain, resources, landmarks

### 3.1 Terrain (r8, `season-1`; counts vary ±30% by seed)

| Terrain | March h | Supply | Alloy | Battlefield modifier | Rot | Crash | Foundry |
|---|---|---|---|---|---|---|---|
| Wasteland | 1 | 1 | 0 | open field | 5 | 4 | 15 |
| Ruined City | 2 | 2 | 0 | rubble cover, 3 melee lanes | 16 | 16 | 10 |
| Dead Forest | 2 | 1 | 0 | ranged −20%, Recon +15% crit | 6 | 4 | 6 |
| Hills | 2 | 1 | 1 | high ground: holder's ranged +15% range | 11 | 9 | 6 |
| Mountains | — | — | — | impassable | 0–4 | 4 | 7 |
| **Mountain Pass** *(new)* | 2 | 0 | 0 | one lane; holder's garrison +10% HP | 0–2 | 2 | 4 |
| Crater | 2 | 0 | 2 | pits: −20% ranged dmg taken, −20% range | 1 | 3 | 7 |
| Coast | 1 | 1 | 0 | beach: Artillery +10% splash; Port site | ~4 | ~3 | ~3 |
| Sea | 3 (Port) | — | — | sea lanes | 12–25 in total | | |
| Toxic Marsh (Rot) | 3 | 1 | 0 | melee −25% speed; Organics 1 dmg/s | ≥14% of wedge | | |
| Crystal Field (Crash) | 2 | 0 | 0 | Ion/Laser +20%, shields +20% | | ≥14% | |
| Scrapyard (Foundry) | 2 | 0 | 3 | killbots repair 1%/s | | | ≥14% |

Each wedge is painted from clumps (one seed per ~6.5 hexes, terrain drawn from that biome's weights, assigned by noisy nearest seed), so terrain comes in regions (Civ-like), not salt-and-pepper. Then hills are added around the mountains (40%), ruined city on the Exchange outskirts (ring 2, 45%), and coast next to the sea, and each biome's special terrain is topped up to 14% of the wedge (outer half first).

### 3.2 Strategic resources: 6 of each at r8 (scales `3 + round(R/2.6)`)
- **Fair kit:** each HQ gets one Fuel Cell, one Xenocrystal and one Rare Earth at the same path cost (r8: ~5–8 h), each closer to its own HQ than to any rival's.
- **Deep deposits:** 3 more of each, deeper than every fair kit, placed in their home biome first (Fuel in the Rotlands, Xeno in the Crash Site, Rare Earths in the Foundry).
- Hosts: Fuel on Wasteland or Marsh, Rare Earths on Hills or Scrapyard, **Xenocrystal on Crystal Fields or Craters** (meteor shards; new, see §7).

### 3.3 Luxuries: 12 at r8 (`round(1.5R)`)
One per HQ in its fair kit (three different types), the rest scattered beyond the fair ring and cycling through the six types (about 2 copies each).

### 3.4 Landmarks: 6 + 3 Lairs

| Landmark | Placement rule |
|---|---|
| St. Grindset Plague Hospital / Crashed Mothership / Oracle Hall | In its biome wedge, ring ≥ R/2, **equidistant (±1 h) to the two HQs that border the wedge**, all three at the same cost L (r8: 7–8 h). |
| The Mint | On one of the 6 passes, farther than L+2 from every HQ. |
| Halving Dam | On a hex that touches ≥ 2 river edges (a river chokepoint), farther than L+2. |
| Satoshi's Lighthouse | On a coast hex, farther than L+2. |
| Lairs | The three outer corners. Corruption is locked at 3 until Lair Week. |

So **every HQ's two nearest landmarks are the two biome landmarks on its flanks, at equal cost.** Each biome landmark is contested by exactly the two factions that share that biome.

## 4. Generation algorithm and fairness

`generate({seed, R})` → deterministic (xmur3 + mulberry32 from `seed#R#attempt`; no `Math.random`, no clock).
1. Axial grid (flat-top), wedge by angle; biome order shuffled per seed.
2. Exchange, HQs, spines (random walk outward, +1 ring per step, so the wall is always continuous on a hex grid), ridge shoulders.
3. Coast arc (noise on ring depth × angle), cape strait, islands (sea hexes surrounded by sea).
4. Terrain clumps → hills/city/coast passes → **identical HQ foyers** (the hex behind each HQ is wasteland, the two flanking hexes are ruined city, so the first steps cost the same for everyone) → special-terrain top-up → Lairs.
5. Rivers on the vertex graph (edges between hexes): greedy walk toward an edge target with noise, never along a mountain, Exchange, HQ or Lair; it stops at sea, the board edge or another river.
6. Dijkstra from each HQ (cost = march hours of the hex entered, +1 h per river edge crossed). **Inner passes** are chosen per spine to minimise the spread of HQ→pass cost; outer passes are random.
7. Biome landmarks (equidistant ring search), global landmarks (beyond the fair ring), **fair kits** (one per HQ per resource type at a common target cost T; a hex may convert only to a host terrain *with the same march cost*, so placing the kit never moves any distance), deep deposits, luxuries.
8. Initial corruption, then `fairness()`.

**Fairness rules (checked, shown in the Map tab):** spread ≤ 1 h across the three HQs for the nearest pass, Fuel, Xeno, Rare Earths and luxury, and the 1st and 2nd landmark. Every land hex is reachable (by land, or by sea for islands only); every Lair is reachable by land from every HQ; exactly 6 passes and 6 landmarks. If an attempt fails, the generator retries with `attempt+1` (up to 40, still deterministic) and keeps the best. **Measured:** 12/12 seeds pass at r7–r10, mostly on attempt 1–3, in 20–150 ms in the browser. r6 passes 11/12 (it's cramped; one seed returns a best-effort map with the fairness panel showing FAIL).

## 5. Initial state: "the map is empty first, full of enemies"
Everything except the Exchange and the HQs starts corrupted. With `x = dHQ / (dHQ + dLair)` plus ±0.09 noise, the level is 1 for x < 0.36, 2 for x < 0.66, and 3 otherwise. Hexes adjacent to an HQ are always 1, and Lairs are always 3. At r8 that's ~350 corruption levels on ~190 hexes, roughly 1/3 at each level.

## 6. Rules implemented in the sandbox (`map-core.js`)

**Round order** (§2.5): event card → pending run WP and orders → card tick effects → 10% Pressure decay → builds → ownership → settlement ageing/upgrades → yields → enemy turn → ownership again.

**Runs:** WP per wave cleared = (1 + w/10) × (1, 1.3, 1.6 by corruption level); waves cleared ~ N(14, 7) / difficulty (×1.0/1.15/1.3, Lair ×1.5). WP × **per-capita factor min(1, √(12 / faction actives))** × underdog (×1.3 for the fewest tiles, ×0.85 for the most). On a corrupted hex, 25 WP = −1 level (progress carries over between rounds). On liberation, leftover WP turns into Pressure (1:5) plus a **+3 Pressure claim** for the liberators. On a clean hex, WP → Pressure 1:5. Runs are allowed on hexes that border your territory or the Exchange.

**Pressure and borders:** Pressure = settlement radiation (strongest settlement, falls 1 per hex) + banked Pressure (runs, Reinforce, liberation claims; −10% a round). **Own at ≥ 3 and ≥ 2 ahead**; both factions ≥ 3 but within 2 = Contested (hatched). Only clean hexes can be claimed; an owned hex survives corruption 1 (infested, half yield) and is lost at 2.

| Settlement | Radiation | Radius | Upgrade |
|---|---|---|---|
| Outpost (30 Supply, resolves at the tick) | 4 | 1 | Fort after 3 rounds held |
| Fort | 6 | 2 | Citadel after 6 more |
| Citadel | 8 | 3 | |
| HQ | 7 | 2 | |

**Supply:** BFS from the HQ through own hexes and the Exchange. Unsupplied hexes yield nothing (drawn faded), and unsupplied settlements radiate −2 (red ✕). The supply tree is drawn as dotted brass lines.

**Enemy turn (Pandemic):**
- **Spread cards:** each biome draws `min(5, 1 + floor(actives/150))` cards, weighted over its **frontier** (its corrupted hexes next to a clean hex, plus clean hexes next to its corruption). Weights: zombies ×2.2 on river or marsh hexes, aliens ×1.6 next to crystal, ×1.3 on faction-owned hexes. +1 corruption each.
- **Outbreak:** a card on a hex already at 3 → +1 to every neighbour **on the front** (clean, or touching a clean hex); a neighbour at 3 chains once (depth ≤ 2). Track 8 → **The Long Night** (Supply −25% for 3 rounds), then the track resets.
- **Zombies:** +1 card while they hold a river hex on the front. Every 2 rounds a **Horde** forms on a corruption-3 frontier hex (max 2) and rolls 1 hex/round toward the nearest non-HQ settlement.
- **Aliens:** `1 + floor(actives/300)` **Drop Pods** a round land within 3 hexes of an alien-held Crystal Field, preferring owned hexes (weight 3), then wild ones (2), and set them to corruption 2: a hit behind your lines.
- **Killbots:** every Scrapyard at corruption 3 is a **Factory**. Every 3 rounds (or on *Rug in the Foundry*) the factory nearest the target rolls out a **Column** (cap `1 + factories/3`, max 4). Columns march toward the **highest-yield faction hex** (re-targeted every round, built-in anti-snowball).
- **Strikes (Horde/Column):** the garrison holds with 35% + 10/25/40% (Outpost/Fort/Citadel) ± card modifiers. Otherwise −3 Pressure, corruption ≥ 1, and the settlement drops a tier.

**Event deck:** all 20 cards in §2.8 are drawn. The ones with a board effect in the sim: Number Go Up, Liquidation Cascade, Rug in the Foundry, Capitulation, Buy the Dip, Sideways Grind, Airdrop Season (WP +10%), FOMO Rally, Funding Rate, Theta Decay, Black Swan, The Halving, Supply Convoy, Refugees, Flash Wick / Ghost Reinforcements (garrison hold ∓15%). The rest are flavour for now. **Suit:** in the browser, from `/api/market` every 15 s: `z = chg15m / (σ1m·√15)`; chaos if σ1m > 0.18% or |chg1m| > 0.35%, bull/bear at |z| ≥ 1 (★★ at 1.5, ★★★ at 2.5), crab at |z| < 0.5, field otherwise. This is a stand-in for the real `z8` over the whole 8 h round. With the toggle off, the suit comes from the seeded deck.

**Ghost Command / auto players** (sandbox only): each faction has actives/3 members. Each round, 50% of them run once and 60% of their 2 order tokens get used (Purge = 4 WP, Reinforce = +1 Pressure, ×3 on clean hexes). Targets are a War Plan of the top 10 hexes by score (low corruption on the front first, resources/landmarks/passes +), filled in order by *need* (WP still missing), so runs aren't wasted on overkill. Ghost Command **does not pour runs into a rival stronghold** (that's what Banners are for) and builds up to 2 outposts a round when Supply allows.

## 7. What I changed from design.md §2 (and why)

1. **Default size r8 (217 hexes), not r5 (91).** r5/r6 is solved in a week in the sim. The radius table becomes r7 under 40 actives, r8 at 40–300, r9 above 300 (§9).
2. **Spines start behind each HQ and run out along the HQ direction.** §2.1 put HQs "facing a gap between two biomes" but never said where the spines go relative to the HQ. This layout makes each HQ the inner gate and the passes the outer gates.
3. **Identical HQ foyers** + **cost-preserving terrain conversion** for fair kits, so fairness holds by construction, not by luck.
4. **Xenocrystal also spawns on Craters (meteor shards).** Without this, the faction that doesn't border the Crash Site could never be equidistant to Xenocrystal.
5. **A fair luxury per HQ** (one each, different types).
6. **New terrain: Mountain Pass** (2 h, one-lane battlefield, holder's garrison +10% HP). §2 had passes but no rules for them.
7. **Ownership threshold 5 → 3** (lead stays 2), and settlement radiation raised (Outpost 4, Fort 6, Citadel 8, HQ 7/r2). With §2's numbers, an Outpost (3 radiation) could not even own its own hex.
8. **Liberation claim (+3 Pressure)** so a freshly cleared hex doesn't sit wild for the enemy to retake on the very next card.
9. **Outbreaks spill only onto the front** and chain at most once. With §2's "all neighbours +1, chains allowed" on a board that starts 100% corrupted, one card set off 40-hex chains through the enemy's own interior (~2,000 outbreaks a season in the first sim).
10. **Purge = 4 WP**, not −1 corruption. 2 tokens per player × 50 players would otherwise erase ~100 levels a round, more than all runs combined.
11. **Per-capita scaling `min(1, √(12/actives))`** applied to all run and order effects, not just Pressure. It's flat up to 12 actives per faction (launch), then √-scaled. Without it, launch numbers either stall (pure 1/√n) or clear the board in 3 rounds (no scaling).
12. **Lairs locked at corruption 3 until Lair Week** (round 64+).
13. **The Long Night resets the track** (the season can't be "lost" like Pandemic).

## 8. Rendering (lab)
- Canvas 2D, flat-top axial hexes. Terrain is painted once into an offscreen cache (gestural strokes along a per-wedge flow, colour bleeding from each neighbour, a hand-drawn motif per terrain, lamp light from the upper left, carved grooves, a generated impasto texture in overlay). Rivers, borders, tokens and pieces are drawn live on top.
- **Two zoom levels** with a crossfade (§2.12): *Strategic* = flattened terrain wash, faction fills and borders, corruption stacks, icons only for landmarks/Lairs/HQs/pieces. *Tile detail* = full painting, brass-rimmed corruption chips with biome glyphs, resource chips (fair kits ringed in the owner's colour), luxury diamonds, pending-WP markers, optional labels and Pressure.
- Carved wooden faction pieces (HQ / Outpost / Fort / Citadel), brass-rimmed enemy tokens (H Horde, K Column, P Pod) with march arrows, a walnut table and a brass-railed hex frame, a lamp vignette.
- Palette: the 12 art-brief pigments. Faction colours are derived from them (Rust from oxide red, Verdigris from olive + steel blue, Slate from cold ash + steel blue). No web fonts; stencil/mono system stacks.
- Pan (drag), zoom (wheel, pinch, ±, fit), tap → tile card (a paper field card: terrain, battlefield, march, yields, resource, landmark, settlement, path cost from each HQ, Pressure bars, **what a run here means**: campaign, difficulty, typical wave, WP, ≈ runs to liberate; plus Run / 10 runs / Outpost buttons).
- Test hooks: `window.WT.select(i)`, `WT.zoomTo(i, z)`, `WT.rounds(n)`, `WT.map`, `WT.st`.

## 9. Left for the real server version
- **Population scaling of the board.** Above ~300 actives, more runs don't move the front (√ scaling + more spread cards). Pick r9/r10 and theatres together with a stronger per-capita curve, or add more War Plan fronts; re-run `tools`-style sims before each season.
- Orders as hidden, simultaneous tokens per player (Scout, Fortify, Sabotage), Marshals, War Plan voting (the sim only has a Ghost Command proxy).
- Improvements (Mine, Salvage Yard, Rig/Harvester/Dig, Road, Relay, Wall, Port, Field Station) and their supply rules. Strategic access currently = owned + supplied, with no improvement needed. **Supply has no sink yet** (factions bank hundreds).
- Sea movement via Ports and naval flanks (islands are reachable in validation only).
- Banners and async PvP, march times, fog of war, Oracle/Lighthouse/Dam powers, Lair Week assaults and the season score.
- The real `z8` card suit over the 8 h round (server-side price series), and a published season seed `H(serverCommit ‖ SOL price)`.
- State persistence: the state object is plain arrays and numbers (serialisable). `advanceRound(map, state, {suit, stars})` is deterministic given its inputs (its RNG lives in `state.rs`).
- Painted per-terrain battlefield backdrops for runs on the map (12 needed), plus painted landmark vignettes for the tile card.
