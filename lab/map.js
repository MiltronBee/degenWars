// degenWars · War Table lab renderer + sandbox UI. All rules live in map-core.js.
import * as C from './map-core.js';

const $ = (s, r = document) => r.querySelector(s);
const S3 = Math.sqrt(3);
const qs = new URLSearchParams(location.search);
const SEED = qs.get('seed') || 'season-1';
const R = Math.max(6, Math.min(10, +(qs.get('r') || 8)));

// ---------------------------------------------------------------- palette (art brief)
const P = { ivory: '#D4C9AD', rumber: '#A58F70', bumber: '#5C4838', ochre: '#AF9561', olive: '#62644C', oxide: '#864F3B', char: '#30312F', ash: '#898F8C', khaki: '#B6AD94', steel: '#485354', bone: '#DDD9CE', carbon: '#211E1B', cad: '#a8322a', warn: '#c0682b', mustard: '#b59a3a', brass: '#d2a75e' };
const TC = { // terrain: base + stroke palette (contaminated)
  wasteland: ['#9a8565', ['#A58F70', '#AF9561', '#8a7556', '#B6AD94', '#6e5a44']],
  city: ['#6b6559', ['#30312F', '#898F8C', '#5C4838', '#7d776a', '#A58F70']],
  forest: ['#55503d', ['#62644C', '#3f3c2e', '#5C4838', '#777256', '#30312F']],
  hills: ['#8c7a58', ['#AF9561', '#A58F70', '#6e5a44', '#B6AD94', '#62644C']],
  mountain: ['#4e4740', ['#30312F', '#5C4838', '#898F8C', '#6b6156', '#211E1B']],
  pass: ['#6f6150', ['#5C4838', '#898F8C', '#A58F70', '#30312F']],
  crater: ['#6e6252', ['#5C4838', '#30312F', '#898F8C', '#A58F70']],
  coast: ['#aea38a', ['#B6AD94', '#D4C9AD', '#A58F70', '#898F8C']],
  sea: ['#2b3d45', ['#34505a', '#22323a', '#45606a', '#485354', '#2f444d']],
  marsh: ['#5a5c3e', ['#62644C', '#4b4d33', '#6d6b3a', '#3a3d2c', '#7a7448']],
  crystal: ['#5d6d6a', ['#485354', '#6f8583', '#898F8C', '#3e4c4b', '#9aa9a3']],
  scrap: ['#6e4a38', ['#864F3B', '#5C4838', '#30312F', '#9a6a4a', '#898F8C']],
  exchange: ['#b9ad90', ['#D4C9AD', '#B6AD94', '#898F8C', '#A58F70']],
  hq: ['#8f7f62', ['#A58F70', '#B6AD94', '#5C4838']],
};
const FC = [ // faction: light, mid, dark  (index = core faction index: R, V, S)
  { l: '#c97a5c', m: '#b0573b', d: '#5e2a1b', name: 'Rust Bears' },
  { l: '#a9c2a2', m: '#7d9c78', d: '#3a5440', name: 'Verdigris Bulls' },
  { l: '#b7c6d4', m: '#8ba0b4', d: '#3c4c5c', name: 'Slate Crabs' },
];
const BC = [ // biome corruption: token face, wash, accent
  { face: '#3d3f24', wash: '#2e3015', acc: P.mustard },
  { face: '#26393b', wash: '#14272a', acc: '#86a7a8' },
  { face: '#3e2219', wash: '#2a120b', acc: P.warn },
];

// ---------------------------------------------------------------- model
let map, st, cam = { x: 0, y: 0, z: 20 }, sel = -1, actF = 1, placing = false, dirty = true;
let opts = { borders: true, supply: true, corr: true, labels: false, pressure: false, auto: true, live: true };
let market = null, tracked = null;
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, cache = null, cacheZ = 64, tex = {};

function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

function rnd(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function newMap() {
  const t0 = performance.now();
  map = C.generate({ seed: SEED, R });
  map.genMs = Math.round(performance.now() - t0);
  st = C.createState(map, { pop: 90 });
  $('#seedLbl').textContent = `${SEED} · r${R}`;
  buildCache();
  fit();
}

// ---------------------------------------------------------------- painted cache (static terrain)
function hexPath(c, x, y, s) { c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; c.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)); } c.closePath(); }
function boardExtent() { return { w: 3 * R + 2, h: S3 * (2 * R + 1) }; }

function buildCache() {
  cacheZ = R >= 10 ? 56 : R >= 9 ? 62 : 70;
  const ext = boardExtent(), pad = 1.2;
  const cw = Math.ceil((ext.w + pad * 2) * cacheZ), ch = Math.ceil((ext.h + pad * 2) * cacheZ);
  cache = document.createElement('canvas'); cache.width = cw; cache.height = ch;
  const c = cache.getContext('2d');
  c.translate(cw / 2, ch / 2); c.scale(cacheZ, cacheZ);
  const T = map.tiles;
  // board underlay (the grooves)
  for (const t of T) { hexPath(c, t.x, t.y, 1.04); c.fillStyle = '#1b1612'; c.fill(); }
  for (const t of T) paintHex(c, t);
  // coastline
  for (const t of T) { if (t.terrain !== 'sea') continue; t.nb.forEach((j) => { if (j < 0 || T[j].terrain === 'sea') return; const o = T[j], mx = (t.x + o.x) / 2, my = (t.y + o.y) / 2, dx = (o.x - t.x) / S3, dy = (o.y - t.y) / S3; c.beginPath(); c.moveTo(mx - dy * 0.55, my + dx * 0.55); c.lineTo(mx + dy * 0.55, my - dx * 0.55); stroke(c, '#d9d2bf', 0.05, 0.55); }); }
  // grooves
  c.lineJoin = 'round';
  for (const t of T) { hexPath(c, t.x, t.y, 0.985); c.strokeStyle = 'rgba(25,19,14,.62)'; c.lineWidth = 0.055; c.stroke(); }
  // impasto overlay
  if (tex.paint) {
    c.save(); c.beginPath(); for (const t of T) { for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; c[k ? 'lineTo' : 'moveTo'](t.x + 1.04 * Math.cos(a), t.y + 1.04 * Math.sin(a)); } c.closePath(); } c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.42;
    const pat = c.createPattern(tex.paint, 'repeat'); c.fillStyle = pat; c.fillRect(0, 0, cw, ch);
    c.restore(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  cache.off = { x: -cw / 2 / cacheZ, y: -ch / 2 / cacheZ, w: cw / cacheZ, h: ch / cacheZ };
}

function paintHex(c, t) {
  const r = rnd(C.hashSeed(map.seed + ':' + t.i)), [base, pal] = TC[t.terrain];
  c.save(); hexPath(c, t.x, t.y, 1.0); c.clip();
  c.fillStyle = base; c.fillRect(t.x - 1.1, t.y - 1.1, 2.2, 2.2);
  // contamination from neighbours: wash of each neighbour colour toward that edge
  t.nb.forEach((j, d) => { if (j < 0) return; const o = map.tiles[j]; if (o.terrain === t.terrain) return;
    const g = c.createLinearGradient(t.x, t.y, (t.x + o.x) / 2, (t.y + o.y) / 2); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, TC[o.terrain][0] + '88');
    c.fillStyle = g; c.fillRect(t.x - 1.1, t.y - 1.1, 2.2, 2.2); });
  // gestural strokes with directional energy
  const flow = (t.wedge * 2.1 + (t.terrain === 'sea' ? 0 : 0.6)) + (r() - 0.5) * 0.8;
  c.lineCap = 'round';
  const n = t.terrain === 'sea' ? 26 : 34;
  for (let k = 0; k < n; k++) {
    const x = t.x + (r() - 0.5) * 1.9, y = t.y + (r() - 0.5) * 1.8, a = (t.terrain === 'sea' ? 0 : flow) + (r() - 0.5) * 0.9, L = 0.18 + r() * 0.45;
    c.strokeStyle = pal[Math.floor(r() * pal.length)]; c.globalAlpha = 0.25 + r() * 0.45; c.lineWidth = 0.04 + r() * 0.12;
    c.beginPath(); c.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2);
    c.quadraticCurveTo(x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.12, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); c.stroke();
  }
  c.globalAlpha = 1;
  MOTIF[t.terrain] && MOTIF[t.terrain](c, t, r);
  // chiaroscuro: light from upper-left, the lamp
  const g = c.createLinearGradient(t.x - 0.9, t.y - 0.9, t.x + 0.9, t.y + 0.9); g.addColorStop(0, 'rgba(240,220,170,.10)'); g.addColorStop(1, 'rgba(10,6,3,.22)');
  c.fillStyle = g; c.fillRect(t.x - 1.1, t.y - 1.1, 2.2, 2.2);
  c.restore();
}

const stroke = (c, col, w, a = 1) => { c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = a; c.stroke(); c.globalAlpha = 1; };
const MOTIF = {
  wasteland(c, t, r) { for (let k = 0; k < 3; k++) { let x = t.x + (r() - 0.5) * 1.2, y = t.y + (r() - 0.5) * 1.1; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.3) * 0.22; y += (r() - 0.5) * 0.22; c.lineTo(x, y); } stroke(c, '#3e3122', 0.025, 0.6); } },
  city(c, t, r) {
    for (let k = 0; k < 8; k++) {
      const x = t.x + (r() - 0.5) * 1.25, y = t.y + (r() - 0.5) * 1.1, w = 0.1 + r() * 0.17, h = 0.12 + r() * (k < 2 ? 0.55 : 0.28);
      c.fillStyle = r() < 0.5 ? '#2c2b28' : '#3d3a33'; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.lineTo(x + w * 0.55, y - h + (r() - 0.3) * 0.12); c.lineTo(x + w, y - h * (0.6 + r() * 0.4)); c.lineTo(x + w, y); c.closePath(); c.fill();
      c.globalAlpha = 0.5; c.fillStyle = '#c9bd9f'; c.fillRect(x, y - h, 0.025, h); c.globalAlpha = 1;
      if (r() < 0.5) { c.fillStyle = '#b6ad9466'; for (let q = 0; q < 3; q++) c.fillRect(x + 0.03 + r() * (w - 0.06), y - h * r(), 0.02, 0.02); }
    }
  },
  forest(c, t, r) { for (let k = 0; k < 10; k++) { const x = t.x + (r() - 0.5) * 1.3, y = t.y + (r() - 0.5) * 1.2 + 0.2, h = 0.22 + r() * 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 0.05, y - h); c.moveTo(x, y - h * 0.55); c.lineTo(x - 0.09, y - h * 0.8); c.moveTo(x, y - h * 0.4); c.lineTo(x + 0.1, y - h * 0.7); stroke(c, '#26231b', 0.03, 0.85); } },
  hills(c, t, r) { for (let k = 0; k < 3; k++) { const x = t.x + (r() - 0.5) * 0.9, y = t.y + (r() - 0.5) * 0.8 + 0.15, w = 0.35 + r() * 0.25; c.beginPath(); c.ellipse(x, y, w, w * 0.55, 0, Math.PI, 0); c.fillStyle = '#7a6a4c'; c.globalAlpha = 0.7; c.fill(); c.beginPath(); c.ellipse(x, y, w, w * 0.55, 0, Math.PI, Math.PI * 1.55); stroke(c, '#d1bf92', 0.05, 0.55); c.beginPath(); c.ellipse(x, y, w, w * 0.55, 0, Math.PI * 1.6, 0); stroke(c, '#3b2f22', 0.05, 0.6); c.globalAlpha = 1; } },
  mountain(c, t, r) {
    const peaks = 2 + Math.floor(r() * 2);
    for (let k = 0; k < peaks; k++) {
      const x = t.x + (k - (peaks - 1) / 2) * 0.55 + (r() - 0.5) * 0.15, b = t.y + 0.55, h = 0.85 + r() * 0.45, w = 0.42 + r() * 0.15, px = x + (r() - 0.5) * 0.15;
      c.beginPath(); c.moveTo(x - w, b); c.lineTo(px, b - h); c.lineTo(px + 0.02, b); c.closePath(); c.fillStyle = '#9b8b70'; c.fill();
      c.beginPath(); c.moveTo(px, b - h); c.lineTo(x + w, b); c.lineTo(px + 0.02, b); c.closePath(); c.fillStyle = '#2d2925'; c.fill();
      c.beginPath(); c.moveTo(px - 0.13, b - h + 0.2); c.lineTo(px, b - h); c.lineTo(px + 0.1, b - h + 0.16); c.fillStyle = '#ddd5c2'; c.globalAlpha = 0.8; c.fill(); c.globalAlpha = 1;
      c.beginPath(); c.moveTo(px, b - h); c.lineTo(px + 0.02, b); stroke(c, '#211e1b', 0.03, 0.7);
    }
  },
  pass(c, t, r) {
    MOTIF.mountain(c, { x: t.x - 0.62, y: t.y - 0.05 }, r); MOTIF.mountain(c, { x: t.x + 0.62, y: t.y - 0.05 }, r);
    c.beginPath(); c.moveTo(t.x, t.y - 0.95); c.bezierCurveTo(t.x + 0.2, t.y - 0.3, t.x - 0.2, t.y + 0.3, t.x, t.y + 0.95);
    c.setLineDash([0.09, 0.07]); stroke(c, '#e2d6b8', 0.07, 0.85); c.setLineDash([]);
  },
  crater(c, t, r) { const x = t.x + (r() - 0.5) * 0.3, y = t.y + (r() - 0.5) * 0.3, w = 0.5 + r() * 0.15; c.beginPath(); c.ellipse(x, y, w, w * 0.7, 0, 0, 7); c.fillStyle = '#2f2923'; c.globalAlpha = 0.75; c.fill(); c.globalAlpha = 1; c.beginPath(); c.ellipse(x, y, w, w * 0.7, 0, Math.PI * 0.05, Math.PI * 0.95); stroke(c, '#cdbb92', 0.07, 0.7); c.beginPath(); c.ellipse(x, y, w * 1.12, w * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9); stroke(c, '#1d1814', 0.06, 0.6); },
  coast(c, t, r) { t.nb.forEach((j, d) => { if (j < 0 || map.tiles[j].terrain !== 'sea') return; const o = map.tiles[j], mx = (t.x + o.x) / 2, my = (t.y + o.y) / 2; c.beginPath(); c.arc(mx, my, 0.55, 0, 7); c.fillStyle = '#3f4b4a'; c.globalAlpha = 0.9; c.fill(); c.beginPath(); c.arc(mx, my, 0.6, 0, 7); stroke(c, '#dcd3bd', 0.04, 0.6); c.globalAlpha = 1; }); },
  sea(c, t, r) { for (let k = 0; k < 6; k++) { const x = t.x + (r() - 0.5) * 1.4, y = t.y + (r() - 0.5) * 1.3; c.beginPath(); c.moveTo(x - 0.18, y); c.quadraticCurveTo(x - 0.06, y - 0.07, x, y); c.quadraticCurveTo(x + 0.08, y + 0.06, x + 0.18, y); stroke(c, '#9aa7a2', 0.025, 0.45); } },
  marsh(c, t, r) { for (let k = 0; k < 4; k++) { const x = t.x + (r() - 0.5) * 1.1, y = t.y + (r() - 0.5) * 1.0; c.beginPath(); c.ellipse(x, y, 0.16 + r() * 0.18, 0.07 + r() * 0.06, 0, 0, 7); c.fillStyle = '#2b3426'; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; } for (let k = 0; k < 9; k++) { const x = t.x + (r() - 0.5) * 1.3, y = t.y + (r() - 0.5) * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 0.06, y - 0.16); stroke(c, '#a39a5a', 0.02, 0.7); } },
  crystal(c, t, r) { for (let k = 0; k < 6; k++) { const x = t.x + (r() - 0.5) * 1.2, y = t.y + (r() - 0.5) * 1.1 + 0.1, h = 0.2 + r() * 0.35, w = 0.06 + r() * 0.07, lean = (r() - 0.5) * 0.2; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + lean, y - h); c.lineTo(x + w, y); c.closePath(); c.fillStyle = r() < 0.5 ? '#7d9896' : '#516867'; c.fill(); c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + lean, y - h); stroke(c, '#dfe3d9', 0.018, 0.75); } },
  scrap(c, t, r) { for (let k = 0; k < 6; k++) { const x = t.x + (r() - 0.5) * 1.2, y = t.y + (r() - 0.5) * 1.1; c.beginPath(); for (let q = 0; q < 5; q++) { const a = q / 5 * 6.28 + r() * 0.5, d = 0.07 + r() * 0.12; c.lineTo(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d); } c.closePath(); c.fillStyle = r() < 0.5 ? '#7a3e2a' : '#3a2a22'; c.fill(); }
    const gx = t.x + (r() - 0.5) * 0.6, gy = t.y + (r() - 0.5) * 0.6; c.beginPath(); c.arc(gx, gy, 0.14, 0, 7); stroke(c, '#2a211c', 0.05, 0.9); for (let q = 0; q < 8; q++) { const a = q / 8 * 6.28; c.beginPath(); c.moveTo(gx + Math.cos(a) * 0.14, gy + Math.sin(a) * 0.14); c.lineTo(gx + Math.cos(a) * 0.2, gy + Math.sin(a) * 0.2); stroke(c, '#2a211c', 0.05, 0.9); } },
  exchange(c, t, r) {
    for (let k = 0; k < 14; k++) { const x = t.x + (r() - 0.5) * 1.4, y = t.y + (r() - 0.5) * 1.3, w = 0.07 + r() * 0.09, h = 0.15 + r() * 0.35; c.fillStyle = r() < 0.5 ? '#3a3a35' : '#565550'; c.globalAlpha = 0.8; c.fillRect(x, y - h, w, h); c.fillStyle = '#e6dcc2'; c.globalAlpha = 0.5; c.fillRect(x, y - h, 0.018, h); c.globalAlpha = 1; }
    if (t.ring === 0) { c.beginPath(); c.moveTo(t.x - 0.2, t.y + 0.4); c.lineTo(t.x - 0.06, t.y - 0.95); c.lineTo(t.x + 0.06, t.y - 0.95); c.lineTo(t.x + 0.2, t.y + 0.4); c.closePath(); c.fillStyle = '#26231f'; c.fill(); c.fillStyle = P.brass; c.fillRect(t.x - 0.03, t.y - 0.9, 0.06, 0.25); }
  },
  hq(c, t, r) { hexPath(c, t.x, t.y, 0.62); c.fillStyle = '#4b4338'; c.fill(); hexPath(c, t.x, t.y, 0.62); stroke(c, '#cdbf9c', 0.04, 0.5); },
};

function drawRiver(c, rv) {
  const V = map.verts, pts = rv.path.map((v) => [V[v].x, V[v].y]);
  const line = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; c.quadraticCurveTo(pts[k][0], pts[k][1], mx, my); } const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  line(); stroke(c, '#1a1715', 0.3, 0.85);
  line(); stroke(c, '#4b5d5d', 0.19, 1);
  line(); stroke(c, '#7d908b', 0.07, 0.7);
  line(); c.setLineDash([0.12, 0.3]); stroke(c, '#dcd9ce', 0.025, 0.5); c.setLineDash([]);
}

// ---------------------------------------------------------------- frame / live layers
function resize() {
  const r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); dirty = true;
}
function fitZ() { const e = boardExtent(); return Math.min(W / (e.w + 2.4), H / (e.h + 2.4)); }
function fit() { cam.z = fitZ(); cam.x = 0; cam.y = 0; dirty = true; }
const toS = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
const toW = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
function pickTile(sx, sy) {
  const [x, y] = toW(sx, sy); const q = (2 / 3) * x, r = (-1 / 3) * x + (S3 / 3) * y;
  let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r); const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
  const t = map.tiles.find((t) => t.q === rx && t.r === rz); return t ? t.i : -1;
}
const detailA = () => Math.max(0, Math.min(1, (cam.z - 26) / 16));

function draw() {
  dirty = false;
  const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
  const z = cam.z, da = detailA(), T = map.tiles;
  // table (world-anchored)
  c.fillStyle = '#1e150f'; c.fillRect(-90, -90, 180, 180);
  if (tex.table) { const e = boardExtent(), sz = Math.max(e.w, e.h) * 2.4; c.drawImage(tex.table, -sz / 2, -sz / 2, sz, sz); }
  drawFrame(c);
  // terrain
  c.drawImage(cache, cache.off.x, cache.off.y, cache.off.w, cache.off.h);
  // strategic simplification wash
  if (da < 1) { c.globalAlpha = (1 - da) * 0.5; for (const t of T) { if (t.terrain === 'sea' || t.terrain === 'pass' || t.terrain === 'mountain') continue; hexPath(c, t.x, t.y, 0.97); c.fillStyle = TC[t.terrain][0]; c.fill(); } c.globalAlpha = 1; }
  // corruption shadow + borders
  for (const t of T) {
    const i = t.i, cr = st.corr[i];
    if (cr > 0 && opts.corr) { hexPath(c, t.x, t.y, 0.97); c.fillStyle = BC[st.cb[i] >= 0 ? st.cb[i] : t.biome].wash; c.globalAlpha = 0.16 + 0.13 * cr + (1 - da) * 0.12; c.fill(); c.globalAlpha = 1; }
    const o = st.owner[i];
    if (opts.borders && o >= 0) { hexPath(c, t.x, t.y, 0.97); c.fillStyle = FC[o].m; c.globalAlpha = 0.22 + (1 - da) * 0.3 - (st.supplied[i] ? 0 : 0.08); c.fill(); c.globalAlpha = 1; }
    if (opts.borders && st.contested[i]) hatch(c, t);
  }
  for (const rv of map.rivers) drawRiver(c, rv);
  if (opts.borders) drawBorders(c);
  if (opts.supply) drawSupply(c, da);
  // icons
  for (const t of T) {
    if (da > 0.05) { c.globalAlpha = da; if (t.res) resIcon(c, t, t.res); if (t.lux) luxIcon(c, t); c.globalAlpha = 1; }
    if (t.lmk) lmkIcon(c, t, da);
  }
  for (const t of T) {
    if (opts.corr && st.corr[t.i] > 0 && !t.lair) tokens(c, t, st.corr[t.i], st.cb[t.i] >= 0 ? st.cb[t.i] : t.biome, da);
    if (t.lair) lairIcon(c, t);
    const s = st.settle[t.i]; if (s) piece(c, t, s, da);
  }
  for (const p of st.pieces) enemyPiece(c, p, da);
  // pending effort markers & outposts under construction
  for (const b of st.builds) { const t = T[b.i]; c.setLineDash([0.12, 0.08]); hexPath(c, t.x, t.y, 0.7); stroke(c, FC[b.f].l, 0.07, 0.9); c.setLineDash([]); }
  if (da > 0.3) for (const t of T) { let p = 0; for (let f = 0; f < 3; f++) p += st.pend[t.i * 3 + f]; if (p > 0.5) pendMark(c, t, p, da); }
  if (opts.labels && da > 0.5 || opts.pressure && da > 0.4) for (const t of T) label(c, t, da);
  // selection
  if (sel >= 0) { const t = T[sel]; hexPath(c, t.x, t.y, 0.98); stroke(c, '#1a120b', 0.2, 0.9); hexPath(c, t.x, t.y, 0.98); stroke(c, P.brass, 0.09, 1); }
  c.restore();
  // lamp: warm pool, falling into umber dark at the edges
  const g = c.createRadialGradient(W * 0.46, H * 0.42, Math.min(W, H) * 0.15, W / 2, H / 2, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(255,214,150,0.05)'); g.addColorStop(0.55, 'rgba(20,12,6,0.10)'); g.addColorStop(1, 'rgba(8,5,3,0.78)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  $('#lvl').textContent = da >= 0.5 ? 'TILE DETAIL' : 'STRATEGIC';
}

function drawFrame(c) {
  // outer carved frame: a big hexagon around the board, brass rail inside
  const k = R + 1.25, pts = []; for (let q = 0; q < 6; q++) { const [dq, dr] = C.DIRS[q]; const [x, y] = C.toXY(dq * k, dr * k); pts.push([x * 1.0, y * 1.0]); }
  // corners of the axial ring are at the board's corner hexes; draw a hexagon through them, slightly expanded
  const poly = (s) => { c.beginPath(); pts.forEach(([x, y], q) => (q ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.closePath(); };
  c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 40; poly(1.06); c.fillStyle = '#2a1d14'; c.fill(); c.restore();
  poly(1.06); stroke(c, '#140e0a', 0.35, 1);
  poly(1.0); c.fillStyle = '#1b1612'; c.fill();
  poly(1.0); stroke(c, '#8a6a3c', 0.12, 0.9); poly(0.985); stroke(c, '#e0bf7a', 0.025, 0.45);
  // stencil serials on the frame
  c.save(); c.fillStyle = 'rgba(210,167,94,.55)'; c.font = '0.42px "Courier New",monospace'; c.textAlign = 'center';
  const [x0, y0] = pts[2]; c.fillText(`WT-${R}/${String(C.hashSeed(map.seed) % 9000 + 1000)} · ${map.tiles.length} HEX`, 0, y0 * 1.03 - 0.1); c.restore();
}

function hatch(c, t) { c.save(); hexPath(c, t.x, t.y, 0.95); c.clip(); c.beginPath(); for (let k = -2; k <= 2; k += 0.22) { c.moveTo(t.x + k - 1, t.y - 1); c.lineTo(t.x + k + 1, t.y + 1); } stroke(c, '#e6d9b8', 0.04, 0.45); c.restore(); }

function drawBorders(c) {
  const T = map.tiles;
  c.lineCap = 'round';
  for (const t of T) {
    const o = st.owner[t.i]; if (o < 0) continue;
    for (let k = 0; k < 6; k++) {
      // edge between corners k and k+1 faces neighbour at angle 60k+30
      const a = (Math.PI / 3) * k + Math.PI / 6, nx = t.x + S3 * Math.cos(a), ny = t.y + S3 * Math.sin(a);
      const j = t.nb.find((jj) => jj >= 0 && Math.abs(T[jj].x - nx) < 1e-3 && Math.abs(T[jj].y - ny) < 1e-3);
      if (j !== undefined && st.owner[j] === o) continue;
      const a0 = (Math.PI / 3) * k, a1 = a0 + Math.PI / 3, s = 0.9;
      const x0 = t.x + s * Math.cos(a0), y0 = t.y + s * Math.sin(a0), x1 = t.x + s * Math.cos(a1), y1 = t.y + s * Math.sin(a1);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, FC[o].d, 0.2, 0.9);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, FC[o].l, 0.1, st.supplied[t.i] ? 1 : 0.55);
    }
  }
}

function drawSupply(c, da) {
  const T = map.tiles;
  c.lineCap = 'round';
  for (const t of T) {
    const p = st.parent[t.i]; if (p < 0 || st.owner[t.i] < 0) continue;
    const isSettle = st.settle[t.i];
    if (!isSettle && da < 0.4) continue;
    c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(T[p].x, T[p].y); c.setLineDash([0.08, 0.1]); stroke(c, '#e8cf8e', isSettle ? 0.07 : 0.045, 0.55 + da * 0.2); c.setLineDash([]);
  }
  for (const t of T) { const s = st.settle[t.i]; if (s && s.cut) { c.beginPath(); c.moveTo(t.x - 0.3, t.y - 0.3); c.lineTo(t.x + 0.3, t.y + 0.3); c.moveTo(t.x + 0.3, t.y - 0.3); c.lineTo(t.x - 0.3, t.y + 0.3); stroke(c, P.cad, 0.12, 0.95); } }
}

function disc(c, x, y, r, face, rim) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = face; c.fill(); c.lineWidth = r * 0.22; c.strokeStyle = rim; c.stroke(); }
function tokens(c, t, n, b, da) {
  const bc = BC[b], r = 0.2 + (1 - da) * 0.04, x = t.x + (da > 0.5 ? 0.38 : 0), y0 = t.y + (da > 0.5 ? 0.3 : 0.12);
  for (let k = 0; k < n; k++) {
    const y = y0 - k * r * 0.55;
    c.beginPath(); c.ellipse(x, y + r * 0.25, r, r * 0.55, 0, 0, 7); c.fillStyle = '#0c0908'; c.fill();
    c.beginPath(); c.ellipse(x, y, r, r * 0.55, 0, 0, 7); c.fillStyle = bc.face; c.fill(); c.lineWidth = 0.035 + (1 - da) * 0.03; c.strokeStyle = da > 0.4 ? '#a98a52' : '#00000088'; c.stroke();
  }
  if (da > 0.4) { const y = y0 - (n - 1) * r * 0.55; c.globalAlpha = da; glyphBiome(c, x, y, r * 0.42, b, bc.acc); c.globalAlpha = 1; }
}
function glyphBiome(c, x, y, s, b, col) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.28;
  if (b === 0) { for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * s * 0.7, y - s * 0.5); c.lineTo(x + k * s * 0.7, y + s * 0.3); c.stroke(); } }
  else if (b === 1) { c.beginPath(); c.ellipse(x, y, s * 1.1, s * 0.4, 0, 0, 7); c.stroke(); c.beginPath(); c.arc(x, y, s * 0.25, 0, 7); c.fill(); }
  else { c.beginPath(); c.arc(x, y, s * 0.6, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.stroke(); }
}

function chip(c, x, y, r, fill = '#d8cba9') { c.beginPath(); c.arc(x, y + 0.03, r, 0, 7); c.fillStyle = '#0008'; c.fill(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = fill; c.fill(); c.lineWidth = 0.03; c.strokeStyle = '#3a2c1e'; c.stroke(); }
function resIcon(c, t, id) {
  const x = t.x - 0.4, y = t.y - 0.38; chip(c, x, y, 0.22, '#e3d6b2');
  c.fillStyle = '#2a2119'; c.strokeStyle = '#2a2119'; c.lineWidth = 0.035;
  if (id === 'fuel') { c.fillStyle = P.mustard; c.fillRect(x - 0.07, y - 0.12, 0.14, 0.22); c.strokeRect(x - 0.07, y - 0.12, 0.14, 0.22); c.fillStyle = '#2a2119'; c.fillRect(x - 0.035, y - 0.16, 0.07, 0.04); }
  else if (id === 'xeno') { c.beginPath(); c.moveTo(x, y - 0.15); c.lineTo(x + 0.09, y); c.lineTo(x, y + 0.14); c.lineTo(x - 0.09, y); c.closePath(); c.fillStyle = '#5f8b88'; c.fill(); c.stroke(); }
  else { c.beginPath(); c.moveTo(x - 0.12, y + 0.09); c.lineTo(x - 0.03, y - 0.1); c.lineTo(x + 0.04, y + 0.02); c.lineTo(x + 0.12, y - 0.06); c.lineTo(x + 0.12, y + 0.09); c.closePath(); c.fillStyle = P.oxide; c.fill(); c.stroke(); }
  if (t.fair !== null && t.fair !== undefined) { c.beginPath(); c.arc(x, y, 0.25, 0, 7); c.strokeStyle = FC[t.fair].m; c.lineWidth = 0.035; c.stroke(); }
}
function luxIcon(c, t) {
  const x = t.x + 0.42, y = t.y - 0.38; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#0008'; c.fillRect(-0.15, -0.12, 0.3, 0.3); c.fillStyle = '#cdb98a'; c.fillRect(-0.16, -0.16, 0.32, 0.32); c.strokeStyle = '#3a2c1e'; c.lineWidth = 0.03; c.strokeRect(-0.16, -0.16, 0.32, 0.32); c.restore();
  c.fillStyle = '#3a2c1e'; c.font = 'bold 0.2px "Courier New",monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText({ copium: 'C', ledger: 'L', servers: 'S', bonded: 'B', press: 'P', hash: '#' }[t.lux], x, y + 0.01);
}
function lmkIcon(c, t, da) {
  const r = 0.36 + (1 - da) * 0.26, x = t.x, y = t.y - (da > 0.5 ? 0.05 : 0);
  c.beginPath(); c.arc(x, y + 0.05, r, 0, 7); c.fillStyle = '#000a'; c.fill();
  disc(c, x, y, r, '#2b241c', P.brass);
  c.strokeStyle = '#e6c47e'; c.fillStyle = '#e6c47e'; c.lineWidth = r * 0.12; const s = r * 0.55;
  switch (t.lmk) {
    case 'mothership': c.beginPath(); c.ellipse(x, y + s * 0.15, s * 1.1, s * 0.35, -0.2, 0, 7); c.stroke(); c.beginPath(); c.arc(x, y - s * 0.1, s * 0.4, Math.PI, 0); c.stroke(); break;
    case 'oracle': c.beginPath(); c.ellipse(x, y, s, s * 0.55, 0, 0, 7); c.stroke(); c.beginPath(); c.arc(x, y, s * 0.28, 0, 7); c.fill(); break;
    case 'hospital': c.fillStyle = P.cad; c.fillRect(x - s * 0.2, y - s * 0.75, s * 0.4, s * 1.5); c.fillRect(x - s * 0.75, y - s * 0.2, s * 1.5, s * 0.4); break;
    case 'mint': for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(x, y + s * 0.5 - k * s * 0.38, s * 0.7, s * 0.22, 0, 0, 7); c.stroke(); } break;
    case 'dam': c.fillRect(x - s * 0.8, y - s * 0.6, s * 1.6, s * 0.5); c.beginPath(); for (let k = 0; k < 2; k++) { c.moveTo(x - s * 0.8, y + s * 0.25 + k * s * 0.35); c.quadraticCurveTo(x - s * 0.4, y + k * s * 0.35, x, y + s * 0.25 + k * s * 0.35); c.quadraticCurveTo(x + s * 0.4, y + s * 0.5 + k * s * 0.35, x + s * 0.8, y + s * 0.25 + k * s * 0.35); } c.stroke(); break;
    case 'lighthouse': c.beginPath(); c.moveTo(x - s * 0.3, y + s * 0.8); c.lineTo(x - s * 0.15, y - s * 0.5); c.lineTo(x + s * 0.15, y - s * 0.5); c.lineTo(x + s * 0.3, y + s * 0.8); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x, y - s * 0.6); c.lineTo(x + s, y - s * 0.95); c.lineTo(x + s, y - s * 0.3); c.closePath(); c.globalAlpha *= 0.5; c.fill(); c.globalAlpha = Math.min(1, c.globalAlpha * 2); break;
  }
}
function lairIcon(c, t) {
  const x = t.x, y = t.y, r = 0.52, bc = BC[t.biome];
  c.beginPath(); c.arc(x, y + 0.06, r, 0, 7); c.fillStyle = '#000b'; c.fill();
  disc(c, x, y, r, bc.face, '#6d5432');
  c.beginPath(); c.arc(x, y, r * 0.78, 0, 7); c.lineWidth = 0.035; c.strokeStyle = P.cad; c.stroke();
  // skull-ish lair mark
  c.fillStyle = '#d8ccb0'; c.beginPath(); c.arc(x, y - 0.06, 0.2, Math.PI, 0); c.lineTo(x + 0.15, y + 0.12); c.lineTo(x - 0.15, y + 0.12); c.closePath(); c.fill();
  c.fillStyle = bc.face; c.beginPath(); c.arc(x - 0.08, y - 0.04, 0.05, 0, 7); c.arc(x + 0.08, y - 0.04, 0.05, 0, 7); c.fill();
  c.fillStyle = P.cad; c.font = '0.17px "Courier New",monospace'; c.textAlign = 'center'; c.fillText('LAIR', x, y + 0.36);
}
// carved wooden faction piece
function piece(c, t, s, da) {
  const f = FC[s.f], big = s.type === 'hq' ? 1.25 : s.type === 'citadel' ? 1 : s.type === 'fort' ? 0.82 : 0.66, k = big * (0.42 + (1 - da) * 0.25);
  const x = t.x - (da > 0.5 && s.type !== 'hq' ? 0.25 : 0), y = t.y + 0.25 * k;
  c.beginPath(); c.ellipse(x + 0.06 * k, y + 0.1 * k, 0.55 * k, 0.2 * k, 0, 0, 7); c.fillStyle = 'rgba(8,5,3,.6)'; c.fill();
  const body = () => {
    c.beginPath();
    if (s.type === 'outpost') { c.moveTo(x - 0.4 * k, y); c.lineTo(x, y - 0.75 * k); c.lineTo(x + 0.4 * k, y); }
    else { const h = s.type === 'hq' ? 1.05 : s.type === 'citadel' ? 0.95 : 0.75; c.moveTo(x - 0.42 * k, y); c.lineTo(x - 0.32 * k, y - h * k); c.lineTo(x - 0.36 * k, y - h * k); c.lineTo(x - 0.36 * k, y - (h + 0.2) * k); c.lineTo(x - 0.16 * k, y - (h + 0.2) * k); c.lineTo(x - 0.16 * k, y - (h + 0.08) * k); c.lineTo(x + 0.16 * k, y - (h + 0.08) * k); c.lineTo(x + 0.16 * k, y - (h + 0.2) * k); c.lineTo(x + 0.36 * k, y - (h + 0.2) * k); c.lineTo(x + 0.36 * k, y - h * k); c.lineTo(x + 0.32 * k, y - h * k); c.lineTo(x + 0.42 * k, y); }
    c.closePath();
  };
  body(); c.fillStyle = f.m; c.fill();
  c.save(); body(); c.clip();
  c.fillStyle = f.d; c.globalAlpha = 0.55; c.fillRect(x + 0.05 * k, y - 1.5 * k, 0.6 * k, 1.6 * k); c.globalAlpha = 1; // shadow side
  c.strokeStyle = f.l; c.globalAlpha = 0.6; c.lineWidth = 0.05 * k; c.beginPath(); c.moveTo(x - 0.28 * k, y - 0.05 * k); c.lineTo(x - 0.25 * k, y - 1.1 * k); c.stroke(); // lamp highlight
  c.globalAlpha = 0.25; c.strokeStyle = '#000'; c.lineWidth = 0.02 * k; for (let q = 0; q < 4; q++) { c.beginPath(); c.moveTo(x - 0.4 * k, y - (0.2 + q * 0.22) * k); c.quadraticCurveTo(x, y - (0.28 + q * 0.22) * k, x + 0.4 * k, y - (0.18 + q * 0.22) * k); c.stroke(); } // wood grain
  c.restore(); c.globalAlpha = 1;
  body(); c.strokeStyle = '#150f0a'; c.lineWidth = 0.045 * k; c.stroke();
  if (s.type === 'hq') { c.fillStyle = '#f0e4c6'; c.font = `${0.32 * k}px Impact,"Arial Black",sans-serif`; c.textAlign = 'center'; c.fillText(C.FACTIONS[s.f].id, x, y - 0.35 * k); }
}
function enemyPiece(c, p, da) {
  const t = map.tiles[p.at], bc = BC[p.b], x = t.x + 0.05, y = t.y - 0.05, r = 0.3 + (1 - da) * 0.12;
  if (p.target !== undefined && p.type !== 'pod') { const g = map.tiles[p.target]; c.beginPath(); c.moveTo(x, y); c.lineTo(g.x, g.y); c.setLineDash([0.15, 0.12]); stroke(c, p.type === 'horde' ? P.mustard : P.warn, 0.06, 0.8); c.setLineDash([]); }
  c.save(); c.translate(x, y); c.rotate(p.type === 'column' ? Math.PI / 4 : 0);
  c.fillStyle = '#000a'; c.fillRect(-r + 0.04, -r + 0.06, 2 * r, 2 * r);
  c.fillStyle = bc.face; c.fillRect(-r, -r, 2 * r, 2 * r); c.lineWidth = 0.06; c.strokeStyle = '#b58f4f'; c.strokeRect(-r, -r, 2 * r, 2 * r);
  c.restore();
  c.fillStyle = p.type === 'horde' ? P.mustard : p.type === 'pod' ? '#9fc2bf' : P.warn; c.font = `bold ${r * 0.85}px "Courier New",monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(p.type === 'horde' ? 'H' : p.type === 'pod' ? 'P' : 'K', x, y + 0.01); c.textBaseline = 'alphabetic';
}
function pendMark(c, t, p, da) { const x = t.x - 0.45, y = t.y + 0.5; c.globalAlpha = da; c.fillStyle = '#1b130cdd'; c.fillRect(x - 0.3, y - 0.14, 0.6, 0.26); c.fillStyle = P.brass; c.font = '0.19px "Courier New",monospace'; c.textAlign = 'center'; c.fillText('▲' + Math.round(p), x, y + 0.05); c.globalAlpha = 1; }
function label(c, t, da) {
  if (!C.TERRAIN[t.terrain] || t.terrain === 'sea' || t.terrain === 'mountain') return;
  c.globalAlpha = da; c.fillStyle = 'rgba(239,228,207,.85)'; c.font = '0.16px "Courier New",monospace'; c.textAlign = 'center';
  let s = opts.labels ? C.tileName(map, t.i) : '';
  if (opts.pressure) { const p = [0, 1, 2].map((f) => (st.rad[t.i * 3 + f] + st.bank[t.i * 3 + f])); if (p.some((v) => v > 0.5)) s += (s ? ' ' : '') + p.map((v) => v.toFixed(0)).join('/'); }
  c.fillText(s, t.x, t.y + 0.78); c.globalAlpha = 1;
}

// ---------------------------------------------------------------- input: pan / pinch / wheel / tap
const ptrs = new Map(); let pan = null, pinch = null, downAt = null;
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); downAt = { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: false };
  if (ptrs.size === 1) pan = { x: e.offsetX, y: e.offsetY, cx: cam.x, cy: cam.y };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z, m: toW((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; pan = null; } });
cv.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (downAt && Math.hypot(e.offsetX - downAt.x, e.offsetY - downAt.y) > 6) downAt.moved = true;
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; cam.z = clampZ(pinch.z * d / pinch.d); cam.x = pinch.m[0] - (mx - W / 2) / cam.z; cam.y = pinch.m[1] - (my - H / 2) / cam.z; clampCam(); dirty = true; }
  else if (pan && downAt && downAt.moved) { cv.classList.add('drag'); cam.x = pan.cx - (e.offsetX - pan.x) / cam.z; cam.y = pan.cy - (e.offsetY - pan.y) / cam.z; clampCam(); dirty = true; } });
const up = (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); cv.classList.remove('drag');
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0 && downAt && !downAt.moved && performance.now() - downAt.t < 600 && e.type === 'pointerup') tap(e.offsetX, e.offsetY);
  if (ptrs.size === 1) { const [p] = [...ptrs.values()]; pan = { x: p[0], y: p[1], cx: cam.x, cy: cam.y }; } else pan = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
function clampZ(z) { return Math.max(fitZ() * 0.8, Math.min(150, z)); }
function clampCam() { const e = boardExtent(); cam.x = Math.max(-e.w / 2, Math.min(e.w / 2, cam.x)); cam.y = Math.max(-e.h / 2, Math.min(e.h / 2, cam.y)); }
function zoomAt(sx, sy, f) { const [wx, wy] = toW(sx, sy); cam.z = clampZ(cam.z * f); cam.x = wx - (sx - W / 2) / cam.z; cam.y = wy - (sy - H / 2) / cam.z; clampCam(); dirty = true; }
$('#zoom').addEventListener('click', (e) => { const z = e.target.dataset.z; if (z === 'in') zoomAt(W / 2, H / 2, 1.6); if (z === 'out') zoomAt(W / 2, H / 2, 1 / 1.6); if (z === 'fit') fit(); });

function tap(sx, sy) {
  const i = pickTile(sx, sy); if (i < 0) { sel = -1; dirty = true; return; }
  if (placing) { const r = C.placeOutpost(map, st, actF, i); toast(r.ok ? `${FC[actF].name}: outpost queued at ${C.tileName(map, i)} (resolves at the tick)` : r.why); if (r.ok) { placing = false; cv.classList.remove('place'); renderSand(); } }
  sel = i; dirty = true; renderTile(); showTab('tile', true);
}
// public hooks for tests
window.WT = { select: (i) => { sel = i; renderTile(); showTab('tile', true); dirty = true; }, zoomTo: (i, z) => { const t = map.tiles[i]; cam.x = t.x; cam.y = t.y; cam.z = z; dirty = true; }, rounds: (n) => { for (let k = 0; k < n; k++) doRound(); afterRound(); }, get map() { return map; }, get st() { return st; }, fit };

// ---------------------------------------------------------------- panel: tabs
function showTab(t, open) { if (t === 'sand') setTimeout(spark, 0); document.querySelectorAll('#tabs button[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'p-' + t)); if (open) setSheet(true); }
function setSheet(open) { $('#panel').classList.toggle('open', open); document.body.classList.toggle('sheet', open); $('#sheet').textContent = open ? '▾' : '▴'; setTimeout(() => { resize(); }, 220); }
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'sheet') return setSheet(!$('#panel').classList.contains('open')); showTab(b.dataset.t, true); });
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

// ---------------------------------------------------------------- tile card
function renderTile() {
  const el = $('#p-tile'); if (sel < 0) { el.innerHTML = '<div class="empty">Tap a hex to read its tile card.</div>'; return; }
  const t = map.tiles[sel], i = sel, tr = C.TERRAIN[t.terrain], biome = C.BIOMES[t.biome], c = st.corr[i], o = st.owner[i];
  const name = C.tileName(map, i), serial = `${['RT', 'CS', 'FD'][t.biome]}·${String(C.hashSeed(map.seed + i) % 90000 + 10000)}`;
  let state, stamp = '';
  if (t.terrain === 'exchange') state = 'NEUTRAL · NO BATTLES';
  else if (t.terrain === 'sea') state = 'SEA LANE';
  else if (t.terrain === 'mountain') state = 'IMPASSABLE';
  else if (t.lair) { state = `LAIR · ${biome.enemy.toUpperCase()}`; stamp = st.round >= C.RULES.lairWeekFrom ? 'LAIR WEEK' : `SEALED TO R${C.RULES.lairWeekFrom}`; }
  else if (c > 0 && o >= 0) state = `${FC[o].name.toUpperCase()} · INFESTED ${c}`;
  else if (c > 0) { state = `CORRUPTED ${'●'.repeat(c)}${'○'.repeat(3 - c)} · ${C.BIOMES[st.cb[i]].enemy.toUpperCase()}`; }
  else if (st.contested[i]) state = 'CONTESTED';
  else if (o >= 0) state = `${FC[o].name.toUpperCase()} · ${st.supplied[i] ? 'SUPPLIED' : 'SUPPLY CUT'}`;
  else state = 'WILD';
  if (o >= 0 && !st.supplied[i]) stamp = 'CUT OFF';
  const y = C.tileYield(map, st, i), riv = t.riverN ? ` (+1 Supply: river)` : '';
  const rows = [];
  rows.push(['Terrain', `${tr.name}${t.island ? ' (island)' : ''}${t.pass ? ' · chokepoint' : ''}`]);
  rows.push(['March', Number.isFinite(tr.march) ? `${tr.march} h/hex${t.riverN ? ' · river edges +1 h to cross' : ''}` : '—']);
  rows.push(['Battlefield', tr.mod]);
  if (C.PASSABLE_UI(t)) rows.push(['Base yield', `${tr.supply} Supply${tr.alloy ? ` · ${tr.alloy} Alloy` : ''}${riv}${o >= 0 ? ` · now ${y.supply.toFixed(1)}/${y.alloy.toFixed(1)}` : ''}`]);
  if (t.res) rows.push(['Strategic', `<b>${C.STRATEGIC[t.res].name}</b>: ${C.STRATEGIC[t.res].note}${t.fair != null ? ` <i>Fair kit of the ${FC[t.fair].name} (${map.dist[t.fair][i]} h from HQ).</i>` : ''}`]);
  if (t.lux) rows.push(['Luxury', `<b>${C.LUXURY[t.lux].name}</b>: ${C.LUXURY[t.lux].bonus}${t.fair != null && !t.res ? ` <i>Fair kit of the ${FC[t.fair].name}.</i>` : ''}`]);
  if (t.lmk) rows.push(['Landmark', `<b>${C.LANDMARKS[t.lmk].name}</b>: ${C.LANDMARKS[t.lmk].bonus}`]);
  const s = st.settle[i]; if (s) rows.push(['Settlement', `${FC[s.f].name} ${C.SETTLE[s.type].name}${s.type !== 'hq' ? ` (age ${s.age})` : ''}${s.cut ? ' · unsupplied, −2 Pressure' : ''}`]);
  if (map.dist && C.PASSABLE_UI(t)) rows.push(['From HQs', map.dist.map((d, f) => `${C.FACTIONS[f].short} ${Number.isFinite(d[i]) ? d[i] + 'h' : '—'}`).join(' · ')]);
  let pbar = '';
  if (C.PASSABLE_UI(t) && t.terrain !== 'exchange') {
    const pv = [0, 1, 2].map((f) => st.rad[i * 3 + f] + st.bank[i * 3 + f]), mx = Math.max(10, ...pv);
    pbar = pv.map((v, f) => `<div class="pbar"><span><b style="width:${(v / mx) * 100}%;background:${FC[f].m}"></b></span> ${C.FACTIONS[f].short} ${v.toFixed(1)}</div>`).join('');
  }
  let run = '';
  if (C.PASSABLE_UI(t) && t.terrain !== 'exchange' && t.terrain !== 'hq') {
    const pv = C.runPreview(map, st, i, actF), can = C.runnable(map, st, actF, i);
    run = `<div class="run"><b>A run here</b> (${FC[actF].name}): the <b>${pv.biome.name}</b> 30-wave campaign on a <b>${tr.name}</b> field, enemy stats ×${pv.diff.toFixed(2)}. A typical clear reaches wave ${pv.typical} → ${pv.raw.toFixed(0)} WP, worth ${pv.eff.toFixed(1)} after per-capita scaling at ${st.pop} actives.
      ${c > 0 ? `Removes 1 corruption per ${C.RULES.levelWP} WP: <b>≈${pv.runs} runs</b> to liberate (${Math.max(0, Math.round(pv.need))} WP left).` : `On a clean tile WP turns into Pressure 1:5 (+${pv.pressure.toFixed(2)} per run).`}
      ${can ? '' : '<br><i>Not reachable for this faction yet: runs must border your territory or the Exchange.</i>'}</div>`;
    const oc = C.canOutpost(map, st, actF, i);
    run += `<div class="row" style="margin-top:8px"><button class="btn pri" data-a="run1" ${can ? '' : 'disabled'}>Run here</button><button class="btn" data-a="run10" ${can ? '' : 'disabled'}>10 runs</button><button class="btn" data-a="out" ${oc.ok ? '' : 'disabled'} title="${oc.why || ''}">Outpost (${oc.cost || 30} Supply)</button></div>${oc.ok ? '' : `<div class="small" style="color:#5c4838">${oc.why}</div>`}`;
  }
  el.innerHTML = `<div class="card"><div class="serial"><span>FIELD CARD ${serial}</span><span>${t.q},${t.r}</span></div>
    <h2>${name}</h2><div class="sub">${biome.name} sector · ring ${t.ring}</div>${stamp ? `<div class="stamp">${stamp}</div>` : ''}
    <div class="st">${state}</div>
    <dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>${pbar ? `<div style="margin-top:8px">${pbar}</div>` : ''}${run}</div>`;
  el.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'run1' || a === 'run10') { const n = a === 'run1' ? 1 : 10; let w = 0; for (let k = 0; k < n; k++) w += C.queueRun(map, st, actF, i, 8 + Math.floor(Math.random() * 14)); toast(`${n} run${n > 1 ? 's' : ''} queued: +${w.toFixed(0)} WP pending, resolves at the tick`); }
    if (a === 'out') { const r = C.placeOutpost(map, st, actF, i); toast(r.ok ? 'Outpost queued' : r.why); }
    renderTile(); renderSand(); dirty = true;
  });
}

// ---------------------------------------------------------------- sandbox
function doRound() {
  if (opts.auto) C.autoPlay(map, st);
  const mk = opts.live && tracked ? tracked : null;
  C.advanceRound(map, st, mk);
}
function renderSand() {
  const el = $('#p-sand'), f = st.fac, card = st.card, last = st.log[0];
  el.innerHTML = `
  <h3>Acting faction</h3><div class="row">${C.FACTIONS.map((x, k) => `<button class="fpill ${k === actF ? 'on' : ''}" data-f="${k}"><i style="background:${FC[k].m}"></i>${x.short}S</button>`).join('')}</div>
  <h3>The round</h3>
  <div class="row"><button class="btn pri" id="b-r1">Advance round ▸</button><button class="btn" id="b-r10">10 rounds ▸▸</button><button class="btn" id="b-rst">Reset</button></div>
  <div class="row"><button class="btn" id="b-g10">Ghost runs ×10</button><button class="btn ${placing ? 'on' : ''}" id="b-place">Place outpost…</button></div>
  <div class="row"><label class="chk"><input type="checkbox" id="o-auto" ${opts.auto ? 'checked' : ''}> auto players</label>
    <span class="small">actives <b id="popv">${st.pop}</b></span><input type="range" id="pop" min="15" max="300" step="15" value="${st.pop}"></div>
  <div class="row"><label class="chk"><input type="checkbox" id="o-live" ${opts.live ? 'checked' : ''}> card suit from live SOL</label></div>
  <h3>Last event card</h3>
  ${card ? `<div class="event"><div class="suit s-${card.suit}">${card.suit.toUpperCase()} ${'★'.repeat(card.stars)}</div><b>${card.name}</b><div class="small" style="color:#3a2c1e">${card.text}</div></div>` : '<div class="dim small">No card yet: advance a round.</div>'}
  <h3>Overlays</h3><div class="row">${['borders', 'supply', 'corr', 'labels', 'pressure'].map((k) => `<label class="chk"><input type="checkbox" data-o="${k}" ${opts[k] ? 'checked' : ''}> ${k === 'corr' ? 'corruption' : k}</label>`).join('')}</div>
  <h3>Season so far</h3><canvas class="spark" id="spark"></canvas>
  <div class="leg" style="margin-top:4px">${C.FACTIONS.map((x, k) => `<span><i style="background:${FC[k].m}"></i>${x.short} tiles</span>`).join('')}${C.BIOMES.map((b, k) => `<span><i style="background:${BC[k].acc}"></i>${b.name} corrupted</span>`).join('')}</div>
  <h3>Round log</h3><div class="log">${st.log.slice(0, 6).map((s) => `<div><b>R${s.round}</b> · liberated ${s.liberated}, lost ${s.lost}, outbreaks ${s.outbreaks}<br>${s.events.slice(0, 7).join(' · ')}</div>`).join('') || '<div class="dim">—</div>'}</div>`;
  el.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { actF = +b.dataset.f; renderSand(); renderTile(); });
  $('#b-r1').onclick = () => { doRound(); afterRound(); };
  $('#b-r10').onclick = () => { for (let k = 0; k < 10; k++) doRound(); afterRound(); };
  $('#b-rst').onclick = () => { const pop = st.pop; st = C.createState(map, { pop }); sel = -1; afterRound(); };
  $('#b-g10').onclick = () => { const w = C.ghostRuns(map, st, actF, 10); toast(`${C.FACTIONS[actF].name}: 10 runs on the War Plan targets, +${w.toFixed(0)} WP pending`); dirty = true; };
  $('#b-place').onclick = () => { placing = !placing; cv.classList.toggle('place', placing); if (placing) { toast('Tap a wild hex next to your supplied border'); if (innerWidth <= 760) setSheet(false); } renderSand(); };
  $('#o-auto').onchange = (e) => (opts.auto = e.target.checked);
  $('#o-live').onchange = (e) => { opts.live = e.target.checked; updateBar(); };
  $('#pop').oninput = (e) => { st.pop = +e.target.value; $('#popv').textContent = st.pop; };
  el.querySelectorAll('[data-o]').forEach((b) => b.onchange = () => { opts[b.dataset.o] = b.checked; dirty = true; });
  spark();
}
function afterRound() { dirty = true; renderSand(); renderFac(); renderTile(); updateBar(); }
function spark() {
  const cvs = $('#spark'); if (!cvs) return; const r = cvs.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cvs.width = r.width * d; cvs.height = r.height * d;
  const c = cvs.getContext('2d'); c.scale(d, d); const w = r.width, h = r.height, H0 = st.hist; if (!H0.length) { c.fillStyle = '#5c4838'; c.font = '11px "Courier New"'; c.fillText('advance rounds to chart the season', 8, h / 2); return; }
  const land = H0[0].landPer, mx = Math.max(...land), x = (k) => 4 + (k / 83) * (w - 8);
  c.strokeStyle = '#3a2e22'; c.beginPath(); c.moveTo(x(C.RULES.lairWeekFrom - 1), 0); c.lineTo(x(C.RULES.lairWeekFrom - 1), h); c.stroke();
  const line = (vals, col, dash) => { c.beginPath(); vals.forEach((v, k) => { const yy = h - 4 - (v / mx) * (h - 8); k ? c.lineTo(x(k), yy) : c.moveTo(x(k), yy); }); c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke(); c.setLineDash([]); };
  for (let f = 0; f < 3; f++) line(H0.map((s) => s.owned[f]), FC[f].m);
  for (let b = 0; b < 3; b++) line(H0.map((s) => s.corrupted[b]), BC[b].acc, [3, 3]);
}

// ---------------------------------------------------------------- factions tab
function renderFac() {
  const snap = C.snapshot(map, st), T = map.tiles;
  const lm = (f) => Object.entries(map.landmarks).filter(([k, i]) => st.owner[i] === f).map(([k]) => C.LANDMARKS[k].name);
  const access = (f, id) => T.some((t) => t.res === id && st.owner[t.i] === f && st.supplied[t.i]);
  const lux = (f) => [...new Set(T.filter((t) => t.lux && st.owner[t.i] === f && st.supplied[t.i]).map((t) => C.LUXURY[t.lux].name))];
  $('#p-fac').innerHTML = C.FACTIONS.map((x, f) => {
    const fa = st.fac[f], settles = T.filter((t) => st.settle[t.i] && st.settle[t.i].f === f && st.settle[t.i].type !== 'hq');
    const vp = snap.owned[f] + lm(f).length * 5;
    return `<h3 style="color:${FC[f].l}">${x.name}</h3>
    <table><tr><th>tiles</th><th>supply</th><th>+/round</th><th>runs</th><th>VP</th></tr>
    <tr><td>${snap.owned[f]}</td><td>${Math.floor(fa.supply)}</td><td>${(fa.income || 0).toFixed(1)}</td><td>${fa.runs}</td><td>${vp}</td></tr></table>
    <div class="small" style="margin-top:4px">Strategic access: ${['fuel', 'xeno', 'rare'].map((id) => `<span class="${access(f, id) ? 'ok' : 'dim'}">${C.STRATEGIC[id].name} ${access(f, id) ? '✓' : '✗'}</span>`).join(' · ')}<br>
    Luxuries: ${lux(f).join(', ') || '<span class="dim">none</span>'}<br>Landmarks: ${lm(f).join(', ') || '<span class="dim">none</span>'}<br>
    Settlements: ${settles.map((t) => C.SETTLE[st.settle[t.i].type].name + (st.settle[t.i].cut ? ' (cut)' : '')).join(', ') || '<span class="dim">HQ only</span>'}</div>`;
  }).join('') + `<h3>Enemy</h3><div class="small">Outbreak track ${st.outbreaks}/8 (season total ${st.outbreakTotal})${st.longNight ? ' · <b class="bad">THE LONG NIGHT</b>' : ''}<br>
    Corrupted tiles: ${C.BIOMES.map((b, k) => `${b.name} ${snap.corrupted[k]}/${snap.landPer[k]} (${snap.levels[k]} levels)`).join(' · ')}<br>
    On the board: ${st.pieces.filter((p) => p.type === 'horde').length} Hordes · ${st.pieces.filter((p) => p.type === 'column').length} Killbot Columns · Factories ${T.filter((t) => t.terrain === 'scrap' && st.cb[t.i] === 2 && st.corr[t.i] === 3).length}</div>`;
}

// ---------------------------------------------------------------- map tab: generator, stats, fairness
function renderGen() {
  const s = map.stats, fr = map.fair, T = map.tiles;
  const terrs = Object.keys(C.TERRAIN).filter((k) => !['exchange', 'hq'].includes(k));
  const pb = s.perBiome;
  const pv = C.runPreview(map, st, map.lairs[0], 1);
  $('#p-gen').innerHTML = `
  <h3>Generator</h3>
  <div class="row"><input type="text" id="g-seed" value="${SEED}" style="flex:1;min-width:120px"><select id="g-r">${[6, 7, 8, 9, 10].map((r) => `<option ${r === R ? 'selected' : ''} value="${r}">r${r} · ${3 * r * r + 3 * r + 1} hex</option>`).join('')}</select></div>
  <div class="row"><button class="btn pri" id="g-go">Generate</button><button class="btn" id="g-rand">Random seed</button></div>
  <div class="small dim">Same seed → same map. Attempt ${map.attempt + 1} of 40 met every fairness rule · ${map.genMs} ms · ${C.VERSION}</div>
  <h3>Fairness report ${fr.ok ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}</h3>
  <table><tr><th>march h</th>${fr.rows.map((r, f) => `<th style="color:${FC[f].l}">${r.f}</th>`).join('')}<th>spread</th></tr>
  ${[['pass', 'nearest pass'], ['fuel', 'Fuel Cells'], ['xeno', 'Xenocrystal'], ['rare', 'Rare Earths'], ['lux', 'a luxury'], ['lmk1', '1st landmark'], ['lmk2', '2nd landmark'], ['lair', 'nearest lair']].map(([k, n]) => { const ck = fr.checks.find((c) => c.k === k); return `<tr><td>${n}</td>${fr.rows.map((r) => `<td>${r[k]}</td>`).join('')}<td class="${ck ? (ck.ok ? 'ok' : 'bad') : 'dim'}">${ck ? ck.spread + (ck.ok ? ' ✓' : ' ✗') : 'info'}</td></tr>`; }).join('')}</table>
  <div class="small" style="margin-top:4px">Reachable: ${fr.byLand} land hexes by land${fr.islandTiles ? `, ${fr.islandTiles} island hexes by sea (Ports)` : ''} · ${fr.checks.filter((c) => ['reach', 'mainland', 'lairs', 'passes6', 'landmarks6'].includes(c.k)).map((c) => `<span class="${c.ok ? 'ok' : 'bad'}">${c.k} ${c.ok ? '✓' : '✗'}</span>`).join(' · ')}<br>Tolerance ±${fr.tol} h. Path cost = march hours, +1 per river crossing.</div>
  ${map.warnings.length ? `<div class="small bad">${map.warnings.join('<br>')}</div>` : ''}
  <h3>Board</h3>
  <table><tr><th></th><th>hexes</th><th>land</th><th>sea</th><th>mtn</th><th>rivers</th></tr><tr><td>total</td><td>${s.tot.tiles}</td><td>${s.tot.land}</td><td>${s.tot.sea}</td><td>${s.tot.mountain}</td><td>${s.tot.rivers} (${s.tot.riverEdges} edges)</td></tr></table>
  <table style="margin-top:6px"><tr><th>terrain</th>${C.BIOMES.map((b, k) => `<th>${b.name.split(' ')[0]}</th>`).join('')}</tr>
  ${terrs.map((k) => `<tr><td>${C.TERRAIN[k].name}</td>${pb.map((p) => `<td>${p.terr[k] || '·'}</td>`).join('')}</tr>`).join('')}
  <tr><td><b>land hexes</b></td>${pb.map((p) => `<td><b>${p.land}</b></td>`).join('')}</tr><tr><td>start corruption</td>${pb.map((p) => `<td>${p.levels}</td>`).join('')}</tr></table>
  <div class="small" style="margin-top:6px">Strategic: Fuel ${s.tot.res.fuel} · Xeno ${s.tot.res.xeno} · Rare ${s.tot.res.rare} (3 of each in fair kits) · Luxuries ${s.tot.lux} · Landmarks 6 + 3 Lairs · Passes ${map.passes.length}</div>
  <h3>Legend</h3>
  <div class="leg">${terrs.map((k) => `<span><i style="background:${TC[k][0]}"></i>${C.TERRAIN[k].name}</span>`).join('')}</div>`;
  const go = (seed, r) => { location.search = `?seed=${encodeURIComponent(seed)}&r=${r}`; };
  $('#g-go').onclick = () => go($('#g-seed').value || 'season-1', $('#g-r').value);
  $('#g-rand').onclick = () => go('s' + Math.floor(Math.random() * 1e6), $('#g-r').value);
}

// ---------------------------------------------------------------- top bar: round track + market ticker
function updateBar() {
  const narrow = innerWidth <= 760;
  $('#rnd').textContent = `${narrow ? 'R' : 'ROUND '}${Math.min(st.round, 84)}/84${st.round >= C.RULES.lairWeekFrom ? ' · LAIR WEEK' : narrow ? '' : ` · WEEK ${Math.ceil(st.round / 21)}`}`;
  const now = Date.now(), per = 8 * 3600e3, left = per - (now % per), hh = Math.floor(left / 3600e3), mm = Math.floor(left / 60e3) % 60, ss = Math.floor(left / 1e3) % 60;
  $('#tick').textContent = `${narrow ? 'tick ' : 'tick in '}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const tk = opts.live && tracked ? tracked : null;
  $('#next').innerHTML = tk ? `${narrow ? 'NEXT' : 'NEXT CARD tracking'} <b class="${tk.suit}">${tk.suit.toUpperCase()} ${'★'.repeat(tk.stars)}</b>${market && !narrow ? ` <span class="dim">SOL ${market.sol.price.toFixed(2)}</span>` : ''}` : `${narrow ? 'NEXT' : 'NEXT CARD'} <b>seeded deck</b>`;
  $('#obt').innerHTML = Array.from({ length: 8 }, (_, k) => `<i class="${k < st.outbreaks ? 'on' : ''}"></i>`).join('');
  $('#obt').classList.toggle('night', st.longNight > 0);
}
async function pollMarket() { if (location.protocol === 'file:') return updateBar(); try { const r = await fetch('/api/market', { cache: 'no-store' }); const j = await r.json(); if (j && j.ok) { market = j; tracked = C.suitFromMarket(j); } } catch (e) { /* offline lab: seeded deck */ } updateBar(); }

// ---------------------------------------------------------------- boot
function loop() { if (dirty) draw(); requestAnimationFrame(loop); }
async function boot() {
  const [paint, table] = await Promise.all([loadImg('art/paint.webp'), loadImg('art/table.webp')]);
  tex.paint = paint; tex.table = table;
  resize();
  newMap();
  if (innerWidth <= 760) setSheet(false);
  renderSand(); renderFac(); renderGen(); updateBar();
  addEventListener('resize', () => { resize(); dirty = true; });
  setInterval(updateBar, 1000); pollMarket(); setInterval(pollMarket, 15000);
  loop();
  window.WT.ready = true;
}
boot();
