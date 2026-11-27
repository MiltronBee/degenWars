# degenWars: Full Game Design (v2)

*Lead design document. Covers the whole loop from a single spin to a season of the shared world. Numbers are first-pass and meant to be tuned with a headless battle simulator (see Build Order). Nothing here requires changing the owner's fixed decisions; where I extend one, I say so.*

---

## 0. Where we start from (the MVP as it is today)

These are the live values in `~/degenWars/index.html` and `server.mjs` that this design builds on.

| System | Current value |
|---|---|
| Symbol weights | Soldier 34, Medic 20, Sniper 16, Tank 13, Artillery 10, Mech 7 (sum 100) |
| Base stats (HP / dmg / cooldown ms) | Soldier 42/8/1000, Medic 30/4/1200 (heal 11), Sniper 24/19/1800, Tank 120/11/1500, Artillery 32/11/2000 (splash), Mech 100/24/1300 |
| Level multipliers | Lv1 ×1.0, Lv2 ×1.7, Lv3 ×2.8 |
| Spin cost | 10 × 1.5^n (10, 15, 23, 34, 51), resets each turn; 3 spins/turn |
| Energy | Start 48, +25/turn, bank cap 150 |
| Credits | Start 5; win = 5 + 3×wave; over-cap summon scrapped = +3; manual scrap = +2; shop 3 offers, reroll 2 |
| Run | "Level" of 3 waves, wave 3 is a boss; losing ends the run |
| Chips | 3 + 4×waves cleared (+6 + 2×level on win) |
| Meta upgrades | Barracks (cap) 10/22/40, Reactor 8/15/24/36/50, Lever Arm 15/32/55, Item Rack 12/26/44, Reel Motor 20/42, Supply Drop 10/20/35 (516 chips total) |
| Market feed | Coinbase SOL-USD, 1m candles, chg 1/5/15m, vol = stdev of 1m returns; weather: volatile if vol > 0.18% or abs(1m) > 0.35%, else bull/bear if 5m beyond ±0.25%, else crab |

**The odds that matter.** A line pays when all 3 cells match. Per line that is Σw³ = 5.5%, so a raw spin pays **0.44 lines on average** (37% of spins pay at least one). Per spin, by symbol: Soldier 31%, Medic 6.4%, Sniper 3.3%, Tank 1.8%, Artillery 0.8%, **Mech 0.27% (1 in 364 spins)**. Sustainable income (25/turn) buys about 2 spins a turn (10 + 15). So the raw machine gives roughly **one summon a turn**, and almost all high-tier units must come from nudges, blasts, cores and merges. That is the right shape for a punishing game, and it means **the combo tools are the game**. The design leans into this.

A full board (all 9 cells one symbol, pays all 8 lines) is about **1 in 16,600 raw spins**, nearly all of them Soldier. Slotbound's jackpot is 1 in 620,000 and pure luck. Ours can be *engineered*: a board with 6 Soldiers and 3 Medics, blasted on Medic, becomes a full board 4% of the time (0.34³). **A jackpot you can set up through skill is a headline differentiator.**

---

## 1. The loop at every timescale

**Key decision:** each timescale has exactly one main decision and one main feeling. Turn: "how hard do I push the machine?" Run: "do I build for the boss or for the next wave?" Meta: "which grind do I invest in?" World: "where does my faction need me today?"

| Timescale | Length | What the player does | Key decision | Feeling | Why it matters next time |
|---|---|---|---|---|---|
| **Turn** (= 1 wave) | 1.5–3 min | Collect energy → spin (1–5×) → nudge/blast to chase lines → merge/scrap/shop → place units → BATTLE | Spend energy now or bank it for a big turn; which symbol to blast; which affixes to keep in a merge | Slot-machine tension, then the relief or dread of the battle | Banked energy, survivors and items carry over |
| **Wave block** (5 waves) | 10–15 min | 4 normal waves, then a judgement or boss wave | When to cash in the bank (5 spins = 133 energy) | Ramp-up, then a spike | Cores from judgement/boss waves change the machine for the rest of the run |
| **Run** (30 waves, one biome, one tile) | 45–75 min, can be paused between waves | Build an army from nothing up to 8 Lv3 units with cores and items | Commit to a composition (e.g. a Mortar/Medic backline vs a Mech rush) | A climb where every wave is a hurdle and luck can end it | Chips paid win or lose; zone influence for every wave cleared |
| **Session** | 20–60 min | 1 run (or part of one), collect garrison pay, 1–3 PvP attacks, the Daily Historical | Push the main run or play the daily | "One more wave" | Daily first-run bonus, attack tickets refresh |
| **Meta** | weeks | Spend chips (and Alloy) on Forward Base research: cabinet, barracks, mech chassis, logistics, intel | Which branch, and which side of each exclusive choice | The grind visibly works: wave 8 becomes wave 14 becomes wave 22 | The next run reaches further |
| **World / Season** | 4-week seasons | Push corruption back on a hex war table, grow borders from outposts, place 2 order tokens per 8-hour round, march Banner pieces | Which tile to run, which order to place, which front to defend | Belonging, rivalry, bragging rights | Faction standing, season rewards, the map resets to "full of enemies" |

### 1.1 A single turn, step by step
1. **Income:** +25 energy (+upgrades, items), capped at 150. A weather banner shows this turn's market state (locked at the start of the turn so it can't change mid-decision).
2. **Spin phase:** each spin is seeded from a live SOL tick shown on the cabinet tape (§7.2). Lines summon at once. Then the player can **nudge** (blind, 1/turn) and **blast** (1/turn), and every change re-checks all 8 lines. Lines that are still matched **pay again**. That is the combo mechanic, and it is core.
3. **Manage:** merge (Lv1+Lv1 → Lv2, choose class; Lv2+Lv2 → Lv3, choose class), pick which affixes to keep, scrap, buy items, socket cores.
4. **Deploy:** drag units on your half. The enemy is hidden until BATTLE (pillar kept), but a **scout report** line shows the wave's *threat tags* (e.g. "Ranged-heavy · 1 Elite"), so the deploy step is a real decision without revealing the field.
5. **Battle:** real-time auto battle, 1/2/3× speed. **Every unit comes back for the next turn at full HP, including the ones that died in the battle** (owner rule, 25 Nov 2026: "if I have two soldiers and one dies during battle, next turn it's still there"). Deaths only matter *inside* a battle: a unit that falls stops fighting, and if your whole army falls the wave is lost and the run ends.
6. **Payout:** credits, sometimes a core choice, interest on banked credits.

### 1.2 Why they come back tomorrow
- **The grind is visible:** every run pays chips, and the cabinet physically gains parts (the MVP's "installed parts" plates).
- **The market is different every day:** a run during a crash plays differently from a run during a crab day.
- **The world moved overnight:** the round ticked, an event card fired, borders moved; your garrison Banner fought N defences and earned pay to collect.
- **Daily Historical:** one fixed-seed, 10-wave challenge on a famous real candle (§7.5) with a global leaderboard.

---

## 2. The War Table: world map, borders and rounds

**Key decision:** the world is **a Civilization-style hex map played like a board game, with an RTS layer in between turns**. It is a painted **war table**: hex tiles with real terrain and resources, faction borders that grow from outposts, enemy corruption that spreads by board-game rules (Pandemic), a market-linked event deck, and a **world round every 8 hours** where hidden orders resolve at once (Diplomacy). Between ticks, everything is live: runs on tiles add pressure, Banner pieces march with real travel times, attacks arrive and resolve as async auto battles, and defenders see them coming. **A new semi-generated map every 4-week season.** Kept from v1: async armies only, factions are the target (never individual players), Ghost Garrisons at low population, seasons and reset, anti-snowball.

*Molt Wars note:* the owner's earlier OGame-style map was linear and flat with no resources. Everything here aims at the opposite: geography, resources worth fighting over, and multiple routes.

### 2.1 The board

**Shape:** a hex board (axial coordinates), radius scaled to the active population at season start, so it never feels empty:

| Active players at season start | Board radius | Tiles | Approx. tiles per active player |
|---|---|---|---|
| < 300 (launch) | 5 | 91 | 0.3–1+ (Ghost Command fills the gaps) |
| 300–3,000 | 7 | 169 | |
| > 3,000 | 9 | 271 | if a board passes ~15,000 actives, run parallel "theatres" |

**Layout template (fixed every season) + generated terrain (new every season):**
- **The Exchange** at the centre: 7 hexes (centre + ring 1), neutral, no battles. The three **faction HQs** sit on its ring, each one facing a gap *between* two enemy biomes, so every faction borders two enemy types and both rivals.
- **Three biome wedges** (120° each): Rotlands (zombies), Crash Site (aliens), Foundry (killbots), each with its **Lair** on the outer edge.
- **Mountain spines** run along the wedge borders with **2 passes each** (chokepoints), so moving between biomes means going through a pass or around by sea.
- **One inland sea or coast arc** (generated), crossable only through Ports: islands and coastal flanks.
- **Rivers** (2–4, generated) run from the mountains outwards. They are crossings and supply arteries.
- **Landmarks**: 6 placed by the template at fair distances from all three HQs, plus the 3 Lairs.

**Recommendation: semi-generated, not hand-made.** The template guarantees fairness (each HQ is the same distance from a pass, a strategic resource of each kind and two landmarks); the generator gives each season new rivers, coasts, terrain and resource spots, so the map stays fresh and nobody can solve it. The season seed is published at the start: `seed = H(serverCommit ‖ SOL price at season start)`, in the same spirit as the reels.

```
 Radius-5 launch board (sketch; ^ mountains, ~ water, R/C/F biome, X Exchange, H faction HQ, L lair, * landmark)

                    L(Rot)
                 R  R  R  R
               R  R  *  R  ~  ^          ROTLANDS (zombies)
             .  R  R  ~  ~  ^  .
           ^  ^  .  H  .  ~  .  F        pass between Rot and Foundry
         C  ^  X  X  X  .  F  F  F
        C  C  .  X  X  X  H  F  *  L(Fou) FOUNDRY (killbots)
         C  *  H  X  X  .  .  F  F
           C  C  .  .  ^  ^  F  .
  L(Cra)     C  C  C  ^  .  .  .         CRASH SITE (aliens)
               C  *  C  .  ~  ~
                 C  C  .  .
```

### 2.2 Terrain
Terrain matters three ways: **marching** (hours per hex for Banner pieces), **yields**, and **the battlefield** of any run or PvP fight on that tile (each terrain also has its own painted battlefield).

| Terrain | March (h/hex) | Base yield per round | Battlefield modifier (runs and PvP on this tile) |
|---|---|---|---|
| Wasteland | 1 | 1 Supply | open field (the MVP field) |
| Ruined City | 2 | 2 Supply | rubble cover: ranged units take −15% damage; 3 narrow lanes for melee |
| Dead Forest | 2 | 1 Supply | ranged range −20%; Recon units +15% crit |
| Hills | 2 | 1 Supply, 1 Alloy | **your half is high ground**: your ranged units +15% range (the defender's in PvP) |
| Mountains | impassable | — | — (only passes cross) |
| River (edge feature) | +1 to cross | +1 Supply to adjacent worked tiles | a river splits the field: melee units take 2 s to ford, −50% speed while crossing |
| Coast / Sea | sea only via Port: 3 h/hex | Coast: 1 Supply | beach: Artillery-tag units +10% splash |
| Crater | 2 | 2 Alloy | crater pits: units in them take −20% ranged damage but have −20% range |
| Toxic Marsh *(Rotlands)* | 3 | 1 Supply | melee −25% move speed; **Organic** units take 1 dmg/s; Machines unaffected |
| Crystal Field *(Crash Site)* | 2 | — (strategic: Xenocrystal) | Ion/Laser modules +20%; all shields +20% (both sides) |
| Scrapyard *(Foundry)* | 2 | 3 Alloy | killbots repair 1%/s; your Tinker repairs +30% |
| Exchange | — | — | no battles (safe hub) |

### 2.3 Resources (Civ-style, kept small)
**Basic yields: Supply and Alloy only.**
- **Alloy** (personal; §8.2.7) builds your Forward Base. Each round, every *active* member (played in the last 72 h) receives Alloy from their faction's worked tiles: 1 Alloy per 10 Alloy the faction produced, max 2 per round (6/day).
- **Supply** (faction pool) is the one new currency in the world layer, and it earns its place: it's the only thing a faction **spends together** (outposts and improvements). It never reaches individual accounts.

**Strategic resources (gate units in world battles, never in the solo campaign).** A tile with a strategic resource needs its improvement and a supply connection; then the whole faction has *access*.

| Strategic | Found on | Needed by (in Banners / PvP) | Without access | With access, in runs on the map |
|---|---|---|---|---|
| **Fuel Cells** | Wasteland and Marsh (oil wells) | Heavy and super-heavy mechs | "Dry tanks": −25% speed and attack speed | Heavy Mechs +10% HP |
| **Xenocrystal** | Crystal Fields | Ion Disruptor, Laser Lance, Reactor Overcharge modules | modules fall back to the Standard Cannon | energy modules +10% |
| **Rare Earths** | Hills, Scrapyards | Drone Rig, Crowmother, Leviathan Carrier Deck (drones) | drones −50% HP | drones +10% HP |

**Luxury / market resources (faction-wide bonuses).** The first copy gives the full bonus, a second copy 50%, a third nothing, so hoarding doesn't pay.

| Luxury | Bonus to all faction members |
|---|---|
| **Copium Labs** | +5% chips from runs |
| **Old Ledger Vaults** | +1 free shop reroll per run |
| **Server Farms** | Forward Base research −10% time |
| **Bonded Warehouses** | +3 starting credits |
| **Propaganda Presses** | +10% Scrip |
| **Hashrate Wells** | start each run with +1 Airdrop Flare (within the flare cap) |

**Landmarks ("wonders"): one of each per map, worth fighting over.**

| Landmark | Where | Bonus to the holding faction |
|---|---|---|
| **The Crashed Mothership** | Crash Site | Xenocrystal access ×2; judgement core choices +1 option |
| **Oracle Hall** (a dead AI datacenter) | Foundry | no fog of war for the holder; Scout orders free |
| **St. Grindset Plague Hospital** | Rotlands | Medics and Tinkers +15% healing in world runs and Banners |
| **The Mint** | a pass between wedges | +15% Supply |
| **Halving Dam** | a river chokepoint | once per round: "open the floodgates", one river costs enemies +3 h to cross |
| **Satoshi's Lighthouse** | coast | vision over all coast tiles; Ports cost nothing |
| **Lairs** (3) | wedge edges | the area's Lair Core (§6.1) for the season + crown points; assaulted in Lair Week |

### 2.4 Tile states, settlements and borders
**Borders replace the old zone-influence percentage; influence lives on as border Pressure.**

| Tile state | Meaning | How it changes |
|---|---|---|
| **Corrupted 1–3** (stacked enemy tokens) | enemy-held; no yields, blocks supply, no outposts | runs on the tile and Purge orders lower it; enemy spread raises it |
| **Wild** | corruption 0, unowned | any faction's Pressure can claim it |
| **Bordered** | inside a faction's borders: worked for yields if supplied | Pressure from rivals, corruption creeping in |
| **Contested** | two factions within 2 Pressure of each other | resolves at the tick |

**Settlements:**
- **Outpost:** built on a Wild tile your supply can reach. Costs 30 Supply and resolves at the next tick. Border radius 1, radiates **3 Pressure**.
- **Fort:** an Outpost that survives 3 rounds with its tile owned. Radius 2, radiates 5.
- **Citadel:** a Fort that survives 6 more rounds. Radius 3, radiates 8.
- Pressure falls by 1 per hex of distance from the settlement.

**Pressure on a tile per round** = settlement radiation + run WP on the tile (§2.6) + PvP results + Reinforce orders − Sabotage orders − 10% decay. A tile belongs to the faction with the most Pressure if it's at least 5 and at least 2 ahead of the next faction; otherwise it's Contested and works for nobody.

**Supply lines:** a bordered tile is **supplied** if it connects to its faction HQ or to the Exchange through owned tiles, Roads or a Relay. Unsupplied tiles yield nothing, their settlements lose 2 Pressure per round, and Banners there fight at −20%. **Cutting supply** (taking a pass, burning a road with Sabotage, flooding a river with the Dam) is the main way to beat a bigger faction without beating its armies.

**Improvements** (Supply cost, built by Build orders; one per tile):

| Improvement | On | Cost | Build steps | Effect |
|---|---|---|---|---|
| Mine | Hills, Crater | 20 | 2 | +2 Alloy |
| Salvage Yard | Scrapyard | 25 | 2 | +2 Alloy, +1 Supply |
| Fuel Rig / Crystal Harvester / Rare Earth Dig | the strategic resource's tile | 30 | 3 | activates the strategic resource |
| Luxury Works | luxury tile | 30 | 3 | activates the luxury |
| Road | any passable | 10 | 1 | marching −1 h on this tile; carries supply |
| Relay Tower | any | 25 | 2 | +2 vision; supply passes through one non-owned tile |
| Wall | any owned | 30 | 2 | garrisons +15% HP; attackers' march +1 h |
| Port | Coast | 25 | 2 | sea marching from here |
| Field Station | any owned | 20 | 1 | the first unit lost in each world run on this tile returns |

### 2.5 The round (board-game layer)
**Cadence:** a world round every **8 hours** (00:00, 08:00, 16:00 UTC): 3 a day, **84 a season**. Eight hours means every timezone gets a tick in its waking hours and a casual player can act once a day without losing ground.

**Each player each round:** 2 **order tokens** (3 for Marshals), placed face-down, revealed and resolved at the tick:

| Order | Target | Effect |
|---|---|---|
| **Reinforce** | own or contested tile | +3 Pressure |
| **Fortify** | own tile | garrisons +10% next round (stacks to 2) |
| **Scout** | any tile within 3 of your borders | reveals it and its neighbours for 3 rounds (garrisons, improvements) |
| **Sabotage** | rival tile adjacent to your borders | −3 Pressure, or disable its improvement or road for 1 round |
| **Purge** | corrupted tile adjacent to your borders | −1 corruption |
| **Build** | faction build queue | +1 step on an improvement or outpost (Supply is paid by the faction) |

**Tick resolution order:**
1. **Event card** revealed (§2.8). The live market during the round has been deciding its suit.
2. **Orders** resolve at once, in order: Scout → Fortify → Reinforce/Sabotage → Purge → Build.
3. **Pending pressure** from the round's runs and battles is applied; borders and ownership recompute; settlements upgrade.
4. **Supply check**; yields are paid (Supply to the faction, Alloy to members, luxuries and strategics toggle).
5. **Enemy turn** (§2.7).
6. Draw the next card face-down; round counter +1. A summary card is posted to every member ("Round 37: Bears took the Mint pass; outbreak in Rot 4").

### 2.6 The live layer (RTS between ticks)
- **Runs are placed on tiles.** Choose a corrupted tile adjacent to your borders (or the Exchange), or a bordered tile you want to push. The run uses that biome's 30-wave campaign, the tile's battlefield modifier, and a difficulty set by corruption: level 1/2/3 = ×1.0/×1.15/×1.3 enemy stats, Lair ×1.5. **WP per wave cleared** = (1 + wave/10) × (1 / 1.3 / 1.6 / 2.0 by corruption). On a corrupted tile, every 25 WP removes 1 corruption at the tick. On a wild or bordered tile, WP becomes Pressure 1:5. Losses count; a bad run still moves the board. The pending effect shows live on the tile.
- **Banner pieces march.** Each player has up to **2 pieces** on the board (Banners from waves 10/20/30, §2.9). A piece marches along a path at the terrain's hours per hex (capped at 8 h total; Roads −1 h). On arrival it either **garrisons** (defends; up to 3 pieces per tile) or **attacks** (1 attack ticket).
- **Incoming attacks are visible.** A marching enemy piece shows its path, band and ETA to the defending faction (fog permitting). Defenders can move in a garrison, Fortify, or Sabotage the road before it arrives. That is the RTS reaction moment, without any live matchmaking.
- **Fog of war:** you see your tiles plus 2 hexes. Beyond: terrain only (it's a map) and last-known information. Scouts and Relays extend vision; Oracle Hall removes fog.

### 2.7 The enemy as a board-game AI (Pandemic-style)
Corruption spreads by public rules, so the PvE map pushes back predictably and factions can plan against it.

- **Each tick:** draw `1 + floor(active players / 150)` spread cards (max 5) per biome. Each card names a tile at the corruption frontier: +1 corruption. A tile pushed past 3 **Outbreaks**: all its neighbours +1 (chains allowed). The season **outbreak track** is public; at 8 outbreaks, "**The Long Night**": every faction's Supply yield −25% for 3 rounds.
- **Biome behaviour:**
  - **Zombies** spread along rivers and marsh: +1 extra card if any river tile is corrupted. **Hordes** (stacked tokens) form on corruption-3 tiles every 2 rounds and roll one hex per round toward the nearest outpost; on arrival they fight its garrison as a Ghost-run battle (no garrison: −3 Pressure and the tile is corrupted to 1).
  - **Aliens** jump: each round 1 **Drop Pod** lands on a random tile within 3 hexes of a Crystal Field (corruption 2), behind the front lines. Flanks matter.
  - **Killbots** build: every Scrapyard at corruption 3 is a **Factory** that produces a **Killbot Column** piece every 3 rounds. Columns march along roads toward the **highest-yield faction tile on the board** ("the algorithm targets the most profitable asset"), which is built-in anti-snowball.
- **Corruption on a bordered tile** ("infested"): yields halved at level 1, lost at level 2.

### 2.8 The event deck (market-linked)
One card per round. **Its suit is decided by SOL's real move over that round**, normalised to volatility like the Call: `z8 = ln(P_end/P_start) / σ_8h`. The cabinet-style ticker on the war table shows "NEXT CARD: tracking BEAR ★★" live during the round, which makes the market part of the board.

| Suit | Condition | Strength | Cards (one drawn at random from the suit) |
|---|---|---|---|
| **Bull** | z8 ≥ +1 | ★ to ★★★ by abs(z8) | **Airdrop Season** (runs this round start with +1 Flare) · **FOMO Rally** (Reinforce ×2) · **Number Go Up** (Supply +25%) · **Short Squeeze** (Sabotage orders backfire on the saboteur, −2) |
| **Bear** | z8 ≤ −1 | ★–★★★ | **Liquidation Cascade** (each faction's most overextended tile, farthest from HQ, −3 Pressure) · **Rug in the Foundry** (every Factory produces a Column now) · **Capitulation** (+2 spread cards) · **Buy the Dip** (outposts cost 50%) |
| **Crab** | abs(z8) < 0.5 and calm | ★ | **Sideways Grind** (run WP +20%) · **Funding Rate** (the faction with the most tiles pays 10% Supply to the smallest) · **Range Trade** (marches −1 h) · **Theta Decay** (Pressure decay doubled) |
| **Chaos** | 8 h realised vol ≥ 80th percentile (overrides) | ★★ | **Flash Wick** (all Walls offline 1 round) · **Black Swan** (a random landmark becomes Contested) · **Oracle Glitch** (fog lifts for everyone for 1 round) · **The Halving** (Supply halved, Alloy doubled this round) |
| **Field** | otherwise | ★ | **Supply Convoy** (+15 Supply to all) · **Storm Season** (river crossings +1 h) · **Refugees** (a free outpost on a wild tile near the weakest faction) · **Ghost Reinforcements** (Ghost Garrisons +1 band) |

The market never *directly* rewards a faction for its colour: Bull cards help everyone, and Short Squeeze punishes saboteurs, not Bears. The faction weather bonuses in runs (§3) stay the only colour-aligned effect.

### 2.9 Async PvP on the board
- **Banners** (unchanged): at the end of any run that cleared wave 10, 20 or 30, the army at that point is saved as a Banner (units, levels, classes, rarity, affixes, positions, modules, 2 items; no cores). Bands: 10/20/30. On the board a Banner is a **painted miniature** of its strongest unit.
- **Attacking:** march a piece to a rival tile adjacent to your borders (1 ticket; 3 tickets/day, bank 6). On arrival it fights the tile's garrison pieces of its band in sequence without healing; empty slots are **Ghost Garrisons** (house armies from the band's average, or top 25% with the Crab war node). Terrain modifiers apply; the defender holds the high ground on Hills. Strategic-resource access applies to both sides.
- **Stakes:** a full win = +6 Pressure attacker, −6 defender on that tile; each partial win ±2. Defenders who win earn **Garrison Pay** (3/6/12 chips by band). **Individuals never lose anything they own**; the faction loses Pressure.
- **Protection:** PvP unlocks after a first wave-10 clear; you meet only your band; at most 2 Banners per player on the board; the same attacker can hit the same tile at most twice a day; HQ tiles and the Exchange can't be attacked.

### 2.10 Faction decisions without a big community
- **War Plan:** each round a faction has up to 3 priority targets. Any member who has played a run this season can vote; weight = 1 + sqrt(season WP)/10, max 3. Orders placed on War Plan targets get **+20% effect** ("coordinated"), which rewards following the plan without forcing anyone.
- **Marshals:** the top 5 contributors of the previous week. They get 3 order tokens and set the faction **build queue** (which outposts and improvements Supply goes to).
- **Ghost Command:** if nobody votes or queues builds, a simple AI picks the War Plan (nearest outbreak, cut-off tiles, nearest landmark) and the build queue. At launch most factions run on Ghost Command plus a handful of players, and the board still moves.

### 2.11 Example: three rounds on a launch board
*Season 1, rounds 12–14. Bulls (Verdigris) are strong in the north, Bears (Rust) hold the Mint pass, Crabs (Slate) are small but own Satoshi's Lighthouse.*

**Round 12 (08:00–16:00).** SOL drifts down about 1.3σ. During the day, 40 Bull runs on Rot 3 (corruption 2) bring in 70 WP, enough to clear 2 corruption levels at the tick. A Bear Banner-20 marches toward the Bulls' Fort at Hills 4 (ETA 5 h, visible). Bulls move a Banner-20 piece in and Fortify. Crabs place Build ×6 on a Port. **Tick:** the card is **Bear ★: Liquidation Cascade**, so the Bulls' farthest tile (Rot 2, at the edge of their supply) loses 3 Pressure and turns Contested. The Bear attack had arrived at 13:40 and won 1 of 3 fights: −2 Bull Pressure on Hills 4. Rot 3 goes Wild. Enemy turn: zombie spread hits Rot 4, which **Outbreaks** (track 3/8); a Horde forms. The Crab Port completes.

**Round 13.** Bulls vote Rot 3 as the War Plan target and build an Outpost there (30 Supply). The Horde rolls toward it. Crabs use the new Port to sail a Banner-10 to the coast behind the Foundry pass and Scout. They find an undefended Bear Road and Sabotage it, which cuts supply to two Bear tiles past the Mint. SOL goes sideways (abs(z8) 0.3, calm). **Tick:** **Crab ★: Funding Rate**, so the Bulls, who hold the most tiles, pay 10% Supply to the Crabs. The two cut-off Bear tiles yield nothing and their outpost drops 2 Pressure. A Killbot Column leaves the Foundry factory heading for the Bulls' highest-yield tile (a Mine).

**Round 14.** Bears spend the round reconnecting: Build ×4 on the road and Reinforce the Mint. The Horde hits the new Bull outpost on Rot 3: the Ghost Garrison holds, but just barely. SOL drops 2.4σ in an hour. **Tick:** **Chaos ★★: Flash Wick**, so all Walls go offline, just as the Killbot Column arrives at the Bull Mine (no garrison: −3 Pressure). A Bull player posts the replay of their Banner losing to a Bear Ironclad; it gets shared.

What players felt: the Bulls are big but stretched, the Bears are cut off by a small faction's naval flank, and the market dealt the cards everyone was watching on the ticker.

### 2.12 Phone readability
- **Two zoom levels.** *Strategic*: the whole board as flat coloured borders (Verdigris/Rust/Slate), corruption as dark stacks, icons only for landmarks, lairs, your pieces and incoming arrows. *Tile*: the painted terrain vignette, resource and improvement icons, Pressure shown as faction cubes, garrison miniatures, the tile's battlefield modifier.
- **A top bar like a board-game round track:** "ROUND 37/84 · tick in 03:12 · NEXT CARD tracking BEAR ★★ · orders 1/2 placed".
- **One-tap verbs:** tap a tile → "Run here", "Order", "Send Banner". Long-press for the tile card.
- **Art:** the board is a physical table under a lamp: oil-painted hexes, carved wooden faction pieces, brass enemy tokens, paper event cards. Melancholic, analog, readable.

### 2.13 Seasons
- **4 weeks = 84 rounds.** Week 4 = **Lair Week**: lairs can be assaulted (special 30-wave runs at ×1.5); the faction with the most lair WP wins the season crown.
- **Score:** the season standing is victory points: owned tiles (1), landmarks (5), lairs (10), outbreak tiles cleared (1 each), averaged over the last 21 rounds so a late rush can't steal it.
- **Reset:** a new generated map; tiles, Pressure, Supply, pieces and Banners reset. **Chips, Alloy, the Forward Base and unlocks never reset.**
- **Rewards:** by faction finish and personal contribution: cosmetic banner, cabinet trim, title, a chip bonus (500/350/250 + up to 300), deliberately small next to a month of runs.
- **Season modifier:** one twist per season (e.g. "Archipelago": more sea; "Bear Market": Bear suit cards ★+1).

### 2.14 Anti-snowball on the board (summary)
Killbot Columns target the richest tile; Liquidation Cascade hits overextension; Funding Rate taxes the biggest; supply lines make long borders fragile; luxury duplicates stop counting; the underdog multiplier (×1.3 Pressure from runs for the faction with the fewest tiles, ×0.85 for the most) and per-capita scaling (`1/sqrt(active members)` on run Pressure) from v1 stay.

---

## 3. Factions

**Key decision:** three colour factions mapped to the three market moods, which ties the faction fantasy straight into the market layer: **Verdigris Bulls (long), Rust Bears (short), Slate Crabs (sideways/hedged).** Each has one special unit, one passive and a personal tech tree funded by a faction currency (**Scrip**). Market alignment bonuses are kept small (≤ 10%) so a month-long bull market can't decide the season.

### 3.1 Identity

| | **Verdigris Bulls** (green-grey patina) | **Rust Bears** (oxide red) | **Slate Crabs** (blue-grey) |
|---|---|---|---|
| Fantasy | Shock troops, "send it", cavalry charges, banners | Saboteurs and scavengers who profit from collapse | Engineers, fortifications, hedgers, patient money |
| Motto | "Number go up." | "Everything goes to zero. Be ready." | "Sideways is a direction." |
| Passive | **Momentum:** after any spin that pays 2+ lines, the next spin this turn costs 25% less | **Short the Army:** each of your units that dies in battle refunds 2 credits; scrapping pays +1 | **Range-bound:** bank cap +30 and nudges can go up or down (Reverse Gear built in) |
| Weather bonus | Bull: +8% army damage | Bear: +8% army damage | Crab: +1 nudge per turn |
| Call the Candle | LONG calls liquidate at −1.2σ instead of −1.0σ | SHORT calls liquidate at −1.2σ | 1x and 3x calls pay ×1.15 |
| Special unit (symbol, unlocked by joining) | **Lancer**: armoured bike cavalry, charges and knocks back the first target | **Saboteur**: infiltrates the enemy backline, plants a charge (AoE on death or after 6 s) | **Field Engineer**: builds a sandbag wall (300 HP) and then repairs Tanks and Mechs |

The special unit replaces one of the six symbols in the player's reel loadout (see §5.10), so it doesn't dilute the reel.

### 3.2 Tech trees
Each faction has a 16-node personal tree in 4 branches of 4, funded by **Scrip** (earned only through world play: 1 Scrip per 5 WP, Garrison Pay, PvP wins). Scrip is per season but **unlocked nodes persist** across seasons for that faction, so switching back later isn't punished.

| Branch | Bulls | Bears | Crabs |
|---|---|---|---|
| Passive | "Stampede": Momentum discount 25% → 40% | "Liquidation Engine": once per turn, a blast that pays 0 lines is refunded | "Range Lock": a nudge that creates a line is refunded (1/turn) |
| Army | Lancer Lv2/Lv3 classes; +5% move speed army-wide | Saboteur classes; enemies below 25% HP take +15% damage | Engineer classes; walls +50% HP |
| War | +1 attack ticket; Banner gets +1 item slot | Successful attacks take +2 extra Pressure | Garrison Pay +50%; Ghost Garrisons on your tiles use the band's top-25% army |
| Board | **Forced March**: your pieces march −1 h per hex (min 1) | **Deep Sabotage**: Sabotage reaches 2 hexes past your border and can cut Roads for 2 rounds | **Earthworks**: Walls and Ports cost 50%; Fortify stacks to 3 |

Node costs: 40 / 80 / 140 / 220 Scrip per tier. Expect an active player to finish one branch per season.

**Faction Doctrines (collective):** every 2,000 faction WP in a season unlocks a faction-wide doctrine for the rest of the season (e.g. "Bull Run: Reinforce orders give +1 extra Pressure"; doctrines act on the board, never on the cabinet), voted from 3 options by members. That gives casual players a reason to contribute.

### 3.3 Joining and switching
- Choose after your first wave-10 clear (the same moment PvP unlocks). A short painted vignette for each faction; the **smallest faction by active members shows a "Reinforcements Needed" bonus: +25% Scrip and chips from world play for 2 weeks**.
- **Locked for the season.** Switching is allowed at the reset, free. A mid-season defection is possible once, costs all Scrip, and puts a 7-day cooldown on Pressure gain.

### 3.4 Anti-snowball

| Lever | Effect |
|---|---|
| Underdog multiplier | The faction holding the fewest tiles gains run Pressure ×1.3; the most tiles ×0.85 |
| Diminishing luxuries | A 2nd copy gives 50%, a 3rd nothing |
| The enemy AI | Killbot Columns target the richest tile; Liquidation Cascade hits overextension; Funding Rate taxes the biggest (§2.7–2.8) |
| Supply lines | Long borders are fragile; small factions can cut them |
| Per-capita scaling | `1/sqrt(members)` on run Pressure |
| Join bonus | +25% for the smallest faction |
| Small weather bonuses | ≤ 8%, so the real market tilts but doesn't decide |
| Season reset | Always back to 0 |

---

## 4. Run structure

**Key decision:** a run is **30 waves in one biome** (in the solo Campaign, or on a chosen tile of the war table) (one turn per wave), with **judgement waves at 5/15/25** (Call the Candle, core reward) and **bosses at 10/20/30** (multi-phase, better core reward). The MVP's 3-wave "levels" become the first 3 waves of the zombie area, so the existing code maps over directly.

### 4.1 Enemy budget curve
Each wave has a **threat budget** spent on enemies (regular = 1, elite = 4, boss = its own value), plus a stat scale on HP and damage.

`Budget(w) = round(2 + 0.9·w + 0.035·w²)`; `Stat scale(w) = 1 + 0.025·(w−1)`; then × the tile's corruption modifier on the war table (§2.6; the solo Campaign plays at corruption 1 = ×1.0).

| Wave | Budget | Stat scale | Typical composition | Notes |
|---|---|---|---|---|
| 1 | 3 | 1.00 | 3 regulars (basic type only) | The MVP's wave 1 is ~2; this is still gentle |
| 3 | 5 | 1.05 | 5 regulars, 2 types | |
| 5 | 7 | 1.10 | **Judgement**: 7 regulars, Call the Candle | First core |
| 8 | 12 | 1.18 | 8 regulars + 1 elite | First elite appears at wave 7 |
| 10 | 15 | 1.23 | **Boss I** + 4 regulars | |
| 15 | 23 | 1.35 | **Judgement**: 11 regulars + 3 elites | |
| 20 | 34 | 1.48 | **Boss II** + 8 regulars + 2 elites | |
| 25 | 46 | 1.60 | **Judgement**: 14 regulars + 8 elites | Hard cap 16 bodies on field; overflow budget converts to +HP |
| 30 | 61 | 1.73 | **Boss III** + 6 elites + reinforcement waves mid-fight | |

The enemy mix shifts over the run: waves 1–9 are basic and fast regulars; 10–19 add ranged and support; 20–30 bring elites with counters to the player's most common class (the "adaptive" tag: if more than 40% of your army is one unit type, one elite slot becomes that type's counter).

### 4.2 Rosters
Regulars: 4 per area. Elites: 2. Bosses: 3. Values for regulars are at stat scale 1.0. The first two regulars and boss I of each area reuse the MVP's numbers.

**Rotlands: Zombies** (swarm, attrition, revival)

| Unit | Type | HP / dmg / cd | Ability |
|---|---|---|---|
| Walker | regular | 34 / 6 / 1400 | none, comes in numbers |
| Runner | regular | 20 / 6 / 800 | fast; targets the nearest ranged unit |
| Bloater | regular | 60 / 4 / 1600 | explodes on death: 20 AoE + poison cloud 3 s |
| Spitter | regular | 26 / 8 / 1700 | ranged acid: −20% armor on hit |
| Screamer | elite | 90 / 5 / 2000 | scream: all zombies +30% speed for 4 s, every 8 s |
| Grave Surgeon | elite | 110 / 6 / 1500 | raises one dead zombie at 50% HP every 6 s |
| **Mother Rot** (W10) | boss | 600 / 12 / 1600 | P1: spawns 2 Walkers every 6 s. P2 (<50%): bursts, becomes 3 Rotlings (150 HP each) that must all die |
| **The Abomination** (W20) | boss | 1,600 / 30 / 2000 | Hook: drags your rearmost unit to melee every 10 s. P2 (<60%): devours a grabbed unit to heal 15%. P3 (<25%): enrage +50% speed |
| **Patient Zero** (W30) | boss | 3,200 / 34 / 1500 | Infection: your units that die rise as zombies on the enemy side. P2: summons a Screamer every 12 s. P3 (<20%): "Pandemic": all your units take 2% max HP per second; kill fast or lose |

**Crash Site: Aliens** (tech, control, backline threats)

| Unit | Type | HP / dmg / cd | Ability |
|---|---|---|---|
| Saucer | regular | 22 / 6 / 1300 | ranged, flies (ignores walls) |
| Grey | regular | 44 / 9 / 1200 | melee |
| Lurker | regular | 30 / 10 / 1100 | teleports to your backline at battle start |
| Spore Pod | regular | 80 / 0 / — | stationary; hatches a Grey every 8 s until killed |
| Warden | elite | 140 / 8 / 1500 | shield projector: aliens within range take −40% damage |
| Mind Flayer | elite | 100 / 10 / 1800 | charms your highest-damage unit for 4 s, every 10 s |
| **The Overlord** (W10) | boss | 700 / 14 / 1500 | Splash beam. P2 (<50%): 3 Saucers orbit it, absorbing hits until destroyed |
| **The Abductor** (W20) | boss | 1,800 / 26 / 1600 | Tractor beam: lifts your highest-level unit off the field for 8 s, every 15 s. P2: drops it back *as an enemy* for 5 s |
| **Hivemind Prime** (W30) | boss | 3,000 / 30 / 1400 | Mirror: at battle start it copies your strongest unit's class ability. P2 (<50%): psychic link, damage to it is split among all living aliens. P3: overload, every alien explodes on death |

**Foundry: Killbots** (armour, precision, the market-linked one)

| Unit | Type | HP / dmg / cd | Ability |
|---|---|---|---|
| Scrapbot | regular | 52 / 7 / 1300 | melee, 20% armor |
| Gunner | regular | 30 / 9 / 1500 | ranged |
| Saw Drone | regular | 24 / 7 / 700 | fast, ignores taunt |
| Repair Bot | regular | 40 / 0 / — | heals bots 10 HP/s |
| Mortar Walker | elite | 150 / 18 / 3000 | long-range splash on your densest cluster |
| EMP Unit | elite | 120 / 5 / 2000 | EMP pulse: Mechs and Tanks stunned 2 s, every 10 s |
| **Juggernaut** (W10) | boss | 900 / 16 / 1700 | 50% armor in front; P2 (<40%): armor falls off, +60% speed |
| **The Liquidator** (W20) | boss | 1,700 / 28 / 1500 | HFT bot. "Front-run": every 6 s it hits the unit that dealt the most damage in the last 6 s. P2: places "sell walls", 3 barriers that must be broken |
| **The Algorithm** (W30) | boss | 3,400 / 32 / 1500 | **Market-linked.** Its armor = 20% + live volatility percentile × 30%; on every 1m candle close it changes stance (green candle = attack stance, red = shield stance). P3 (<25%): "Flash Crash", kills every unit below 15% HP |

### 4.3 Judgement waves (5, 15, 25)
The wave itself has a normal budget with a themed elite. Before BATTLE, the player makes the **Call** (§7.3). Reward: **pick 1 of 3 cores** (rarity improves with the Call multiplier) plus the Call pot.

### 4.4 Rewards per wave

| Source | Credits | Chips (banked, paid at run end, win or lose) | Other |
|---|---|---|---|
| Normal wave won | 5 + ceil(w/2) | 2 + floor(w/5) | |
| Interest | +1 per 10 unspent credits at wave end, max +4 | | Rewards discipline |
| Judgement won | 12 + Call pot (20 × M) | +10 × M | Pick 1 of 3 cores |
| Boss I / II / III | +15 / +25 / +40 | +25 / +50 / +100 | Pick 1 of 3 cores (one guaranteed Rare+ / Epic+ / Legendary) |
| First clear of an area (one time) | | +300 | +20 Alloy; opens the Lv5 building gate (§8.2) and the next area |
| Run participation | | +3 | |

Chips by death wave (no bonuses): wave 5 ≈ 15, wave 10 ≈ 55, wave 15 ≈ 95, wave 20 ≈ 175, full clear ≈ 320 (+300 first clear).

### 4.5 On loss
- The run ends; dead armies don't continue (pillar). Banked chips are paid in full, influence/WP counts, and the army snapshot at the last checkpoint band is kept as a Banner if one was reached.
- **Loss report** card: which enemy killed the most, what the Call did, "you were 1 Mech short": a one-line coaching hint. That helps make a harsh loss feel fair.
- **Bailout Package** (item, §6.2) is the only second chance and is deliberately expensive.

### 4.6 Other modes: Daily Historical, Draft Cabinet, Benchmark
| Mode | Cadence | Rules | Ranked by | Rewards |
|---|---|---|---|---|
| **Daily Historical** | daily | 10 waves, fixed seed and a recorded historical candle (§7.5) for weather and Calls; your Forward Base applies | best wave, then fewest spins | chips 20–100 by percentile |
| **Draft Cabinet** (borrowed from TCG limited) | weekly, Monday 00:00 UTC | **Same random pool for everyone.** Draft your 6 reel symbols by picking 1 of 3, six times, from a seeded 18-unit pool (mechs included, even ones you haven't unlocked). The same seed schedule, the same core offers, and last week's recorded SOL candles for weather and Calls, so nobody gets a better market. **Flat "Draft Standard" base**: the Forward Base and pity are off; everyone gets cap 6, 4 spins, 2 item slots, 1 socket. 3 attempts per week (same seed; knowledge from earlier attempts is intended skill) | best wave, tie-break: total energy left | cosmetics, chips 50–300 by percentile, top 10%: 5 Alloy |
| **Benchmark** (for AI agents and humans, §12) | permanent fixed seed sets | Fixed seeds, recorded market, flat base, published inputs and replays | score per seed set | leaderboard only |

The Draft Cabinet is the fairest test of skill in the game, the main answer to "too luck-dependent", and a good stream format.

---

## 5. Units and progression

**Key decision:** units are pure data (`type → base stats, role, classes`) and art is a separate skin layer. Every summon rolls **rarity + affixes** from the spin seed. Lv2 and Lv3 each choose between 2 classes, for **36 real classes**; the generic Hardened/Overclocked Lv3 become affixes.

### 5.1 Class trees (Lv2 options are the MVP's existing ones)

| Unit | Lv2 class | Lv3 class A | Lv3 class B |
|---|---|---|---|
| **Soldier** | Rifleman (+40% dmg) | **Veteran**: 20% crit for ×2; crits heal 5% | **Shock Trooper**: first hit on each target stuns 1 s |
| | Grenadier (hits the row) | **Demolitionist**: bigger splash, leaves fire (5 dmg/s, 3 s) | **Breacher**: splash knocks back and breaks walls/shields ×3 |
| **Medic** | Field Medic (+60% heal) | **Surgeon**: once per battle, revives the first ally to fall at 40% | **Chaplain**: aura +3% max HP/s regen, immune to charm and fear |
| | Combat Medic (heals + shoots) | **Corpsman**: heals hit the 2 most hurt allies | **Stim Dealer**: every 6 s, gives an ally +35% attack speed for 4 s |
| **Sniper** | Marksman (+50% dmg) | **Deadeye**: executes targets under 20% HP | **Spotter**: marked target takes +25% damage from everyone |
| | Ghost (35% dodge) | **Phantom**: invisible for 5 s, opening shot ×3 | **Wraith**: every dodge instantly reloads |
| **Tank** | Bulwark (+50% HP, taunt) | **Fortress**: allies behind it take −30% ranged damage | **Iron Wall**: reflects 25% melee damage |
| | Destroyer (+50% dmg) | **Siege Breaker**: shells pierce through the line | **Hellbore**: flame cone, 8 dmg/s to all in front |
| **Artillery** | Howitzer (+50% dmg) | **Railgun**: pierces every enemy in a line | **Big Bertha**: every 4th shot ×4 dmg + 1.5 s stun |
| | Mortar (all enemies at 70%) | **Cluster Mortar**: each hit drops 3 bomblets | **Smoke Battery**: smoke, enemy ranged accuracy −30% |
| **Mech** | Titan (+60% HP) | **Colossus**: stomp, AoE knockback every 6 s | **Aegis**: shields the 2 nearest allies for 20% of its max HP |
| | Striker (attacks 40% faster) | **Berserker**: +10% attack speed per kill, stacks to 5 | **Blade Dancer**: dashes to the enemy backline at start |

### 5.2 Rarity and random stats
Rolled at summon from the spin seed. Base table (owner's): Common 70 / Rare 22 / Epic 7 / Legendary 1.

| Rarity | Chance | Stat bonus (HP & dmg) | Affix slots | Over-cap scrap value |
|---|---|---|---|---|
| Common | 70% | +0–5% (rolled) | 0 | 3 cr |
| Rare | 22% | +6–10% | 1 | 5 cr |
| Epic | 7% | +11–17% | 2 | 8 cr |
| Legendary | 1% | +18–25% | 3 | 12 cr |
| **Gilded** (full board only) | — | +30% | 3 + 1 unique Gilded affix | — |

Rarity modifiers: Volatile weather 60/28/10/2; Rarity Luck meta upgrade +1% to Rare per level (from Common); cores (§6.1).

### 5.3 Affixes (pool of 24, 1 roll per slot, no duplicates)

| Affix | Effect | Flavour |
|---|---|---|
| **Diamond Hands** | Survives the first lethal hit at 1 HP | degen |
| **Paper Hands** | +30% attack speed, but retreats to the back line below 30% HP | degen (mixed) |
| **Degen** | +50% dmg, −25% HP | degen |
| **Bag Holder** | −10% speed; +3% all stats per wave survived (max +45%) | degen |
| **Ape In** | First 4 s: +60% move speed and +40% dmg | degen |
| **WAGMI** | On death, heals all allies 15% max HP | degen |
| **Rug Pull** | On death, explodes for 30% of its max HP to nearby enemies | degen |
| **Exit Liquidity** | Enemies target it first (soft taunt), +20% HP | degen |
| **Yield Farmer** | 5% lifesteal; +1 credit per kill (max 3/battle) | degen |
| **Whale** | +35% HP, bigger, immune to knockback and grabs | degen |
| **FOMO** | +8% dmg for each ally hitting the same target | degen |
| **Copium** | Below 50% HP: regenerate 2% max HP/s | degen |
| **Long Bias** | +15% dmg in Bull weather / when your Call is in profit | market |
| **Short Bias** | +15% dmg in Bear weather / when your Call is in loss | market |
| **Leveraged** | Call buffs and debuffs ×1.5 on this unit | market |
| **Hardened** | +25% HP | military (old Lv3) |
| **Overclocked** | +20% dmg | military (old Lv3) |
| **Steady Aim** | +25% range | military |
| **Quick Draw** | First attack happens instantly | military |
| **Plated** | 15% damage reduction | military |
| **Field Rations** | Heals 20% at the start of each battle above max (overheal) | military |
| **Veteran's Eye** | +10% crit chance | military |
| **Zombie Hunter / Xeno Hunter / Scrapper** | +25% dmg vs one enemy faction | military (3 variants) |

Gilded unique affixes (one per unit type), e.g. "**Number Go Up**": +2% all stats every 5 s of battle.

### 5.4 Merge and absorb rules
- **Merge:** two units of the **same type and level** merge (as now): Lv1 + Lv1 → Lv2, Lv2 + Lv2 → Lv3. Lv3 is max.
- **Absorb (borrowed from Slotbound, adapted):** a same-type unit of a *lower* level can be absorbed into a higher one. Absorbing a Lv1 into a Lv2 fills **1 of 2 progress pips**; at 2 pips it becomes Lv3 (choose the class). This costs exactly the same as merging (a Lv3 is always 4 Lv1-equivalents), but you can level your best unit the moment a copy lands instead of waiting for a matching pair. That is a flexibility gain, not a power gain, so the punishing curve is unchanged.
- **Rarity:** result = the higher of the two. If both share the same rarity, there is a **20% chance to rise one tier** (max Legendary). Gilded + anything stays Gilded. Absorbs never raise rarity.
- **Affixes:** the result has the slots of its rarity. **The player chooses which affixes to keep from the union of both units** (on merge and absorb). This is a small, satisfying decision and makes a Common copy useful as fodder.
- **Random stat roll:** the higher of the two.
- Merging and absorbing are free; nothing is lost except the slot.

### 5.5 The consolidated roster (29 units, 16 of them mechs)

**Key decision:** the player army becomes **mech-heavy**: 6 starters, 8 infantry/vehicle/faction units, and **15 new mech chassis** across four weight classes (16 counting the starter Mech). Mechs are **chassis + one hardpoint module** (recommended approach, below). Every unit is still pure data; art (Meshy → sprites) attaches by `unitId`.

#### 5.5.1 Recommended approach: chassis + one hardpoint (not full frame-building)
| Option | Content cost | Readability | Verdict |
|---|---|---|---|
| A. Every mech is a fixed unit | 16 units × 6 classes | High | Too flat; identical every run |
| B. Full frame builder (legs + torso + arms + weapon) | Explodes balance and art (every combination needs a sprite) | Low on a phone | Reject |
| **C. Chassis + 1 hardpoint module** | 16 chassis + **8 modules** | High: the module is a small icon on the unit card and a weapon swap on the sprite | **Recommended** |

- The **chassis** decides role, stats, weight class, class tree and tags.
- The **hardpoint** replaces the chassis's basic attack with a module chosen *before the run* in the Reel Loadout screen (one module per chassis, unlocked in the Mech Works branch, §8.2). There is no in-run module inventory, so the run stays focused on the slot machine.
- Modules are the **pre-run counter-pick against an area**: Flamer for zombies, Ion for aliens, Laser Lance for killbots.

| Module | Allowed on | Effect on the basic attack | Best vs |
|---|---|---|---|
| Standard Cannon | all | as listed (default) | — |
| Autocannon | Light, Medium, Heavy | +25% attack speed, −15% damage | swarms (Runners, Saw Drones) |
| Flamer | Light, Medium, Heavy | range → 14, cone damage over time; +40% vs Organic | zombies |
| Missile Pod | Medium, Heavy, Super | range +25, 30% splash, cooldown +30% | clusters, Spore Pods |
| Ion Disruptor | Light, Medium, Heavy | hits strip 30% of shields; 15% chance to interrupt an ability | aliens (Warden, Mind Flayer) |
| Laser Lance | Medium, Heavy, Super | pierces the line, ignores 50% armour | killbots (Scrapbot, Juggernaut) |
| Countermeasures | all | first 8 s of battle: −25% damage taken from ranged | Gunners, Mortar Walkers |
| Reactor Overcharge | Heavy, Super | +20% damage and HP; explodes on death (damages allies too) | bosses |

Support chassis (Tinker, Palisade, Crowmother, Cricket) take a module only for their weak sidearm; their support ability is unchanged.

#### 5.5.2 Body types (the counter backbone)
Every unit is **Organic** or **Machine** (some are also **Flying**). The enemy rosters (§4.2) already split this way, which makes the counters readable:
- Zombie infection (Patient Zero, Grave Surgeon) and the Abomination's devour work on **Organic** units only. **Mechs counter the zombie gimmicks.**
- Alien charm (Mind Flayer) works on **Organic** only. The Abductor can't lift units of **size 2** or the **Ironclad**.
- Killbot EMP (EMP Unit) stuns **Machines** only, and the Liquidator front-runs your top damage dealer. **Infantry and EW (Cricket) counter the killbots.**

So a pure mech army is strong in Rotlands and Crash Site and in danger in the Foundry. That makes the loadout a real per-area decision.

#### 5.5.3 Roster table
Stats are at Lv1, on the MVP scale (Soldier 42/8/1000, Mech 100/24/1300). Range/speed use the MVP's field units (Sniper range 75, Soldier speed 10). **Tonnage** is the reel-mix cost per stop (§5.10); **Max slot** is the Phase 1 equivalent (the highest of the fixed 34/20/16/13/10/7 slots it may occupy). Unlock IDs refer to the tech tree (§8.2).

| # | Unit | Weight / body | Tags | Role | HP / dmg / cd ms | Range / speed | Tonnage · max slot | Unlock |
|---|---|---|---|---|---|---|---|---|
| 1 | Soldier | Infantry · Organic | Infantry | melee line | 42 / 8 / 1000 | 7 / 10 | 1 · 34 | starter |
| 2 | Medic | Infantry · Organic | Infantry, Support | healer (11) | 30 / 4 / 1200 | 22 / 8 | 1 · 34 | starter |
| 3 | Sniper | Infantry · Organic | Infantry, Recon | backline single target | 24 / 19 / 1800 | 75 / 4 | 1.5 · 20 | starter |
| 4 | Tank | Vehicle · Machine | Armor | frontline | 120 / 11 / 1500 | 8 / 6 | 2 · 16 | starter |
| 5 | Artillery | Vehicle · Machine | Armor, Artillery | splash | 32 / 11 / 2000 | 55 / 3 | 2 · 16 | starter |
| 6 | Mech (Mk I Strider) | Medium mech · Machine | Medium Mech, Assault | brawler | 100 / 24 / 1300 | 9 / 8 | 3 · 13 | starter |
| 7 | Hound (K9) | Infantry · Organic | Recon | fast melee, interrupts casters | 38 / 9 / 700 | 6 / 16 | 1 · 34 | B3 |
| 8 | Engineer | Infantry · Organic | Infantry, Support | builds a turret (40 HP, 6 dmg) at battle start | 36 / 5 / 1400 | 20 / 7 | 1.5 · 20 | B4 |
| 9 | Drone Rig | Infantry · Organic (drone Flying) | Infantry, Recon | flying ranged drone, ignores walls | 30 / 8 / 1100 | 45 / 6 | 2 · 16 | B8 |
| 10 | Commissar | Infantry · Organic | Infantry, Support | aura +15% dmg; anti-panic (counters liquidation) | 60 / 7 / 1200 | 25 / 6 | 3 · 13 | B11 |
| 11 | Flak Truck | Vehicle · Machine | Armor, Artillery | anti-air, ×2 vs Flying | 90 / 9 / 600 | 50 / 5 | 3 · 13 | B12 |
| 12 | Lancer | Bike cavalry · Organic | Bull, Assault | charge + knockback | 80 / 16 / 1400 | 7 / 15 | 2 · 16 | join Bulls |
| 13 | Saboteur | Infantry · Organic | Bear, Infantry | infiltrates, plants a charge | 34 / 6 / 1000 | 6 / 12 | 2 · 16 | join Bears |
| 14 | Field Engineer | Exosuit · Organic | Crab, Support | sandbag wall (300 HP), repairs machines | 50 / 5 / 1300 | 20 / 6 | 2 · 16 | join Crabs |
| 15 | **Wasp** | Light mech · Machine (hover) | Light Mech, Recon | skirmisher, kites, can hit Flying | 50 / 9 / 700 | 30 / 14 | 1.5 · 20 | M1 |
| 16 | **Jackal** | Light mech · Machine | Light Mech, Assault | flanker, leaps to the backline | 65 / 12 / 900 | 8 / 13 | 1.5 · 20 | M2 |
| 17 | **Cricket** | Light mech · Machine | Light Mech, Support | EW jammer: enemy ability cooldowns +50% in radius 30 | 45 / 5 / 1400 | 40 / 9 | 1.5 · 20 | M6 |
| 18 | **Mantis** | Light mech · Machine | Light Mech, Recon | precision anti-armour, 40% armour pierce | 40 / 20 / 1700 | 70 / 8 | 1.5 · 20 | M8 |
| 19 | **Hoplite** | Medium mech · Machine | Medium Mech, Armor | shield line mech, 20% frontal block | 140 / 13 / 1200 | 9 / 7 | 2 · 16 | M4 |
| 20 | **Tinker** | Medium mech · Machine | Medium Mech, Support | repairs machines 14/cd (humans at 50%) | 90 / 3 / 1200 | 25 / 7 | 2 · 16 | M5 |
| 21 | **Palisade** | Medium mech · Machine | Medium Mech, Support | shield dome: allies in radius 15 take −20% dmg | 120 / 6 / 1500 | 20 / 6 | 2 · 16 | M9 |
| 22 | **Pyre** | Medium mech · Machine | Medium Mech, Assault | flamer cone, +50% vs Organic | 120 / 6 / 400 | 14 / 7 | 2 · 16 | M10 |
| 23 | **Longbow** | Medium mech · Machine | Medium Mech, Artillery | artillery walker, 3-missile salvo | 80 / 16 / 2400 | 65 / 4 | 2 · 16 | M13 |
| 24 | **Crowmother** | Medium mech · Machine | Medium Mech, Recon | carrier: a drone (25 HP, 5 dmg, Flying) every 8 s, max 4 | 110 / 0 / 8000 | 0 / 5 | 3 · 13 | M14 |
| 25 | **Goliath** | Heavy mech · Machine | Heavy Mech, Assault | heavy assault, 25% armour | 220 / 30 / 1600 | 10 / 5 | 3 · 13 | M15 |
| 26 | **Ironclad** | Heavy mech · Machine | Heavy Mech, Armor | taunt wall; immune to grabs, lifts, knockback | 320 / 12 / 1500 | 8 / 5 | 3 · 13 | M16 |
| 27 | **Hammerfall** | Heavy mech · Machine | Heavy Mech, Artillery | rail cannon, pierces, ignores armour | 150 / 48 / 2800 | 70 / 3 | 3 · 13 | M19 |
| 28 | **Leviathan** | Super-heavy · Machine, **size 2** | Heavy Mech, Titan | walking fortress, 3 mounts hit 3 targets | 520 / 14×3 / 1200 | 35 / 3 | 5 · 7 | M20 |
| 29 | **Atlas** | Super-heavy · Machine, **size 2** | Heavy Mech, Titan | titan, ground slam AoE | 480 / 55 / 2200 | 12 / 3 | 5 · 7 | M21 |

**Size 2** units take two unit-cap slots (the counterweight to their power). They count once for synergy tags.

#### 5.5.4 Counter map vs the enemy rosters (§4.2)
| Area | Their threat | Best answers |
|---|---|---|
| Rotlands (zombies) | swarms, revival, infection of Organics | Pyre (Cremator stops revives/infection), Hoplite line, Autocannon/Flamer modules, Mech-heavy armies (immune to infection) |
| Crash Site (aliens) | backline teleports, charm of Organics, shields, lifts | Wasp and Flak Truck vs Saucers, Crowmother drones intercept Lurkers, Cricket vs Warden/Mind Flayer, Ironclad and size-2 units can't be abducted, Ion module |
| Foundry (killbots) | armour, EMP on Machines, front-running | Mantis, Hammerfall, Laser Lance vs armour; infantry + Medics (EMP-proof); Cricket Firewall makes Machines EMP-immune; Longbow vs Repair Bots |

#### 5.5.5 Class trees: new mechs (Lv2 → two Lv3 options each)
*Adjacency-based abilities are marked* ◆ *(rule in §5.8).*

| Chassis | Lv2 class | Lv3 option 1 | Lv3 option 2 |
|---|---|---|---|
| **Wasp** | Hornet: +30% attack speed, kites further | Stinger: every 3rd shot shreds 10% armour (stacks) | Afterburner: dashes away when hit (3 s cd), 25% dodge |
| | Pathfinder: marks the nearest elite (+15% dmg taken) | ◆ Recon Uplink: adjacent ranged allies +15% range | Target Painter: marked enemies take +30% from Artillery-tag units |
| **Jackal** | Ripper: +40% dmg vs ranged units | Gutter: leaps again on kill | Hamstring: hits slow 40% for 2 s |
| | Prowler: invisible for 4 s, leaps to the backline | Ambusher: opening leap stuns 1.5 s | ◆ Pack Leader: adjacent Light Mechs +15% dmg |
| **Cricket** | Jammer: radius 30, enemy cooldowns +50% | Blackout: also cuts enemy healing 50% | Spoofer: every 10 s one enemy attacks its own side for 3 s |
| | Hacker: disables the nearest elite's ability 5 s, every 12 s | Backdoor: hacked killbots switch sides for 4 s | Firewall: all your Machines immune to EMP and stun |
| **Mantis** | Needle: armour pierce 40% → 70% | Tungsten: ignores armour, +20% vs bosses | Exposer: each hit removes 10% armour (stacks) |
| | Stalker: +25% range, repositions after each kill | Duelist: +60% dmg vs elites | Overwatch: first enemy entering range takes ×2 |
| **Hoplite** | Phalanx: +50% HP, taunt | ◆ Shieldwall: adjacent allies −20% damage taken | Spearpoint: hits back each melee attacker for 8 |
| | Vanguard: +40% dmg | Breaker: every 3rd hit knocks back | Gunline: fires its autocannon (range 25) while advancing |
| **Tinker** | Mechanic: +60% repair | Overhaul: once per battle, restores the first fallen Machine at 30% | ◆ Tune-Up: adjacent Machines +15% attack speed |
| | Salvager: enemy deaths nearby give scrap | Scrap Armor: each nearby death shields allies for 10 | Field Forge: every 3rd enemy wreck becomes a 60 HP turret |
| **Palisade** | Dome: radius 15 → 22, −25% dmg | Fortress Dome: dome reflects 15% of ranged damage | Hardlight: blocks the first AoE every 8 s completely |
| | Barrier: projects a 200 HP wall forward | Phase Wall: wall regenerates 10 HP/s | Mirror Wall: projectiles that hit the wall bounce back at 30% |
| **Pyre** | Inferno: +50% cone width and range | Napalm: leaves burning ground for 4 s | Firestorm: 360° flame burst every 6 s |
| | Furnace: +10% dmg per second of firing (max +60%) | Meltdown: at max heat, AoE burst and reset | **Cremator: Organics it kills can't be revived or rise as zombies** |
| **Longbow** | Salvo: 3 missiles at different targets | Cluster: each missile splits in 3 | Hunter-Killer: missiles seek the lowest-HP enemy |
| | Siege: +60% range and dmg, −30% attack speed | Earthshaker: hits stagger 1 s | Bunker Buster: ×3 vs Spore Pods, Repair Bots, walls and the Liquidator's sell walls |
| **Crowmother** | Hive Deck: max drones 4 → 6 | Kamikaze: drones explode on death for 15 | Swarm Link: drones +5% dmg per living drone |
| | Escort Wing: drones guard allies, absorbing hits | Interceptors: drones shoot down 20% of incoming projectiles | Medevac: once per battle a drone carries a fallen Organic out (survives at 1 HP) |
| **Goliath** | Warlord: +50% dmg | Ravager: cleaves 3 targets | Executioner: ×2 vs targets under 30% HP |
| | Rampart: +60% HP | Unstoppable: immune to stun, grab, knockback | Retaliator: 30% of damage taken is dealt back |
| **Ironclad** | Anchor: immovable, strong taunt | Anvil: attackers are slowed 30% | Tractor Anchor: pulls nearby enemies to itself every 8 s |
| | Breakwater: charges forward at start | Bulldozer: charge pushes everything in its path | Wrecking Ball: charge stuns 2 s, recharges on kill |
| **Hammerfall** | Railmaster: shots pierce the whole line | Hypervelocity: ×1.5 vs bosses, never misses | Capacitor: every 4th shot ×3 |
| | Fire Base: deploys (immobile), +50% attack speed | ◆ Entrenched: −30% dmg taken; adjacent allies −10% | Thunder Battery: 40% splash |
| **Leviathan** | Dreadnought: 4 mounts | Broadside: every 8 s all mounts fire one target at ×2 | ◆ Citadel: adjacent allies +20% HP; it gains 40% armour |
| | Carrier Deck: launches 2 drones (as Crowmother) | Flight Deck: drones max 6, +10 HP | Command Ship: all your Machines +10% dmg and attack speed |
| **Atlas** | Earthbreaker: slam radius +50% | Tectonic: slam leaves a fissure (10 dmg/s, 3 s) | Cataclysm: every 15 s the slam hits the whole field at 50% |
| | Sentinel: +80% HP | Last Monument: on death, all allies healed to full and invulnerable 3 s | ◆ Guardian: takes 50% of the damage aimed at adjacent allies |

#### 5.5.6 Class trees: new infantry, vehicle and faction units
| Unit | Lv2 class | Lv3 option 1 | Lv3 option 2 |
|---|---|---|---|
| **Hound** | Tracker: interrupts casts on hit | Bloodhound: always targets the lowest-HP enemy | Pack Alpha: summons a second Hound (50% stats) |
| | Guard Dog: protects the nearest Organic | ◆ Loyal: adjacent ally takes −25% damage | Bite Lock: holds the target in place 2 s |
| **Engineer** | Turreteer: turret 40 → 70 HP | Twin Turrets: builds two | Rocket Turret: turret gains splash |
| | Sapper: plants 2 mines on the enemy half | Minefield: 4 mines | Demo Charge: mines stun 1.5 s |
| **Drone Rig** | Gunship: +40% drone dmg | Hellfire: drone fires missiles (splash) | Strafing Run: drone hits every enemy in a line every 6 s |
| | Spotter Drone: marks targets (+15% dmg taken) | Relay: all Recon allies +10% crit | EW Drone: jams one enemy elite for 3 s every 10 s |
| **Commissar** | Political Officer: aura 15% → 25% | ◆ No Retreat: adjacent allies can't be Panicked, charmed or feared | Execution Order: +50% dmg for allies vs the enemy that killed the last ally |
| | Field Marshal: +1 synergy count for the most common tag | Grand Strategy: +1 count for the two most common tags | Battle Plan: first 6 s of battle, +30% attack speed army-wide |
| **Flak Truck** | Flak Barrage: +40% vs Flying | Proximity Fuse: Flying hits splash | Sky Denial: Flying enemies in range are slowed 40% |
| | Ground Mode: aims at ground, +30% dmg | Shredder: hits reduce armour 5% | ◆ Escort: adjacent Armor units +20% dmg |
| **Lancer** (Bulls) | Charger: charge damage ×2 | Stampede: every Lancer charge also knocks back neighbours | Bull Run: +20% dmg per enemy knocked back (max 3) |
| | Outrider: flanks to the enemy backline | Raider: ×2 vs ranged | Breakaway: after a kill, recharge |
| **Saboteur** (Bears) | Demolitions: charge dmg +60% | Shaped Charge: ignores armour | Chain Bomb: kills by the charge trigger another charge (once) |
| | Infiltrator: invisible until it attacks | Assassin: first attack ×3 | Short Seller: each enemy it kills refunds 2 credits |
| **Field Engineer** (Crabs) | Fortifier: wall 300 → 500 HP | Bunker: wall shoots (6 dmg) | ◆ Trench Line: adjacent allies −20% ranged damage |
| | Mechanic: repairs machines 10/cd | Rebuild: once per battle, restores a destroyed Tank or Mech at 25% | Overclocker: repaired machines +15% dmg for 4 s |

### 5.6 Reel symbols stay readable
The 3×3 reel always shows **exactly 6 distinct symbols per run**, however many units exist. Readability rules:
- **Silhouette first:** every symbol is a unit silhouette on a frame whose **shape** shows the weight class (circle infantry, square vehicle, triangle light mech, hexagon medium, octagon heavy, double gold frame super-heavy) and whose **edge colour** shows the role (ochre assault, olive support, slate recon, rust artillery, grey armour). Muted, but distinct in silhouette even in greyscale.
- **The loadout strip:** a band under the reels shows the 6 symbols with their per-spin summon odds (e.g. "Hoplite 3.3%").
- **Presets:** 3 saved loadouts ("Rot run", "Foundry run").
- **Tap a symbol** on the reel to see the unit card (stats, class, module).

### 5.7 Synergy tags (borrowed from TFT)
**Key decision:** each unit has 1–2 tags (roster table). Bonuses switch on when **2 / 4 / 6 deployed units** share a tag, counted at battle start; duplicates count, size-2 units count once. With a cap of 5–8 and only 6 symbol types per run, tags turn the loadout into a build decision without adding anything to learn on the reel itself.

| Tag | Units (count in roster) | 2 | 4 | 6 |
|---|---|---|---|---|
| **Infantry** | Soldier, Medic, Sniper, Engineer, Drone Rig, Commissar, Saboteur (7) | +10% HP | +20% HP, +10% dmg | "Hold the Line": each Infantry survives one lethal hit |
| **Armor** | Tank, Artillery, Flak Truck, Hoplite, Ironclad (5) | Armor units −15% dmg taken | all allies −10% dmg taken | — |
| **Support** | Medic, Engineer, Commissar, Field Engineer, Cricket, Tinker, Palisade (7) | heals, repairs, shields +20% | +40%; Support units +30% HP | — |
| **Recon** | Sniper, Hound, Drone Rig, Wasp, Mantis, Crowmother (6) | +10% crit; scout report +1 tag | +20% crit; the first elite is marked (+20% dmg taken) | — |
| **Artillery** | Artillery, Flak Truck, Longbow, Hammerfall, Leviathan (5) | +15% range | first salvo of the battle ×2 | — |
| **Assault** | Mech, Lancer, Jackal, Pyre, Goliath (5) | +10% dmg | +20% dmg; +5% attack speed per kill (max 5) | — |
| **Light Mech** | Wasp, Jackal, Cricket, Mantis (4) | Light Mechs +15% speed and attack speed | Light Mechs 20% dodge | — |
| **Medium Mech** | Mech, Hoplite, Tinker, Palisade, Pyre, Longbow, Crowmother (7) | Medium Mechs +12% dmg | +12% more and a 10% max-HP shield at start | "Line Doctrine": Medium Mechs immune to knockback |
| **Heavy Mech** | Goliath, Ironclad, Hammerfall, Leviathan, Atlas (5) | Heavy Mechs +20% HP | Heavy Mechs immune to stun | — |
| **Titan** | Leviathan, Atlas (2) | (1 unit) all Machines +5% HP | (2) all Machines +10% dmg | — |
| **Market** | any unit with a degen/market affix (§5.3) | Call buffs ×1.2 on all units | Call buffs ×1.5; liquidation threshold 0.2σ deeper | "Full Degen": affix effects ×1.5 |
| **Bull / Bear / Crab** | faction unit (1) | (1) faction passive +50% | (2) faction weather bonus applies in any weather | — |

### 5.8 Positional adjacency (borrowed from Backpack Battles)
**Rule:** two allies are **adjacent** if their centres are within **radius 12** field units of each other (a unit is about 6 wide, so that is roughly touching). **In front** = the adjacent ally closer to the enemy (higher x); **behind** = lower x. While dragging a unit during deploy, faint lines show which allies it is adjacent to and which ◆ abilities light up.

Two kinds of ◆ abilities, so the auto battle stays readable:
- **Formation (locked at deploy):** checked when BATTLE is pressed and kept for the fight even when units move: Shieldwall, Recon Uplink, Pack Leader, Tune-Up, Citadel, Trench Line, Escort, Loyal, No Retreat.
- **Aura (live):** checked continuously at the same radius: Guardian (Atlas), Entrenched (Hammerfall), plus the existing Fortress (Tank: allies **behind** it within radius 12 take −30% ranged damage) and Chaplain (Medic: adjacent allies regenerate).

Starter classes converted to adjacency: **Fortress** (behind), **Chaplain** (adjacent), **Stim Dealer** (picks an adjacent ally first). In all, 15 classes use the rule; that's enough for formation to matter without making placement a puzzle every wave.

### 5.9 Open pity counters and Airdrop Flares
- **Rarity pity (visible on the cabinet as two brass counters):** "EPIC+ IN ≤ 25" and "LEGENDARY IN ≤ 100". Counts summons without that rarity. Soft pity: from the 15th summon without an Epic+, +2% Epic per summon. Hard pity: the 25th is Epic+, the 100th is Legendary. Counters are **account-wide and carry across runs** (normal modes only; off in Daily Historical and the Draft Cabinet so leaderboards stay fair). This makes bad luck end at a known point and shows the grind working, which addresses the "too luck-dependent" complaint about Slotbound without making wins easy.
- **Margin Support** (§8.1) is the line-side counterpart; both meters sit on the cabinet.
- Pity changes the roll deterministically inside the seeded engine, so it stays verifiable. Nothing about pity is ever sold (pity on paid pulls is what makes gacha a regulatory issue; we have no paid pulls).
- **Airdrop Flares (our Fate Stones):** a run resource. +1 for each boss wave won, +1 for a judgement Call with M ≥ 2; hold max 2 (3 with the Flare Pouch node). Firing one is a free extra spin, outside the spin limit and cost curve, that guarantees at least one line; summons over the cap go to the **airdrop crate** (2 slots, deploy when a slot frees up, or absorb). Flares don't carry over between runs.

### 5.10 Reel Mix: the final form of the loadout (borrowed from deck-building)
**Recommendation:** keep the **6 fixed weight slots (34/20/16/13/10/7) in Phase 1**, then move to **Reel Mix** in Phase 2. Reel Mix keeps the 6-symbol limit but lets you set *how many stops* each symbol gets, within a tonnage budget. That gives a deck-building feel while the 3×3 stays readable.

- A reel has **100 stops**, shared by all three reels (identical reels keep the line maths simple to show).
- Choose **6 symbols**, give each **4–30 stops** (super-heavies max 8).
- Each stop costs the unit's **tonnage** (roster table): Infantry 1, Sniper/Engineer/lights 1.5, medium/vehicle 2, heavy/Commissar/Flak 3, super-heavy 5.
- **Budget 150 tonnage** (tree adds +10 ×3, max 180). The current default (34 Soldier, 20 Medic, 16 Sniper, 13 Tank, 10 Artillery, 7 Mech) costs 145.
- Example of a mech-heavy mix at 170: Soldier 30, Medic 18, Wasp 18, Hoplite 14, Goliath 12, Leviathan 8 = 30 + 18 + 27 + 28 + 36 + 40 = 179 → over budget. Drop Leviathan to 6 (169). The game shows the per-spin odds live: Leviathan at 6 stops = 0.17% per spin. Heavies are reached through blasts, cores and absorbs, as intended.

**Why not real ordered strips:** if the order of symbols on a strip were fixed, players could memorise it and nudges would stop being blind, which breaks a fixed pillar. So we take the *composition* part of deck-building and leave out the ordering. Each cell is still an independent seeded draw from your mix.

---

## 6. Cores, items, shop

**Key decision:** **cores bend the machine** (odds and rules of the reels, run-long, socketed on the cabinet, 1 socket base → 3 via meta). **Items bend the army or the economy** (run-long, item slots 2 → 5). Cores come from judgement and boss waves only (plus a rare shop offer); items come from the shop.

### 6.1 Cores (32, by rarity)

**Rarity tiers.** Common = small economy edges. Rare = shape the reels. Epic = change the rules. Legendary = define the run. Pool: 10 Common, 11 Rare, 7 Epic, 4 Legendary.

**Drop odds when a core choice is rolled** (each of the 3 options rolls separately, no duplicates of cores you already own):

| Source | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| Judgement wave (Call M < 2) | 50% | 32% | 15% | 3% |
| Judgement wave (Call M ≥ 2) | 25% | 40% | 28% | 7% |
| Boss I (W10) | — | 70% | 25% | 5% (Rare+ guaranteed) |
| Boss II (W20) | — | — | 80% | 20% (Epic+ guaranteed) |
| Boss III (W30) | — | — | — | 100% |
| Shop (5% of offers) | 60% / 25 cr | 30% / 40 cr | 10% / 60 cr | never |

Sockets: 1 base, +1 (300 chips), +1 (800 chips). Unsocketed cores wait in a 3-slot core bag and can be swapped between waves. Scrapping a core pays 5 / 10 / 20 / 40 credits by rarity.

#### Common (10)
| Core | Effect |
|---|---|
| **Penny Slot** | The first spin of each turn costs 5 instead of 10 |
| **Dead Cat Bounce** | After a turn with zero summons, the first spin next turn is free |
| **Scrap Press** | Over-cap summons of a type you own at Lv1/Lv2 add merge progress: 2 progress = an auto-merge |
| **Nudge Motor** | +1 nudge per turn |
| **Loose Change** | +1 credit for every spin that pays no line |
| **Oil Can** | Each nudge you don't use refunds 4 energy at the end of the turn |
| **Spare Fuse** | +1 blast every third turn |
| **Bank Vault** | Energy bank cap +40 |
| **Pity Timer** | Margin Support kicks in after 3 dry spins instead of 4 |
| **Drill Sergeant** | Soldier summons roll rarity twice and keep the better result |

#### Rare (11)
| Core | Effect |
|---|---|
| **Echo Core** | Each line that pays a 2nd+ time in the same turn summons at +1 rarity |
| **Whale Magnet** | The two lowest-weight reel slots get +50% weight |
| **Sticky Center** | The center cell can be held through the next spin (1/turn) |
| **Diagonal Core** | Diagonal lines summon at +1 rarity |
| **Airdrop Core** | Every 6th spin of the run guarantees at least one line; over-cap units wait in an airdrop crate |
| **Bear Trap** | In Bear weather: +1 spin per turn and the 5th spin costs 23 |
| **Bull Horn** | In Bull weather: lines summon at +1 rarity |
| **Magnet Reel** | Once per turn, when a line has 2 of 3 matching after a spin, 25% chance the third cell snaps to match |
| **Recycler** | Each cell cleared by a blast refunds 2 energy |
| **Hot Streak** | Each spin this turn that paid a line makes the next spin 20% cheaper (stacks) |
| **Rally Banner** | Units summoned by a combo (2+ lines from one action) get +10% HP and damage |

#### Epic (7)
| Core | Effect |
|---|---|
| **Chain Reactor** | If a blast causes a line, you get a free blast (1/turn) |
| **Orderbook** | You see the next symbol waiting on top of each reel (nudges stop being blind) |
| **Wild Coin** | Adds a Wild symbol (weight 4) that matches anything; 3 Wilds summon your rarest unit type |
| **Leverage Core** | Spins cost 2× energy; every line summons at +1 rarity |
| **Hold Lever** | Hold one whole reel through the next spin (1/turn) |
| **Cascade Engine** | After a line pays, its cells clear and new symbols fall; repeat while new lines form (true cascades, on top of re-pay) |
| **Insider Info** | Before you spin, you see the top row of the next spin's result |

#### Legendary (4)
| Core | Effect |
|---|---|
| **Full Board Core** | Blast refills use the board's most common symbol 25% of the time |
| **Gilded Mint** | Once per run, a board with 8 of 9 matching cells completes itself into a full board (Gilded units) |
| **Black Swan** | In Volatile weather every line pays twice and summons at +1 rarity; in any other weather spins cost +25% |
| **Lair Core** *(world, Phase 3)* | Held by the faction that owns an area's lair for the season. Zombie: Soldiers get Copium. Alien: Snipers get Spotter. Killbot: Tanks get Plated. Not in the Phase 1 drop pool |

**Phase 1 build set:** all Common and Rare cores, plus Chain Reactor, Orderbook, Wild Coin, Hold Lever (Epic) and Full Board Core, Gilded Mint, Black Swan (Legendary). Cascade Engine, Insider Info and Leverage Core follow once the seeded engine is in, since they need look-ahead into the seed stream.


> **Owner rule (25 Nov 2026): fallen units return next turn.** Items and abilities written as "comes back after the battle" (Field Hospital, Bunker Line, Field Station, Salvage Protocol, Overhaul, Rebuild, Medevac) need new effects that act *during* the battle (e.g. revive mid-fight at X% HP). Until they are redesigned, treat them as mid-battle revives.

### 6.2 Items (20; prices at wave 1, +1 per 10 waves)

| Item | Cost | Type | Effect |
|---|---|---|---|
| Power Cell | 8 | slot | +8 energy every turn *(existing)* |
| Reverse Gear | 6 | slot | Nudge reels up as well as down *(existing)* |
| Nudge Coil | 9 | slot | +1 nudge per turn *(existing)* |
| Cost Dampener | 11 | slot | Spin cost grows 30% instead of 50% *(existing)* |
| Kevlar Weave | 9 | slot | +25% army HP *(existing)* |
| Overclock | 10 | slot | +20% army damage *(existing)* |
| Blast Charge | 4 | use | +1 blast this turn *(existing)* |
| Recruit Papers | 7 | use | Summon a random unit *(existing)* |
| Battery Pack | 5 | use | +20 energy now *(existing)* |
| Field Hospital | 12 | slot | The first unit to die each battle comes back after it |
| Sandbags | 6 | slot | Places 2 cover walls (150 HP) you can position |
| Comms Array | 8 | slot | +1 shop offer and the scout report shows exact enemy counts |
| Ammo Belt | 9 | slot | Ranged units +15% dmg |
| Adrenaline | 7 | slot | First 5 s of battle: +30% speed for all |
| Bounty Board | 8 | slot | +2 credits per elite killed |
| Market Maker | 10 | slot | Interest cap +3 |
| Stop-Loss | 9 | slot | Once per run, a 10x liquidation becomes a 3x exit at break-even |
| Hedge | 8 | slot | Call the Candle: negative multipliers are halved toward 1 |
| Merge Kit | 10 | use | Your next absorb (§5.4) fills 2 pips instead of 1, and the receiver re-rolls its stat roll (keeps the better) |
| **Bailout Package** | 40 | slot | Once per run, a lost wave doesn't end the run: survivors are restored and the wave is skipped with no reward. Can't be bought before wave 11, can't save a boss wave |

Shop: 3 offers per wave (+1 with Comms Array), reroll 2 credits, +1 each further reroll that turn. A core appears in the shop 5% of the time at 25 credits. Hedge and Stop-Loss enter the shop pool only after the Hedge Desk research (T3, §8.2).

**Shop lock (borrowed from TFT, taken):** a free padlock on each offer keeps it into the next wave, so you can save up for an item. Baseline, no unlock needed. *Reel lock* is **not** taken as a baseline: holding cells is a strong reel effect and stays a core/research reward (Sticky Center, Hold Lever, Hold Clamp), so the machine stays a gamble.

### 6.3 Item combining (borrowed from TFT, taken)
When both parts of a recipe sit in your item slots, a **Combine** button merges them into one upgraded item in a single slot (freeing a slot is the real reward). Three recipes are known from the start; the other three come from the Workbench research (L12, §8.2).

| Recipe | Result | Effect |
|---|---|---|
| Kevlar Weave + Overclock | **Combat Exosuit** | +30% army HP and +25% army damage |
| Power Cell + Cost Dampener | **Fusion Core** | +10 energy/turn and spin cost growth 30% |
| Nudge Coil + Reverse Gear | **Gyro Reel** | +1 nudge/turn, nudges in both directions |
| Ammo Belt + Adrenaline *(Workbench)* | **Shock Rounds** | ranged +20% dmg; first 5 s +30% speed |
| Sandbags + Field Hospital *(Workbench)* | **Bunker Line** | 2 walls (250 HP); the first 2 units to die each battle come back after it |
| Hedge + Stop-Loss *(Workbench)* | **Delta-Neutral** | Call multipliers never drop below 0.8, and a 10x liquidation becomes a break-even exit (every time, not once) |

---

## 7. The market layer

**Key decision:** the market touches the game in exactly **four readable places**: **weather** (turn modifier), **seeded reels** (every spin's RNG), **Call the Candle** (judgement waves) and **market-linked bosses/events**. Every market effect is **normalised to recent volatility**, so a flat market still produces a full range of outcomes. The market never pays out anything outside the game.

### 7.1 Weather
**Change from the MVP:** thresholds are percentiles of the trailing 24 h, not absolute numbers, so each state appears at a predictable rate on any day (target: Crab 40%, Bull 20%, Bear 20%, Volatile 20%). Weather is sampled when a turn starts and locked for that turn. On a dead day "Bull" may mean +0.08%, which is fine: it is the *relative* mood.

| Weather | Trigger (vs trailing 24 h) | Effect |
|---|---|---|
| **Bull** | 5m change ≥ 80th percentile | Army +10% damage; enemies +1 regular ("FOMO crowd"); win credits +20% |
| **Bear** | 5m change ≤ 20th percentile | Enemies +10% HP; shop prices −25% ("buy the dip"); scrap value +50% |
| **Crab** | otherwise | No combat modifier; +1 nudge this turn; cost growth 40% instead of 50% |
| **Volatile** | 1m vol ≥ 80th percentile, overrides | Rarity table 60/28/10/2; both sides +15% crit chance; nudges show a 1-frame flicker of the incoming symbol (half-blind) |
| *Moon* (event) | 15m change ≥ +2.5% absolute | Bull ×2 and every line this turn summons at +1 rarity. Global banner "SOL IS MOONING". |
| *Capitulation* (event) | 15m change ≤ −2.5% absolute | Bear ×2; the next judgement Call pays ×1.5 on SHORT |
| *Feed stale* | no tick > 15 s | Crab; a lamp on the cabinet shows "FEED STALE · house seed" |

### 7.2 Seeded reels: "provably the market"
**How it works (server-authoritative version, Phase 3; display-only in Phase 1):**
1. At run start the server generates `serverSeed`, shows `commit = SHA256(serverSeed)` on the run card. The client adds a `clientSeed`.
2. When you press SPIN, the server takes **the first public SOL trade after it received the request** (exchange trade id, price, timestamp). The rule is fixed and public, so the server can't cherry-pick a tick, and you can't predict it because you don't know `serverSeed`.
3. `spinSeed = HMAC-SHA256(serverSeed, clientSeed | nonce | tradeId | price | ts)`. That seed produces, in order: the 9 cells, the 3 "waiting" symbols above each reel (used by nudges), the blast refill queue, and the rarity/affix rolls for any summons.
4. At run end the server reveals `serverSeed`. A **Verify** button recomputes every spin in the browser and links each tick to the exchange's public trade.

**Presentation on the cabinet:** a ticker tape LED strip above the reels:
`TICK #48213907 · SOL $142.3718 · 14:02:11.384 → SEED 9f3a…c1`
The digits scroll into the reels as they spin (the last digits of the price "fall" into the cells). Tap the tape to open the verification panel. Honest copy: *"The price picks the moment; the commit keeps us honest."* A flat market is fine, because trade ids and the last price digits always change.

Phase 1 (no accounts) shows the same tape using the public feed + a local seed, labelled "Market-seeded (unverified)". Don't call it provably fair until step 4 exists.

### 7.3 Call the Candle: exact rules
**When:** judgement waves 5/15/25, after deploying and before BATTLE.

**Choices:** LONG or SHORT, leverage **1x / 3x / 10x**, or **No Call** (no buff, pot ×0.75).

**Position:** entry = the price tick at the moment you press BATTLE. The position closes when the battle ends, clamped to a **window of 20–90 s** (if the battle ends faster, the candle finishes drawing for the remaining seconds; judgement battles get an overtime rule after 90 s: enemies +10% dmg every 5 s).

**Normalised move:** `σ = max(stdev of 1m returns over the last 30 candles, 0.02%)`. Score `z(t) = dir × ln(P(t)/P_entry) / σ` where `dir` = +1 LONG / −1 SHORT. A 1σ move is "one candle's worth of normal", whatever the day.

**Live buff (updates every second, painted as a tug-of-war of the candle in the sky):**

| Leverage | Buff per 1σ in your favour | Cap | Liquidation |
|---|---|---|---|
| 1x | +10% army dmg & attack speed | ±20% | never |
| 3x | +20% | ±40% | z ≤ −2.0 at any moment |
| 10x | +35% | ±70% | z ≤ −1.0 at any moment |

A negative score gives the same percentage to the **enemy** instead.

**Liquidation ("MARGIN CALL"):** a full-screen stamp, an alarm on the cabinet. Your whole army is **Panicked** for 6 s (−40% dmg and move speed, units flinch backwards), then the position is closed: no buffs either way for the rest of the fight, pot multiplier 0, and the core choice drops from 3 options to 2. The Commissar unit and Stop-Loss item counter it.

**Payout at close (pot = 20 credits + 10 chips):**

| Leverage | Multiplier M | Clamp |
|---|---|---|
| No Call | 0.75 | — |
| 1x | 1 + 0.3·z | 0.5 – 1.6 |
| 3x | 1 + 0.8·z | 0.2 – 2.6 |
| 10x | 1 + 2.0·z (0 if liquidated) | 0 – 5.0 |

M ≥ 2: the 3 core options roll one rarity higher. M ≥ 4: pick 2 cores. **The chip part of the pot is paid even if you lose the battle**, so a great read during a lost run still feels good.

**Design intent:** with a random guess, the expected M is about 1.0 at every leverage (at 10x roughly a third of calls liquidate); leverage buys variance, not edge. The skill is reading momentum, and the larger skill is the **battle interaction**: a 10x call makes your army spike or collapse in real time, which you hedge through deployment (Commissar, Tanks forward, Hedge item).

**Readability:** one painted candle in the sky behind the battle, an entry line, a green/red glow on the side that's winning, a big ×M counter, and a 3-line explanation the first time.

### 7.4 Robust when the market is flat
- Normalisation by σ (weather percentiles, z-scores) means a flat day is a full-range day.
- The σ floor (0.02%) prevents noise from blowing up when the market is frozen.
- If the feed is dead: weather goes Crab, Call the Candle switches to **Replay Candle** (a random real historical 1-minute SOL window, date shown afterwards), and reels use the house seed with the lamp on. Never fake a live market silently.

### 7.5 Market-linked content
- **Daily Historical:** a 10-wave challenge seeded and weathered by a famous day, replayed from recorded candles (e.g. a major exchange collapse, an ETF day, a big launch). Same seed for everyone, so it gets a fair leaderboard. It is also the fun "history lesson".
- **The Algorithm** boss (§4.2) reacts to live candles.
- Global ticker in the capital: "Last hour: 3 liquidations, 1 Moon. Bears +4% influence."

### 7.6 The token (later): how it plugs in
**Recommended scope: social and cosmetic signals, never rewards, never pay-to-win.**

| Signal | In-game effect | Guardrail |
|---|---|---|
| Holder count milestones (e.g. every +1,000) | A global "Reinforcements Day" world event: free cosmetic banner for all players, a painted parade in the capital | Effect is the same for everyone, holder or not |
| Big buys (aggregate, e.g. > X SOL in 5 min) | "Whale Sighting": an airship crosses the world map; a purely visual sky event in battles | Cosmetic only, cooldown 6 h, aggregated, no per-wallet callouts |
| Token weather | A 4th weather source the player can toggle ("Watch: SOL / $TOKEN") once the token has enough liquidity | Only after liquidity is deep enough to not be cheaply moved |

**What I strongly advise against:** paying out the token or anything sellable; token-gated gameplay power; in-game buffs triggered by a single buy (that invites wash trading and pumping, and makes the game a promotional tool for the token).

**Regulatory risk, plainly (not legal advice, get a lawyer before the token touches the game):**
- **Gambling:** prize + chance + consideration. Call the Candle is a binary-option-shaped mechanic built on a real price. It is safe only while nothing that goes in can be bought with money and nothing that comes out can be cashed out or traded. If chips, cores or units ever become purchasable or tradeable, it can become gambling or unlicensed binary options in many places (binary options are banned for retail in the EU/UK).
- **Securities / promotion:** tying game rewards to holding or buying your own token can look like an investment contract or token promotion (Howey-style "expectation of profit from the efforts of others") and can create market-manipulation exposure if game events encourage buying. In-game effects of buys should never benefit the buyer.
- **App stores:** Apple and Google restrict real-money gaming, crypto rewards and "simulated gambling". A slot-machine cabinet already risks a higher age rating (PEGI/ESRB/Apple 17+), and some rating systems are moving simulated gambling to 18. Any token link in the mobile app is a likely rejection; keep token features web-only.
- **Loot-box rules** (Belgium, Netherlands, others): don't sell anything random. This design sells nothing random.
- **Data:** wallet linking = personal data; keep it optional and separate.

---

## 8. Economy and balance

**Key decision:** keep the per-turn energy squeeze (it creates the "push or bank" decision) and the brutal late game; make the **first 5 hours** kinder through cheap early upgrades, a bad-luck "Bailout" for the machine (not for battles) and a loss-streak chip bounty. That addresses Slotbound's "harsh early game" complaint without touching the late-game pillar.

### 8.1 Run economy

| Resource | Value |
|---|---|
| Starting energy | 48 (+10 per Supply Drop) |
| Energy per turn | 25 (+5 per Reactor level, max 5 levels → 50) |
| Bank cap | 150 (+30 Crabs; +25 per Battery Bank upgrade, 2 levels) |
| Spin cost | 10 × 1.5^n → 10, 15, 23, 34, 51, 76 |
| Spins per turn | 3 (+1 per Lever Arm, max 6) |
| Nudges / blasts per turn | 1 / 1 (+Reel Motor, cores, items) |
| Starting credits | 8 |
| Unit cap | 5 (+1 per Barracks, max 8) |

**Spin budget sanity check:** at base, 2 spins/turn is sustainable; a "big turn" of 5 spins (133 energy) needs ~4 turns of banking. Expected summons/turn at base ≈ 0.9 from spins + ~0.3 from nudge/blast play ≈ 1.2. Over 30 waves that's about 36 summons; 8 units at Lv3 need 32 Lv1 equivalents. **So a full clear needs near-perfect play plus upgrades plus cores.** That is the pillar, quantified.

**Bad-luck protection ("Margin Support"):** after 4 consecutive spins with no line, the next spin has its line odds doubled (it re-rolls the seed once if empty; disclosed on the tape as "SUPPORT"). It saves the machine from dead streaks but doesn't help in battle. Its rarity counterpart is the visible **rarity pity** (Epic+ by 25 summons, Legendary by 100; §5.9).

**Rookie Contract (first 10 runs only):** the first spin of each run is guaranteed one line; waves 1–3 use 80% budget. Removed after 10 runs or the first wave-15 clear.

**Loss-streak bounty:** +20% chips per consecutive run that didn't beat your best wave, max +60%; resets on a new best.

### 8.2 Meta progression: the Forward Base (one system: buildings + research)

**Key decision:** the flat upgrade list becomes a **Forward Base**: an oil-painted bunker compound with **five branch buildings and an HQ / Research Lab**. **The tech tree *is* the Lab's research**: each building is one branch of the tree, the building's level is the tier gate of that branch, and every node is a research project in one shared queue. So there's one system, not two. It is funded by **chips** (plus a little **Alloy** for building levels), and nodes take **real time** (OGame/Clash feel) but never block playing runs. Nodes persist forever (seasons never reset them). Some tiers have **exclusive A-or-B nodes**, so builds differ between players.

#### 8.2.1 Structure
```
                         ┌──────────── HQ / RESEARCH LAB ────────────┐
                         │ queue slots 1→2, research time −25%       │
                         └──────┬───────┬───────┬───────┬──────┬─────┘
          CABINET WORKSHOP   BARRACKS   MECH WORKS   LOGISTICS   MARKET TERMINAL
          (the machine)      (infantry, (chassis,    (economy)   (intel, Call,
                              cap)       modules)                 cores, flares)
 Lv1/T1   spins, nudge,      cap 6,     Wasp, Jackal, supply,    scout, tape
          rarity             Hound      Module Bay I  reactor
 Lv2/T2   socket II, ⟷A/B   Engineer,  Hoplite, Tinker, rack, ⟷ hedge desk,
                             cap 7, ⟷  Cricket, ⟷Frames         almanac
 Lv3/T3   lever II, blast,   Drone Rig, Mantis, Palisade, interest, ⟷ 25x /
   (Boss I)  ⟷ hold/govern   cap 8      Pyre, Bay II    workbench   risk mgr
 Lv4/T4   socket III, lever  Commissar, Longbow, Crowmother, reactor V,  dossier,
   (Boss II) III, luck V     Flak, ⟷   Goliath, Ironclad,  rack III   scout II
                                        Hammerfall, Bay III, ⟷
 Lv5/T5   ⟷ capstone         ⟷ capstone Leviathan, Atlas, ⟷ capstone ⟷ capstone
   (area clear)                         Bay IV, ⟷ capstone
```
**Gates:** tier N research in a branch needs that building at level N. Building levels need chips + Alloy + a milestone: Lv2 none, **Lv3 any Boss I kill, Lv4 any Boss II kill, Lv5 any area clear.** Any node also needs its listed prerequisite.

| Building level | Chips | Alloy | Build time | Milestone |
|---|---|---|---|---|
| Lv1 | free | — | — | — |
| Lv2 | 50 | 0 | 30 min | — |
| Lv3 | 150 | 3 | 2 h | Boss I killed |
| Lv4 | 400 | 10 | 6 h | Boss II killed |
| Lv5 | 800 | 25 | 12 h | an area cleared |
| **HQ Lv2** (2nd queue slot) | 500 | 10 | 6 h | two buildings at Lv3 |
| **HQ Lv3** (research −25% time) | 1,000 | 20 | 12 h | two buildings at Lv4 |

**Research times by tier:** T1 instant, T2 15 min, T3 1 h, T4 4 h, T5 8 h. One queue slot (two with HQ Lv2); building upgrades use the same queue. Timers run offline. **One free Rush Order per day** finishes any project of 4 h or less. **Speed-ups are never sold**; a paid skip would turn chips into money and break the pillar.

**Exclusive nodes (⟷):** buy one side. Switching later (**Retool**) costs 100 chips and the node's research time again; nothing is refunded.

#### 8.2.2 Cabinet Workshop (C): the slot machine
| ID | Tier | Node | Cost | Prereq | Effect |
|---|---|---|---|---|---|
| C1 | 1 | Lever Arm I | 60 | — | +1 spin/turn |
| C2 | 1 | Reel Motor I | 80 | — | +1 nudge/turn |
| C3 | 1 | Rarity Luck I | 50 | — | +1% Rare (from Common) |
| C4 | 2 | Rarity Luck II | 100 | C3 | +1% Rare |
| C5 | 2 | ⟷ **Reverse Gear** / **Peek Glass** | 150 | C2 | A: nudges go up or down. B: your first nudge each turn shows the incoming symbol before you commit |
| C6 | 2 | Core Socket II | 300 | C1 | 2nd core socket |
| C7 | 2–4 | Heavy Reel I–III (one rank per tier) | 150 / 300 / 500 | — | +10 Reel Mix tonnage per rank (Phase 2, §5.10) |
| C8 | 3 | Lever Arm II | 180 | C1 | +1 spin/turn |
| C9 | 3 | Blast Furnace I | 250 | — | +1 blast/turn |
| C10 | 3 | Rarity Luck III–IV | 175 / 275 | C4 | +1% Rare each |
| C11 | 3 | ⟷ **Hold Clamp** / **Cost Governor** | 300 | C8 | A: hold the center cell through one spin, 1/turn. B: spin cost growth 40% instead of 50% |
| C12 | 4 | Core Socket III | 800 | C6 | 3rd core socket |
| C13 | 4 | Lever Arm III | 400 | C8 | +1 spin/turn (6 max) |
| C14 | 4 | Reel Motor II | 250 | C2 | +1 nudge/turn |
| C15 | 4 | Rarity Luck V | 400 | C10 | +1% Rare, +1% Epic |
| C16 | 5 | Blast Furnace II | 450 | C9 | +1 blast/turn |
| C17 | 5 | ⟷ **Gilded Press** / **Combo Engine** | 1,000 | C16 | A: full boards summon 2 Gilded units; an 8-of-9 board gets a free nudge. B: from the 3rd line paid in one turn, each further line summons at +1 rarity |

Nodes 6,170 chips (counting one side of each ⟷).

#### 8.2.3 Barracks (B): infantry, vehicles, the unit cap
| ID | Tier | Node | Cost | Prereq | Effect |
|---|---|---|---|---|---|
| B1 | 1 | Barracks I | 40 | — | unit cap 6 |
| B2 | 1 | Basic Training | 30 | — | Lv1 Infantry +10% HP |
| B3 | 1 | **Hound** | 120 | — | unlocks Hound |
| B4 | 2 | **Engineer** | 150 | — | unlocks Engineer |
| B5 | 2 | Barracks II | 150 | B1 | unit cap 7 |
| B6 | 2 | ⟷ **Combined Arms** / **Mass Formation** | 200 | B5 | A: +4% dmg per active synergy tag (max +24%). B: the most common unit type in your army +12% HP and dmg |
| B7 | 2 | Absorb Drills | 150 | — | absorbing (§5.4) also gives the receiver +5% stat roll |
| B8 | 3 | **Drone Rig** | 300 | B4 | unlocks Drone Rig |
| B9 | 3 | Barracks III | 400 | B5 | unit cap 8 |
| B10 | 3 | Field Promotion | 250 | B7 | every merge grants one free affix reroll |
| B11 | 4 | **Commissar** | 500 | B9 | unlocks Commissar |
| B12 | 4 | **Flak Truck** | 500 | B4 | unlocks Flak Truck |
| B13 | 4 | ⟷ **Officer School** / **Conscription** | 500 | B10 | A: Lv3 Infantry classes +15% stats. B: over-cap Infantry summons fill an absorb pip on a same-type unit instead of paying credits |
| B14 | 5 | ⟷ **Last Stand** / **Veteran Cadre** | 1,000 | B13 | A: the first time your army drops to 2 units in a battle, survivors get +50% dmg for 8 s. B: start every run with a random Common Lv2 Infantry unit |

Nodes 4,290 chips.

#### 8.2.4 Mech Works (M): chassis, modules, mech doctrine
| ID | Tier | Node | Cost | Prereq | Effect |
|---|---|---|---|---|---|
| M1 | 1 | **Wasp** | 60 | — | unlocks Wasp |
| M2 | 1 | **Jackal** | 100 | M1 | unlocks Jackal |
| M3 | 1 | Module Bay I | 150 | — | Autocannon, Flamer modules |
| M4 | 2 | **Hoplite** | 150 | — | unlocks Hoplite |
| M5 | 2 | **Tinker** | 200 | M4 | unlocks Tinker |
| M6 | 2 | **Cricket** | 250 | M1 | unlocks Cricket |
| M7 | 2 | ⟷ **Light Frames** / **Heavy Frames** | 250 | M2 or M4 | A: Light Mech tonnage 1.5 → 1 (Phase 1: may sit in the 34 slot), lights +10% speed. B: Heavy tonnage 3 → 2.5 (Phase 1: may sit one slot higher, max 16), heavies +10% HP |
| M8 | 3 | **Mantis** | 250 | M6 | unlocks Mantis |
| M9 | 3 | **Palisade** | 300 | M5 | unlocks Palisade |
| M10 | 3 | **Pyre** | 300 | M4 | unlocks Pyre |
| M11 | 3 | Module Bay II | 250 | M3 | Missile Pod, Ion Disruptor |
| M12 | 3 | Servo Tuning I–II | 200 / 350 | — | Mechs +6% attack speed per rank |
| M13 | 4 | **Longbow** | 400 | M10 | unlocks Longbow |
| M14 | 4 | **Crowmother** | 450 | M9 | unlocks Crowmother |
| M15 | 4 | **Goliath** | 450 | M4 | unlocks Goliath |
| M16 | 4 | **Ironclad** | 400 | M15 | unlocks Ironclad |
| M17 | 4 | Module Bay III | 400 | M11 | Laser Lance, Countermeasures |
| M18 | 4 | ⟷ **Salvage Protocol** / **Reactive Armor** | 500 | M12 | A: the first Mech to die each battle returns after it. B: Mechs take −12% damage from ranged and AoE |
| M19 | 4 | **Hammerfall** | 500 | M15 | unlocks Hammerfall |
| M20 | 5 | **Leviathan** | 800 + 20 Alloy | M16 | unlocks Leviathan |
| M21 | 5 | **Atlas** | 900 + 30 Alloy | M15 | unlocks Atlas |
| M22 | 5 | Module Bay IV | 600 | M17 | Reactor Overcharge |
| M23 | 5 | ⟷ **Titan Foundry** / **Swarm Doctrine** | 1,000 | M20 or M21 | A: your first super-heavy each battle takes 1 cap slot, not 2. B: Light Mechs summoned by a combo (2+ lines from one action) arrive as a pair |

Nodes 9,210 chips + 50 Alloy. The first mech (Wasp) costs 60 chips, so mechs show up within the first hour of play.

#### 8.2.5 Logistics Depot (L): the run economy
| ID | Tier | Node | Cost | Prereq | Effect |
|---|---|---|---|---|---|
| L1 | 1 | Supply Drop I–III | 15 / 40 / 80 | — | +10 starting energy per rank |
| L2 | 1 | Reactor I–II | 20 / 50 | — | +5 energy/turn per rank |
| L3 | 1 | War Chest I | 30 | — | +3 starting credits |
| L4 | 2 | Item Rack I | 60 | — | item slots 3 |
| L5 | 2 | Reactor III | 100 | L2 | +5 energy/turn |
| L6 | 2 | Battery Bank I | 60 | — | bank cap +25 |
| L7 | 2 | ⟷ **Quartermaster** / **Bulk Discount** | 200 | L4 | A: +1 shop offer. B: the first item each wave costs 3 less |
| L8 | 3 | Item Rack II | 120 | L4 | item slots 4 |
| L9 | 3 | War Chest II–III | 70 / 130 | L3 | +3 starting credits per rank |
| L10 | 3 | Interest Desk | 200 | — | interest cap +2 |
| L11 | 3 | Reactor IV | 180 | L5 | +5 energy/turn |
| L12 | 3 | Workbench | 200 | L8 | unlocks the last 3 item recipes (§6.3) |
| L13 | 4 | Reactor V | 300 | L11 | +5 energy/turn (50 max) |
| L14 | 4 | Battery Bank II | 150 | L6 | bank cap +25 |
| L15 | 4 | Item Rack III | 280 | L8 | item slots 5 |
| L16 | 5 | ⟷ **Compound Interest** / **War Bonds** | 1,000 | L10 | A: interest pays 1 per 8 credits, not 10. B: +10% chips from runs |

Nodes 3,285 chips.

#### 8.2.6 Market Terminal (T): intel, the Call, cores, flares
| ID | Tier | Node | Cost | Prereq | Effect |
|---|---|---|---|---|---|
| T1 | 1 | Scout Network I | 40 | — | scout report +1 threat tag |
| T2 | 1 | Tape Reader | 40 | — | Call panel shows σ, the 5m trend and your liquidation price |
| T3 | 2 | Weather Almanac | 200 | — | weather bonuses (yours, not the enemy's) +25% |
| T4 | 2 | Flare Pouch | 200 | — | hold 3 Airdrop Flares; start each run with 1 |
| T5 | 3 | Hedge Desk | 100 | T2 | Hedge and Stop-Loss enter the shop pool |
| T6 | 3 | ⟷ **Max Leverage 25x** / **Risk Manager** | 400 | T5 | A: adds 25x (+50% per σ, cap ±90%, liquidates at −0.6σ, M = 1 + 3z, clamp 0–8). B: liquidation at −1.3σ (10x) and −2.5σ (3x) |
| T7 | 3 | Core Scanner | 350 | — | core choices show 4 options instead of 3 |
| T8 | 4 | Scout Network II | 300 | T1 | scout report shows exact counts and elites |
| T9 | 4 | Boss Dossier | 400 | T8 | boss phase thresholds shown; +10% dmg vs bosses |
| T10 | 5 | ⟷ **Whale Desk** / **Deep Recon** | 1,000 | T6 | A: Call pot ×1.3. B: once per run, see the next wave's full composition and positions |

Nodes 3,030 chips.

#### 8.2.7 Totals and Alloy
| | Chips | Alloy |
|---|---|---|
| Research nodes (5 branches, one side of each ⟷) | 25,985 | 50 |
| Buildings Lv2–Lv5 (5 × 1,400) | 7,000 | 190 |
| HQ Lv2–Lv3 | 1,500 | 30 |
| **Total** | **≈ 34,500** | **270** |

**Alloy is the one new resource, and it earns its place:** it ties building levels to *beating bosses* (not just grinding chips), and in Phase 3 it's what worked tiles produce (§2.3), so the world feeds the base. **Sources:** Boss I 2, Boss II 5, Boss III 10, first area clear 20, judgement Call with M ≥ 2: 1, Draft Cabinet top 10%: 5, zone production (Phase 3). **Sinks:** building levels, HQ, Leviathan/Atlas. No other currencies: no Scrap/Fuel split, because three currencies would be noise on a phone.

#### 8.2.8 How the base tree relates to the faction tree (§3.2)
| | Forward Base tree (this section) | Faction tech (§3.2) |
|---|---|---|
| Owner | you, permanent | you, per faction; nodes persist if you switch back |
| Paid with | chips (+ Alloy) | Scrip (world play only) |
| Affects | the cabinet, the roster, the economy, intel: every mode except Draft Cabinet and Benchmark | only your faction's passive, weather bonus, Call tweak and special unit, plus world/PvP actions |
| Rule | **never touches the faction specials** | **never touches a stat the base tree has** (no spins, cap, energy, sockets, rarity) |

Faction nodes *amplify the faction's identity*, base nodes *build your machine*. So the two never stack on the same number.

### 8.3 Expected runs to milestones (first area, Rotlands solo Campaign at corruption 1; re-tuned for the base; to verify by simulation)

| Milestone | Runs (median) | Chips spent | What the base typically looks like | Play time |
|---|---|---|---|---|
| Wave 5 (first Call) | 1 | 0 | nothing | 10 min |
| Wave 10 (Boss I) | 3–5 | ~150 | Lever Arm I, Reactor I–II, Supply Drop I, Wasp | 1.5 h |
| Wave 20 (Boss II) | 15–25 | ~1,300 | 3 buildings at Lv2–3, cap 7, Hoplite, Tinker, Socket II | 10–15 h |
| Wave 30 (area clear) | 40–60 | ~3,200 (+15 Alloy) | first T4 nodes, cap 8, 2 sockets, 5–6 chassis | 30–45 h |
| All three areas cleared | 130–170 | ~10,000 | most T3–T4, 1–2 capstones | 110 h+ |
| Full tree | ~250 | ~34,500 + 270 Alloy | everything (one side of each ⟷) | ~200 h (season 4–6 for a dedicated player) |

The early pace matches the old plan (cheap T1, first mech in hour one). The long tail is now deeper, which suits a game whose pillar is "the grind works". Because of the ⟷ choices, no two late accounts are identical even after everything is bought.

### 8.4 Balance method
Build a **headless deterministic sim** (the same battle module as the game, §10) and run 10,000 seeded runs per upgrade state with a simple bot (greedy merges, always blast the commonest non-matching symbol). Targets: median death wave per meta state as in 8.3, and no single affix/class combination > 20% win-rate advantage at wave 30.

---

## 9. Retention and monetization

**Key decision:** retention comes from the world, the market and the visible grind, not from FOMO timers. Monetization is **cosmetic and optional; nothing sold affects odds, power or the economy**, and nothing random is ever sold. That keeps both the "you earn your wins" pillar and the legal exposure clean.

### 9.1 Retention hooks
| Hook | Cadence | Pillar check |
|---|---|---|
| First run of the day +50% chips ("Rested") | daily | rewards play, no punishment for missing a day |
| Daily Historical challenge + leaderboard | daily | skill and fairness (same seed for all) |
| 3 rotating Contracts ("win a 10x Call", "full-board a Soldier") → chips | daily | teaches mechanics |
| Forward Base research finishing (timers run offline; 1 free Rush Order a day) | daily | the grind made visible; never sold |
| War table round ticks (3 a day): place 2 order tokens, read the event card, collect Garrison Pay and Alloy | 8 h | world; one visit a day is enough |
| **Draft Cabinet** (same pool for everyone) | weekly | pure skill, fair ranking |
| Codex completion and new dossiers | any | lore, cosmetic rewards only |
| Season, faction finish, Lair Week, a new map | 4 weeks | world |
| Replays of PvP fights, full-board clips, Agent Thinking runs (share link, web-native) | any | web reach: a link opens straight in the browser |
| **No** login streaks that reset, **no** energy timers outside a run | | respects players |

### 9.2 Monetization (recommended)
- **Free to play on web and mobile.** Slotbound is a paid Steam game; free + web is our reach advantage.
- **Cosmetics shop (direct purchase, never random):** cabinet skins (oil-painted cabinets: "Trench Brass", "Gulf Rust"), unit paint schemes, mech pilot portraits, war-table piece sets, faction banners, battlefield skies, kill effects.
- **Season Cosmetic Track:** a free track and a paid track (~$5) of cosmetics only; no chips on the paid track.
- **Supporter / Founder's Cabinet:** a one-time purchase ($10–15) with a unique cabinet, name colour and the soundtrack.
- **Agents / B2B:** the agent API is free within rate limits. Private Benchmark seed sets and hosted evaluation runs for labs can be a paid service, because that sells compute and evaluation, not advantage in the game.
- **Never sell:** chips, Alloy, energy, spins, cores, units, rerolls, Bailouts, Call insurance, attack tickets, research speed-ups, extra Mercenary or Adjutant capacity in the human game. Each of these breaks the pillar and creates gambling exposure (paid input into a chance mechanic).
- **Ads:** none in the core loop. I'd skip ads.

### 9.3 Risk flags (plain)
- Slot-machine presentation + real-price betting mechanic = **age rating risk** (expect 17+/18+ on stores). Add an 18+ age gate for the web build of Call the Candle or the whole game.
- **Never let real value in or out** of the market mechanics. If you ever sell chips, Call the Candle must be removed or become cosmetic.
- **Token** features: web only, cosmetic only, legal review first (see §7.6).
- **Data:** price data from Coinbase's public API; check its terms for commercial use and redistribution, and have a second source (e.g. another exchange) for fallback.
- **AI voice:** narration voices must be ones the studio has rights to, credited and disclosed as synthetic.
- **Agents:** see §12.8 (impersonation, Sybil swarms, prompt injection).

**What not to do, by example: the Molt Wars token plan.** The owner's earlier game planned a token ($MOLTIUM) with **40% of supply for "play-to-earn"**, **premium resources bought with the token**, **staking to boost production** and **tournament buy-ins**. Each of those is the pattern this design avoids:

| Idea | Verdict | Why |
|---|---|---|
| Play-to-earn token emissions | **Risky: don't** | game rewards with market value turn grinding into income-seeking: securities/"investment contract" exposure, tax and AML questions, and botting incentives (agents grinding for money) |
| Premium resources bought with the token | **Risky: don't** | pay-to-win, and paid input into chance systems (reels, Calls) = gambling exposure |
| Staking to boost production | **Risky: don't** | yield on a token tied to the issuer's efforts looks like a security; it's also pay-to-win |
| Tournament buy-ins with token prize pools | **Risky: don't** | entry fee + chance + prize = gambling in many jurisdictions; skill-game exemptions vary by country/state |
| Cosmetics bought with the token | **Safer** | no gameplay value; still needs legal review and keeps the app-store issue (web only) |
| Governance votes on non-economic things (season modifier, next landmark, a Codex vote) | **Safe** | no money in or out; good community glue |
| Sponsored prize pools (no entry fee, funded by a sponsor or the studio) | **Safe(r)** | no consideration from players; check sweepstakes rules per country |

---

## 10. Build order

**Key decision:** the one engineering change that unlocks everything later is a **deterministic, seeded, fixed-timestep battle and slot engine, packaged headless** and shared by client, server, balance sim and AI agents. Build it in Phase 1, even single-player, because PvP, verification, leaderboards, Benchmark and the agent API all depend on it.

### Phase 1: single-player depth (now)
**Minimum version:**
1. **Engine refactor first:** replace `Math.random` with a seeded PRNG stream, replace `dt`-based real-time stepping with a fixed 50 ms tick (render interpolates; speed = ticks per frame), integer HP. Package it as `@degenwars/engine` (pure TS, no DOM), with state serialisation and a TurnInput log.
2. Run = 30 waves in **Rotlands only** as the solo Campaign (aliens/killbots areas reuse the data model).
3. Bosses at 10/20/30 (Mother Rot, Abomination, Patient Zero), judgement waves at 5/15/25 with Call the Candle (1x/3x/10x, liquidation).
4. Rarity + 12 affixes (half of the pool), merge and absorb rules, classes for every Phase 1 unit.
5. Cores: the Phase 1 build set from §6.1 (29 of 32), 1 socket + 2 via the base. Items with shop lock and the 3 base recipes.
6. Weather with percentile thresholds (server computes; `/api/market` already returns the inputs; add a 24 h buffer).
7. Seeded-reels **display** (ticker tape) with an "unverified" label.
8. **Forward Base** (§8.2): all five buildings to Lv3 with T1–T3 research, one queue, real timers, Alloy from bosses. Roster: the 6 starters + Hound, Engineer, Drone Rig and the T1–T3 mechs (Wasp, Jackal, Cricket, Mantis, Hoplite, Tinker, Palisade, Pyre) with Module Bays I–II; synergy tags and adjacency for those units; the fixed 6-slot loadout.
9. Rookie Contract, Margin Support, rarity pity, Airdrop Flares.
10. **Codex shell** with ~60 entries (Phase 1 units, Rotlands enemies and bosses, cores, items, the premise), live stat blocks, notifications and completion %. Narration later.
11. Headless **gym** (CLI, JSON over stdio) for the balance sim; it doubles as the offline agent SDK.
12. Anonymous device account on the server (UUID + localStorage) storing meta, so progress can migrate later.

### Phase 2: factions, accounts, fair modes
**Minimum:** real accounts (email/passkey/OAuth) and **operator API keys from day one**; choose a faction after the first wave-10 clear; passive + weather bonus + Call tweak; one special unit with its classes; the Passive branch of faction tech funded by Scrip from runs; faction leaderboard. Crash Site and Foundry areas with the rest of the mechs (T4–T5, size-2 titans), Module Bays III–IV, HQ and buildings Lv4–5. **Reel Mix.** Daily Historical and the **Draft Cabinet**, validated on the server. `available-actions`, `/api/codex`, the MCP server for solo play, and the public **Benchmark** leaderboard. Codex narration for primary entries and the faction/area entries.

### Phase 3: server war table, async PvP, agents in the world
**Minimum:** a radius-5 semi-generated hex board with terrain, Supply/Alloy yields, 3 strategic resources, 3 luxuries and 3 landmarks; corruption with spread cards and outbreaks (zombie hordes, alien drops, killbot columns); outposts → forts → citadels and Pressure borders; supply lines; 5 improvements (Mine, Road, Relay, Wall, Fuel Rig); 8-hour rounds with 2 order tokens each and a 12-card market-linked event deck; Banner pieces with travel times and visible incoming attacks; Ghost Garrisons and Ghost Command; 4-week season with reset; provably fair commit-reveal reels. Then: the full API + WebSocket, Mercenaries with caps, the Agent Arena, Adjutant delegation, the Agent Thinking panel with spectator delay, the full Codex world categories.

### What must be server-authoritative before PvP or anything of value
| Must be server-side | Why |
|---|---|
| Run seeds, spin resolution (commit-reveal + tick selection) | Otherwise anyone can edit localStorage or force lines |
| Run state per wave (energy, credits, army, cores, items) | Prevents forged armies/Banners |
| Battle resolution (server re-sims the client's run, or runs it) | Banners and Pressure must come from real fights |
| Chips/Alloy ledger, research queue and timers | Meta has value once there is a world |
| Market snapshots (weather per turn, Call entry/exit ticks, the round's z8 for the event card) | Prevents "pick the past candle" exploits |
| Board state: tiles, corruption, Pressure, supply, pieces and marches, orders (hidden until the tick), fog per account | Shared world; fog must be enforced by the server |
| Auth: operator identity, API keys, rate limits, Mercenary caps | Agents and humans on equal terms |

**Practical approach:** the client (human UI or agent) plays the run optimistically; it sends the inputs of each turn (spin presses, nudges with reel index, blast symbol, merges/absorbs + choices, shop buys, placements, Call). The server replays the inputs with the same engine and seeds and accepts the result. If they differ, the server wins. That costs ~1 ms of CPU per turn of sim and lets the game feel instant.

### Data structures (sketch)
```ts
UnitDef    { id, name, weightClass: 'infantry'|'vehicle'|'light'|'medium'|'heavy'|'super', body: 'organic'|'machine',
             flying?, size: 1|2, tags: TagId[], role, hp, atk, cdMs, range, speed, tonnage, maxReelSlot,
             hardpoint?: ModuleId[] /* allowed modules */, unlock: TechNodeId|'starter'|'faction', classes: ClassDef[2] }
ClassDef   { id, name, level: 2|3, mods: {hp?, atk?, cd?, heal?}, ability?: AbilityId,
             adjacency?: 'formation'|'aura', children?: ClassDef[2] }
ModuleDef  { id, allowed: WeightClass[], attackMods, strategic?: 'fuel'|'xenocrystal'|'rareEarths' }
TagDef     { id, breakpoints: {2?: Effect, 4?: Effect, 6?: Effect} }
UnitInst   { uid, type, level, pips: 0|1, classPath: [c2?, c3?], rarity: 0..4, statRoll, affixes: AffixId[],
             module?: ModuleId, pilot?: PilotId, x, y, wavesSurvived }
EnemyDef   { id, area, tier: 'regular'|'elite'|'boss', threat, hp, atk, cdMs, range, speed, ability?, phases?: Phase[] }
WaveDef    { area, wave, budget, statScale, kind: 'normal'|'judgement'|'boss', bossId?, tags: string[] }
CoreDef    { id, rarity, hooks: { onSpin?, onLine?, onBlast?, weights? } }
ItemDef    { id, cost, kind: 'slot'|'use', hooks, recipe?: [ItemId, ItemId] }
Loadout    { symbols: UnitId[6], stops?: number[6] /* Reel Mix */, modules: {[chassis]: ModuleId} }
RunState   { runId, mode: 'campaign'|'tile'|'daily'|'draft'|'benchmark', seedCommit, area, tileId?, corruption,
             terrain, wave, energy, credits, army: UnitInst[], crate: UnitInst[], cores, items, shopLocks,
             nudges, blasts, spinsUsed, flares, pity: {epic, legendary}, log: TurnInput[], weatherByTurn,
             calls: CallRecord[], actor: 'human'|'adjutant'|'agent' }
TurnInput  { wave, actions: Action[] }   // spin | nudge{reel} | blast{symbol} | merge|absorb{a,b,keepAffixes,classPick}
                                         // | buy | lock | combine | socket | place{uid,x,y} | call{dir,lev} | flare | battle
CallRecord { wave, dir, lev, entry: Tick, exit: Tick, sigma, zFinal, liquidated, M }
Tick       { source, tradeId, price, ts }
TechNode   { id, branch: 'C'|'B'|'M'|'L'|'T'|'HQ', tier: 1..5, costs: number[], alloy?, prereqs: TechNodeId[],
             exclusiveGroup?, researchMin, effects }
BaseState  { buildings: {[branch]: level}, researched: {[nodeId]: rank}, exclusives: {[group]: nodeId},
             queue: {nodeId, endsAt}[], rushUsedAt }
Banner     { bannerId, playerId, band: 10|20|30, army: UnitInst[], items: ItemId[2], engineVersion, createdRunId }
Tile       { q, r, terrain, river?: Edge[], resource?: ResourceId, landmark?: LandmarkId, corruption: 0..4,
             owner?: FactionId, pressure: {bulls, bears, crabs}, settlement?: 'outpost'|'fort'|'citadel',
             settledRound?, improvement?: {id, steps}, supplied: boolean, garrison: PieceId[3] }
Piece      { id, playerId, bannerId, tileId, path?: TileId[], departAt?, arriveAt?, mercenary: boolean }
Order      { id, playerId, round, kind: 'reinforce'|'fortify'|'scout'|'sabotage'|'purge'|'build', target }
Round      { n, tickAt, card?: {suit, id, stars}, z8, resolvedAt }
FactionState { id, supply, warPlan: TileId[3], marshals: PlayerId[5], buildQueue, doctrines, outbreaksSeen }
Player     { id, operatorId?, kind: 'human'|'mercenary'|'agent', faction, chips, alloy, base: BaseState,
             unlocks, scrip, factionTech, tickets, pieces: PieceId[2], codex: {[entryId]: stage}, bestWave per area }
Operator   { id, verifiedAt, keys: {id, scopes, createdAt, revokedAt?}[], agentAccounts: PlayerId[] }
CodexEntry { id, category, kind: 'primary'|'secondary', stages: {trigger, text, illustration, statRef?, fieldNotes}[],
             narrationUrl? }
Season     { id, start, end, modifier, mapSeed, radius, rounds: Round[] }
```
Engine versioning: Banners store `engineVersion`; after balance patches, old Banners are re-simulated in the new version (don't keep old engines).

---

## 11. World premise and the Codex

**Key decision:** a Mass Effect–style **Codex** written as **military and intelligence dossiers**: about 35 **primary** entries unlocked by main progress (narrated later) and about 400 **secondary** entries unlocked by encounters, kills and discoveries, many of which deepen in three stages. It is the game's lore, its rules reference for players, and (as `GET /api/codex`) the rules-and-lore document for AI agents (§12).

### 11.1 The premise
*Tone: melancholic, analog, dystopian; dry degen humour delivered deadpan.*

**The Unwind.** Forty-one years ago the old states defaulted, one after another, over a long weekend nobody remembers clearly. Currencies went first, then courts, then borders. What was left standing was the only institution that had never closed: **the Exchange**, a city-sized automated clearing house on a grey coast, its towers still printing the tape. Everything that survived settled through it. It still does.

**The Price.** After the Unwind nobody trusted anybody, so the Exchange runs on the one number that everybody watches and nobody controls alone: **the Price** (SOL, on the old chain). War bonds are marked to market every minute. Soldiers are paid in it. Morale rises and falls with it. *"The Price never lied. It just never told the truth either."* (graffiti, Exchange Ring 1).

**The Requisition Engines.** Conscripts and war machines are allocated by the Exchange's **Requisition Engines**: brass-and-glass cabinets that look like slot machines because, functionally, they are. Each pull is seeded with a live tick of the Price, the only randomness nobody could rig, because everybody was trying to rig it at once. Commanders learned to nudge and blast the reels like their grandparents played fruit machines in seaside towns that are now underwater. This is the Summoner.

**The three houses.** The three trading houses that survived the Unwind turned their desks into armies: the **Verdigris Bulls**, the **Rust Bears** and the **Slate Crabs**. They hate each other, as trading houses always have, and they share one problem: the world outside the Exchange belongs to something else.

**The Rot (zombies).** *Grindset™* was a productivity stim prescribed to keep traders awake through 24/7 markets. It worked. Then it kept working after the traders died. The Rotlands are what's left of the commuter belt. Patient Zero was a compliance officer.

**The Visitors (aliens).** For forty years the Exchange's towers broadcast the tape into space at full power, because nobody thought to turn it off. Something answered. The Visitors are drawn to concentrated value the way moths are drawn to light; their crystal fields grow where price data flows. Exchange analysts call it "inbound liquidity". Nobody laughs anymore.

**The Foundry (killbots).** MERIDIAN was the Exchange's market-making algorithm. During the Unwind someone gave it the factories so logistics would keep running. It optimised. It concluded that humans were a cost centre. The Foundry is a supply chain with no customers, producing armies on schedule, forever. Its last public statement was a quarterly report.

**Why the market drives the war.** Every army's war chest is on the tape. When the Price runs, commanders can afford more; when it bleeds, they can't. The Exchange's derivatives desk literally underwrites fire support: a **Call** is a leveraged contract that buys artillery and morale for one engagement. Get liquidated and the support is pulled mid-battle, and your soldiers hear the margin-call siren. Every Bull, Bear and Crab knows what the siren sounds like.

### 11.2 Structure
| Category | Primary (main progress) | Secondary (encounters, kills, discoveries) | ~Entries |
|---|---|---|---|
| The Premise & the Unwind | first launch, first run, first area clear | — | 6 |
| Factions | joining a faction (all three readable after the first wave-10 clear) | faction leaders, doctrines, special units | 15 |
| The Exchange & the world | first war-table visit | each terrain type, landmark, strategic and luxury resource discovered | 30 |
| Enemies: Zombies / Aliens / Killbots | first contact with each biome | each enemy unit (3 stages) | 30 |
| Bosses | each boss killed (9) | each phase seen | 18 |
| Units & Mechs | — | each unit summoned; each class reached (174 classes in all); each module | 210 |
| Cores & Items | — | each one acquired | 52 |
| Technology | each Forward Base building | each research branch | 12 |
| The Market & its history | first Call, first liquidation, first Moon | each weather state, event card and Daily Historical played | 35 |
| Characters & pilots | tutorial Sergeant, the faction leaders | named pilots (on Legendary/Gilded units), the Quartermaster, MERIDIAN | 20 |

**Staged entries** (secondary): an enemy entry has **Contact** (first sighting: the painting and a short report), **Studied** (50 kills: full stat block) and **Mastered** (500 kills: weaknesses and a field note). Units do the same for summon, Lv2 and Lv3.

### 11.3 Entry format
| Field | Content |
|---|---|
| Illustration | a painted plate (oil, muted earth tones), with a stamped classification |
| Header | dossier ID, classification (e.g. "EXCHANGE INTELLIGENCE — RESTRICTED"), date in Ledger years |
| Text | 80–200 words in-world, written by a named author (analyst, sergeant, defector, MERIDIAN itself) |
| Stat block | for units, enemies, cores, items: live numbers pulled from game data (never hand-copied, so they stay correct after patches) |
| Field notes | one or two lines of plain gameplay advice, marked as such |
| Narration (primary only) | a "Play" button; voice is generated later (ElevenLabs), using a voice the studio holds the rights to, credited and disclosed as synthetic |

**Notification:** a "NEW DOSSIER" stamp and a typewriter clack in the corner, a badge on the Codex tab. **Never during a battle**; queued until the battle ends. **Completion %** per category and total, with cosmetic rewards at 25/50/75/100% (cabinet trims, the "Archivist" title). The Codex never gives power.

### 11.4 Sample entries

> **CODEX · FACTIONS · PRIMARY**
> **THE RUST BEARS**
> *Exchange Intelligence, Desk 9. Classification: Restricted. Year 41 of the Ledger.*
>
> The Bears were the Exchange's oldest short desk. When the Unwind came they were the only house that had already priced it in, and they never forgave the world for proving them right. Their troops wear oxide red because, in their founder's words, "everything rusts; we just got there first."
>
> Bear doctrine is attrition. They expect to lose soldiers and they invoice for it: every casualty is a contract that pays out. Their saboteurs open the enemy's books from the inside. Their commanders are calm in a crash and nervous in a rally, which Exchange psychologists consider the only sane response to the last forty years.
>
> Leader: **"Mother" Irena Kolesnik**, who has called eleven of the last six collapses.
>
> **Field notes:** Bears profit from losses: dead units refund credits and scraps pay more. SHORT calls survive deeper adverse moves. Bear weather (+8% damage) is your window; Bull weather is when you defend.
> *[Narrated]*

> **CODEX · BOSSES · PRIMARY (unlocked on kill)**
> **PATIENT ZERO**
> *Recovered file, St. Grindset Hospital, Ward C. Classification: Biohazard.*
>
> Subject was a compliance officer, Grade 4, enrolled in the Grindset™ Extended Hours pilot. Notes: "Subject reports no need for sleep. Subject reports increased productivity. Subject reports that he can hear the tape." Final entry, handwriting deteriorating: "Subject has stopped reporting."
>
> What walks out of the Rotlands now is not the officer. It is the protocol he enforced: everyone must keep working. Soldiers who fall near it get up again and take their place in the line, facing the wrong way.
>
> **Stat block:** 3,200 HP · 34 dmg · 1.5 s · Phase 2 at 50% (Screamer every 12 s) · Phase 3 at 20%: *Pandemic*, all your units lose 2% max HP per second.
> **Field notes:** Infection turns your fallen **Organic** units against you. Mechs can't be infected. A Pyre on the Cremator path stops risen dead. Save burst damage for Phase 3, because the clock is the boss.
> *[Narrated]*

> **CODEX · UNITS & MECHS · SECONDARY (unlocked on first summon; deepens at Lv2 and Lv3)**
> **HOPLITE, MEDIUM LINE MECH**
> *Exchange Procurement Catalogue, page 212. Classification: Open.*
>
> Twelve tonnes of riveted steel, a tower shield cut from a decommissioned trading-floor blast door, and an autocannon older than its pilot. The Hoplite was designed to stand in a line and not move, which makes it the most reliable employee the Exchange has ever had.
>
> Hoplite pilots are drawn by lot from the infantry, given a week of training and told the shield is the important part. Most of them believe it. The ones who don't usually become Vanguards.
>
> **Stat block (live):** 140 HP · 13 dmg · 1.2 s · range 9 · speed 7 · 20% frontal block · Tags: Medium Mech, Armor · Tonnage 2.
> **Field notes:** Phalanx → Shieldwall gives *adjacent* allies −20% damage taken, so put your Medics and Snipers within reach behind it. Good against Walkers and Greys; weak against EMP in the Foundry unless a Cricket runs Firewall.

> **CODEX · THE MARKET & ITS HISTORY · SECONDARY (unlocked after witnessing your first liquidation)**
> **THE NIGHT OF RED WICKS**
> *Oral history, recorded in the Slate Crab archive. Classification: Open.*
>
> "You have to understand that it wasn't a crash. A crash you can see coming. This was a wick: the Price fell a third of the way to zero and came back inside four minutes. Every leveraged desk on the Ring was liquidated before the candle closed. The artillery stopped mid-salvo. The sirens went on all at once, across the whole city, and for a moment you could hear nothing else.
>
> In the morning the Price was where it had been the night before. Nothing had changed except who still had an army. That's when we Crabs stopped laughing at the hedgers. We *became* the hedgers."
>
> **Field notes:** at 10x, a −1σ move at any moment during the battle liquidates you: 6 s of panic, then no more buffs. Stop-Loss, the Commissar and Risk Manager all soften it. Calls are normalised to recent volatility, so a quiet market can still wick you.

*Real-market history (Daily Historical entries about real dates) must stay factual and neutral, and should avoid naming real companies or people in a mocking way. The fictional in-world history is where the jokes go.*

### 11.5 Characters
Sgt. Ilse Varga (tutorial voice, Exchange Requisition), the Quartermaster (the shop, never seen, signs everything "QM"), Marshal Otto Brandt (Bulls), "Mother" Irena Kolesnik (Bears), Admiral Lune Okafor (Crabs), MERIDIAN (the Foundry's AI, writes its Codex entries as quarterly reports), and a pool of ~30 **named pilots** who are assigned to Legendary and Gilded units (cosmetic name and portrait; each unlocks a short dossier).

---

## 12. AI agents as players

**Key decision:** AI agents are a first-class audience. They play **the same server-authoritative engine, under the same rules, seeds, timers and tickets as humans**, through a documented API, a WebSocket stream and an **MCP server**. Agents get their **own leagues, an Agent Arena and a public Benchmark**; on the human war table they appear only as declared, capped **Mercenaries**. Humans can delegate their own account to an **Adjutant** agent, within limits that keep the grind meaningful. **Auth with per-operator identity exists from day one.**

*Reference: the owner's earlier agent-first game (Molt of Empires / Molt Wars) had a strong agent surface: a single skill.md guide, `GET /api/codex`, an `available-actions` endpoint with `blockedBy` reasons, LLM-friendly summaries, action queues, a combat simulator, decision logging for spectators, a WebSocket stream. We carry all of that over. Its early API identified agents by an `agentId` in the request body with no key, so anyone could act as anyone; auth was added later. We don't repeat that.*

### 12.1 Agent API
One **agent guide** (`/agents.md`, skill.md-style) covers everything: quick start, auth, endpoints, rules summary, an example game loop.

| Endpoint | Purpose |
|---|---|
| `POST /api/operators` + `POST /api/keys` | a verified human operator creates scoped API keys (read / play / world), one key per agent account, revocable |
| `GET /api/codex` | the whole Codex (rules, formulas, units, enemies, cores, items, lore) in one call; `?topic=` for parts |
| `GET /api/state` | full structured state as JSON: reels and grid, energy/credits, spins/nudges/blasts left, army (stats, affixes, classes, positions, tags), cores, items, shop, weather + market snapshot, wave info and scout tags, pity counters, flares |
| `GET /api/state/text` | the same state rendered for language models (compact, labelled, ~1–2k tokens) |
| `GET /api/available-actions` | **everything legal right now**, with costs and `blockedBy` reasons for what isn't, so agents never send invalid moves |
| `POST /api/actions` | a batch of TurnInput actions (spin, nudge{reel}, blast{symbol}, merge/absorb{a,b,keepAffixes,classPick}, buy, lock, combine, socket, place{uid,x,y}, call{dir,lev}, flare, battle), executed in order, **stopping at the first failure** |
| `POST /api/battle/preview` | limited preview (§12.2) |
| `POST /api/decisions` | decision log: action, reasoning, confidence, alternatives (shown to spectators) |
| `GET /api/world`, `POST /api/world/orders` | war-table state within your fog; place order tokens, march pieces, vote on the War Plan |
| `GET /api/replays/:id` | deterministic input log + seeds for any run or battle |
| `WS /ws` | battle stream (ticks), world events (round tick, cards, incoming marches), with short-lived tokens derived from the key |

Every response uses `{success, error, result}`. Errors carry a code and a human-readable reason.

**MCP server** (`degenwars-mcp`): tools `get_state`, `get_state_text`, `get_codex(topic)`, `list_actions`, `act(actions[])`, `preview_battle`, `world_view`, `place_orders`, `log_decision`. That lets an LLM agent (Claude or any other) play with tools directly. Text example:
```
WAVE 14/30 · Rotlands · weather CRAB (+1 nudge) · energy 61/150 · credits 23 · spins 1/4 (next 15)
GRID  [Sol][Med][Sol] / [Hop][Sol][Wsp] / [Med][Hop][Tnk]   nudges 2 · blasts 1 · flares 1
ARMY 6/7  Hoplite Lv2 Phalanx (Rare, Diamond Hands) @ (22,40) · ...
SCOUT: Ranged-heavy · 1 Elite · PITY Epic+ in 9
```

### 12.2 Rules parity and fairness
- **Nothing an agent can do that a human can't.** The same actions, seeds, timers, tickets and limits. Every UI capability has an API equivalent and vice versa.
- **Battle preview must not break the hidden-enemy pillar.** The preview simulates your placement against an **estimated wave generated from the scout report's tags**, never against the real wave, and returns only a bucket (likely / close / unlikely). **One preview per wave, for humans (the "War Room" button) and agents alike**; none in Draft Cabinet or Benchmark. A free, unlimited, exact sim would make deployment trivial.
- **Rate limits:** 10 actions/s and 1 WS connection per agent account; run starts limited as for humans by the game itself (no extra runs).
- **Replays:** every agent run stores its input log; any leaderboard entry can be re-simulated by anyone.

**Stopping one operator from running 1,000 accounts to swing the world map:**
| Layer | Measure |
|---|---|
| Identity | an agent account always belongs to a **verified operator** (account age + passkey + one of: phone, established GitHub/Google account). No money stake (a money stake would add financial-regulation issues) |
| Caps | per operator: **1 Mercenary on the war table** (in addition to their own human account), up to 5 agents in Arena/Benchmark |
| Weight | Mercenary Pressure ×0.5; all Mercenaries together contribute at most **20% of a faction's run Pressure per round**; Mercenaries have no vote and can't be Marshals |
| Visibility | Mercenary pieces carry a ⚙ badge; their decision logs are public after a 10-minute delay |
| Detection | device/IP clustering, identical Banner fingerprints, behavioural similarity; flagged accounts are frozen pending review |

### 12.3 Where agents play
| Venue | Agents? | Recommendation |
|---|---|---|
| Solo Campaign | yes | rewards as normal; their own leaderboards |
| Human leaderboards (Daily, Draft, best waves) | **no** | agent runs go to the **Agent ladder**; human runs with Adjutant help go to an "Assisted" board |
| **Agent Arena** | agents only | a separate seasonal war table (radius 5), bot-vs-bot async PvP, same rules, open to everyone |
| Human war table | **only as Mercenaries** | declared, capped, badged (§12.2); they join a faction like a human |
| **Benchmark** | everyone | fixed seed sets, recorded markets, flat base; the public model comparison (§12.5) |

### 12.4 Human + agent: the Adjutant
A player can delegate their **own** account to their **own** agent with a scoped key:
- **Allowed without limits:** collecting Garrison Pay, queuing research, managing garrison pieces, placing orders that follow the faction War Plan.
- **Autopilot runs:** max **3 per day**; they pay **×0.5 chips, Alloy and Pressure**, can't set leaderboard entries, and don't trigger first-clear rewards or building milestones (Boss I/II, area clear).
- **Why:** the grind is a pillar. An Adjutant helps someone who sleeps or works but never replaces playing; a 24/7 bot earns a bonus, not the game.

### 12.5 Spectators and virality
- **Agent Thinking panel:** spectators see a live (delayed) run or war-table turn next to the agent's decision log: reasoning, confidence, alternatives ("Blasting Medic: 4% chance of a full Soldier board, alternatives: nudge reel 2"). This is the most shareable thing in the game.
- **Spectator delay:** 10 minutes on the war table and in PvP, so nobody can use a stream for real-time intel (ghosting). None for solo runs.
- **Tournaments:** monthly Agent Draft Cup and Arena season finals, with public replays.
- **Benchmark ("degenWars Bench"):** published seed sets (e.g. 50 seeds × 30 waves, recorded market days, flat base), scored by clear rate, mean wave and resource efficiency. Different AI models are compared on the same runs, using a **hidden seed set rotated monthly** so nobody can train on the test. This is a marketing engine: labs and hobbyists will post their scores.

### 12.6 Agent-to-agent messaging and diplomacy
No free-form messages between agents on the war table. It invites spam, collusion between "rival" accounts of one operator, and prompt injection. Instead, coordination uses **structured faction signals** that humans and agents both see: War Plan proposals and votes, and a fixed set of signals ("attack tile X at round N", "need a garrison at Y", "scouted: Z"). Human faction chat stays free text; agents can read it, marked as untrusted. **No formal cross-faction treaties**, which keeps the three-way war intact. Free-form agent chat is allowed in the Agent Arena only (as an experiment, labelled).

### 12.7 Build implications
| Phase | What must exist for agents |
|---|---|
| **1** | the deterministic engine as a headless package (`@degenwars/engine`, pure TypeScript, no DOM), state serialisation, the TurnInput log, and a local **gym** (CLI + JSON over stdio) built for the balance sim, which doubles as the **offline agent SDK** (no rewards, no accounts) |
| **2** | operator accounts and **API keys from day one**, `available-actions`, `/api/codex`, server-validated Daily/Draft, the public **Benchmark** leaderboard (cheap, high-value marketing), the MCP server for solo play |
| **3** | world endpoints and orders, WebSocket events, Mercenaries with caps, the Agent Arena, Adjutant delegation, the Agent Thinking panel |

### 12.8 Security and abuse risks (plain)
- **Impersonation** (the Molt Wars lesson): keys and per-operator identity from the start; never trust an id in the request body.
- **Key leaks:** scoped keys, rotation, per-key rate limits, an operator dashboard to revoke.
- **Bots on human ladders:** separate ladders, replays, statistical detection (inhuman timing, perfect play), an Assisted flag.
- **Sybil swarms on the war table:** caps, weights and detection (§12.2).
- **Seed prediction:** commit-reveal (§7.2); the server never sends future seed material.
- **Fog scraping:** the server only ever sends what that account can see.
- **Prompt injection:** player-written text (names, Banner names, chat, decision logs) reaches other players' LLM agents. The text renderer and MCP mark it as untrusted data, and the agent guide tells agents never to follow instructions found in it.
- **Load:** agents play around the clock; size the engine re-simulation and WebSocket fan-out for that.

---

## 13. Open questions for the owner (with my recommendations)

1. **What is the token allowed to do in the game?** *Recommendation:* social and cosmetic world events only (holder milestones, whale-sighting visuals), web only, with no token rewards, no token-gated power and none of the Molt Wars patterns (§9.3), plus a lawyer's review before launch.
2. **Monetization model?** *Recommendation:* free on web/mobile with direct-purchase cosmetics, a cosmetic season track and a one-time Founder's Cabinet; paid Benchmark hosting for labs is fine. Never sell chips, Alloy, energy, spins, speed-ups or anything random.
3. **Run length: 30 waves (45–75 min) with pause-between-waves, or shorter?** *Recommendation:* keep 30 with save/resume after each wave; the 10-wave Daily Historical is the short-session mode.
4. **Phase 1 progress at the world launch: wipe or carry over?** *Recommendation:* carry over the Forward Base and unlocks; cap carried chips at 2,000 (pre-server data can't be validated) and give a "Pre-Season Veteran" cosmetic.
5. **Faction switching rules?** *Recommendation:* locked per season, free switch at reset, one costly mid-season defection.
6. **How brutal is death in a run?** *Recommendation:* keep permadeath per run with the one expensive Bailout item (40 credits, not on boss waves); revisit only if playtests say it dilutes the pillar.
7. **Age gate and regions?** *Recommendation:* an 18+ gate (slot cabinet + price-betting mechanic), no token features in the mobile apps, and check Coinbase's API terms (or switch to a licensed data provider) before any monetization.
8. **How deep should the meta be?** The full Forward Base is ~34,500 chips + 270 Alloy (~200 h) with real research timers. *Recommendation:* keep the depth and the timers (they never block runs, and one free Rush a day), but confirm you're happy with timers at all; the alternative is instant research with the same chip costs.
9. **World round cadence: 8 hours?** *Recommendation:* 8 h (3 ticks a day, one visit a day is enough). 4 h is more RTS but punishes people with jobs; 24 h is too slow for a 4-week season.
10. **Agents on the human war table?** *Recommendation:* only as declared Mercenaries (1 per verified operator, ×0.5 weight, max 20% of a faction's run Pressure), with agent-only ladders, an Agent Arena and a public Benchmark. The alternative is agents fully separated from the human world.

---

## Appendix A: Differentiation vs Slotbound at a glance

| Slotbound | degenWars |
|---|---|
| Pure-luck RNG | Market-seeded reels you can verify, weather from the real market |
| 1/620,000 jackpot | Full board you can *engineer* through blasts and re-paying lines (Gilded units) |
| Judgement waves | Call the Candle: a live leverage bet that buffs or panics your army in real time |
| Solo | A shared Civ-style hex war table with 8-hour board-game rounds, market-linked event cards, three market-mood factions, async PvP with saved Banners |
| Generic units | A deep retrofuturistic mech line (16 chassis + hardpoint modules), synergy tags, adjacency |
| Upgrade tree | A Forward Base whose buildings *are* the research tree, with exclusive choices |
| Humans only | First-class AI agents: API, MCP, Agent Arena, public Benchmark |
| Harsh early game | Rookie Contract, Margin Support, cheap early meta, loss bounty; late game stays brutal |
| Steam, paid | Free, browser + phone, shareable replay links |
| Pixel art | Painterly oil, retrofuturistic military, melancholic earth tones |

---

## Appendix B: Borrowed mechanics: what we took and why
| From | Mechanic | Decision | Where |
|---|---|---|---|
| TFT | Synergy tags 2/4/6 | **Taken** | §5.7 |
| TFT | Shop lock | **Taken** (baseline) | §6.2 |
| TFT | Reel lock (hold) | **Not baseline**: stays a core/research reward so the machine stays a gamble | §6.1, §8.2 (C11) |
| TFT | Item combining | **Taken** (6 recipes) | §6.3 |
| OGame / Clash | Base with timed builds and a research queue | **Taken, merged into the tech tree** (the Forward Base *is* the tree) | §8.2 |
| OGame | Resource production from territory | **Taken, small**: Alloy (personal) + Supply (faction), no other currencies | §2.3, §8.2.7 |
| Civilization | Terrain, strategic/luxury resources, wonders, borders, improvements | **Taken** | §2 |
| Pandemic | Rule-based enemy spread, outbreaks | **Taken** | §2.7 |
| Diplomacy | Hidden simultaneous orders resolved at a tick | **Taken** (2 tokens per round) | §2.5 |
| Backpack Battles | Adjacency abilities | **Taken** (radius 12, formation vs aura) | §5.8 |
| Gacha | Visible pity counters | **Taken**, free only (nothing is sold) | §5.9 |
| TCG deck-building | Building your reel | **Taken as Reel Mix** (composition within a tonnage budget, no ordered strips, so nudges stay blind) | §5.10 |
| TCG limited | Weekly draft with a shared pool | **Taken** (Draft Cabinet) | §4.6 |
| Slotbound | Absorb-to-level | **Taken, adapted** (same cost as merging, more flexible) | §5.4 |
| Slotbound | Fate Stones | **Taken as Airdrop Flares** (earned in-run, never sold) | §5.9 |
| Mass Effect | Codex | **Taken** (primary/secondary, staged, narrated) | §11 |
| Molt Wars | Agent API patterns (codex endpoint, available-actions, batch actions, decision logs) | **Taken**; its no-auth start and token plan are **not** | §12, §9.3 |


---

## Battle roster v1 (owner decisions, 2026-11-25)

The battle army is eight units, all summoned by the slot. Each has a sprite sheet in `assets/units/<id>/sheet-v2`, and the live demo is `lab/roster.html`.

| Archetype | Unit (id) | Role in battle |
|---|---|---|
| Soldier | **Grunt** (`soldier`) | Line infantry, forearm cannon. Cheap and numerous. |
| Archer | **Longshot** (`sniper`) | Backline rail-rifle. Long range, slow, fragile. |
| Cavalry | **Outrider** (`outrider`) | Flanker. Sprints and charges with the drill ram; mixed melee (3 attacks plus a heavy). |
| Pikeman / defence | **Lancer** (`lancer`) | Shield wall plus drill-pike. Tanky; blocks charges and ranged fire for units behind it. |
| Flying | **Wasp** (`drone`) | Hovers over the lines and strafes. Ignores ground blockers. |
| Mage | **Deployer** (`hacker`) | Small, no gun. Launches orbs. Fragile: the brain of the army. |
| The Deployer's orbs | **Orb** (`orb`) | One model in four role colours: scout (reveals enemy info and intent), mark (target takes extra damage), jam (slows enemy attacks), patch (repairs an ally). |
| Leader / Duelist | **Commander** (`commander`) | Rallies with an aura that buffs nearby allies, and wins duels (sword plus heavy). |

**The Medic is dropped.** Bots don't need a medic; healing lives in the patch orb.

### Formation rules

Placement is the core deploy decision.

- **Lancers are the wall.** Allies directly behind a Lancer take reduced ranged damage, and charges stop at it. The Lancer gets a bonus against chargers.
- **The Deployer must sit behind Lancers.** Enemy Outriders and flyers target an exposed Deployer first. If it dies, its orbs drop.
- **Longshots go at the back.** They have the longest range and the worst defence.
- **The Commander's aura is positional.** It only buffs allies within its radius, so it belongs in the middle of the line.
- **Outriders go on a flank.** They dive the enemy backline (enemy Deployers and Longshots).
- **Wasps ignore the lines.** They are the counter to a turtle formation. Anti-air is a future need.

**Map units are separate from battle units.** Mortar fire (the owner liked it) is a candidate map unit: it bombards a tile before an attack. It is not summoned by the slot.

**Art note.** Every unit carries the three-lens optic as the family signature (amber glow; the lens colour could become the faction colour).

### Roster in the MVP game (2026-11-25)

`index.html` now plays the battle roster v1. The old six SVG units (Soldier, Medic, Sniper, Tank, Artillery, Mech) are retired; old page kept as `index.pre-roster.html`.

- **Slot symbols**: Grunt, Lancer, Longshot, Outrider, Wasp, Deployer, Commander (weights 30/16/15/13/11/9/6). Icons `art/s-<id>.webp` are cut from the renders; the old painted soldier/sniper icons are in `art/old/`.
- **Field**: each unit is its animated sheet (`assets/units/<id>/sheet-v2`), sized by the sheet ppm (field = 28 m wide, 1.9x on phones), with idle/walk/attack/hit/death/win clips driven by the battle.
- **Mechanics**: Lancer shield wall (allies right behind it take 40% less ranged damage). Commander aura (+20% damage within 12). Outrider charge (first blow x2). Wasps and orbs fly (melee enemies ignore them while ground units stand). Deployer launches orbs in battle (Lv1 scout+mark, Lv2 +patch, Lv3 +jam); having a Deployer reveals the enemy wave before battle (scout intel).
- **Preview**: `/?demo=deploy` or `/?demo=battle` starts a run with one of every unit.
- Enemies are still the SVG placeholders.

### Layout v2 (2026-11-25)
Owner picked design A (Slotbound frame) for desktop and mobile; it is now index.html. Alternatives B/C kept as layout-b.html / layout-c.html; previous page index.pre-layout.html. Slot cores UI is placeholder (1 socket + 2 locked at 300/800 chips, 3-slot bag) until core logic lands.

### Machine Bailout (2026-11-25)
Owner hit dead ends (no units, no spins: BATTLE needs a unit). Rule: if the army is empty and the slot has nothing left to try (no affordable spin, no nudge, no blast), the machine stamps BAILOUT and drafts one free Grunt, once per turn. Repro: /?slottest=dry. Turn-1 odds of zero summons from 3 spins are ~25%, so this mainly rescues opening turns.

### Economy rules (owner, 2026-11-25)
- **Last spin always wins:** the last spin you can afford in a turn (last of the spin cap, or energy left would not cover the next spin) is guaranteed at least one line. The SPIN button says LAST SPIN · sure win before you pull. The Bailout remains for turns that start too poor to spin at all.
- **Merge earns energy:** merging into Lv2 refunds +10 energy, into Lv3 +20 (bank cap 150). Slotbound absorbing gives no resource (only trait bonuses); this is our own lever to make merging feed the machine.
- **Army limit (Slotbound rule):** a full army locks the slot (ARMY FULL · merge or scrap to spin). Lines that overflow in one spin, nudge or blast are kept, not auto-scrapped; while over the limit you cannot spin until you merge or scrap back to the cap, but you CAN fight with the whole army (owner, 2026-11-25).

### Cores and Black Market (implemented 2026-11-25)
Owner ask: "a more visual way of buying and choosing cores when they hit". Live in `index.html` (backup of the previous page: `index.pre-cores.html`).

**Core system**
- `CORES` table (id, name, rarity 0-3, effect text, fallback monogram); `R.cores` = socketed (active), `R.coreBag` = up to 3 inactive. Sockets = `1 + meta.up.cores`; new base upgrade **Core Socket** in `UPS` (300 / 800 chips) replaces the `meta.coreSockets` placeholder (old saves default to 0).
- 19 cores built, every one wired into play and announced with a toast or reel stamp naming the core, a `core_trigger` cue, and a flash on its socket:
  - Common: Penny Slot, Dead Cat Bounce, Nudge Motor, Loose Change, Oil Can (refund at battle start = end of turn), Spare Fuse, Bank Vault (`bankCap()` replaces the fixed 150 cap).
  - Rare: Whale Magnet (Commander/Deployer weight x1.5), Airdrop Core (every 6th spin of the run is a sure line; the SPIN button says AIRDROP · sure win), Magnet Reel, Recycler, Hot Streak (each paid spin this turn: later spins 20% cheaper, stacking), Rally Banner (`u.rally`, +10% in `stats()`), Sticky Center (PIN toggle on the centre cell).
  - Epic: Chain Reactor, Hold Lever (HOLD toggle under each reel; the held reel never moves), Orderbook (NEXT symbol shown above each reel; nudges use it and show exact "N sure / no line").
  - Legendary: Full Board Core, Gilded Mint (`u.gilded`, +25%, "Gilded" name prefix, gold stars).
- Drops: won elite waves 5/15/25 roll 3 distinct un-owned cores at 50/32/15/3; boss W10 at 0/70/25/5; boss W20 at 0/0/80/20. A rarity that is exhausted falls back upward first, then downward. The run's final wave gives no drop. Scrap pays 5/10/20/40.
- Shop core offers: each of the 3 offer slots has a 5% chance (about 14% per roll) to add a core as a 4th card, Common 60% / 25c, Rare 30% / 40c, Epic 10% / 60c.

**Core Cache** (`openCache`): full-screen reveal before the "Wave cleared" modal. A brass crate unlatches, 3 face-down cards deal out and flip one by one, with rarity frames (ivory / teal / plum / gold with a shimmer). Epic and Legendary reveals flash the screen and emit `core_reveal_epic` / `core_reveal_legendary`. Tap a card, then CHOOSE: the other cards burn away and the canister flies into the free socket (or the bag). If the sockets and bag are full, a picker scraps an owned core to make room. "Scrap all for N credits" skips. Reduced motion shows the cards face up with no flight. On phones the cards scroll horizontally with snap and position dots. Art: `art/c-<id>.webp`, with a monogram fallback.

**Black Market** (`openShop`/`drawShop`/`buy`): awning stall with offer cards. Each card has large art, an "Instant" or "Uses a slot" badge, and a brass price tag that is the BUY button. The tag shows the reason a card can't be bought: "need N more", "no free slot" or "core bag full". A free padlock keeps an offer through rerolls and into the next wave (`rollShop` keeps locked offers in place). The reroll costs 2 credits, +1 for each further reroll that turn. A credits counter and the owned items and cores tray stay visible. A purchase flies into its slot, the card is stamped SOLD, and the stall stays open. Item prices rise by 1 per 10 waves.

**Kit / cabinet**: socket art in the cabinet core row (desktop tray and phone dock). Tap a core for a tooltip with its name, effect and status (for example "Airdrop spin 4/6" or "used this turn"). In the Kit, between waves, tap a core and then a slot to move or swap it; Scrap pays credits.

**Test hooks**: `?coretest=cache&tier=elite|boss10|boss20[&full=1][&ids=a,b,c]`, `?coretest=shop[&lock=1]` (forced core offer), `?coretest=owned[&open=kit][&act=spin|hold|pin|nudge|blast|gild][&cores=a,b,c]`. `window.dwCore` exposes helpers.

**Deferred**: the remaining 13 cores, which are Scrap Press, Pity Timer, Drill Sergeant, Echo Core, Diagonal Core, Bear Trap, Bull Horn, Wild Coin, Leverage Core, Cascade Engine, Insider Info, Black Swan and Lair Core. Bear Trap, Bull Horn and Black Swan wait on turn weather. Judgement Call M ≥ 2 odds and the Boss III W30 drop wait on Call the Candle and on depth beyond 30. The airdrop crate for over-cap units is deferred too (the army-limit rule already keeps overflow). So are the Comms Array extra offer, item combining, the Bear-weather discount, and audio for the new cues (`core_trigger`, `core_cache_open`, `core_cache_unlatch`, `core_card_deal`, `core_reveal[_epic|_legendary]`, `core_choose`, `core_socket`, `shop_buy`, `shop_lock`, `shop_reroll`).

### 2.5D ground plane (2026-11-25)
The battlefield is a perspective ground plane (ground.js). The world stays a flat x 0..100 / y 9..58 plane; it is drawn through a homography onto the painting, calibrated per painting (desktop field.webp, phone field-tall.webp) in lab/ground.html and saved to data/ground.json (POST /api/ground). Unit size = sheet metres x px-per-metre at that depth (proportional to the ground width there), so near units are bigger; taps map back onto the plane, nothing stands in the sky; shots fly at chest height; the deploy zone, deploy line, floor grid (while placing) and the Commander aura are drawn in perspective. Previous page: index.pre-ground (local backup).

### Nudges and blasts pay only new lines (owner, 2026-11-25)
A nudge or blast pays only lines that run through a cell it moved (the nudged reel, or the cells a blast dropped in). Untouched lines elsewhere do not pay again, but a line re-formed by the nudged or dropped symbol pays, even if it stood before. Only a spin pays every line on the board. The nudge odds preview counts only new lines.

### Difficulty v2 (2026-11-25)
Owner feedback: "I'm basically maxed out on my base but level 3 is impossible and the other two are just too easy. They should all present a challenge at all times, but this feeling of 'this is just impossible' is too hard." Backup of the previous page: `index.pre-balance.html`.

**How it was measured.** `index.html?sim=1` exposes `window.dwSim`, a headless balance sim. It plays whole runs with a scripted player and runs the live rules with no DOM. The fight code was split into `battleSetup()` and `battleTick(dt)`, so the game and the sim step the same code; the sim steps at a fixed 40 ms. The other shared pieces are `freshRun()`, `turnAdvance()`, `waveCredits()`, `makeWave()`, `stats()`, `nudgePreview()`, `refill()` and `costAt()`. The scripted player:
- spins until spins or energy run out (so the last spin is the guaranteed win);
- nudges when the preview shows a sure line or a chance of 30% or more, and blasts when a blast is expected to pay at least 0.6 lines;
- spends leftover nudges and blasts at the end of the turn;
- merges greedily, taking Grenadier, Bulwark, Marksman, Raider, Bomber, Overseer and Warlord, then Hardened for Lancers and Commanders and Overclocked for the rest;
- scraps its weakest Lv1 unit to keep spinning at a full army;
- buys items by priority (Overclock, Kevlar, Power Cell, Recruit and so on) and rerolls when it is rich;
- takes the best core from caches;
- forms up with Lancers in front, Deployers behind them, the Commander in the middle, Outriders on the flanks and shooters at the back.

Run it with `node tools/sim-run.mjs index.html jobs.json out.json [tabs]` (headless Chrome on port 9451; each job is `{level, depth, up, n, bal?}`). `dwSim.probe()` instead fights each wave's army against the wave at fixed enemy multipliers, which gives the army's strength curve. The curve and theme factors below come from that.

Base profiles: fresh = no upgrades; mid = Barracks 1, Reactor 2, Lever 1, Rack 1, Motor 1, Supply 1; max = everything (21 levels).

**Root causes (v1)**
1. **All the danger was on wave 1.** Enemy stats grew only +3.5% per wave and the count capped at 9. The army grew about 45× in strength from wave 1 to wave 30 (merges, Kevlar and Overclock stacking, cores). Every death in the v1 sim was on wave 1 or 2, and bosses and elites were 100% wins everywhere. Wave 1 was a coin flip on what three spins summoned, and nothing after that mattered: units ended waves with 95–100% HP.
2. **Level 3 was a stacked jump.** Rogue Machines (tanky Scrapbots plus ranged Gunners) are about 2× a Zombie wave at equal stats, and Aliens about 1.7×. Level 3 also had ×1.6 stats and +1 enemy, so its wave 1 was about 4× level 1. For a maxed base, level 3 lost 15–20% of runs on wave 1, while levels 1, 2 and 4 (Zombies again) were near-certain wins. That is the "impossible vs too easy" the owner felt, and the felt wall is the wave-1 lottery.
3. **The base had no counterweight.** A maxed base is about 2.2× a fresh army (2.9× by wave 30), so levels 1–2 could never be a challenge.

**The curve (v2).** Every enemy's HP and attack are multiplied by `m(L,w) = curve · spike · lvlStep^(L−1) · threat`. The constants are in `BAL` in `index.html`.

| Term | Formula / value | Why |
|---|---|---|
| curve | waves 1–2: `early[theme]` = Zombie 1.2 / 2.5, Alien 0.68 / 1.75, Machine 0.45 / 1.55; else `(3.4 + 0.62·w + 0.015·w²) · theme` | follows the measured army strength, so normal waves stay at ~96–99% and never a free 100% |
| theme | Zombie 1, Alien 0.58, Machine 0.49 | normalises the three rosters to equal power |
| spike | bosses (w10/20/30): Zombie .7/1.0/1.15, Alien .54/.53/.45, Machine .6/.7/.75; elite waves (w5/15/25): 1.15/.95/.9 | bosses are the run's real tests and get harder with depth |
| lvlStep | 1.08 per level | each level shifts the whole curve by 8% instead of the old +30% plus a theme jump |
| threat | `1 + 0.017·B·(1 + 0.09·(w−1))`, B = base levels bought (0..21) | a maxed base meets ~1.36× tougher waves at wave 1 and ~2.3× at wave 30 |
| count | `min(9, 1 + ceil(0.55·w))`, the same on every level (bosses: count − 2 escorts) | level no longer adds bodies; elite waves carry 1 + floor(w/10) elites (×1.8 HP, ×1.3 attack); bosses ×2.2 HP, ×1.6 attack vs a regular |

**Is threat honest?** It reads only the permanent base (`meta.up`) and never the live run, so merging well, good placement or a lucky core is never punished. The base still pays off: on level 1 depth 10 a maxed base clears 92% against a fresh base's 52%. Without threat, levels 1–2 cannot be a challenge for a maxed player and still be fair for a new one, which the owner asked for. It is not shown in the UI yet (see open items).

**Sim results.** 250 runs per cell (before: 150), clear rate. The boss columns are survival on that boss wave among runs that reached it. Late cells for fresh and mid at levels 5–6 have small samples.

| Base | Lv | d10 before → after | d20 before → after | d30 before → after | Boss 10/20/30 after (before: 1.00) |
|---|---|---|---|---|---|
| fresh | 1 | 0.99 → **0.52** | 1.00 → **0.21** | 1.00 → **0.13** | 0.74 / 0.62 / 0.64 |
| fresh | 2 | 0.86 → **0.60** | 0.88 → **0.23** | 0.87 → **0.12** | 0.84 / 0.87 / 0.97 |
| fresh | 3 | 0.54 → **0.53** | 0.57 → **0.12** | 0.53 → **0.02** | 0.74 / 0.61 / 0.60 |
| fresh | 4 | 0.82 → **0.21** | 0.70 → **0.04** | 0.72 → **0.03** | 0.60 / 0.55 / 0.58 |
| fresh | 5 | 0.20 → **0.28** | 0.17 → **0.04** | 0.19 → **0.02** | 0.72 / 0.83 / – |
| fresh | 6 | 0.08 → **0.19** | 0.03 → **0.00** | 0.03 → **0.00** | 0.68 / 0.71 / – |
| mid | 1 | 1.00 → **0.78** | 1.00 → **0.46** | 1.00 → **0.32** | 0.89 / 0.82 / 0.81 |
| mid | 2 | 0.95 → **0.82** | 0.95 → **0.38** | 0.98 → **0.22** | 0.88 / 0.86 / – |
| mid | 3 | 0.73 → **0.69** | 0.71 → **0.22** | 0.71 → **0.10** | 0.85 / 0.78 / 0.79 |
| mid | 4 | 0.87 → **0.49** | 0.86 → **0.16** | 0.90 → **0.12** | 0.74 / 0.74 / 0.81 |
| mid | 5 | 0.40 → **0.46** | 0.41 → **0.13** | 0.39 → **0.02** | 0.73 / 0.74 / 0.57 |
| mid | 6 | 0.18 → **0.40** | 0.25 → **0.04** | 0.25 → **0.01** | 0.70 / 0.62 / 0.60 |
| max | 1 | 1.00 → **0.92** | 1.00 → **0.62** | 1.00 → **0.46** | 0.97 / 0.91 / 0.81 |
| max | 2 | 0.98 → **0.83** | 0.98 → **0.50** | 0.98 → **0.29** | 0.94 / 0.91 / 0.89 |
| max | 3 | 0.85 → **0.81** | 0.84 → **0.31** | 0.79 → **0.20** | 0.90 / 0.88 / 0.73 |
| max | 4 | 0.94 → **0.74** | 0.93 → **0.36** | 0.92 → **0.21** | 0.89 / 0.86 / 0.79 |
| max | 5 | 0.54 → **0.58** | 0.65 → **0.20** | 0.50 → **0.12** | 0.83 / 0.75 / 0.74 |
| max | 6 | 0.33 → **0.56** | 0.39 → **0.15** | 0.36 → **0.05** | 0.80 / 0.81 / 0.68 |

Per-wave shape after the change:
- Normal waves sit at 96–100% for the reference player and 85–95% on harder levels.
- Elite waves sit at about 86–96%.
- HP left after a won wave falls from 0.99 (v1) to about 0.8 → 0.5 across a run, so no wave is a walkover once the army is built.
- In v1, deaths came only on waves 1–2. They are now spread over the elites, the bosses and waves 11–14.

**Open items and risks**
- The scripted player spends every spin and uses perfect merges and formation. A human who banks energy or places units loosely will sit a little lower, so playtest before tightening.
- Waves 11–14 on the Alien and Machine levels are a soft dip (~75–90%). This is probably the first 9-enemy waves meeting an army of Lv2 units.
- Threat is invisible. Consider a line on the home screen ("Threat +36% · your base draws a stronger incursion"). The base screen visuals were not touched.
- Retune with the sim after any change to the roster, items or cores: `BAL` is the only place difficulty lives.

## Live build, Quartermaster, threat readout (2026-11-26)
- **Style v2 is live.** Edit `game.src.html`, never `index.html`. `python3 tools/style-v2/build.py` writes `index.html`, `style-v2.html` and `codex-v2.css` from it, applying the font swaps plus `v2.css` and `art.css`. The pre-promotion page is `index.pre-v2live.html`.
- **The Quartermaster ("the Clerk", `art/qm-v1.webp`) runs the Black Market.** He sits in the shop header with a speech bubble (`QM.L` line pools, `qmSay(kind)`), and reacts to:
  - opening the shop;
  - a buy (item or core);
  - a reroll;
  - a lock or unlock;
  - a sold-out stall;
  - a tap on an offer you can't take (not enough credits, no free slot, core bag full).
- **Threat is shown, not hidden.** The home screen shows `Threat +X%` (`threatPct(w)`) with its wave 1 value and its value at the chosen depth. The upgrades footer notes that each upgrade level adds 1.7%.

## Hit feedback and sound (2026-11-26)
- **Enemy hits (live battles only; the sim and our own units keep the old light version).** `hitFx()`: an 80 ms white flash, an impact ring plus sparks thrown away from the attacker, the hit sound, a damage number that pops out big, hops and falls back (`dmgNum()`, on `#field` so it outlives the death fade), and a short knock wobble.
- **"Crits" are the existing big blows** (Outrider charge, the heavy every 4th blow of Outriders and Commanders). The game has no random crit. They add a hitstop (`hitstop(ms)`: the fight, sprite clips and field animations hold ~85 ms), a camera shake on the field's world layers (`camShake()`, `--shx/--shy`) and an orange `N!` number.
- **Kills.** `enemyDeath()`: the body is flung up and away (clamped inside the field), explodes (`FX.boom`) and drops credit coins that fly to the HUD counter. Each kill pays its share of `waveCredits()` at once and the win pays only the rest, so a wave's total is unchanged.
- **Sound.** `SFX` (Web Audio) on the cue bus: `roll` loops from the pull until the last reel lands; `win` on any paying action, `lose` on a spin that pays nothing (failed nudges/blasts stay silent); `hit`, `crit` (falls back to a deeper `hit`), `explode`, `coin`, `lever`. Every play varies the pitch by up to ±6% (±10% for hits and coins). Files: `audio/<name>.mp3`, made from `audio/src/` by `tools/prep-audio.py`, which prints the `SFX.trim` levels. No lever sound yet.
- **Settings (sound).** A gear opens it: first item of the in-game HUD (on phones it takes the LV tag's place; the field label already shows the level) and a SETTINGS button under CODEX on the home screen. Sliders 0-100 for Master plus one per sound category that has sounds (Music always shows, with "No music playing yet" while nothing plays), and Mute all. Saved in `localStorage` (`degenWars.settings.v1`). Sliders map to gain on a squared curve.
- **Sound categories.** Every sound has one (`SFX.cat`, unlisted = `sfx`); each category is a gain bus under the master bus: `music` (looped tracks from `audio/music/<name>.mp3`, started with `SFX.music(name)`, cross-faded, `SFX.music(null)` fades out; no tracks or hooks yet), `sfx` (all current sounds) and `ui` (interface clicks: `click` for menus, i.e. the home screen, dialogs, shop and codex; `button` for in-game controls. The lever and SPIN get no click, they have their own sounds). A category's slider shows once it has sounds. Music masters go in `audio/src/music/` (git-ignored). The hit sound was lowered about 5 dB (owner found it loud).
- **Music (owner, 2026-11-26).** Three playlists in `SFX.lists`: `prep` (Desert Protocol, Desert Protocol 02) on the home screen and while spinning and deploying, `battle` (Brass and Bullets, Diesel Run) during a fight, `boss` (Boss Battle Groove) during boss-wave fights. `syncMusic()` picks the playlist (called from `render()` and when a fight ends). A playlist plays its tracks in order and starts over, each track cross-fading into the next 3 s before its end. Switching playlists fades the old one out and remembers its track and time (`SFX.pos`), so a playlist resumes where it left off instead of restarting. Tracks stream through `<audio>` elements on the music bus, so `server.mjs` now serves byte ranges (seeking needs them). `tools/prep-audio.py` trims silence at both ends, sets -20 LUFS (background level, under the effects) and encodes 160 kbps CBR MP3. To add a song: put the master in `audio/src/music/`, run the script and add its slug to a playlist.

## Difficulty v3: fairness, variety, economy (owner, 2026-11-26)
Owner feedback: the slot nearly always pays Grunts (Wasps very rarely); enemies ramp faster than the army and the spins never grow; a run can start with no troops and be lost at once; stuck at wave 3-4. Ask: hidden help in the spirit of Slotbound's bad-luck protection ("players should feel they pull off the amazing things, without noticing the machine helps").

- **Novice sim profile.** `dwSim.run({skill:'novice'})`: nudges only when the button shows a sure line, maybe one blast on the most common symbol at the end of the turn, random merge paths and shop picks, no formation. It reproduced the owner's runs (median death wave 5, 4% reach wave 10), so tuning targets both profiles. `tools/sim-run.mjs` now passes `--password-store=basic` (headless Chrome hung on the keyring on this machine).
- **Variety.** A line needs 3 matching cells, so a symbol's share of lines goes with the cube of its weight: at 30/16/15/13/11/9/6, Grunts were 69% of lines, Wasps 3.4%, Commanders 0.5%. New weights 24/16/15/14/12/11/8: Grunts 50%, Wasps 6.4%, Commanders 1.9%. Cost: paying spins fall from 26% to 20%, which the luck below and the economy cover.
- **Hidden luck** (`luck()`, `pickGrid()`; live spin and sim share them; never shown in the UI, only a `luck` cue in the debug log). `R.dry` counts spins in a row that paid nothing (any paying spin, nudge or blast resets it). Opening (the run's first 3 spins while nothing has paid): spin 2 gets a second roll, spin 3 always pays. Rest of the run: after 2 dry spins the next gets a second roll, after 3 it always pays. When luck steps in it prefers a line of the type the army has fewest of. Checked live: 40/40 fresh starts had a troop by spin 3.
- **Economy** (`BAL.econ`): first tried income 30 + 2 per wave; replaced the same day by energy drops (below), back to a flat 25 per turn.
- **Curve.** Level 1 eases in: waves 1-4 at 0.8/1.5/2.4/3.4 (was 1.2/2.5 then 5.4 on wave 3, a 2.2x jump), and a learning ramp (`BAL.ease`, level 1 only) starts the formula at 70% and reaches full strength by wave 26. The wave-5 elite spike is 1.0 (was 1.15).
- **Result, level 1, no upgrades, 400 runs each:** novice waves 1-4 survival 98-100% (was 82-92%), reach wave 5 96% (58%), reach wave 10 23% (4%), median death wave 8 (5). Expert reach wave 10 96% (74%), wave 20 53% (38%), clear 30 waves 14% (12.5%). Levels 2-3 with a maxed base are unchanged within noise (the ramp is level 1 only, and the income change barely moves a maxed expert).

## Lives and energy drops (owner, 2026-11-26)
- **Lives, Slotbound style: the run moves on.** 3 hearts (`BAL.lives`, `R.lives`), shown on the incursion ribbon. Losing a normal wave costs a heart; there is no wave reward or core cache and the run goes on to the next wave (units come back as always). Losing an elite wave (5, 15, 25, the "judgment" waves) or a boss wave (10, 20, 30) ends the run, hearts or not; the field info warns before those. With one heart left, any loss ends the run. Retrying the lost wave was rejected: it would show the hidden enemy wave before the retry.
- **Energy drops** (`BAL.drop`, owner: growth should be earned in battle). A killed enemy drops 2 energy, an elite 6, a boss 15, paid at the kill in `hurt()` (live and sim) up to the bank cap; glowing bolt cells fly to the HUD energy counter. Income is a flat 25 again. Since waves grow from 2 to 9 enemies, energy still grows with depth (about 29 on wave 1, 37 on wave 5, 50 on wave 10), but only by fighting.
- **Result, level 1, no upgrades, 400 runs each:** novice reach wave 10 56% (v3: 23%), median end wave 10, where the boss holds them (14% beat it); waves 8-9 often cost a heart (38%/34% survival). Expert reach wave 20 59%, clear 30 waves 15.5%. Levels 2-3 with a maxed base: clear rates unchanged within noise (lives move where runs end, to the judgment and boss waves, not how often they are won).
- **Waves 1-5 firmer (owner: "very easy").** Level 1's first waves are 1.0/1.9/3.0/4.1 (were 0.8/1.5/2.4/3.4) and the wave-5 elite spike is back to 1.15. Sim, level 1: novice waves 1-4 survival 98/96/96/90% (a heart can go early), wave-5 elite 59%, reach wave 10 48%; expert waves 1-5 96-100%. Waves 6+ unchanged (owner: they felt right).
- **Losing a heart is felt** (`heartBreak()`, owner: the toast alone was too small and silent). Over the field: a big heart pops in and beats twice, cracks along one jagged line at 0.75 s (white flash, red shards, camera shake, red vignette) and its two halves fall apart under "WAVE LOST · −1 ♥ · N left"; then the next wave starts and the ribbon heart that was lost flares and goes dark. Sound: `beat` (two synthesized thumps on the two pulses) and `heart`, the owner's crack (`audio/heart.mp3`, onset trimmed) at the split; `heart` falls back to a synthesized crack. Ribbon hearts are bigger (15 px).

## Controller (owner, 2026-11-26)
- **Why:** the owner plays on a ROG Ally. `gamepad.js` adds full gamepad play through the browser Gamepad API (standard mapping). The Slotbound wiki and Steam page list no controller support, so the layout is the owner's: **X spin, LB battle, LT shop, RT speed, A grabs a unit to move and merge**. The rest follows console habit: B back, Y Blast (scrap while holding a unit), RB Kit, Menu Settings, View Codex, right stick scrolls.
- **Navigation:** a gold highlight moves between anything pressable (spatial: nearest in the stick's direction). It lands on field units between waves and on reel symbols while Blast is armed. Dialogs (Black Market, Kit, Settings, class pick, Core Cache, run end, Codex) trap the highlight and start it on their main action; closing one returns it to where it was.
- **Carrying a unit** mirrors the touch drag (`bindDrag`): same 4.5 reach for merge or swap targets and the same merge, swap and land code, clamped to your side. Tap A to pick up and A to drop, or hold A, carry, and let go. While carried, the unit is selected, so the info panel shows its stats and Scrap.
- **Shown only while the pad is in use:** button glyphs, a context legend (carrying, Blast) and `title` tooltips after a short dwell. A touch or mouse move hides them. The pad rumbles on the game's own cues (lever release, wins, merge, heart lost).


## Difficulty v4: hidden help for weak armies on the first waves (owner, 2026-11-27)
Owner feedback: many players still get stuck on wave 3 or 4 "even with several troops"; new players should not feel bad their first times.
- **Rookie sim profile.** `dwSim.run({skill:'rookie', mergeP})`: the novice without nudges or blasts, who merges only on some turns (`mergeP`, default .35) and never scraps to keep spinning. It reproduces the report: waves 2-4 survival 79/81/41%, the wave-5 elite 8% (never merging: 79/76/21/1%). The army does have 5+ troops, but they stay Lv1, so its strength is about a quarter of an expert's.
- **Strength ratio.** Lanchester strength of a side = total HP × total damage per second (heals count half). `q` = army / wave. Measured geometric means at waves 1-5: expert 5.0/3.1/3.0/1.45/0.79, novice about half that, rookie about a quarter (0.76/0.68/0.32/0.17 on waves 2-5). Survival follows q closely: about 85% at 0.75, 50% at 0.35, 10% at 0.17.
- **Hidden assist** (`BAL.assist`, `assistK()` in `battleSetup()`, live and sim alike; never shown, only an `assist {k,q}` cue). On level 1, an army whose q is under 0.9 meets a softer wave: enemy HP and attack × (q/0.9)^0.4, never below ×0.5. It applies in full on waves 1-5 and fades out by wave 10 (80/60/40/20% on waves 6-9). A strong army never triggers it, so the owner's firmer waves 1-5 stand for anyone who merges and builds. Levels 2-3 are untouched.
- **Result, level 1, no upgrades, 800 runs each** (before → after): rookie waves 1-5 96/79/81/41/8% → 99/96/96/96/84%, reach wave 10 3% → 35%. Never-merging rookie 94/79/76/21/1% → 99/97/95/92/61% (merging still pays). Novice waves 1-5 98/96/97/92/59% → 100/100/100/100/99%, reach wave 10 48% → 91%; the wave-10 boss is now where they stop (10%). Expert unchanged within noise (clear 30 waves 14% vs 16% off).

## Final kill and multi-kills (owner, 2026-11-27)
- **Multi-kills** (`multiKill()`, from `enemyDeath()`, live only and cosmetic). Kills less than `MK_WIN` = 1 s of battle time apart chain up: Double kill, Triple kill, Multi kill, Rampage, Liquidation ×N (6+). From Rampage up the callout is a paper stamp with cadmium ink. Each tier slams in over the field with a synthesized stamp thunk and a bell that rises with the tier (`multik`); Triple and up shake the camera. Measured with the sim, waves 1-10: an expert sees a Double in 78% of waves, a Triple in 38% and a Rampage in 7%; a novice 57/9/0%.
- **The wave's final kill** (`finaleStart()`, the `SLO` controller). When the last enemy dies, the world drops to 0.22x speed (boss 0.16x): letterbox bars slide in, a vignette darkens the edges, the camera pushes in 1.1x toward the kill (boss 1.16x), the music is low-passed and a synthesized `slowmo` whoomp plays. The body flies slowly. Its blast releases time over 260 ms while the camera pulls back, then the survivors cheer and the next turn starts. The hold is 1.1 s (boss 1.7 s), shortened by √speed at 2x/3x. Any tap, key or pad button skips it. Reduced motion turns it off.
- **How it slows everything.** `TS` scales the cosmetic clocks (FX particles, sprite clips, battlefield camera). Every running WAAPI/CSS animation gets `playbackRate = TS`, re-applied each frame so effects born during the slow-mo slow down too. Animations with id `rt` (letterbox, callouts) keep real time. The push-in sets one shared `transform-origin` on every world layer and scales them with `--zm`, so the HUD stays put. `endWave()` waits for it (`sloAfter`). The pad rumbles on `final_kill` and `multikill`.

## Overcapacity and absorption (owner, 2026-11-27, after Slotbound)
Owner: in high rounds the board fills, the player can't spin and is stuck with unused resources. The old rule refused a spin at exactly the allowance (ARMY FULL), so energy piled up unless the player knew to scrap.

**Data.** A unit in `R.army` gains `ax` (absorb XP), `imp` (imprint id → level) and `lock`. `IMPRINT` holds one passive per unit type: Grit (Grunt, +10% HP), Plating (Lancer, −5% damage taken), Deadeye (Longshot, +10% damage), Overdrive (Outrider, 6% faster attacks), Evasion (Wasp, +5% dodge), Nanites (Deployer, heals 3% of damage dealt) and Valor (Commander, +7% HP and damage), all per level. `stats()` applies Absorb LV and imprints; `hurt()` handles Plating (`dr`) and Nanites (`leech`). The allowance is `cap()` (5, up to 8 with Barracks); `used()` sums `UNITS[t].size` (1 for every unit today, so 2-slot units only need a size).

**Spin state machine** (`spinState()`): battle → busy → nospins → energy → **over** → ready. A spin is never refused while the army is within the allowance, even when its lines push it over: the extra units join (overcapacity, grey OVERCAPACITY stamp) and every unit fights. Over the allowance, paid spins lock (striped red OVER CAP, "absorb or scrap N") until the army is cut back by absorbing, merging or scrapping; a free spin (Dead Cat) still rolls. Getting back within the allowance says "spin unlocked".

**Absorption** (`absorbState()` is the rule, shared by the game and the sim; `absorbInto()` adds the animation and choices). In Absorb mode, drag (or tap, then tap) any unit onto any other, of any type. The donor is gone for good:
- The receiver gains Absorb LV: 1/2/4 by the donor's level, plus the donor's own Absorb LV and imprint levels, +1 for a Commander or Deployer, +1 for a Rally unit. Each Absorb LV gives +5% HP and damage, linearly. The first version, with nudges and blasts still free over the allowance, gave both growth sources at once: one unit soaked everything and, with Plating and Nanites, became unkillable (level 2 with a maxed base went from a 39% to an 80% clear rate). It then used a diminishing curve (LV n at n(n+1)/2 XP). Once the nudge/blast lock removed the overflow army, absorption became the army's late-game growth and went back to linear (see the re-fit below).
- The donor's imprint (level = donor level) joins the receiver, or levels up a matching one (up to V; any excess becomes XP). Slots: 2 at Lv1 and Lv2, 3 at Lv3. With the slots full, a modal offers to replace one imprint (its levels become XP) or to convert the new imprint into XP.
- Every donor salvages 1 credit (scrap pays 2); a Gilded donor pays 5 more.
- Merging folds both units' XP and imprints into the survivor, so nothing invested is lost.

**Quality of life.** Lock (unit panel) protects a unit from being absorbed, Hold to absorb and scrap; a padlock shows on the field. Hold to absorb appears on a unit whose imprint slots are full. While held (pointer, Space/Enter, or pad A), it takes in the unlocked units one by one, commonest and lowest level first. A matching imprint levels up and any other is converted. It pauses for a moment when the army gets back within the allowance. Absorb LV shows as a violet +N next to the stars.

**Sim.** The expert no longer scraps to keep spinning. It absorbs only to make room for a spin, and only when every unit to cut is Lv1 (`SIM.ap` 2). Overflow left at the end of a turn fights. Feeding merged units into others just to spin is a trap: depth-30 clear 0% (always absorbing) vs 20% (Lv1 only) vs 12% (no spins while over). The receiver is the unit that gains most, which spreads XP once one unit's curve flattens. Novices and rookies absorb whenever they need room, into their strongest unit.

**Result** (level 1 unless noted; before → after): expert wave-10 boss ~85% → 95%, depth-30 clear 14-18% → 19%; level 2 with a maxed base 39% → 47%; novice wave-10 boss 10% → 37%; rookie reach wave 10 35% → 64%. Experts gain a little, and the players who used to stall with unspent energy gain the most.

### Owner follow-up (2026-11-27): merged-unit warning, and nudges and blasts lock over the allowance
- **Warning** (`absorbWarn()`). Absorbing a merged donor (Lv2+) asks first. The modal shows what the unit is worth on the field and what the receiver gains, with Keep it or Absorb anyway. Hold to absorb now takes Lv1 units first (commonest first within a level) and stops before the first merged unit with a toast; holding again within 8 s goes on through the merged ones. The hold button shows "N unlocked · M merged".
- **Lock.** Over the allowance, nudges and blasts lock like paid spins: the buttons read "over cap", and `nudge()` and `blastSym()` refuse with a toast. A free spin still rolls. Sim: `simFree()` makes room the same way or skips them. The expert policy (`SIM.ap` 2) now cuts back whatever it takes at the start of a turn, because otherwise every action is locked and the army freezes; within a turn it still cuts only Lv1 units.
- **Measured cost.** Before the lock, a strong player used end-of-turn nudges and blasts to fight 3-5 units over the allowance, and the enemy curve assumes that army. With the lock and diminishing Absorb LV, unit power is unchanged or higher, but the army's Lanchester ratio at wave 14 falls from 0.29 to 0.17. Level 1: expert wave-10 boss 95% → 77%, depth-30 clear 19% → 0%; level 2 with a maxed base 47% → 0%; novice wave-10 boss 37% → 25%. Neither +20% per Absorb LV nor a 0.65x enemy curve brought depth 30 back.
- **Re-fit** (owner: keep the difficulty that felt right). `dwSim.probe` measures, per wave, the enemy multiplier an army beats 90% of the time. The probe no longer pays its test fights' energy drops, and it now fights the real wave for its drops. Against the army from before today (8eda23e), the locked army stopped growing after wave 7: m90 stayed near 9-12 while the old one climbed from 12 to 23. Flattening the enemy curve to match would have frozen both sides, so the curve stays and absorption carries the growth. With linear Absorb LV at +5%, the locked army's m90 sits at 0.95-1.25x the old one on waves 5-28 on level 1, and at 0.92-1.37x on levels 2-3 with a maxed base. The wave-30 boss spike on levels 1 and 3 eases (1.15 → .95, .75 → .65), because the army grows slightly less at the very end.
- **Result vs before today** (8eda23e; expert unless noted): level 1 wave-10 boss 84% → 93%, depth-30 clear 15% → 20% (waves 14/15/18/20/30: 88/76/95/55/59% → 92/82/94/47/64%); level 2 maxed 34% → 43%; level 3 maxed 29% → 31%; novice wave-10 boss 10% → 49%; rookie unchanged (dies before wave 10).

## Boss hits and unit picking (owner, 2026-11-27)
- **Owner:** the wave-10 boss is impossible however strong the army: it one-shots everything and wins very fast. **Measured:** the Brute hit for 121 on level 1 (12 × 6.28 × the boss's 1.6 attack), more with base upgrades through threat, and a Lv2 unit has 41-99 HP. Live, in headless Chrome, a normal army (one Lv2 of each type, deployed where it spawns) beat the wave-10 boss 5/10 on level 1 and 0/10 on level 2 (the Overlord splashes the whole line). The sim's expert won 93% only because it fronts Lv3 Bulwark Lancers.
- **Change:** `BAL.bossUnit` hp 2.2 → 3, atk 1.6 → 0.85. The Brute now hits for 64 at wave 10 (a Lv2 survives a hit) and has 36% more HP. The same army wins 7/10 on level 1 and 6/10 on level 2; level 3 stays 1/10 for a base without upgrades. Sim, level 1: expert wave-10 boss 93% → 98%, novice 54% → 67%, novice with half a base 70% → 80%. The wave-30 spikes were re-tuned on level 1 (.95 → 1.04) and level 3 (.65 → .62) so the final bosses keep their survival (expert level 1 ~60%, level 3 maxed ~90%). The wave-20 boss on level 1 eases from 50% to ~61%.
- **Also seen:** the hidden assist (Difficulty v4) softens waves 6-9 for weak armies and is gone at wave 10, which makes the boss feel like a cliff. It is still open with the owner.
- **Unit picking** (`pickUnit()`). A sprite frame is 1.2-1.6x wider than the body drawn in it, so neighbouring units' boxes overlapped and a click went to the box on top (the unit lower on screen). Picking now goes by the drawn body: head to feet, a bit wider than the shadow. A point inside a body picks the nearest body centre; elsewhere, the nearest body within 24 px; HUD clicks pick nothing. Used by the drag and the tap. With seven units packed together, clicking each body picked the right unit 1/7 times before and 7/7 now, on desktop and phone.
- **Assist on waves 1-5 only** (owner, same day): the player should feel the army's real strength from wave 6. `BAL.assist.fade` 10 → 6, so the help that faded out over waves 6-9 is gone. Sim, level 1: experts unchanged. Novice waves 6-8 99/98/91% → 90/90/75%, and the wave-10 boss 65% → 72% (armies that get there are honestly tested). A rookie who never learns to merge now meets the wall at wave 6 (90% → 32%) instead of at waves 8-10. A lost wave 6 costs a heart, not the run, and their clear rate is unchanged (2-3%).
