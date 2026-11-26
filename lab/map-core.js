// degenWars · War Table core: seeded map generator + board-game rules.
// PURE MODULE: no DOM, no globals, no Date/Math.random. Same (seed, radius) -> same map; same state + same inputs -> same round.
// Meant to move to the server engine as-is. See docs/map.md for the spec.

export const VERSION = 'map-core 0.3';

// ------------------------------------------------------------------ rng
function xmur3(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }; }
export function hashSeed(s) { return xmur3(String(s))(); }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function makeRng(seed) { const r = mulberry(hashSeed(seed)); const f = () => r(); f.int = (n) => Math.floor(r() * n); f.pick = (a) => a[Math.floor(r() * a.length)]; f.shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }; f.wpick = (a, w) => { let s = 0; for (const x of w) s += x; let t = r() * s; for (let i = 0; i < a.length; i++) { t -= w[i]; if (t <= 0) return a[i]; } return a[a.length - 1]; }; return f; }
// state rng: serialisable integer state
function srng(st) { st.rs = (st.rs + 0x6D2B79F5) | 0; let t = Math.imul(st.rs ^ (st.rs >>> 15), 1 | st.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

// ------------------------------------------------------------------ tables
export const TERRAIN = {
  wasteland: { name: 'Wasteland', march: 1, supply: 1, alloy: 0, mod: 'Open field: the standard battlefield.' },
  city: { name: 'Ruined City', march: 2, supply: 2, alloy: 0, mod: 'Rubble cover: ranged units take −15% damage; 3 narrow lanes for melee.' },
  forest: { name: 'Dead Forest', march: 2, supply: 1, alloy: 0, mod: 'Ranged range −20%; Recon units +15% crit.' },
  hills: { name: 'Hills', march: 2, supply: 1, alloy: 1, mod: 'High ground: the holder\'s ranged units +15% range.' },
  mountain: { name: 'Mountains', march: Infinity, supply: 0, alloy: 0, mod: 'Impassable. Cross only at a pass.' },
  pass: { name: 'Mountain Pass', march: 2, supply: 0, alloy: 0, mod: 'One lane: melee fights one at a time; the holder\'s garrison +10% HP.' },
  crater: { name: 'Crater', march: 2, supply: 0, alloy: 2, mod: 'Crater pits: units in them take −20% ranged damage but have −20% range.' },
  coast: { name: 'Coast', march: 1, supply: 1, alloy: 0, mod: 'Beach: Artillery-tag units +10% splash. A Port here opens the sea.' },
  sea: { name: 'Inland Sea', march: 3, supply: 0, alloy: 0, mod: 'Sea lanes: only from a Port, 3 h per hex.' },
  marsh: { name: 'Toxic Marsh', march: 3, supply: 1, alloy: 0, mod: 'Melee −25% move speed; Organic units take 1 dmg/s; Machines unaffected.' },
  crystal: { name: 'Crystal Field', march: 2, supply: 0, alloy: 0, mod: 'Ion/Laser modules +20%; all shields +20% (both sides).' },
  scrap: { name: 'Scrapyard', march: 2, supply: 0, alloy: 3, mod: 'Killbots repair 1%/s; your Tinker repairs +30%.' },
  exchange: { name: 'The Exchange', march: 1, supply: 0, alloy: 0, mod: 'Neutral clearing house. No battles.' },
  hq: { name: 'Faction HQ', march: 1, supply: 3, alloy: 1, mod: 'Cannot be attacked. Always supplied.' },
};
export const BIOMES = [
  { id: 'rot', name: 'Rotlands', enemy: 'Zombies', special: 'marsh', lmk: 'hospital', w: { wasteland: 24, city: 22, forest: 20, marsh: 20, hills: 8, crater: 6 } },
  { id: 'crash', name: 'Crash Site', enemy: 'Aliens', special: 'crystal', lmk: 'mothership', w: { wasteland: 28, crystal: 18, crater: 18, hills: 12, forest: 12, city: 12 } },
  { id: 'foundry', name: 'Foundry', enemy: 'Killbots', special: 'scrap', lmk: 'oracle', w: { scrap: 20, city: 22, wasteland: 22, hills: 18, crater: 10, forest: 8 } },
];
export const FACTIONS = [
  { id: 'R', name: 'Rust Bears', short: 'BEAR', dir: 0 },
  { id: 'V', name: 'Verdigris Bulls', short: 'BULL', dir: 2 },
  { id: 'S', name: 'Slate Crabs', short: 'CRAB', dir: 4 },
];
export const STRATEGIC = {
  fuel: { name: 'Fuel Cells', hosts: ['wasteland', 'marsh'], conv: 'wasteland', note: 'Heavy and super-heavy mechs. Without: "dry tanks", −25% speed.' },
  rare: { name: 'Rare Earths', hosts: ['hills', 'scrap'], conv: 'hills', note: 'Drone units. Without: drones −50% HP.' },
  xeno: { name: 'Xenocrystal', hosts: ['crystal', 'crater'], conv: 'crater', note: 'Ion / Laser / Overcharge modules. Without: fall back to the Standard Cannon.' },
};
export const LUXURY = {
  copium: { name: 'Copium Labs', bonus: '+5% chips from runs' },
  ledger: { name: 'Old Ledger Vaults', bonus: '+1 free shop reroll per run' },
  servers: { name: 'Server Farms', bonus: 'Forward Base research −10% time' },
  bonded: { name: 'Bonded Warehouses', bonus: '+3 starting credits' },
  press: { name: 'Propaganda Presses', bonus: '+10% Scrip' },
  hash: { name: 'Hashrate Wells', bonus: '+1 Airdrop Flare per run' },
};
export const LANDMARKS = {
  mothership: { name: 'The Crashed Mothership', bonus: 'Xenocrystal access ×2; judgement core choices +1' },
  oracle: { name: 'Oracle Hall', bonus: 'No fog of war for the holder; Scout orders free' },
  hospital: { name: 'St. Grindset Plague Hospital', bonus: 'Medics and Tinkers +15% healing in world runs and Banners' },
  mint: { name: 'The Mint', bonus: '+15% Supply' },
  dam: { name: 'Halving Dam', bonus: 'Once per round: flood one river, enemies +3 h to cross' },
  lighthouse: { name: "Satoshi's Lighthouse", bonus: 'Vision over all coast tiles; Ports cost nothing' },
};
export const SETTLE = { // radiation S at distance 0, radius; falls 1/hex
  outpost: { name: 'Outpost', S: 4, rad: 1, next: 'fort', after: 3 },
  fort: { name: 'Fort', S: 6, rad: 2, next: 'citadel', after: 6 },
  citadel: { name: 'Citadel', S: 8, rad: 3 },
  hq: { name: 'HQ', S: 7, rad: 2 },
};
export const RULES = {
  rounds: 84, capRef: 12, claim: 3, lairWeekFrom: 64, own: 3, lead: 2, decay: 0.10, levelWP: 25, outpostCost: 30, startSupply: 40,
  corrMult: [1, 1, 1.3, 1.6], diff: [1, 1, 1.15, 1.3], lairDiff: 1.5, wpToPressure: 1 / 5,
  purgeWP: 4, reinforceP: 1, runRate: 0.5, orderUse: 0.6, outbreakMax: 8, longNight: 3, chainDepth: 2, // an outbreak can trigger at most one further outbreak generation
};
export const SUITS = {
  bull: ['Airdrop Season|Runs this round start with +1 Flare (sim: run WP +10%).', 'FOMO Rally|Reinforce orders ×2.', 'Number Go Up|Supply +25% at this tick.', 'Short Squeeze|Sabotage backfires on the saboteur (−2).'],
  bear: ['Liquidation Cascade|Each faction\'s farthest tile from its HQ loses 3 Pressure.', 'Rug in the Foundry|Every Factory produces a Column now.', 'Capitulation|+2 spread cards for every biome.', 'Buy the Dip|Outposts cost 50% this round.'],
  crab: ['Sideways Grind|Run WP +20% this round.', 'Funding Rate|The faction with the most tiles pays 10% Supply to the smallest.', 'Range Trade|Marches −1 h this round.', 'Theta Decay|Pressure decay doubled at this tick.'],
  chaos: ['Flash Wick|All Walls offline: garrisons hold less this round.', 'Black Swan|A random held landmark loses its banked Pressure.', 'Oracle Glitch|Fog lifts for everyone for 1 round.', 'The Halving|Supply halved at this tick.'],
  field: ['Supply Convoy|+15 Supply to every faction.', 'Storm Season|River crossings +1 h this round.', 'Refugees|A free Outpost on a wild tile near the weakest faction.', 'Ghost Reinforcements|Ghost Garrisons hold better this round.'],
};

// ------------------------------------------------------------------ hex geometry (axial, flat-top, size 1)
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const S3 = Math.sqrt(3);
export const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const toXY = (q, r) => [1.5 * q, S3 * (r + q / 2)];
const angDiff = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
const dirAng = (d) => { const [x, y] = toXY(DIRS[d][0], DIRS[d][1]); return Math.atan2(y, x); };
export const edgeKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function buildGrid(R) {
  const tiles = [], idx = new Map();
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
    const [x, y] = toXY(q, r);
    const t = { i: tiles.length, q, r, x, y, ring: (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2, ang: Math.atan2(y, x) };
    idx.set(q + ',' + r, t.i); tiles.push(t);
  }
  for (const t of tiles) t.nb = DIRS.map(([dq, dr]) => idx.get((t.q + dq) + ',' + (t.r + dr))).map((v) => (v === undefined ? -1 : v));
  // vertices (shared corners) for edge rivers
  const vmap = new Map(), verts = [];
  const vk = (x, y) => Math.round(x * 1000) + ':' + Math.round(y * 1000);
  for (const t of tiles) {
    t.cv = [];
    for (let c = 0; c < 6; c++) {
      const a = (Math.PI / 3) * c, x = t.x + Math.cos(a), y = t.y + Math.sin(a), k = vk(x, y);
      let v = vmap.get(k); if (v === undefined) { v = verts.length; vmap.set(k, v); verts.push({ x, y, hexes: [], adj: new Set() }); }
      verts[v].hexes.push(t.i); t.cv.push(v);
    }
  }
  // edge between corners c and c+1 faces the neighbour at angle 60c+30
  const edgeVerts = new Map(); // "va~vb" -> [hexA, hexB|-1]
  for (const t of tiles) for (let c = 0; c < 6; c++) {
    const va = t.cv[c], vb = t.cv[(c + 1) % 6]; verts[va].adj.add(vb); verts[vb].adj.add(va);
    const a = (Math.PI / 3) * c + Math.PI / 6, nx = t.x + S3 * Math.cos(a), ny = t.y + S3 * Math.sin(a);
    let n = -1; for (const j of t.nb) if (j >= 0 && Math.abs(tiles[j].x - nx) < 1e-3 && Math.abs(tiles[j].y - ny) < 1e-3) n = j;
    const k = va < vb ? va + '~' + vb : vb + '~' + va; if (!edgeVerts.has(k)) edgeVerts.set(k, [t.i, n]);
  }
  return { tiles, idx, verts, edgeVerts };
}

// ------------------------------------------------------------------ generator
export const PASSABLE_UI = (t) => t.terrain !== 'mountain' && t.terrain !== 'sea';
const PASSABLE = (t) => t.terrain !== 'mountain' && t.terrain !== 'sea';
const LANDLIKE = (t) => t.terrain !== 'sea';

function dijkstra(m, src, opt = {}) {
  const n = m.tiles.length, d = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
  d[src] = 0; const pq = [[0, src]];
  while (pq.length) {
    let bi = 0; for (let k = 1; k < pq.length; k++) if (pq[k][0] < pq[bi][0]) bi = k;
    const [dc, u] = pq.splice(bi, 1)[0]; if (done[u]) continue; done[u] = 1;
    for (const v of m.tiles[u].nb) {
      if (v < 0 || done[v]) continue; const t = m.tiles[v];
      if (!PASSABLE(t)) continue;
      const c = dc + TERRAIN[t.terrain].march + (m.river.has(edgeKey(u, v)) ? 1 : 0);
      if (c < d[v]) { d[v] = c; pq.push([c, v]); }
    }
  }
  return d;
}

export function generate({ seed = 'season-1', R = 8 } = {}) {
  R = Math.max(6, Math.min(10, R | 0));
  let best = null, lastErr = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    let m; try { m = tryGenerate(String(seed), R, attempt); } catch (e) { lastErr = String(e && e.message || e); continue; }
    if (m.fair.ok) return m;
    if (!best || m.fair.score < best.fair.score) best = m;
  }
  if (!best) throw new Error('map generation failed: ' + lastErr);
  return best;
}

function tryGenerate(seed, R, attempt) {
  const rng = makeRng(seed + '#' + R + '#' + attempt);
  const g = buildGrid(R), T = g.tiles, at = (q, r) => g.idx.get(q + ',' + r);
  const m = { seed, R, attempt, tiles: T, verts: g.verts, river: new Set(), rivers: [], hqs: [], lairs: [], spines: [], passes: [], landmarks: {}, warnings: [] };
  // zones
  const biomeOrder = rng.shuffle([0, 1, 2]);
  const bis = [1, 3, 5].map(dirAng);
  for (const t of T) {
    t.terrain = null; t.res = null; t.lux = null; t.lmk = null; t.lair = false; t.pass = false; t.island = false; t.hq = -1; t.fair = null;
    let w = 0; for (let k = 1; k < 3; k++) if (angDiff(t.ang, bis[k]) < angDiff(t.ang, bis[w])) w = k;
    t.wedge = w; t.biome = biomeOrder[w];
    if (t.ring <= 1) t.terrain = 'exchange';
  }
  m.wedgeBiome = biomeOrder;
  FACTIONS.forEach((f, fi) => { const [dq, dr] = DIRS[f.dir]; const i = at(dq, dr); T[i].terrain = 'hq'; T[i].hq = fi; m.hqs.push(i); });
  // wedge w sits between HQ dirs 2w and 2w+2 -> faction indices
  const facByDir = {}; FACTIONS.forEach((f, fi) => (facByDir[f.dir] = fi));
  m.wedgeFactions = [0, 1, 2].map((w) => [facByDir[(2 * w) % 6], facByDir[(2 * w + 2) % 6]]);

  // spines along HQ directions, from ring 3 outward, wiggling
  const seaSpine = rng.int(3); m.seaSpine = seaSpine;
  FACTIONS.forEach((f, fi) => {
    const a0 = dirAng(f.dir), [dq, dr] = DIRS[f.dir]; let cur = at(3 * dq, 3 * dr); const sp = [cur];
    const end = fi === seaSpine ? R - 1 : R;
    while (T[cur].ring < end) {
      const c = T[cur].nb.filter((j) => j >= 0 && T[j].ring === T[cur].ring + 1);
      const sc = c.map((j) => -angDiff(T[j].ang, a0) * T[j].ring * 1.6 + rng() * 0.9);
      cur = c[sc.indexOf(Math.max(...sc))]; sp.push(cur);
    }
    for (const j of sp) T[j].terrain = 'mountain';
    // ridge shoulders (never touching the HQ approach)
    for (const j of sp) if (T[j].ring >= 5 && T[j].ring < end && rng() < 0.22) {
      const c = T[j].nb.filter((k) => k >= 0 && !T[k].terrain && T[k].ring === T[j].ring && T[k].ring < R);
      if (c.length) T[rng.pick(c)].terrain = 'mountain';
    }
    m.spines.push(sp);
  });
  // coast arc centred on one spine's outer end
  const seaA = dirAng(FACTIONS[seaSpine].dir) + (rng() - 0.5) * 0.35, halfW = (32 + rng() * 14) * Math.PI / 180;
  for (const t of T) {
    if (t.terrain || t.ring < R - 3) continue;
    if (t.ring < R && t.nb.some((j) => j >= 0 && T[j].terrain === 'mountain')) continue; // keep land flanks on the cape
    const da = angDiff(t.ang, seaA); if (da > halfW + 0.15) continue;
    const s = (t.ring - (R - 3.4)) / 3.4 + (1 - da / halfW) * 1.0 + (rng() - 0.5) * 0.5;
    if (s > 0.98) t.terrain = 'sea';
  }
  // keep a strait at the cape tip
  { const tip = m.spines[seaSpine][m.spines[seaSpine].length - 1]; for (const j of T[tip].nb) if (j >= 0 && T[j].ring === R && !T[j].terrain) T[j].terrain = 'sea'; }
  // islands
  const seaT = T.filter((t) => t.terrain === 'sea' && t.ring < R && t.nb.every((j) => j < 0 || T[j].terrain === 'sea' || T[j].terrain === null || T[j].terrain === 'mountain'));
  const nIsl = 1 + rng.int(R >= 8 ? 3 : 2);
  for (let k = 0; k < nIsl && seaT.length; k++) {
    const t = seaT.splice(rng.int(seaT.length), 1)[0];
    if (t.nb.some((j) => j >= 0 && T[j].island)) continue;
    if (t.nb.filter((j) => j >= 0 && T[j].terrain === 'sea').length < 4) continue;
    t.terrain = null; t.island = true;
  }
  // terrain clumps per wedge
  const seeds = [];
  for (let w = 0; w < 3; w++) {
    const cand = T.filter((t) => !t.terrain && t.wedge === w), n = Math.max(6, Math.round(cand.length / 6.5)), bw = BIOMES[biomeOrder[w]].w;
    rng.shuffle(cand);
    for (let k = 0; k < n && k < cand.length; k++) seeds.push({ t: cand[k], w, terr: rng.wpick(Object.keys(bw), Object.values(bw)) });
  }
  for (const t of T) {
    if (t.terrain) continue;
    let bs = null, bd = Infinity;
    for (const s of seeds) if (s.w === t.wedge) { const d = hexDist(t, s.t) + rng() * 1.2; if (d < bd) { bd = d; bs = s; } }
    t.terrain = bs ? bs.terr : 'wasteland';
  }
  // hills under the mountains, city on the Exchange outskirts, coast, biome special minimum
  for (const t of T) {
    if (['exchange', 'hq', 'mountain', 'sea'].includes(t.terrain)) continue;
    if (t.nb.some((j) => j >= 0 && T[j].terrain === 'mountain') && rng() < 0.4) t.terrain = 'hills';
    if (t.ring === 2 && rng() < 0.45) t.terrain = 'city';
    if (t.nb.some((j) => j >= 0 && T[j].terrain === 'sea') && !t.island && rng() < 0.75) t.terrain = 'coast';
    if (t.island) t.terrain = rng() < 0.5 ? 'coast' : t.terrain;
  }
  // identical HQ foyers (fairness by construction near the HQ)
  m.hqs.forEach((h, fi) => {
    const d = FACTIONS[fi].dir, [dq, dr] = DIRS[d];
    const back = at(2 * dq, 2 * dr), L = DIRS[(d + 1) % 6], Rr = DIRS[(d + 5) % 6];
    T[back].terrain = 'wasteland';
    const l = at(dq + L[0], dr + L[1]), r = at(dq + Rr[0], dr + Rr[1]);
    if (l !== undefined && T[l].terrain !== 'exchange') T[l].terrain = 'city';
    if (r !== undefined && T[r].terrain !== 'exchange') T[r].terrain = 'city';
  });
  for (let w = 0; w < 3; w++) {
    const b = BIOMES[biomeOrder[w]], wt = T.filter((t) => t.wedge === w && PASSABLE(t) && !['exchange', 'hq', 'coast'].includes(t.terrain));
    const need = Math.round(wt.length * 0.14); let have = wt.filter((t) => t.terrain === b.special).length;
    const outer = wt.filter((t) => t.terrain !== b.special && t.ring >= R / 2).sort((a, c) => c.ring - a.ring + (rng() - 0.5) * 4);
    while (have < need && outer.length) { outer.shift().terrain = b.special; have++; }
  }
  // lairs on the outer corners of each wedge
  for (let w = 0; w < 3; w++) {
    const [dq, dr] = DIRS[2 * w + 1], i = at(R * dq, R * dr), t = T[i];
    t.terrain = BIOMES[biomeOrder[w]].special; t.lair = true; m.lairs.push(i);
    for (const j of t.nb) if (j >= 0 && T[j].terrain === 'mountain') T[j].terrain = 'hills';
  }

  // rivers on hex edges, from the spines outward
  const V = g.verts, vTouches = (v, pred) => V[v].hexes.some((h) => pred(T[h]));
  const usedV = new Set();
  const nRiv = 2 + rng.int(3);
  const rotW = biomeOrder.indexOf(0);
  for (let k = 0, tries = 0; m.rivers.length < nRiv && tries < 60; tries++, k++) {
    // first river is guaranteed in the Rotlands (zombies follow rivers)
    const w = m.rivers.length === 0 ? rotW : rng.int(3);
    const [fa, fb] = m.wedgeFactions[w], spineF = rng() < 0.5 ? fa : fb;
    const sp = m.spines[spineF].filter((j) => T[j].terrain === 'mountain' && T[j].ring >= 3 && T[j].ring <= R - 3);
    if (!sp.length) continue;
    const src = rng.pick(sp);
    const starts = T[src].cv.filter((v) => V[v].hexes.length === 3 && !usedV.has(v) && V[v].hexes.some((h) => T[h].wedge === w && PASSABLE(T[h]) && T[h].terrain !== 'hq' && T[h].terrain !== 'exchange'));
    if (!starts.length) continue;
    let v = rng.pick(starts); const path = [v];
    const tA = dirAng(FACTIONS[spineF].dir), wa = bis[w], tgtA = tA + Math.sign(Math.sin(wa - tA)) * (0.35 + rng() * 0.45);
    const tx = Math.cos(tgtA) * (1.75 * R + 2), ty = Math.sin(tgtA) * (1.75 * R + 2);
    let ok = false;
    for (let step = 0; step < 5 * R; step++) {
      const opts = [...V[v].adj].filter((u) => !path.includes(u) && !vTouches(u, (t) => t.terrain === 'exchange' || t.terrain === 'hq' || t.lair)
        && (step < 1 || !vTouches(u, (t) => t.terrain === 'mountain')));
      if (!opts.length) break;
      const sc = opts.map((u) => -Math.hypot(V[u].x - tx, V[u].y - ty) + rng() * 1.1);
      const u = opts[sc.indexOf(Math.max(...sc))];
      path.push(u); v = u;
      if (usedV.has(u) || V[u].hexes.length < 3 || vTouches(u, (t) => t.terrain === 'sea')) { ok = true; break; }
    }
    if (!ok || path.length < Math.max(4, R)) continue;
    const edges = [];
    for (let s = 1; s < path.length; s++) {
      const a = path[s - 1], b = path[s], e = g.edgeVerts.get(a < b ? a + '~' + b : b + '~' + a);
      if (e && e[1] >= 0) edges.push(edgeKey(e[0], e[1]));
    }
    edges.forEach((e) => m.river.add(e)); path.forEach((p) => usedV.add(p));
    m.rivers.push({ path, edges, wedge: w });
  }
  for (const t of T) t.riverN = t.nb.filter((j) => j >= 0 && m.river.has(edgeKey(t.i, j))).length;

  // passes: inner pass equalised by path cost, outer pass free
  let dist = m.hqs.map((h) => dijkstra(m, h));
  const passCost = (p, fi) => Math.min(...T[p].nb.filter((j) => j >= 0 && PASSABLE(T[j])).map((j) => dist[fi][j] + (m.river.has(edgeKey(p, j)) ? 1 : 0))) + TERRAIN.pass.march;
  const crosses = (p) => { const ws = new Set(T[p].nb.filter((j) => j >= 0 && PASSABLE(T[j]) && T[j].terrain !== 'hq').map((j) => T[j].wedge)); return ws.size >= 2; };
  const iLo = Math.ceil(0.38 * R), iHi = Math.min(Math.ceil(0.6 * R), R - 3);
  const innerC = m.spines.map((sp) => sp.filter((p) => T[p].terrain === 'mountain' && T[p].ring >= iLo && T[p].ring <= iHi && crosses(p)));
  if (innerC.some((c) => !c.length)) throw new Error('no inner pass candidate');
  let bestT = null, bestSpread = Infinity, bestPick = null;
  for (const c0 of innerC[0]) {
    const target = passCost(c0, 0), pick = innerC.map((c, fi) => c.reduce((a, p) => (Math.abs(passCost(p, fi) - target) < Math.abs(passCost(a, fi) - target) ? p : a)));
    const cs = pick.map((p, fi) => passCost(p, fi)), spread = Math.max(...cs) - Math.min(...cs);
    if (spread < bestSpread) { bestSpread = spread; bestT = target; bestPick = pick; }
  }
  bestPick.forEach((p) => { T[p].terrain = 'pass'; T[p].pass = true; m.passes.push(p); });
  m.spines.forEach((sp, fi) => {
    const inner = bestPick[fi];
    const c = sp.filter((p) => T[p].terrain === 'mountain' && T[p].ring >= T[inner].ring + 2 && crosses(p));
    if (!c.length) { m.warnings.push(`${FACTIONS[fi].short} spine: no room for an outer pass`); return; }
    const p = rng.pick(c); T[p].terrain = 'pass'; T[p].pass = true; m.passes.push(p);
  });
  dist = m.hqs.map((h) => dijkstra(m, h)); m.dist = dist;
  const minD = (i) => Math.min(dist[0][i], dist[1][i], dist[2][i]);
  const free = (t) => PASSABLE(t) && !t.lair && !t.pass && !t.res && !t.lux && !t.lmk && t.terrain !== 'exchange' && t.terrain !== 'hq';
  const spaced = (t, k) => !T.some((o) => (o.res || o.lux || o.lmk || o.lair) && hexDist(o, t) < k);

  // biome landmarks, equidistant to the two HQs that border the wedge
  const tol = 1;
  let L = null;
  for (let target = Math.round(R * 0.9); target <= R * 3.5 && L === null; target++) {
    const picks = [];
    for (let w = 0; w < 3; w++) {
      const [fa, fb] = m.wedgeFactions[w], fc = 3 - fa - fb;
      const c = T.filter((t) => t.wedge === w && free(t) && t.terrain !== 'coast' && t.ring >= Math.ceil(R / 2) && t.ring <= R - 2
        && dist[fa][t.i] >= target && dist[fa][t.i] <= target + tol && dist[fb][t.i] >= target && dist[fb][t.i] <= target + tol && dist[fc][t.i] > target + tol);
      if (!c.length) break; picks.push(rng.pick(c));
    }
    if (picks.length === 3) { L = target; picks.forEach((t, w) => { t.lmk = BIOMES[biomeOrder[w]].lmk; m.landmarks[t.lmk] = t.i; }); }
  }
  if (L === null) throw new Error('no fair biome landmark ring');
  m.fairL = L;
  // global landmarks, farther than the biome ones from every HQ
  const far = (t, k = 2) => minD(t.i) >= L + tol + k;
  const putL = (id, pred) => { let c = T.filter((t) => pred(t) && far(t) && spaced(t, 2)); if (!c.length) c = T.filter((t) => pred(t) && far(t, 1)); if (!c.length) c = T.filter((t) => pred(t)); if (!c.length) { m.warnings.push(`${LANDMARKS[id].name}: no spot`); return false; } const t = rng.pick(c); t.lmk = id; m.landmarks[id] = t.i; return true; };
  putL('mint', (t) => t.pass && !t.lmk);
  putL('dam', (t) => free(t) && t.riverN >= 2) || putL('dam', (t) => free(t) && t.riverN >= 1);
  putL('lighthouse', (t) => free(t) && t.nb.some((j) => j >= 0 && T[j].terrain === 'sea'));

  // fair kit: per HQ one of each strategic + one luxury at the same path cost
  const kit = (kind, ids, conv, startT) => {
    for (const sp of [2, 1]) for (let target = startT; target <= startT + 3 * R; target++) {
      const picks = [];
      for (let fi = 0; fi < 3; fi++) {
        const c = T.filter((t) => free(t) && spaced(t, sp) && !picks.some((p) => hexDist(p, t) < 2) && !t.island && dist[fi][t.i] >= target && dist[fi][t.i] <= target + tol
          && [0, 1, 2].every((o) => o === fi || dist[o][t.i] > target + tol) && conv(t));
        if (!c.length) break; picks.push(rng.pick(c));
      }
      if (picks.length === 3) { picks.forEach((t, fi) => ids(t, fi)); return target; }
    }
    throw new Error('no fair kit for ' + kind);
  };
  m.fairT = {};
  for (const [id, s] of Object.entries(STRATEGIC)) {
    const host = (t) => s.hosts.includes(t.terrain) || (TERRAIN[t.terrain].march === TERRAIN[s.conv].march && !['coast', 'marsh', 'crystal', 'scrap', 'pass'].includes(t.terrain));
    m.fairT[id] = kit(id, (t, fi) => { if (!s.hosts.includes(t.terrain)) t.terrain = s.conv; t.res = id; t.fair = fi; }, host, Math.max(3, Math.round(R * 0.55)));
  }
  const luxIds = rng.shuffle(Object.keys(LUXURY));
  m.fairT.lux = kit('lux', (t, fi) => { t.lux = luxIds[fi]; t.fair = fi; }, (t) => t.terrain !== 'marsh', Math.max(4, Math.round(R * 0.7)));
  // extra strategics, deeper in the biomes (biome flavour), luxuries to 2 copies-ish
  const extraN = Math.max(2, Math.round(R / 2.6));
  const deepOK = (t, id) => free(t) && spaced(t, 2) && minD(t.i) >= m.fairT[id] + tol + 2;
  const homeBiome = { fuel: 0, xeno: 1, rare: 2 };
  for (const [id, s] of Object.entries(STRATEGIC)) {
    let n = 0;
    const pri = T.filter((t) => deepOK(t, id) && t.biome === homeBiome[id] && s.hosts.includes(t.terrain));
    const sec = T.filter((t) => deepOK(t, id) && s.hosts.includes(t.terrain));
    for (const pool of [rng.shuffle(pri), rng.shuffle(sec)]) for (const t of pool) { if (n >= extraN) break; if (deepOK(t, id)) { t.res = id; n++; } }
  }
  const luxN = Math.round(R * 1.5) - 3;
  const luxPool = rng.shuffle(T.filter((t) => free(t) && t.terrain !== 'marsh' && minD(t.i) >= m.fairT.lux + tol + 1));
  for (let k = 0, n = 0; k < luxPool.length && n < luxN; k++) { const t = luxPool[k]; if (!spaced(t, 2)) continue; t.lux = luxIds[(3 + n) % 6]; n++; }

  // initial corruption: everything outside the Exchange and the HQs, denser toward each Lair
  for (const t of T) {
    t.corr0 = 0; if (!PASSABLE(t) || t.terrain === 'exchange' || t.terrain === 'hq') continue;
    const dl = Math.min(...m.lairs.map((l) => hexDist(t, T[l]))), dh = Math.min(...m.hqs.map((h) => hexDist(t, T[h])));
    const x = dh / (dh + dl) + (rng() - 0.5) * 0.18;
    t.corr0 = t.lair ? 3 : dh <= 1 ? 1 : x < 0.36 ? 1 : x < 0.66 ? 2 : 3;
  }
  m.fair = fairness(m);
  m.stats = stats(m);
  return m;
}

export function fairness(m) {
  const T = m.tiles, d = m.dist, tol = 1, rows = [], checks = [];
  const nearest = (fi, pred, k = 0) => { const v = T.filter(pred).map((t) => d[fi][t.i]).sort((a, b) => a - b); return v[k] ?? Infinity; };
  for (let fi = 0; fi < 3; fi++) rows.push({
    f: FACTIONS[fi].short,
    pass: nearest(fi, (t) => t.pass), fuel: nearest(fi, (t) => t.res === 'fuel'), xeno: nearest(fi, (t) => t.res === 'xeno'), rare: nearest(fi, (t) => t.res === 'rare'),
    lux: nearest(fi, (t) => !!t.lux), lmk1: nearest(fi, (t) => !!t.lmk, 0), lmk2: nearest(fi, (t) => !!t.lmk, 1),
    lair: nearest(fi, (t) => t.lair),
  });
  let score = 0, ok = true;
  for (const k of ['pass', 'fuel', 'xeno', 'rare', 'lux', 'lmk1', 'lmk2']) {
    const v = rows.map((r) => r[k]), sp = Math.max(...v) - Math.min(...v), pass = sp <= tol && v.every(Number.isFinite);
    checks.push({ k, spread: sp, ok: pass }); score += pass ? 0 : sp; ok = ok && pass;
  }
  // reachability: land via land; islands via sea lanes
  const land = T.filter((t) => PASSABLE(t)), seen = new Uint8Array(T.length), q = [m.hqs[0]]; seen[m.hqs[0]] = 1;
  while (q.length) { const u = q.pop(); for (const v of T[u].nb) if (v >= 0 && !seen[v] && PASSABLE(T[v])) { seen[v] = 1; q.push(v); } }
  const byLand = land.filter((t) => seen[t.i]).length, islands = land.filter((t) => !seen[t.i]);
  const seen2 = new Uint8Array(seen), q2 = T.filter((t) => seen[t.i]).map((t) => t.i);
  while (q2.length) { const u = q2.pop(); for (const v of T[u].nb) if (v >= 0 && !seen2[v] && LANDLIKE(T[v])) { seen2[v] = 1; q2.push(v); } }
  const unreachable = land.filter((t) => !seen2[t.i]).length;
  const strandedNotIsland = islands.filter((t) => !t.island).length;
  checks.push({ k: 'reach', ok: unreachable === 0, spread: unreachable });
  checks.push({ k: 'mainland', ok: strandedNotIsland === 0, spread: strandedNotIsland });
  const lairsOk = rows.every((r) => Number.isFinite(r.lair)); checks.push({ k: 'lairs', ok: lairsOk, spread: 0 });
  const passesOk = m.passes.length === 6; checks.push({ k: 'passes6', ok: passesOk, spread: 6 - m.passes.length });
  const lmkOk = Object.keys(LANDMARKS).every((k) => m.landmarks[k] !== undefined); checks.push({ k: 'landmarks6', ok: lmkOk, spread: 0 });
  ok = ok && unreachable === 0 && strandedNotIsland === 0 && lairsOk && passesOk && lmkOk;
  if (!ok) score += 100 * (unreachable + strandedNotIsland + (lairsOk ? 0 : 1) + (6 - m.passes.length) + (lmkOk ? 0 : 1));
  return { ok, score, rows, checks, byLand, islandTiles: islands.length, tol };
}

export function stats(m) {
  const T = m.tiles, per = [0, 1, 2].map(() => ({ tiles: 0, land: 0, levels: 0, terr: {} }));
  const tot = { tiles: T.length, land: 0, sea: 0, mountain: 0, res: { fuel: 0, xeno: 0, rare: 0 }, lux: 0, lmk: Object.keys(m.landmarks).length, rivers: m.rivers.length, riverEdges: m.river.size };
  for (const t of T) {
    if (t.terrain === 'sea') tot.sea++; else if (t.terrain === 'mountain') tot.mountain++; else tot.land++;
    if (t.res) tot.res[t.res]++; if (t.lux) tot.lux++;
    if (t.terrain === 'exchange' || t.terrain === 'hq') continue;
    const p = per[t.biome]; p.tiles++; if (PASSABLE(t)) { p.land++; p.levels += t.corr0; }
    p.terr[t.terrain] = (p.terr[t.terrain] || 0) + 1;
  }
  return { tot, perBiome: per };
}

// ------------------------------------------------------------------ state & rules
export function createState(m, { pop = 90 } = {}) {
  const n = m.tiles.length;
  const st = {
    v: 1, seed: m.seed, R: m.R, round: 1, rs: hashSeed(m.seed + '/sim') | 0, pop,
    corr: m.tiles.map((t) => t.corr0), cb: m.tiles.map((t) => (t.corr0 ? t.biome : -1)), prog: new Array(n).fill(0),
    owner: new Array(n).fill(-1), contested: new Array(n).fill(false), supplied: new Array(n).fill(false), parent: new Array(n).fill(-1),
    bank: new Array(n * 3).fill(0), pend: new Array(n * 3).fill(0), pendP: new Array(n * 3).fill(0),
    settle: new Array(n).fill(null), builds: [], pieces: [], pieceId: 1,
    fac: FACTIONS.map(() => ({ supply: RULES.startSupply, income: 0, runs: 0, wp: 0, liberated: 0, lost: 0 })),
    outbreaks: 0, outbreakTotal: 0, longNight: 0, card: null, roundFx: {}, log: [], hist: [], lairWP: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  m.hqs.forEach((h, fi) => { st.settle[h] = { f: fi, type: 'hq', age: 0 }; st.owner[h] = fi; });
  recompute(m, st);
  return st;
}

const members = (st) => Math.max(1, st.pop / 3);
// per-capita scaling (§2.14): full effect up to capRef members, then 1/sqrt beyond it
export const perCapita = (st) => Math.min(1, Math.sqrt(RULES.capRef / members(st)));
export function wavesWP(waves, corr) { return (waves + waves * (waves + 1) / 20) * (RULES.corrMult[corr] || 1); }

// what one typical run on this tile means (for the tile card)
export function runPreview(m, st, i, fi) {
  const t = m.tiles[i], c = st.corr[i], diff = t.lair ? RULES.lairDiff : RULES.diff[c] || 1;
  const typical = Math.max(1, Math.min(30, Math.round(14 / diff)));
  const raw = wavesWP(typical, c), eff = raw * perCapita(st) * underdog(m, st, fi);
  const need = c > 0 ? c * RULES.levelWP - st.prog[i] : 0;
  return { biome: BIOMES[st.cb[i] >= 0 ? st.cb[i] : t.biome], diff, typical, raw, eff, need, runs: c > 0 ? Math.ceil(need / eff) : 0, pressure: eff * RULES.wpToPressure };
}
function underdog(m, st, fi) {
  const cnt = [0, 1, 2].map((f) => st.owner.filter((o) => o === f).length), mx = Math.max(...cnt), mn = Math.min(...cnt);
  if (mx === mn) return 1; return cnt[fi] === mn ? 1.3 : cnt[fi] === mx ? 0.85 : 1;
}

// tiles a faction may run on: corrupted/wild/contested next to its borders, or next to the Exchange
export function runnable(m, st, fi, i) {
  const t = m.tiles[i]; if (!PASSABLE(t) || t.terrain === 'exchange' || t.terrain === 'hq') return false;
  if (t.lair && st.round < RULES.lairWeekFrom) return st.corr[i] > 3; // lairs locked until Lair Week (corr never >3)
  if (st.owner[i] === fi && !st.contested[i] && st.corr[i] === 0) return st.bank[i * 3 + fi] < 12; // pushing own tile is allowed but pointless when saturated
  return t.nb.some((j) => j >= 0 && (st.owner[j] === fi || m.tiles[j].terrain === 'exchange'));
}

export function queueRun(m, st, fi, i, waves) {
  const c = st.corr[i], fx = st.roundFx;
  let wp = wavesWP(waves, Math.max(1, c)) * (fx.wpMult || 1);
  const eff = wp * perCapita(st) * underdog(m, st, fi);
  st.pend[i * 3 + fi] += eff; st.fac[fi].runs++; st.fac[fi].wp += wp;
  if (m.tiles[i].lair) st.lairWP[m.tiles[i].biome][fi] += wp;
  return eff;
}

function rollWaves(st, diff) { const g = (srng(st) + srng(st) + srng(st) - 1.5) * 2 * 7 + 14; return Math.max(0, Math.min(30, Math.round(g / diff))); }

// Ghost Command target choice (War Plan): top targets get most runs
export function ghostTargets(m, st, fi) {
  const T = m.tiles, out = [];
  for (const t of T) {
    if (!runnable(m, st, fi, t.i)) continue;
    const c = st.corr[t.i];
    let s = (c === 3 ? 1.5 : 3 - c) + t.nb.filter((j) => j >= 0 && st.owner[j] === fi).length * 0.8;
    if (t.res || t.lux) s += 2.5; if (t.lmk) s += 4; if (t.pass) s += 1.5;
    if (st.contested[t.i]) s += 1; if (c === 0) s -= st.owner[t.i] === fi ? 3 : 1;
    if (t.lair && st.round >= RULES.lairWeekFrom) s += 6;
    s -= m.dist[fi][t.i] * 0.08; s += srng(st) * 1.5;
    out.push([s, t.i]);
  }
  return out.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

// remaining effort a target still needs this round (WP for corruption, Pressure-as-WP for claiming)
function need(m, st, fi, i) {
  let pend = 0; for (let f = 0; f < 3; f++) pend += st.pend[i * 3 + f];
  if (st.corr[i] > 0) return st.corr[i] * RULES.levelWP - st.prog[i] - pend + 8; // +8: leftover becomes the claim
  const P = st.bank[i * 3 + fi] + (st.rad ? st.rad[i * 3 + fi] : 0) + st.pend[i * 3 + fi] * RULES.wpToPressure + st.pendP[i * 3 + fi];
  const rival = Math.max(...[0, 1, 2].filter((f) => f !== fi).map((f) => st.bank[i * 3 + f] + (st.rad ? st.rad[i * 3 + f] : 0)));
  if (rival > RULES.own + 3) return 0; // Ghost Command does not pour runs into a rival's stronghold (that is what Banners are for)
  return Math.max(0, Math.min(8, Math.max(RULES.own + 2, rival + RULES.lead + 1) - P)) / RULES.wpToPressure;
}
export function ghostRuns(m, st, fi, n) {
  const tg = ghostTargets(m, st, fi).slice(0, 10); if (!tg.length) return 0;
  let wp = 0;
  for (let k = 0; k < n; k++) {
    const i = tg.find((j) => need(m, st, fi, j) > 0) ?? tg[Math.floor(srng(st) * tg.length)];
    const c = st.corr[i], diff = m.tiles[i].lair ? RULES.lairDiff : RULES.diff[c] || 1;
    wp += queueRun(m, st, fi, i, rollWaves(st, diff));
  }
  return wp;
}

// population-driven play for one round (runs + orders by each faction's active members)
export function autoPlay(m, st) {
  const mem = members(st);
  for (let fi = 0; fi < 3; fi++) {
    const runs = Math.round(mem * RULES.runRate * (0.8 + srng(st) * 0.4));
    ghostRuns(m, st, fi, runs);
    const orders = Math.round(mem * 2 * RULES.orderUse), tg = ghostTargets(m, st, fi).slice(0, 10);
    if (!tg.length) continue;
    for (let k = 0; k < orders; k++) {
      const i = tg.find((j) => need(m, st, fi, j) > 0) ?? tg[k % tg.length];
      if (st.corr[i] > 0) st.pend[i * 3 + fi] += RULES.purgeWP * perCapita(st);
      else st.pendP[i * 3 + fi] += RULES.reinforceP * (st.roundFx.reinforce || 1) * perCapita(st) * 3;
    }
    ghostBuild(m, st, fi);
  }
}

export function canOutpost(m, st, fi, i) {
  const t = m.tiles[i];
  if (!PASSABLE(t) || t.terrain === 'exchange' || t.terrain === 'hq' || t.lair || st.settle[i] || st.corr[i] > 0) return { ok: false, why: st.corr[i] > 0 ? 'Corrupted: liberate it first.' : 'Not buildable.' };
  if (st.builds.some((b) => b.i === i)) return { ok: false, why: 'Already queued.' };
  if (st.owner[i] >= 0 && st.owner[i] !== fi) return { ok: false, why: 'Inside a rival border.' };
  const reach = st.owner[i] === fi && st.supplied[i] || t.nb.some((j) => j >= 0 && ((st.owner[j] === fi && st.supplied[j]) || m.tiles[j].terrain === 'exchange'));
  if (!reach) return { ok: false, why: 'Your supply does not reach it.' };
  const cost = Math.round(RULES.outpostCost * (st.roundFx.dip ? 0.5 : 1));
  if (st.fac[fi].supply < cost) return { ok: false, why: `Needs ${cost} Supply (have ${Math.floor(st.fac[fi].supply)}).`, cost };
  return { ok: true, cost };
}
export function placeOutpost(m, st, fi, i, free = false) {
  const c = canOutpost(m, st, fi, i); if (!c.ok && !(free && c.cost)) return c;
  if (!free) st.fac[fi].supply -= c.cost;
  st.builds.push({ f: fi, i }); return { ok: true };
}
function ghostBuild(m, st, fi) {
  if (st.fac[fi].supply < RULES.outpostCost + 5 || st.builds.filter((b) => b.f === fi).length >= 2) return;
  let best = -1, bs = -Infinity;
  for (const t of m.tiles) {
    if (!canOutpost(m, st, fi, t.i).ok) continue;
    if (m.tiles.some((o) => ((st.settle[o.i] && st.settle[o.i].f === fi) || st.builds.some((b) => b.i === o.i)) && hexDist(o, t) < 3)) continue;
    const s = (t.res || t.lux ? 3 : 0) + (t.lmk ? 5 : 0) + (t.pass ? 2 : 0) + t.nb.filter((j) => j >= 0 && st.corr[j] === 0 && st.owner[j] < 0).length * 0.4 + srng(st);
    if (s > bs) { bs = s; best = t.i; }
  }
  if (best >= 0) { placeOutpost(m, st, fi, best); ghostBuild(m, st, fi); }
}

// ownership, contest, supply
export function recompute(m, st) {
  const T = m.tiles, n = T.length, rad = new Array(n * 3).fill(0);
  for (const t of T) { const s = st.settle[t.i]; if (!s) continue; const def = SETTLE[s.type];
    for (const o of T) { const d = hexDist(t, o); if (d > def.rad) continue; const v = def.S - d - (s.cut && s.type !== 'hq' ? 2 : 0); if (v > rad[o.i * 3 + s.f]) rad[o.i * 3 + s.f] = v; } }
  st.rad = rad;
  for (const t of T) {
    const i = t.i; st.contested[i] = false;
    if (!PASSABLE(t) || t.terrain === 'exchange') { st.owner[i] = -1; continue; }
    if (t.terrain === 'hq') { st.owner[i] = t.hq; continue; }
    const P = [0, 1, 2].map((f) => rad[i * 3 + f] + st.bank[i * 3 + f]);
    const order = [0, 1, 2].sort((a, b) => P[b] - P[a]), top = order[0];
    const was = st.owner[i];
    const eligible = st.corr[i] === 0 || (st.corr[i] === 1 && was >= 0);
    if (!eligible) { st.owner[i] = -1; continue; }
    if (P[top] >= RULES.own && P[top] - P[order[1]] >= RULES.lead) st.owner[i] = top;
    else if (P[top] >= RULES.own && P[order[1]] >= RULES.own) { st.contested[i] = true; st.owner[i] = -1; }
    else st.owner[i] = -1;
  }
  // supply: BFS from HQ + Exchange through own tiles
  st.supplied.fill(false); st.parent.fill(-1);
  for (let fi = 0; fi < 3; fi++) {
    const q = [m.hqs[fi]], seen = new Set(q); st.supplied[m.hqs[fi]] = true;
    while (q.length) {
      const u = q.shift();
      for (const v of T[u].nb) {
        if (v < 0 || seen.has(v)) continue;
        const ex = T[v].terrain === 'exchange';
        if (!ex && st.owner[v] !== fi) continue;
        seen.add(v); q.push(v);
        if (!ex) { st.supplied[v] = true; st.parent[v] = u; }
      }
    }
  }
  for (let i = 0; i < n; i++) { const s = st.settle[i]; if (s) s.cut = s.type !== 'hq' && !st.supplied[i]; }
}

export function tileYield(m, st, i) {
  const t = m.tiles[i], o = st.owner[i]; if (o < 0 || !st.supplied[i]) return { supply: 0, alloy: 0 };
  const tr = TERRAIN[t.terrain]; let s = tr.supply + (t.riverN ? 1 : 0), a = tr.alloy;
  if (st.corr[i] === 1) { s /= 2; a /= 2; }
  return { supply: s, alloy: a };
}

function drawCard(st, suit, stars) {
  const S = suit || ['bull', 'bear', 'crab', 'chaos', 'field'][Math.floor(Math.pow(srng(st), 0.9) * 5)];
  const list = SUITS[S], pick = list[Math.floor(srng(st) * list.length)].split('|');
  const st2 = stars || (S === 'chaos' ? 2 : S === 'field' || S === 'crab' ? 1 : 1 + Math.floor(srng(st) * 3));
  return { suit: S, stars: st2, name: pick[0], text: pick[1] };
}

const LAND = (m, i) => { const t = m.tiles[i]; return PASSABLE(t) && t.terrain !== 'exchange' && t.terrain !== 'hq'; };

// one world round (the tick). market: optional {suit, stars} from the live feed
export function advanceRound(m, st, market = null) {
  const T = m.tiles, n = T.length, sum = { round: st.round, events: [], outbreaks: 0, liberated: 0, lost: 0 };
  const log = (s) => sum.events.push(s);
  // 1. event card
  const card = drawCard(st, market && market.suit, market && market.stars); st.card = card;
  const mag = 1 + 0.5 * (card.stars - 1), fx = {};
  log(`Card: ${card.suit.toUpperCase()} ${'★'.repeat(card.stars)} ${card.name}`);
  // 2-3. pending WP and pressure
  const before = st.owner.slice();
  for (let i = 0; i < n; i++) {
    let tot = 0; for (let f = 0; f < 3; f++) tot += st.pend[i * 3 + f];
    if (tot > 0) {
      if (st.corr[i] > 0) {
        st.prog[i] += tot;
        const floor = T[i].lair && st.round < RULES.lairWeekFrom ? 3 : 0;
        while (st.prog[i] >= RULES.levelWP && st.corr[i] > floor) { st.prog[i] -= RULES.levelWP; st.corr[i]--; sum.cleared = (sum.cleared || 0) + 1; }
        if (st.corr[i] === 0) {
          st.cb[i] = -1; const left = st.prog[i]; st.prog[i] = 0; sum.liberated++;
          for (let f = 0; f < 3; f++) st.bank[i * 3 + f] += (left * st.pend[i * 3 + f] / tot) * RULES.wpToPressure + (st.pend[i * 3 + f] > 0 ? RULES.claim * st.pend[i * 3 + f] / tot : 0);
          const fBest = [0, 1, 2].sort((a, b) => st.pend[i * 3 + b] - st.pend[i * 3 + a])[0]; st.fac[fBest].liberated++;
        }
        if (floor === 3) st.prog[i] = Math.min(st.prog[i], RULES.levelWP - 1);
      } else for (let f = 0; f < 3; f++) st.bank[i * 3 + f] += st.pend[i * 3 + f] * RULES.wpToPressure;
    }
    for (let f = 0; f < 3; f++) { st.bank[i * 3 + f] += st.pendP[i * 3 + f]; st.pend[i * 3 + f] = 0; st.pendP[i * 3 + f] = 0; }
  }
  // card effects that act at the tick
  if (card.name === 'Liquidation Cascade') for (let f = 0; f < 3; f++) { let far = -1; for (let i = 0; i < n; i++) if (st.owner[i] === f && !st.settle[i] && (far < 0 || m.dist[f][i] > m.dist[f][far])) far = i; if (far >= 0) { st.bank[far * 3 + f] = Math.max(0, st.bank[far * 3 + f] - 3 * mag); log(`${FACTIONS[f].short} overextended at ${tileName(m, far)}: −${3 * mag} P`); } }
  if (card.name === 'Theta Decay') fx.decay = 2;
  if (card.name === 'Black Swan') { const ls = Object.values(m.landmarks).filter((i) => st.owner[i] >= 0); if (ls.length) { const i = ls[Math.floor(srng(st) * ls.length)]; for (let f = 0; f < 3; f++) st.bank[i * 3 + f] = 0; log(`Black Swan at ${tileName(m, i)}`); } }
  // decay
  for (let k = 0; k < n * 3; k++) st.bank[k] *= 1 - RULES.decay * (fx.decay || 1);
  // 4. builds
  for (const b of st.builds) {
    if (st.corr[b.i] === 0 && !st.settle[b.i] && (st.owner[b.i] < 0 || st.owner[b.i] === b.f)) { st.settle[b.i] = { f: b.f, type: 'outpost', age: 0 }; log(`${FACTIONS[b.f].short} outpost at ${tileName(m, b.i)}`); }
    else st.fac[b.f].supply += RULES.outpostCost / 2;
  }
  st.builds = [];
  if (card.name === 'Refugees') { const cnt = [0, 1, 2].map((f) => st.owner.filter((o) => o === f).length), weak = cnt.indexOf(Math.min(...cnt)); const c = T.filter((t) => canOutpost(m, { ...st, fac: st.fac.map(() => ({ supply: 999 })) }, weak, t.i).ok); if (c.length) { const t = c[Math.floor(srng(st) * c.length)]; st.settle[t.i] = { f: weak, type: 'outpost', age: 0 }; log(`Refugees found ${FACTIONS[weak].short} an outpost`); } }
  recompute(m, st);
  // settlements: age/upgrade, razed if lost
  for (let i = 0; i < n; i++) {
    const s = st.settle[i]; if (!s || s.type === 'hq') continue;
    if (st.owner[i] !== s.f && st.corr[i] >= 2) { log(`${FACTIONS[s.f].short} ${SETTLE[s.type].name} razed at ${tileName(m, i)}`); st.settle[i] = null; continue; }
    if (st.owner[i] === s.f) { s.age++; const d = SETTLE[s.type]; if (d.next && s.age >= d.after) { s.type = d.next; s.age = 0; log(`${FACTIONS[s.f].short} ${SETTLE[s.type].name} at ${tileName(m, i)}`); } }
  }
  recompute(m, st);
  // 5. yields
  for (let f = 0; f < 3; f++) {
    let s = 0, a = 0; for (let i = 0; i < n; i++) if (st.owner[i] === f) { const y = tileYield(m, st, i); s += y.supply; a += y.alloy; }
    if (st.owner[m.landmarks.mint] === f && st.supplied[m.landmarks.mint]) s *= 1.15;
    if (card.name === 'Number Go Up') s *= 1 + 0.25 * mag; if (card.name === 'The Halving') s *= 0.5; if (st.longNight > 0) s *= 0.75;
    if (card.name === 'Supply Convoy') s += 15;
    st.fac[f].supply += s; st.fac[f].income = s; st.fac[f].alloy = a;
  }
  if (card.name === 'Funding Rate') { const cnt = [0, 1, 2].map((f) => st.owner.filter((o) => o === f).length), big = cnt.indexOf(Math.max(...cnt)), small = cnt.indexOf(Math.min(...cnt)); if (big !== small) { const x = st.fac[big].supply * 0.1; st.fac[big].supply -= x; st.fac[small].supply += x; log(`Funding: ${FACTIONS[big].short} pays ${x.toFixed(0)} to ${FACTIONS[small].short}`); } }
  if (st.longNight > 0) st.longNight--;
  // 6. enemy turn
  enemyTurn(m, st, card, mag, sum, log);
  recompute(m, st);
  for (let i = 0; i < n; i++) { if (before[i] >= 0 && st.owner[i] !== before[i]) { st.fac[before[i]].lost++; sum.lost++; } }
  // next round
  st.roundFx = {};
  if (card.name === 'Sideways Grind') st.roundFx.wpMult = 1.2; if (card.name === 'Airdrop Season') st.roundFx.wpMult = 1.1;
  if (card.name === 'FOMO Rally') st.roundFx.reinforce = 2; if (card.name === 'Buy the Dip') st.roundFx.dip = true;
  if (card.name === 'Flash Wick') st.roundFx.hold = -0.15; if (card.name === 'Ghost Reinforcements') st.roundFx.hold = 0.15;
  st.round++;
  const tally = snapshot(m, st); st.hist.push(tally); sum.tally = tally;
  st.log.unshift(sum); if (st.log.length > 40) st.log.pop();
  return sum;
}

export function snapshot(m, st) {
  const T = m.tiles, owned = [0, 0, 0], cor = [0, 0, 0], lv = [0, 0, 0], wild = { n: 0 };
  for (const t of T) { if (!LAND(m, t.i)) continue; if (st.owner[t.i] >= 0) owned[st.owner[t.i]]++; if (st.corr[t.i] > 0) { cor[t.biome]++; lv[t.biome] += st.corr[t.i]; } else if (st.owner[t.i] < 0) wild.n++; }
  const landPer = [0, 1, 2].map((b) => T.filter((t) => LAND(m, t.i) && t.biome === b).length);
  return { round: st.round, owned, corrupted: cor, levels: lv, landPer, wild: wild.n, outbreaks: st.outbreakTotal, supply: st.fac.map((f) => Math.round(f.supply)) };
}

export function frontier(m, st, b) {
  const T = m.tiles, out = [];
  for (const t of T) {
    const i = t.i; if (!LAND(m, i) || t.lair) continue;
    const c = st.corr[i];
    if (c > 0 && st.cb[i] === b) { if (t.nb.some((j) => j >= 0 && PASSABLE(T[j]) && st.corr[j] === 0)) out.push(i); }
    else if (c === 0 && t.nb.some((j) => j >= 0 && st.corr[j] > 0 && st.cb[j] === b)) out.push(i);
  }
  return out;
}

function corrupt(m, st, i, b, sum, log, depth = 0, chain = null) {
  if (!LAND(m, i) || m.tiles[i].lair) return;
  if (st.corr[i] < 3) { if (st.corr[i] === 0) st.cb[i] = b; st.corr[i]++; sum.added = (sum.added || 0) + 1; sum.src = sum.src || {}; sum.src[depth ? 'outbreak' : 'card'] = (sum.src[depth ? 'outbreak' : 'card'] || 0) + 1; return; }
  // Outbreak: the tile is already at 3. Neighbours below 3 get +1; a neighbour at 3 chains only if it is itself on the front.
  chain = chain || new Set(); if (chain.has(i)) return; chain.add(i);
  st.outbreaks++; st.outbreakTotal++; sum.outbreaks++;
  log(`OUTBREAK (${BIOMES[b].enemy}) at ${tileName(m, i)}${depth ? ' (chain)' : ''}`);
  const T = m.tiles;
  for (const j of T[i].nb) {
    if (j < 0 || !LAND(m, j) || T[j].lair || chain.has(j)) continue;
    const onFront = st.corr[j] === 0 || T[j].nb.some((k) => k >= 0 && LAND(m, k) && st.corr[k] === 0);
    if (!onFront) continue; // outbreaks spill toward the front, not into the enemy's own hinterland
    if (st.corr[j] < 3) corrupt(m, st, j, b, sum, log, depth + 1, chain);
    else if (depth < RULES.chainDepth - 1) corrupt(m, st, j, b, sum, log, depth + 1, chain);
  }
}

function holdChance(st, i) { const s = st.settle[i]; let p = 0.35 + (s ? ({ outpost: 0.1, fort: 0.25, citadel: 0.4, hq: 0.9 })[s.type] : 0); return Math.max(0.05, Math.min(0.95, p + (st.roundFx.hold || 0))); }

function bfsStep(m, st, from, goalFn) {
  const T = m.tiles, prev = new Map([[from, -1]]), q = [from];
  while (q.length) { const u = q.shift(); if (u !== from && goalFn(u)) { let v = u; while (prev.get(v) !== from) v = prev.get(v); return { next: v, goal: u }; }
    for (const v of T[u].nb) if (v >= 0 && !prev.has(v) && PASSABLE(T[v]) && T[v].terrain !== 'exchange') { prev.set(v, u); q.push(v); } }
  return null;
}

function strike(m, st, p, i, sum, log) {
  const o = st.owner[i], name = p.type === 'horde' ? 'Horde' : 'Killbot Column';
  if (o >= 0 && srng(st) < holdChance(st, i)) { log(`${FACTIONS[o].short} garrison held ${tileName(m, i)} vs ${name}`); return; }
  if (o >= 0) st.bank[i * 3 + o] = Math.max(0, st.bank[i * 3 + o] - 3);
  const s = st.settle[i]; if (s && s.type !== 'hq') { s.type = s.type === 'citadel' ? 'fort' : s.type === 'fort' ? 'outpost' : s.type; }
  if (m.tiles[i].terrain !== 'hq') { st.corr[i] = Math.max(st.corr[i], 1); if (st.cb[i] < 0 || st.corr[i] === 1) st.cb[i] = p.b; }
  log(`${name} hit ${tileName(m, i)}${o >= 0 ? ' (' + FACTIONS[o].short + ')' : ''}`);
}

function enemyTurn(m, st, card, mag, sum, log) {
  const T = m.tiles, n = T.length;
  const cards = Math.min(5, 1 + Math.floor(st.pop / 150)) + (card.name === 'Capitulation' ? Math.round(2 * mag) : 0);
  st.pieces = st.pieces.filter((p) => p.type !== 'pod');
  for (let b = 0; b < 3; b++) {
    let f = frontier(m, st, b); if (!f.length) continue;
    let k = cards;
    if (b === 0 && f.some((i) => T[i].riverN && st.corr[i] > 0)) k++;
    for (let c = 0; c < k; c++) {
      f = frontier(m, st, b); if (!f.length) break;
      const w = f.map((i) => (b === 0 && (T[i].riverN || T[i].terrain === 'marsh') ? 2.2 : 1) * (b === 1 && T[i].nb.some((j) => j >= 0 && T[j].terrain === 'crystal') ? 1.6 : 1) * (st.owner[i] >= 0 ? 1.3 : 1));
      let s = 0; for (const x of w) s += x; let r = srng(st) * s, pick = f[0];
      for (let q = 0; q < f.length; q++) { r -= w[q]; if (r <= 0) { pick = f[q]; break; } }
      corrupt(m, st, pick, b, sum, log);
    }
  }
  // Rotlands: hordes form every 2 rounds on a corruption-3 frontier tile
  const settleOK = (i) => st.settle[i] && st.settle[i].type !== 'hq';
  if (st.round % 2 === 0) {
    const live = st.pieces.filter((p) => p.type === 'horde').length;
    const c = frontier(m, st, 0).filter((i) => st.corr[i] === 3 && st.cb[i] === 0);
    if (c.length && live < 2) { const i = c[Math.floor(srng(st) * c.length)]; st.pieces.push({ id: st.pieceId++, type: 'horde', b: 0, at: i, age: 0 }); log(`A Horde rises at ${tileName(m, i)}`); }
  }
  // Crash Site: drop pods near crystal fields, behind the lines
  const crystals = T.filter((t) => t.terrain === 'crystal' && st.cb[t.i] === 1 && st.corr[t.i] > 0);
  const pods = 1 + Math.floor(st.pop / 300);
  if (crystals.length) for (let k = 0; k < pods; k++) {
    const c = T.filter((t) => LAND(m, t.i) && !t.lair && st.corr[t.i] < 2 && crystals.some((x) => hexDist(x, t) <= 3));
    if (!c.length) break;
    const w = c.map((t) => (st.owner[t.i] >= 0 ? 3 : st.corr[t.i] === 0 ? 2 : 1));
    let s = 0; for (const x of w) s += x; let r = srng(st) * s, t = c[0]; for (let q = 0; q < c.length; q++) { r -= w[q]; if (r <= 0) { t = c[q]; break; } }
    sum.added = (sum.added || 0) + 2 - st.corr[t.i]; st.corr[t.i] = 2; st.cb[t.i] = 1; st.prog[t.i] = 0;
    st.pieces.push({ id: st.pieceId++, type: 'pod', b: 1, at: t.i, age: 0 }); log(`Drop Pod lands at ${tileName(m, t.i)}`);
  }
  // Foundry: factories (scrapyards at 3) build columns every 3 rounds; columns hunt the richest tile
  const factories = T.filter((t) => t.terrain === 'scrap' && st.cb[t.i] === 2 && st.corr[t.i] === 3);
  const richest = () => { let best = -1, bv = -1; for (let i = 0; i < n; i++) { if (st.owner[i] < 0 || T[i].terrain === 'hq') continue; const y = tileYield(m, st, i), v = y.supply + y.alloy * 1.2 + (T[i].res || T[i].lux ? 2 : 0) + (T[i].lmk ? 3 : 0); if (v > bv) { bv = v; best = i; } } return best; };
  const capCols = Math.min(4, 1 + Math.floor(factories.length / 3));
  if (factories.length && (st.round % 3 === 0 || card.name === 'Rug in the Foundry')) {
    const tg = richest();
    if (tg >= 0) {
      const fs = factories.slice().sort((a, b) => hexDist(a, T[tg]) - hexDist(b, T[tg]));
      const make = card.name === 'Rug in the Foundry' ? Math.min(fs.length, 2) : 1;
      for (let k = 0; k < make && st.pieces.filter((p) => p.type === 'column').length < capCols; k++) { st.pieces.push({ id: st.pieceId++, type: 'column', b: 2, at: fs[k].i, age: 0 }); log(`Factory at ${tileName(m, fs[k].i)} rolls out a Column`); }
    }
  }
  // move pieces
  for (const p of st.pieces) {
    if (p.type === 'pod') continue;
    p.age++;
    const goal = p.type === 'horde' ? (i) => settleOK(i) : (() => { const r = richest(); return (i) => i === r; })();
    if (goal(p.at)) { strike(m, st, p, p.at, sum, log); p.dead = true; continue; }
    const s = bfsStep(m, st, p.at, goal);
    if (!s) { if (p.age > 6) p.dead = true; continue; }
    p.at = s.next; p.target = s.goal;
    if (p.at === s.goal) { strike(m, st, p, p.at, sum, log); p.dead = true; }
  }
  st.pieces = st.pieces.filter((p) => !p.dead);
  if (st.outbreaks >= RULES.outbreakMax) { st.longNight = RULES.longNight; st.outbreaks = 0; log('THE LONG NIGHT: Supply −25% for 3 rounds'); }
}

export function tileName(m, i) {
  const t = m.tiles[i];
  if (t.lmk) return LANDMARKS[t.lmk].name;
  if (t.lair) return `${BIOMES[t.biome].name} Lair`;
  if (t.terrain === 'hq') return `${FACTIONS[t.hq].name} HQ`;
  if (t.terrain === 'exchange') return 'The Exchange';
  const code = ['RT', 'CS', 'FD'][t.biome];
  return `${code}-${String(t.q + m.R).padStart(2, '0')}${String(t.r + m.R).padStart(2, '0')}`;
}

// pure market -> suit (§2.8 approximation over the live /api/market snapshot)
export function suitFromMarket(snap) {
  if (!snap || !snap.ok || !snap.sol) return null;
  const s = snap.sol, vol = Math.max(0.02, s.vol || 0.05), z = (s.chg15m || 0) / (vol * Math.sqrt(15));
  let suit = 'field', stars = 1;
  if (vol > 0.18 || Math.abs(s.chg1m || 0) > 0.35) { suit = 'chaos'; stars = 2; }
  else if (z >= 1) suit = 'bull'; else if (z <= -1) suit = 'bear'; else if (Math.abs(z) < 0.5) suit = 'crab';
  if (suit === 'bull' || suit === 'bear') stars = Math.abs(z) >= 2.5 ? 3 : Math.abs(z) >= 1.5 ? 2 : 1;
  return { suit, stars, z };
}
