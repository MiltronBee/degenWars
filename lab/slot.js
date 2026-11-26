/* degenWars slot lab: "dopamine per spin" prototype. Standalone; no deps.
   Sections: data · cue bus · motion/haptics · state · RNG/market · rendering · particles · juice primitives
             · lever gesture · spin · nudge · blast · evaluate/celebrate · attract · debug · boot            */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

// ---------- DATA (same weights as index.html) ----------
const U = {
 soldier:  {n:'Soldier',  w:34, r:0},
 medic:    {n:'Medic',    w:20, r:0},
 sniper:   {n:'Sniper',   w:16, r:1},
 tank:     {n:'Tank',     w:13, r:1},
 artillery:{n:'Artillery',w:10, r:2},
 mech:     {n:'Mech',     w:7,  r:2},
};
const TYPES = Object.keys(U), WSUM = TYPES.reduce((s,t)=>s+U[t].w,0);
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const TEASE = [[0,1,2],[3,4,5],[6,7,8],[0,4,8],[6,4,2]]; // lines whose first two cells sit on reels 1-2 and last on reel 3
const CAP = 8, BANK = 150, PER_TURN = 25;
const ART = t => `../art/s-${t}.webp`;
const lineKey = l => l.join('');

// ---------- CUE BUS (audio drops in later: bus.on('reel_stop', d => play('clunk', d.col))) ----------
const bus = {
 h: {}, log: [],
 on(e, f){ (this.h[e] ||= []).push(f); return () => { this.h[e] = this.h[e].filter(x => x !== f); }; },
 emit(e, d = {}){
  const rec = {e, d, t: Math.round(performance.now())};
  this.log.push(rec); if (this.log.length > 60) this.log.shift();
  (this.h[e] || []).slice().forEach(f => { try { f(d); } catch (err) { console.warn(err); } });
  (this.h['*'] || []).slice().forEach(f => { try { f(e, d); } catch (err) { console.warn(err); } });
 }
};
window.degenCues = bus;

// ---------- MOTION + HAPTICS ----------
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let simRM = false;
const RM = () => mq.matches || simRM;
const canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const buzz = p => { if (!canBuzz || RM() || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return; try { navigator.vibrate(p); } catch (e) {} };

// ---------- STATE ----------
const S = {
 energy: 48, turn: 1, spinsUsed: 0, spinCap: 3, nudges: 1, blasts: 1, credits: 0,
 grid: [], army: [], heat: 0, chain: 0, blastMode: false, busy: false, skip: false,
 nonce: 0, rng: Math.random, seed: '--------', standing: new Set(), lastTease: [],
 force: '', rigNudge: false, rigBlast: false, repay: 'all',
 mk: {ok: false, price: null, t: 0, chg1m: 0, chg5m: 0, chg15m: 0, vol: 0, weather: 'crab', tick: 0},
};
const spinCost = (n = S.spinsUsed) => Math.round(10 * Math.pow(1.5, n));
const canSpin = () => !S.busy && S.spinsUsed < S.spinCap && S.energy >= spinCost();

// ---------- RNG (market-seeded) ----------
function cyrb53(str, seed = 0){
 let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
 for (let i = 0, ch; i < str.length; i++){ ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
 h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
 h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
 return [h1 >>> 0, h2 >>> 0];
}
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SALT = Math.random().toString(36).slice(2, 8);
function seedSpin(){
 const src = S.mk.ok ? `${S.mk.price}|${S.mk.t}` : `house|${Date.now()}`;
 const [a, b] = cyrb53(`${src}|${S.nonce}|${SALT}`);
 S.rng = mulberry(a ^ b);
 S.seed = a.toString(16).padStart(8, '0');
}
function randSym(rng = S.rng){ let r = rng() * WSUM; for (const t of TYPES){ r -= U[t].w; if (r < 0) return t; } return 'soldier'; }
const lines = g => LINES.filter(l => g[l[0]] && g[l[0]] === g[l[1]] && g[l[1]] === g[l[2]]);
const teaseOf = g => TEASE.filter(l => g[l[0]] === g[l[1]]);

// debug: forced outcomes (built with Math.random, not the market seed; flagged in the tape)
function forcedGrid(kind){
 const rs = () => randSym(Math.random);
 const tries = pred => { for (let i = 0; i < 60000; i++){ const g = Array.from({length:9}, rs); if (pred(g)) return g; } return null; };
 const pick = (ex = []) => { let t; do t = rs(); while (ex.includes(t)); return t; };
 if (kind === 'line1') return tries(g => lines(g).length === 1);
 if (kind === 'line2'){
  for (let k = 0; k < 2000; k++){
   const s = pick(), a = LINES[Math.floor(Math.random()*8)], b = LINES[Math.floor(Math.random()*8)]; if (a === b) continue;
   const g = Array.from({length:9}, () => pick([s])); [...a, ...b].forEach(i => g[i] = s);
   if (lines(g).length === 2) return g;
  }
 }
 if (kind === 'combo'){
  for (let k = 0; k < 2000; k++){
   const s = pick(['soldier']), g = Array.from({length:9}, () => pick([s]));
   [0,1,3,4,5,7,8].forEach(i => g[i] = s); // middle row + middle column + diagonal = 3 lines
   if (Math.random() < .4) g[2] = s;        // sometimes a 4th/5th line
   if (lines(g).length >= 3) return g;
  }
 }
 if (kind === 'near') return tries(g => lines(g).length === 0 && teaseOf(g).length > 0 && Math.random() < .6);
 if (kind === 'full'){ const s = rs(); return Array(9).fill(s); }
 return null;
}

// ---------- MARKET TAPE ----------
const pct = v => (v >= 0 ? '▲' : '▼') + Math.abs(v).toFixed(2) + '%';
let tapeText = '';
function renderTape(changedPrice, dir){
 const px = $('#tapePx'), m = S.mk;
 $('#tapeLamp').classList.toggle('stale', !m.ok);
 if (m.ok && changedPrice){
  const str = '$' + m.price.toFixed(2), old = px.dataset.v || '';
  px.innerHTML = 'SOL ' + [...str].map((c, i) => `<span class="${old[i] !== c ? 'flip' : ''}">${c}</span>`).join('');
  px.dataset.v = str;
  px.className = 'tape-px ' + (dir > 0 ? 'up' : dir < 0 ? 'dn' : '');
  bus.emit('market_tick', {price: m.price});
 } else if (!m.ok) px.textContent = 'FEED STALE';
 const items = m.ok
  ? [`SOL ${pct(m.chg1m)} 1M`, `${pct(m.chg5m)} 5M`, `${pct(m.chg15m)} 15M`, `VOL ${m.vol.toFixed(2)}%`, `WEATHER ${String(m.weather).toUpperCase()}`, `TICK #${m.tick}`, `<b class="seed">SEED ${S.seed}${S.force ? ' · RIGGED (DEBUG)' : ''}</b>`, 'MARKET-SEEDED (UNVERIFIED)']
  : ['FEED STALE · HOUSE SEED', `<b class="seed">SEED ${S.seed}</b>`, 'NO LIVE PRICE'];
 const txt = items.map(x => `<span>${x}</span>`).join('');
 if (txt !== tapeText){ tapeText = txt; $('#tapeTrack').innerHTML = txt + txt; }
}
async function poll(){
 try {
  const r = await fetch('/api/market', {cache: 'no-store'}); const j = await r.json();
  if (!j || !j.ok || !j.sol || !j.sol.price) throw new Error('bad feed');
  const s = j.sol, prev = S.mk.price, changed = prev !== s.price;
  Object.assign(S.mk, {ok: true, price: s.price, t: s.t, chg1m: s.chg1m || 0, chg5m: s.chg5m || 0, chg15m: s.chg15m || 0, vol: s.vol || 0, weather: j.weather || 'crab'});
  if (changed) S.mk.tick++;
  renderTape(changed, prev == null ? 0 : Math.sign(s.price - prev));
 } catch (e) { S.mk.ok = false; renderTape(false); }
}

// ---------- RENDERING ----------
const reelsEl = $('#reels'), svg = $('#paylines'), stampsEl = $('#stamps'), bezel = $('#bezel'), cab = $('#cab');
const cellHTML = (t, i, cls = '') => `<div class="sym ${cls}" ${i != null ? `data-i="${i}"` : ''} data-t="${t}" title="${U[t].n}"><img src="${ART(t)}" alt="${U[t].n}" draggable="false"></div>`;
const reelEl = c => reelsEl.children[c];
const symEl = i => reelsEl.querySelector(`.sym[data-i="${i}"]`);
function renderGrid(cls = () => ''){
 reelsEl.innerHTML = [0,1,2].map(c => `<div class="reel" data-c="${c}">${[0,1,2].map(r => cellHTML(S.grid[r*3+c], r*3+c, cls(r*3+c))).join('')}</div>`).join('');
}
function setReelCol(c, cls = () => ''){
 const reel = reelEl(c); reel.classList.remove('spinning');
 reel.innerHTML = [0,1,2].map(r => cellHTML(S.grid[r*3+c], r*3+c, cls(r*3+c))).join('');
}
function bulbs(){
 const o = [], T = 10, Sd = 8; let i = 0;
 const b = (x, y) => o.push(`<span class="bulb ${i % 7 === 4 ? 'dead' : ''}" style="left:${x}%;top:${y}%;--i:${i++}"></span>`);
 for (let k = 0; k < T; k++) b(4 + 92*k/(T-1), 2.4);
 for (let k = 1; k < Sd; k++) b(97.4, 2.4 + 95.2*k/Sd);
 for (let k = T-1; k >= 0; k--) b(4 + 92*k/(T-1), 97.6);
 for (let k = Sd-1; k > 0; k--) b(2.6, 2.4 + 95.2*k/Sd);
 $('#bulbs').innerHTML = o.join('');
}
const setChase = s => bezel.style.setProperty('--chase', s + 's');

let shownEnergy = S.energy;
function tweenEnergy(to){
 const el = $('#energy'), from = shownEnergy; shownEnergy = to;
 if (RM()){ el.textContent = to; return; }
 const t0 = performance.now(), D = 420;
 const step = t => { const k = Math.min(1, (t - t0) / D); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
 requestAnimationFrame(step);
}
function renderHUD(){
 $('#turn').textContent = S.turn;
 if (+$('#energy').textContent !== S.energy && shownEnergy === S.energy) $('#energy').textContent = S.energy;
 $('#ebar').style.width = (100 * S.energy / BANK) + '%';
 const c = spinCost(), ok = S.spinsUsed < S.spinCap;
 const cw = ok ? Math.min(S.energy, c) : 0;                     // honest cost preview: the bite the next spin takes out of the bar
 const ec = $('#ecost'); ec.style.left = (100 * (S.energy - cw) / BANK) + '%'; ec.style.width = (100 * cw / BANK) + '%';
 const n = S.army.length, ac = $('#acount'); ac.textContent = `${n}/${CAP}`; ac.parentNode.classList.toggle('full', n >= CAP);
}
function renderArmy(){
 $('#aslots').innerHTML = Array.from({length: CAP}, (_, k) => `<div class="aslot" data-k="${k}">${S.army[k] && S.army[k].shown ? `<img src="${ART(S.army[k].t)}" alt="${U[S.army[k].t].n}">` : ''}</div>`).join('');
}
function renderControls(){
 renderHUD();
 const c = spinCost(), left = S.spinCap - S.spinsUsed, sp = $('#spin');
 sp.disabled = !canSpin() && !S.busy;
 $('#spinT').textContent = left <= 0 ? 'NO SPINS' : S.energy < c ? 'LOW ENERGY' : left === 1 ? 'LAST SPIN' : 'SPIN';
 $('#spinCost').textContent = left > 0 ? `${c} energy${left > 1 ? ` · next ${spinCost(S.spinsUsed + 1)}` : ''}` : 'end the turn';
 $('#spinLamps').innerHTML = Array.from({length: S.spinCap}, (_, k) => `<i class="${k < left ? 'f' : ''}"></i>`).join('');
 const bb = $('#blast'); bb.disabled = S.busy || S.blasts < 1; bb.classList.toggle('on', S.blastMode);
 $('#blastT').textContent = S.blastMode ? 'PICK ONE' : 'BLAST'; $('#blastLeft').textContent = S.blastMode ? 'tap a symbol' : `${S.blasts} left`;
 $('#endturn').disabled = S.busy; $('#endturn').classList.toggle('glow', !S.busy && !canSpin() && S.nudges < 1 && S.blasts < 1);
 const lb = $('#leverbay'); lb.classList.toggle('locked', !canSpin() && !S.busy); $('#lhint').textContent = canSpin() || S.busy ? 'PULL' : 'LOCKED';
 renderNudges();
}
function nudgePreview(col){
 const g = S.grid, ng = g.slice(); ng[col] = null; ng[3+col] = g[col]; ng[6+col] = g[3+col];
 let sure = [], need = {}, chanceLines = [];
 for (const l of LINES){
  const v = l.map(i => ng[i]), nulls = v.filter(x => x === null).length;
  if (!nulls){ if (v[0] === v[1] && v[1] === v[2] && (S.repay === 'all' || !S.standing.has(lineKey(l)))) sure.push(l); }
  else { const o = v.filter(x => x !== null); if (o[0] === o[1]){ need[o[0]] = 1; chanceLines.push(l); } }
 }
 const chance = Object.keys(need).reduce((s, t) => s + U[t].w / WSUM, 0);
 return {sure, chance, chanceLines, need: Object.keys(need)};
}
function renderNudges(){
 const el = $('#nudges'), dis = S.busy || S.nudges < 1 || S.blastMode;
 el.innerHTML = [0,1,2].map(c => {
  const p = nudgePreview(c);
  const txt = p.sure.length && p.chance ? `${p.sure.length} sure · ${Math.round(p.chance*100)}%` : p.sure.length ? `${p.sure.length} sure line${p.sure.length > 1 ? 's' : ''}` : p.chance ? `${Math.round(p.chance*100)}% to hit` : 'blind';
  return `<button data-c="${c}" ${dis ? 'disabled' : ''} aria-label="Nudge reel ${c+1}: ${txt}"><b>▼ NUDGE${S.nudges > 1 ? ' <i>×' + S.nudges + '</i>' : ''}</b><small class="${p.sure.length || p.chance ? 'hot' : ''}">${S.nudges < 1 ? 'none left' : txt}</small></button>`;
 }).join('');
 el.querySelectorAll('button').forEach(b => {
  const c = +b.dataset.c;
  b.onclick = () => nudge(c);
  b.onpointerenter = b.onfocus = () => { if (!b.disabled) previewLines(c); };
  b.onpointerleave = b.onblur = () => clearSvg('.prev');
 });
}

// ---------- PAYLINE SVG ----------
const NS = 'http://www.w3.org/2000/svg';
const cen = i => [50 + 100 * (i % 3), 50 + 100 * Math.floor(i / 3)];
function linePath(l, ext = 26){
 const [x0, y0] = cen(l[0]), [x1, y1] = cen(l[2]), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
 const ux = dx / L, uy = dy / L;
 return {d: `M${x0 - ux*ext} ${y0 - uy*ext} L${x1 + ux*ext} ${y1 + uy*ext}`, len: L + 2*ext};
}
function addPath(l, cls){
 const {d, len} = linePath(l), p = document.createElementNS(NS, 'path');
 p.setAttribute('d', d); p.setAttribute('class', cls); svg.appendChild(p); return {p, len};
}
const clearSvg = sel => svg.querySelectorAll(sel || 'path').forEach(p => p.remove());
function traceLine(l, dur = 260){
 const a = addPath(l, 'trace win'), b = addPath(l, 'trace core win');
 if (!RM()){
  // draw-on: the payline is "inked" from first cell to last (stroke-dashoffset), same trick as slot payline indicators
  for (const {p, len} of [a, b]) {
   p.style.strokeDasharray = p.classList.contains('core') ? '' : len;
   if (!p.classList.contains('core')) p.animate([{strokeDashoffset: len}, {strokeDashoffset: 0}], {duration: dur, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both'});
   else p.animate([{opacity: 0}, {opacity: 0, offset: .6}, {opacity: .85}], {duration: dur});
  }
 }
}
function previewLines(col){
 clearSvg('.prev'); const p = nudgePreview(col);
 p.sure.forEach(l => addPath(l, 'sure prev'));
 p.chanceLines.forEach(l => addPath(l, 'ghost prev'));
}

// ---------- PARTICLES (one canvas, pooled-ish, sleeps when empty) ----------
const cv = $('#fx'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function fit(){ DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; }
const sprite = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; };
const TOKEN = sprite(48, (g, s) => { // tarnished brass token, stamped star, dirty rim
 const r = s/2; const gr = g.createRadialGradient(r*.7, r*.6, 2, r, r, r);
 gr.addColorStop(0, '#DDD9CE'); gr.addColorStop(.35, '#AF9561'); gr.addColorStop(.8, '#7a5a2c'); gr.addColorStop(1, '#3a2814');
 g.fillStyle = gr; g.beginPath(); g.arc(r, r, r-1, 0, 7); g.fill();
 g.strokeStyle = 'rgba(33,30,27,.75)'; g.lineWidth = 2; g.beginPath(); g.arc(r, r, r*.68, 0, 7); g.stroke();
 g.fillStyle = 'rgba(92,72,56,.9)'; g.font = `bold ${s*.42}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', r, r+1);
 for (let i = 0; i < 18; i++){ g.fillStyle = `rgba(48,49,47,${Math.random()*.35})`; g.fillRect(Math.random()*s, Math.random()*s, 2, 2); }
});
const SMOKE = sprite(64, (g, s) => { const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, 'rgba(48,49,47,.75)'); gr.addColorStop(.6, 'rgba(48,49,47,.3)'); gr.addColorStop(1, 'rgba(48,49,47,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const DUST = sprite(64, (g, s) => { const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, 'rgba(182,173,148,.6)'); gr.addColorStop(1, 'rgba(182,173,148,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const P = []; let raf = 0, lastT = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
function add(p){ if (RM()) return; if (P.length > 380) P.shift(); P.push(Object.assign({age: 0, rot: 0, vr: 0, g: 0, drag: 1}, p)); if (!raf){ lastT = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(t){
 const dt = Math.min(.033, (t - lastT) / 1000); lastT = t;
 ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, VW, VH);
 for (let i = P.length - 1; i >= 0; i--){
  const p = P[i]; p.age += dt; if (p.age >= p.life || p.y > VH + 60){ P.splice(i, 1); continue; }
  p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  const k = p.age / p.life;
  if (p.type === 'token'){
   ctx.globalAlpha = k > .8 ? (1 - k) * 5 : 1;
   ctx.setTransform(DPR * Math.max(.08, Math.abs(Math.cos(p.rot))), 0, 0, DPR, p.x * DPR, p.y * DPR); // coin flip = x-scale by cos
   ctx.drawImage(TOKEN, -p.s/2, -p.s/2, p.s, p.s);
   ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  } else if (p.type === 'spark'){
   ctx.globalAlpha = 1 - k; ctx.strokeStyle = k < .3 ? '#F0C080' : '#D9772B'; ctx.lineWidth = p.s;
   ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke();
  } else if (p.type === 'debris'){
   ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; ctx.fillStyle = p.c;
   ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s/2, -p.s/3, p.s, p.s*.66); ctx.restore();
  } else { // smoke, dust
   const sz = p.s * (1 + k * p.grow); ctx.globalAlpha = (1 - k) * p.a;
   ctx.drawImage(p.type === 'smoke' ? SMOKE : DUST, p.x - sz/2, p.y - sz/2, sz, sz);
  }
 }
 ctx.globalAlpha = 1;
 raf = P.length ? requestAnimationFrame(tick) : 0;
 if (!raf) ctx.clearRect(0, 0, VW, VH);
}
const rc = el => { const r = el.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height}; };
function tokens(x, y, n, spread = 1){
 for (let i = 0; i < n; i++){ const a = rnd(-Math.PI*.9, -Math.PI*.1); const v = rnd(260, 620) * spread;
  add({type: 'token', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, g: 1500, s: rnd(11, 17), life: rnd(1, 1.6), vr: rnd(8, 20), drag: .995}); }
}
function sparks(x, y, n, sp = 1){ for (let i = 0; i < n; i++){ const a = rnd(0, Math.PI*2), v = rnd(200, 650) * sp; add({type: 'spark', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 120, g: 900, s: rnd(1, 2.4), life: rnd(.18, .45), drag: .96}); } }
function smoke(x, y, n, a = .5){ for (let i = 0; i < n; i++) add({type: 'smoke', x: x + rnd(-10, 10), y: y + rnd(-6, 6), vx: rnd(-25, 25), vy: rnd(-60, -20), s: rnd(26, 44), grow: 1.6, a, life: rnd(.8, 1.4), drag: .98}); }
function dust(x, y, n){ for (let i = 0; i < n; i++) add({type: 'dust', x: x + rnd(-20, 20), y, vx: rnd(-60, 60), vy: rnd(-30, -5), s: rnd(18, 30), grow: 1.2, a: .55, life: rnd(.5, .9), drag: .95}); }
function explode(x, y){
 sparks(x, y, 16, 1.1); smoke(x, y, 4, .65);
 const cols = ['#5C4838', '#30312F', '#D4C9AD', '#AF9561', '#864F3B'];
 for (let i = 0; i < 10; i++){ const a = rnd(-Math.PI, 0), v = rnd(150, 480); add({type: 'debris', x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, g: 1800, s: rnd(3, 8), c: cols[i % 5], life: rnd(.7, 1.1), vr: rnd(-14, 14)}); }
}

// ---------- JUICE PRIMITIVES ----------
// trauma-based screen shake (Eiserloh, "Juicing Your Cameras With Math", GDC 2016): offset = max * trauma^2 * noise
let trauma = 0, shakeRaf = 0, shakeLast = 0;
function shake(add_){
 if (RM()) return; trauma = Math.min(1, trauma + add_);
 if (!shakeRaf){ shakeLast = performance.now(); shakeRaf = requestAnimationFrame(shakeTick); }
}
function shakeTick(t){
 const dt = (t - shakeLast) / 1000; shakeLast = t; trauma = Math.max(0, trauma - dt * 1.6);
 const s = trauma * trauma, M = 14;
 if (s <= .0005){ cab.style.transform = ''; shakeRaf = 0; return; }
 cab.style.transform = `translate3d(${(Math.random()*2-1)*M*s}px,${(Math.random()*2-1)*M*s}px,0) rotate(${(Math.random()*2-1)*1.6*s}deg)`;
 shakeRaf = requestAnimationFrame(shakeTick);
}
const skipWaiters = new Set();
function wait(ms){ if (S.skip) ms = Math.min(ms, 30); return new Promise(r => { const done = () => { clearTimeout(id); skipWaiters.delete(done); r(); }; const id = setTimeout(done, ms); skipWaiters.add(done); }); }
let activeAnims = [];
function skipNow(){ if (!S.busy || S.skip) return; S.skip = true; bus.emit('slam_stop'); activeAnims.forEach(a => { try { a.playbackRate = 6; } catch (e) {} }); [...skipWaiters].forEach(f => f()); }
function begin(){ S.busy = true; S.skip = false; stopAttract(); clearSvg(); renderControls(); }
function end(){ S.busy = false; S.skip = false; activeAnims = []; renderControls(); armIdle(); }
function jolt(el = bezel){ el.classList.remove('jolt'); void el.offsetWidth; el.classList.add('jolt'); }
function flare(ms){ bezel.classList.add('flare'); setTimeout(() => bezel.classList.remove('flare'), ms); }
function flashScreen(peak = .8, dur = 380){ if (RM()) return; $('#flash').animate([{opacity: 0}, {opacity: peak, offset: .15}, {opacity: 0}], {duration: dur}); }
function stamp(text, {sub = '', cls = '', size = 1, hold = 900} = {}){
 const el = document.createElement('div'), r = rnd(-6, 6);
 el.className = 'stamp ' + cls; el.style.setProperty('--s', size);
 el.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`; stampsEl.appendChild(el);
 bus.emit('stamp', {text, cls});
 if (RM()){ el.style.transform = `rotate(${r}deg)`; setTimeout(() => el.remove(), hold + 300); return el; }
 // a stamp is a slam: accelerate INTO the paper (ease-in), tiny rebound, then ink sits
 el.animate([
  {transform: `rotate(${r}deg) scale(2.4)`, opacity: 0, easing: 'cubic-bezier(.55,0,1,.45)'},
  {transform: `rotate(${r}deg) scale(.93)`, opacity: 1, offset: .62, easing: 'ease-out'},
  {transform: `rotate(${r}deg) scale(1.03)`, offset: .82},
  {transform: `rotate(${r}deg) scale(1)`, opacity: 1}], {duration: 220});
 setTimeout(() => { if (cls.includes('grey')) return; shake(.12 * size); const c = rc(el); dust(c.x, c.y + c.h/2, 3); }, 140);
 el.animate([{opacity: 1}, {opacity: 0, transform: `rotate(${r}deg) translateY(-8px)`}], {duration: 280, delay: hold, fill: 'forwards'}).onfinish = () => el.remove();
 return el;
}
function say(t){ $('#live').textContent = t; }

// ---------- LEVER (the phone's main input) ----------
// Pull down: rubber-band resistance, 4 ratchet notches, a threshold "armed" detent, release to fire.
// Release early = cancel (spring back, no spin). Tap = auto-pull. Release velocity -> cosmetic spin power.
const LV = {down: false, id: null, y0: 0, p: 0, notch: 0, armed: false, samples: [], src: null, t0: 0};
const lever = $('#lever'), leverImg = lever.querySelector('img'), bay = $('#leverbay');
const NOTCHES = [.18, .34, .5, .64], ARM = .72;
function leverPose(p){ leverImg.style.transform = p ? `perspective(420px) rotateX(${-p * 72}deg)` : ''; }
function leverTravel(){ return Math.max(140, bay.offsetHeight * .7); }
function grab(e, src){
 if (S.busy){ if (src === 'lever') skipNow(); return; }
 if (S.blastMode && src === 'window') return;
 if (!canSpin()){
  if (src !== 'lever') return;
  bus.emit('lever_denied', {reason: S.spinsUsed >= S.spinCap ? 'no_spins' : 'energy'});
  buzz([12, 40, 12]);
  leverImg.animate([{transform: 'none'}, {transform: 'perspective(420px) rotateX(-8deg)'}, {transform: 'none'}, {transform: 'perspective(420px) rotateX(-5deg)'}, {transform: 'none'}], {duration: 260});
  $('#spin').classList.add('costbump'); setTimeout(() => $('#spin').classList.remove('costbump'), 500);
  return;
 }
 stopAttract();
 Object.assign(LV, {down: true, id: e.pointerId, y0: e.clientY, p: 0, notch: 0, armed: false, samples: [[e.timeStamp, e.clientY]], src, t0: e.timeStamp});
 try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
 lever.classList.add('held'); bay.classList.remove('beckon'); leverImg.getAnimations().forEach(a => a.cancel());
 bus.emit('lever_grab', {src}); buzz(8);
 e.preventDefault();
}
function drag(e){
 if (!LV.down || e.pointerId !== LV.id) return;
 const dy = Math.max(0, e.clientY - LV.y0), H = leverTravel();
 LV.p = 1 - Math.exp(-1.5 * dy / H);                   // resistance grows as you pull (rubber band)
 LV.samples.push([e.timeStamp, e.clientY]); while (LV.samples.length > 2 && e.timeStamp - LV.samples[0][0] > 90) LV.samples.shift();
 while (LV.notch < NOTCHES.length && LV.p >= NOTCHES[LV.notch]){ LV.notch++; bus.emit('lever_ratchet', {notch: LV.notch}); buzz(5); jolt(); }
 if (!LV.armed && LV.p >= ARM){ LV.armed = true; bus.emit('lever_armed'); buzz(16); bezel.classList.add('flare'); $('#lhint').textContent = 'LET GO'; }
 if (LV.armed && LV.p < ARM - .08){ LV.armed = false; bezel.classList.remove('flare'); $('#lhint').textContent = 'PULL'; }
 leverPose(LV.p + (LV.armed ? .04 : 0));
}
function releaseLever(e){
 if (!LV.down || (e && e.pointerId !== LV.id)) return;
 LV.down = false; lever.classList.remove('held'); bezel.classList.remove('flare');
 const dy = e ? e.clientY - LV.y0 : 0, dt = e ? e.timeStamp - LV.t0 : 999;
 const tap = LV.src === 'lever' && Math.abs(dy) < 8 && dt < 350;
 if (tap) return autoPull('tap');
 if (LV.src === 'window' && Math.abs(dy) < 8) return;
 if (!LV.armed || (e && e.type === 'pointercancel')){
  bus.emit('lever_cancel', {p: +LV.p.toFixed(2)});
  if (!RM()) leverImg.animate([{transform: `perspective(420px) rotateX(${-LV.p*72}deg)`}, {transform: 'perspective(420px) rotateX(5deg)'}, {transform: 'none'}], {duration: 260, easing: 'ease-out'});
  leverPose(0); $('#lhint').textContent = 'PULL'; return;
 }
 const [a, b] = [LV.samples[0], LV.samples[LV.samples.length - 1]];
 const v = (b[1] - a[1]) / Math.max(16, b[0] - a[0]);        // px per ms at release
 const power = Math.max(0, Math.min(1, (v - .25) / 1.8));
 fire(power, LV.p);
}
function autoPull(src){
 if (!canSpin()) return;
 bus.emit('lever_grab', {src}); buzz(8);
 if (RM()) return fire(.3, 1);
 leverImg.animate([{transform: 'none'}, {transform: 'perspective(420px) rotateX(-74deg)'}], {duration: 170, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards'})
  .onfinish = () => { bus.emit('lever_ratchet', {notch: 4}); fire(.35, 1); };
}
function fire(power, from){
 bus.emit('lever_release', {power: +power.toFixed(2)});
 buzz([28]);                                                   // the "thump"
 if (!RM()){
  // spring-back with overshoot (damped), like a real return spring: past rest, back, settle
  leverImg.getAnimations().forEach(a => a.cancel());
  leverImg.animate([
   {transform: `perspective(420px) rotateX(${-from*72}deg)`, easing: 'cubic-bezier(.2,.9,.3,1)'},
   {transform: 'perspective(420px) rotateX(14deg)', offset: .38},
   {transform: 'perspective(420px) rotateX(-6deg)', offset: .62},
   {transform: 'perspective(420px) rotateX(2deg)', offset: .82},
   {transform: 'none'}], {duration: 520});
 }
 leverPose(0); $('#lhint').textContent = 'PULL';
 shake(.22 + .28 * power); flare(380 + 300 * power);
 const c = rc(bay); sparks(c.x, c.y + c.h * .35, 6 + Math.round(10 * power), .6);
 spin(power);
}
// swipe-down on the reel window also drives the lever (Slotomania-style swipe-to-spin)
function bindGesture(el, src){
 el.addEventListener('pointerdown', e => {
  if (src === 'window'){ if (S.busy){ skipNow(); return; } if (S.blastMode || !canSpin()) return; }
  grab(e, src);
 });
 el.addEventListener('pointermove', drag);
 el.addEventListener('pointerup', releaseLever);
 el.addEventListener('pointercancel', releaseLever);
}

// ---------- SPIN ----------
function payEnergy(cost){
 S.energy -= cost; tweenEnergy(S.energy); bus.emit('energy_spend', {cost, left: S.energy});
 const st = $('#energyStat'); st.classList.remove('hit'); void st.offsetWidth; st.classList.add('hit');
 if (RM()) return;
 // the cost is physically fed into the machine: tokens drop from the energy gauge into the cabinet
 const a = rc(st), b = rc($('#leverbay')), n = Math.min(8, Math.ceil(cost / 6));
 for (let i = 0; i < n; i++){
  const d = document.createElement('div'); d.className = 'coinfly'; d.style.left = a.x + 'px'; d.style.top = a.y + 'px'; document.body.appendChild(d);
  d.animate([{transform: 'translate(0,0) scale(1)', opacity: 1}, {transform: `translate(${(b.x - a.x) * .5 + rnd(-20, 20)}px,${(b.y - a.y) * .3 - 30}px) scale(1.1)`, offset: .45}, {transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(.5)`, opacity: .2}],
   {duration: 420, delay: i * 45, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'backwards'}).onfinish = () => d.remove();
 }
}
function seedDrop(){
 const tp = $('#tape'); tp.classList.add('seeding'); setTimeout(() => tp.classList.remove('seeding'), 600);
 bus.emit('seed_drop', {seed: S.seed, price: S.mk.price});
 if (RM()) return;
 const a = rc($('#tapePx')), digits = (S.mk.ok ? S.mk.price.toFixed(2).replace('.', '') : S.seed).slice(-3);
 [0,1,2].forEach(c => {
  const b = rc(reelEl(c)), d = document.createElement('div'); d.className = 'digit'; d.textContent = digits[c] || '0';
  d.style.left = a.x + 'px'; d.style.top = a.y + 'px'; document.body.appendChild(d);
  d.animate([{transform: 'translate(-50%,-50%) scale(1)', opacity: 1}, {transform: `translate(calc(-50% + ${b.x - a.x}px),calc(-50% + ${b.y - b.h*.45 - a.y}px)) scale(1.6)`, opacity: 0}],
   {duration: 360, delay: c * 50, easing: 'cubic-bezier(.5,0,.8,.6)'}).onfinish = () => d.remove();
 });
}
async function spin(power = .3){
 if (!canSpin()) return;
 begin();
 const cost = spinCost(); S.spinsUsed++; S.nonce++; S.chain = 0; payEnergy(cost);
 seedSpin();
 const forced = S.force ? forcedGrid(S.force) : null;
 const prev = S.grid.slice(), g = forced || Array.from({length: 9}, () => randSym());
 const tz = teaseOf(g); S.lastTease = tz;
 bus.emit('spin_start', {cost, seed: S.seed, nonce: S.nonce, power: +power.toFixed(2), forced: S.force || null});
 S.force = ''; syncDbg(); renderTape(false); seedDrop();
 renderControls(); setChase(.9);
 await spinReels(prev, g, tz, power);
 S.grid = g;
 const paid = await evaluate('spin');
 if (paid) $$('#reels .hold').forEach(x => x.classList.remove('hold'));
 if (!paid){
  if (tz.length) nearMiss(tz); else dud();
 }
 setChase(2.4); end();
}
function spinReels(prev, g, tz, power){
 return new Promise(res => {
  const reels = [...reelsEl.children];
  if (RM()){ // reduced motion: no scrolling strip, reels resolve left to right with a short delay
   let k = 0; S.grid = g;
   reels.forEach((reel, c) => setTimeout(() => { setReelCol(c); bus.emit('reel_stop', {col: c}); if (++k === 3) res(); }, 140 + 140 * c));
   return;
  }
  const H = reels[0].offsetHeight, h = H / 3, T = y => `translateY(${y}px)`;
  const ext = tz.length ? (tz.length > 1 ? 1500 : 1000) : 0;
  let left = 3;
  reels.forEach((reel, col) => {
   const last = col === 2 && tz.length > 0;
   const K = 12 + col * 6 + Math.round(power * 8) + (last ? 12 : 0);
   const fin = [0,1,2].map(r => g[r*3 + col]), old = [0,1,2].map(r => prev[r*3 + col]);
   // filler symbols are drawn from the SAME weights, never stacked with the needed symbol next to the result (no fabricated near misses)
   const fill = Array.from({length: K}, () => randSym(Math.random));
   const strip = document.createElement('div'); strip.className = 'strip'; strip.style.setProperty('--h', h + 'px');
   strip.innerHTML = [...fin, ...fill, ...old].map(t => cellHTML(t)).join('');
   reel.innerHTML = ''; reel.appendChild(strip); reel.classList.remove('lit'); reel.classList.add('spinning');
   const y0 = -(K + 3) * h;
   const dur = [600, 860, 1120][col] + Math.round(power * 220) + (last ? ext : 0);
   const kf = last ? [
     {transform: T(y0), offset: 0, easing: 'ease-out'},
     {transform: T(y0 - h * .25), offset: 80 / dur, easing: 'ease-in'},          // wind-up (anticipation)
     {transform: T(y0 + h * 1.4), offset: 200 / dur, easing: 'linear'},
     {transform: T(-h * 5), offset: 1000 / dur, easing: 'cubic-bezier(.12,.6,.25,1)'}, // then a long crawl: the tease
     {transform: T(h * .14), offset: (dur - 150) / dur, easing: 'ease-in-out'},
     {transform: T(0), offset: 1}]
    : [
     {transform: T(y0), offset: 0, easing: 'ease-out'},
     {transform: T(y0 - h * .25), offset: .08, easing: 'ease-in'},
     {transform: T(y0 + h * 1.3), offset: .18, easing: 'linear'},
     {transform: T(-h * 2), offset: .74, easing: 'cubic-bezier(.25,.6,.35,1)'},
     {transform: T(h * .22), offset: .9, easing: 'ease-in-out'},           // overshoot past the stop, then settle back: the "clunk"
     {transform: T(0), offset: 1}];
   const an = strip.animate(kf, {duration: dur, fill: 'forwards'}); activeAnims.push(an);
   let done = false;
   const fin_ = () => {
    if (done) return; done = true;
    const tmp = S.grid; S.grid = g; setReelCol(col, i => tz.length && col < 2 && tz.some(l => l.includes(i)) ? 'hold' : ''); S.grid = tmp;
    if (col === 2){ reel.classList.remove('tease', 'double'); reelsEl.classList.remove('teasing'); clearSvg('.tz'); if (tz.length) bus.emit('tease_end'); }
    const colSame = fin[0] === fin[1] && fin[1] === fin[2];
    if (colSame){ reel.classList.add('lit'); bus.emit('reel_line_preview', {col}); }
    bus.emit('reel_stop', {col, tease: last}); buzz(6); jolt();
    const rr = rc(reel); dust(rr.x, rr.y + rr.h / 2 - 4, 2);
    if (col === 1 && tz.length) startTease(tz);
    if (--left === 0) setTimeout(res, 60);
   };
   an.onfinish = fin_; setTimeout(fin_, dur + 400);
  });
 });
}
function startTease(tz){
 const r2 = reelEl(2); if (!r2) return;
 r2.classList.add('tease'); if (tz.length > 1) r2.classList.add('double');
 reelsEl.classList.add('teasing'); setChase(tz.length > 1 ? .35 : .55);
 tz.forEach(l => addPath(l, 'ghost tz'));
 bus.emit('tease_start', {lines: tz.length, double: tz.length > 1});
 buzz(10);
}
function nearMiss(tz){
 // honest framing: show what was one short, in grey, no celebration, and point at the tools that could fix it
 bus.emit('near_miss', {lines: tz.length});
 tz.forEach(l => addPath(l, 'near nm'));
 stamp('ONE SHORT', {cls: 'grey', sub: 'nudge or blast it', hold: 1100});
 $$('#nudges button').forEach(b => { const p = nudgePreview(+b.dataset.c); if (!b.disabled && (p.sure.length || p.chance)) b.classList.add('hint'); });
 say('No line. One short.');
 setTimeout(() => { clearSvg('.nm'); $$('#reels .hold').forEach(x => x.classList.remove('hold')); }, 1500);
}
function dud(){
 bus.emit('dud');
 bezel.classList.add('sag'); setTimeout(() => bezel.classList.remove('sag'), 260); // the lights sag for a beat; no fanfare, no fake win
 say('No line.');
}

// ---------- NUDGE (blind gamble, no confirm) ----------
async function nudge(col){
 if (S.busy || S.nudges < 1 || S.blastMode) return;
 begin(); S.nudges--;
 const old = [0,1,2].map(r => S.grid[r*3 + col]);
 let inc = randSym();
 if (S.rigNudge){ const p = nudgePreview(col); if (p.need.length) inc = p.need[0]; S.rigNudge = false; syncDbg(); }
 bus.emit('nudge', {col});
 S.grid[col] = inc; S.grid[3 + col] = old[0]; S.grid[6 + col] = old[1];
 const reel = reelEl(col);
 if (!RM()){
  const h = reel.offsetHeight / 3, T = y => `translateY(${y}px)`;
  const strip = document.createElement('div'); strip.className = 'strip'; strip.style.setProperty('--h', h + 'px');
  strip.innerHTML = cellHTML(inc, null, 'shut') + old.map(t => cellHTML(t)).join('');
  reel.innerHTML = ''; reel.appendChild(strip);
  const an = strip.animate([
   {transform: T(-h), easing: 'ease-out'},
   {transform: T(-h * 1.08), offset: .18, easing: 'cubic-bezier(.7,0,1,.5)'},   // tiny lift before the drop
   {transform: T(h * .1), offset: .55, easing: 'ease-out'},
   {transform: T(-h * .03), offset: .78},
   {transform: T(0)}], {duration: 300, fill: 'forwards'});
  activeAnims.push(an); await an.finished.catch(() => {});
 }
 setReelCol(col, i => i === col ? 'shut' : '');
 bus.emit('nudge_clunk', {col}); buzz(14); shake(.16); jolt();
 const rr = rc(reel); dust(rr.x, rr.y - rr.h / 2 + 6, 3);
 await wait(RM() ? 0 : 420);                                // the blind moment: shutter rattles, then flips
 const top = symEl(col); if (top) top.classList.add('open');
 bus.emit('nudge_reveal', {col, sym: inc});
 await wait(RM() ? 0 : 200);
 if (top) top.classList.remove('shut', 'open');
 await evaluate('nudge');
 end();
}

// ---------- BLAST ----------
function setBlastMode(on){
 S.blastMode = on; reelsEl.classList.toggle('blasting', on); $$('#reels .sym.target').forEach(s => s.classList.remove('target'));
 $('#mqsub').textContent = on ? 'BLAST: PICK A SYMBOL' : 'Summoner · 8 paylines';
 if (on) bus.emit('blast_arm'); renderControls();
}
reelsEl.addEventListener('pointerover', e => {
 if (!S.blastMode) return; const s = e.target.closest('.sym'); if (!s) return;
 $$('#reels .sym').forEach(x => x.classList.toggle('target', x.dataset.t === s.dataset.t));
 const n = S.grid.filter(t => t === s.dataset.t).length;
 $('#mqsub').textContent = `BLAST ${n} × ${U[s.dataset.t].n}`;
});
reelsEl.addEventListener('click', e => { if (!S.blastMode) return; const s = e.target.closest('.sym'); if (s && s.dataset.i != null) blastSym(+s.dataset.i); });
async function blastSym(i){
 if (S.busy || S.blasts < 1) return;
 const s = S.grid[i]; S.blasts--; setBlastMode(false); begin();
 const hit = S.grid.map((t, j) => t === s ? j : -1).filter(j => j >= 0);
 bus.emit('blast', {sym: s, count: hit.length});
 hit.forEach(j => symEl(j).classList.add('charge'));
 await wait(RM() ? 0 : 160);
 hit.forEach((j, k) => { const el = symEl(j); const c = rc(el); setTimeout(() => explode(c.x, c.y), k * 25); el.classList.remove('charge'); el.classList.add('gone'); });
 bus.emit('blast_boom', {count: hit.length}); shake(.3 + .04 * hit.length); flashScreen(.35, 240); buzz([20, 30, 40]);
 await wait(RM() ? 80 : 300);
 // gravity refill: survivors fall, fresh symbols drop in from above
 const old = S.grid.slice(), fall = new Array(9).fill(0);
 let fresh = null;
 if (S.rigBlast){
  for (let k = 0; k < 400 && !fresh; k++){ const f = Array.from({length: 9}, () => randSym(Math.random)); const g = refill(old, s, f); if (lines(g.g).some(l => !S.standing.has(lineKey(l)))) fresh = f; }
  S.rigBlast = false; syncDbg();
 }
 const res = refill(old, s, fresh || Array.from({length: 9}, () => randSym()));
 S.grid = res.g; renderGrid();
 let longest = 0;
 if (!RM()) for (let j = 0; j < 9; j++){
  const f = res.fall[j]; if (!f) continue;
  const c = j % 3, r = Math.floor(j / 3), d = 200 + 110 * Math.sqrt(f), delay = c * 55 + (2 - r) * 30;
  longest = Math.max(longest, d + delay);
  symEl(j).animate([
   {transform: `translateY(${-f * 100}%)`, easing: 'cubic-bezier(.55,0,1,.45)'},   // gravity: accelerate down
   {transform: 'translateY(0)', offset: .74, easing: 'ease-out'},
   {transform: 'translateY(-7%)', offset: .87, easing: 'ease-in'},                // one small bounce
   {transform: 'translateY(0)'}], {duration: d, delay, fill: 'backwards'});
 }
 await wait(longest);
 bus.emit('blast_land'); jolt(); buzz(10);
 [0,1,2].forEach(c => { const rr = rc(reelEl(c)); dust(rr.x, rr.y + rr.h / 2 - 6, 2); });
 await evaluate('blast');
 end();
}
function refill(old, s, freshQ){
 const g = old.slice(), fall = new Array(9).fill(0); let q = 0;
 for (let c = 0; c < 3; c++){
  const keepRows = [0,1,2].filter(r => old[r*3 + c] !== s), k = 3 - keepRows.length;
  for (let r = 0; r < k; r++){ g[r*3 + c] = freshQ[q++ % freshQ.length]; fall[r*3 + c] = k; }
  keepRows.forEach((orow, m) => { const nr = k + m; g[nr*3 + c] = old[orow*3 + c]; fall[nr*3 + c] = nr - orow; });
 }
 return {g, fall};
}

// ---------- EVALUATE + CELEBRATE ----------
async function evaluate(src){
 const hits = lines(S.grid);
 let pay = hits;
 if (S.repay === 'new' && src !== 'spin') pay = hits.filter(l => !S.standing.has(lineKey(l)));
 S.standing = new Set(hits.map(lineKey));
 if (!pay.length){
  if (S.chain) bus.emit('chain_break', {chain: S.chain});
  S.chain = 0; renderHeat(); return false;
 }
 S.chain++;
 await celebrate(pay, src);
 return true;
}
const TIER = n => n >= 8 ? 4 : n >= 3 ? 3 : n;
const HOLD = [0, 420, 650, 950, 1900];
async function celebrate(pay, src){
 const n = pay.length, tier = TIER(n), syms = pay.map(l => S.grid[l[0]]);
 const rare = Math.max(...syms.map(t => U[t].r)), chain = S.chain;
 const power = Math.min(5, tier + (chain - 1) * .6 + rare * .5);  // celebration intensity: tier, + chain, + rarity
 bus.emit('win_start', {lines: n, tier, chain, src, power: +power.toFixed(1)});
 // hit-stop: freeze a beat before the payoff (fighting games / Vlambeer)
 await wait(tier >= 4 ? 220 : 80);
 if (tier === 4){ flashScreen(.85, 520); bus.emit('jackpot'); bezel.classList.add('flare'); }
 setChase(Math.max(.18, .9 - power * .15)); $('.marquee').classList.add('win-glow');
 const gap = tier === 4 ? 85 : tier === 3 ? 170 : 230;
 for (let k = 0; k < n; k++){
  const l = pay[k], t = S.grid[l[0]];
  traceLine(l, tier === 4 ? 160 : 260);
  l.forEach(i => { const el = symEl(i); if (el){ el.classList.remove('win'); void el.offsetWidth; el.classList.add('win'); } });
  bus.emit('line_win', {index: k + 1, of: n, sym: t, line: l, repaid: false});
  if (k >= 1) bus.emit('combo_' + Math.min(k + 1, 8), {lines: k + 1});
  const mid = symEl(l[1]); if (mid){ const c = rc(mid); tokens(c.x, c.y, Math.round(8 + power * 4), .8 + power * .08); sparks(c.x, c.y, 6); }
  shake(.1 + .05 * k + .03 * chain); buzz(12 + 4 * k);
  await wait(gap);
 }
 const label = tier === 4 ? 'FULL HOUSE' : tier === 3 ? `COMBO ×${n}` : tier === 2 ? 'DOUBLE' : 'LINE';
 const units = [...new Set(syms)].map(t => '+ ' + U[t].n).join(' ');
 stamp(label, {cls: 't' + tier, sub: units, size: [1, .9, 1.05, 1.2, 1.4][tier], hold: HOLD[tier] + 250});
 if (chain >= 2){ stamp(`CHAIN ×${chain}`, {cls: 'chain', sub: src === 'nudge' ? 'nudge paid' : src === 'blast' ? 'blast paid' : '', hold: HOLD[tier] + 150}); bus.emit('chain_' + Math.min(chain, 6), {chain}); }
 shake([0, .2, .32, .5, .9][tier] + Math.min(.25, (chain - 1) * .08));
 if (tier === 4){ const w = rc($('#window')); for (let k = 0; k < 14; k++) setTimeout(() => tokens(rnd(w.x - w.w/2, w.x + w.w/2), w.y - w.h/2 - 20, 9, 1.1), k * 90); }
 say(`${label}. ${units}.`);
 // flights start after the stamp has been read
 pay.forEach((l, k) => setTimeout(() => summon(S.grid[l[0]], symEl(l[1])), (tier >= 3 ? 520 : 380) + k * (tier === 4 ? 70 : 130)));
 addHeat(n);
 await wait(HOLD[tier] + (n - 1) * 60);
 clearSvg('.win'); bezel.classList.remove('flare'); $('.marquee').classList.remove('win-glow');
 setChase(.9);
}
function summon(t, fromEl){
 const k = S.army.length, full = k >= CAP;
 if (!full) S.army.push({t, shown: false});
 renderHUD();
 const target = full ? $('#acount') : $('#aslots').children[k];
 const land = () => {
  if (full){
   S.credits += 3; bus.emit('army_full', {unit: t, credits: 3});
   const a = $('#aslots'); a.classList.remove('reject'); void a.offsetWidth; a.classList.add('reject');
   const c = rc(target); smoke(c.x, c.y, 3, .5);
   stamp('ARMY FULL', {cls: 'grey', sub: `${U[t].n} scrapped · +3 credits`, hold: 900});
   return;
  }
  S.army[k].shown = true;
  target.innerHTML = `<img src="${ART(t)}" alt="${U[t].n}">`; target.classList.remove('in'); void target.offsetWidth; target.classList.add('in');
  const ac = $('#acount').parentNode; ac.classList.remove('bump'); void ac.offsetWidth; ac.classList.add('bump');
  const c = rc(target); sparks(c.x, c.y, 8, .5); dust(c.x, c.y + c.h/2, 2);
  bus.emit('summon', {unit: t, rarity: U[t].r, army: S.army.length});
  buzz(10);
 };
 if (RM() || !fromEl || !target) return land();
 const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
 const img = new Image(); img.src = ART(t); img.className = 'flyer'; img.alt = '';
 Object.assign(img.style, {left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px'});
 document.body.appendChild(img);
 const dx = b.left + b.width/2 - (a.left + a.width/2), dy = b.top + b.height/2 - (a.top + a.height/2), s = Math.max(.3, b.width / a.width);
 bus.emit('summon_fly', {unit: t});
 // arc flight: lift and swell first (anticipation), then dive into the army slot
 img.animate([
  {transform: 'translate(0,0) scale(.8) rotate(0)', opacity: .9, easing: 'cubic-bezier(.2,.7,.4,1)'},
  {transform: `translate(${dx * .15}px,${Math.min(-40, dy * .1 - 50)}px) scale(.95) rotate(-8deg)`, offset: .3, easing: 'cubic-bezier(.6,0,.8,.4)'},
  {transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(0)`, opacity: 1}], {duration: 640}).onfinish = () => { img.remove(); land(); };
}
function addHeat(n){
 const before = heatLevel(S.heat); S.heat = Math.min(12, S.heat + n); const after = heatLevel(S.heat);
 bus.emit('heat_up', {heat: S.heat, level: after});
 renderHeat(true);
 if (after > before){
  bus.emit('heat_level_' + after, {heat: S.heat});
  const h = rc($('#heat')); smoke(h.x - h.w * .3, h.y, 3 + after * 2, .45); smoke(h.x + h.w * .3, h.y, 3 + after * 2, .45);
 }
}
const heatLevel = h => h >= 10 ? 3 : h >= 6 ? 2 : h >= 3 ? 1 : 0;
function renderHeat(kick){
 const lv = heatLevel(S.heat);
 $('#hseg').innerHTML = Array.from({length: 12}, (_, k) => `<i class="${k < S.heat ? 'on h' + (k >= 9 ? 3 : k >= 5 ? 2 : 1) : ''}"></i>`).join('');
 const ch = $('#chain'); ch.textContent = S.chain >= 2 ? `CHAIN ×${S.chain}` : ['COLD', 'WARM', 'HOT', 'RED LINE'][lv]; ch.classList.toggle('hot', S.chain >= 2 || lv >= 2);
 if (kick){ const h = $('#heat'); h.classList.remove('kick'); void h.offsetWidth; h.classList.add('kick'); }
}

// ---------- TURN ----------
async function endTurn(){
 if (S.busy) return;
 begin(); bus.emit('turn_end', {turn: S.turn});
 stamp('TO BATTLE', {cls: 'ink', sub: `turn ${S.turn} closed`, hold: 650});
 await wait(800);
 S.turn++; S.energy = Math.min(BANK, S.energy + PER_TURN); tweenEnergy(S.energy);
 S.spinsUsed = 0; S.nudges = 1; S.blasts = 1; S.heat = 0; S.chain = 0; renderHeat();
 bus.emit('turn_start', {turn: S.turn, energy: S.energy});
 end(); bay.classList.add('beckon');
}

// ---------- IDLE ATTRACT MODE ----------
let idleT = 0, demoT = 0, attract = false;
function armIdle(){ clearTimeout(idleT); idleT = setTimeout(startAttract, 9000); }
function startAttract(){
 if (S.busy || LV.down){ armIdle(); return; }
 attract = true; $('#stage').classList.add('attract'); $('#mqsub').textContent = canSpin() ? 'PULL THE LEVER' : 'END THE TURN';
 if (canSpin()) bay.classList.add('beckon');
 bus.emit('attract_start');
 if (RM()) return;
 let k = 0;
 const demo = () => { const l = LINES[k++ % 8]; const {p, len} = addPath(l, 'demo'); p.animate([{opacity: 0, strokeDasharray: len, strokeDashoffset: len}, {opacity: .55, strokeDashoffset: 0, offset: .4}, {opacity: 0, strokeDashoffset: 0}], {duration: 1300}).onfinish = () => p.remove(); };
 demo(); demoT = setInterval(demo, 1400);
}
function stopAttract(){
 if (!attract) return; attract = false; clearInterval(demoT); $('#stage').classList.remove('attract');
 if (!S.blastMode) $('#mqsub').textContent = 'Summoner · 8 paylines'; clearSvg('.demo'); bus.emit('attract_stop');
}

// ---------- DEBUG PANEL ----------
const CUE_DESC = {};
function syncDbg(){
 $$('#dbg [data-force]').forEach(b => b.classList.toggle('on', b.dataset.force === S.force && !!S.force));
 $$('#dbg [data-rig]').forEach(b => b.classList.toggle('on', b.dataset.rig === 'nudge' ? S.rigNudge : S.rigBlast));
 $('#dbg [data-opt="repay"]').textContent = 'Repay: ' + (S.repay === 'all' ? 'all standing' : 'only new lines');
 $('#dbg [data-opt="rm"]').textContent = 'Reduced motion: ' + (RM() ? 'on' : 'off');
}
function bindDebug(){
 const btn = $('#dbgBtn'), pan = $('#dbg');
 const toggle = () => { pan.hidden = !pan.hidden; btn.setAttribute('aria-expanded', String(!pan.hidden)); };
 btn.onclick = toggle;
 pan.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.force != null){ S.force = b.dataset.force; renderTape(false); }
  if (b.dataset.rig === 'nudge') S.rigNudge = !S.rigNudge;
  if (b.dataset.rig === 'blast') S.rigBlast = !S.rigBlast;
  if (b.dataset.res === 'energy'){ S.energy = Math.min(BANK, S.energy + 100); tweenEnergy(S.energy); }
  if (b.dataset.res === 'tools'){ S.nudges++; S.blasts++; }
  if (b.dataset.res === 'spins') S.spinsUsed = 0;
  if (b.dataset.res === 'army'){ S.army = []; renderArmy(); }
  if (b.dataset.opt === 'repay') S.repay = S.repay === 'all' ? 'new' : 'all';
  if (b.dataset.opt === 'rm'){ simRM = !simRM; document.documentElement.classList.toggle('rm', simRM); }
  syncDbg(); renderControls();
 });
 bus.on('*', (e, d) => {
  const ol = $('#cuelog'); if (pan.hidden && ol.childElementCount > 40) return;
  const li = document.createElement('li'); const ds = Object.keys(d).length ? ' ' + JSON.stringify(d).slice(0, 60) : '';
  li.innerHTML = `<b>${e}</b>${ds.replace(/</g, '&lt;')}`; ol.prepend(li); while (ol.childElementCount > 40) ol.lastChild.remove();
 });
}

// ---------- PRESS DEPTH for touch (":active" is unreliable on iOS) ----------
function pressDepth(){
 document.addEventListener('pointerdown', e => { const b = e.target.closest('.spinbtn,.cbtn,.nudges button'); if (b && !b.disabled){ b.classList.add('pressed'); bus.emit('button_press', {id: b.id || 'nudge'}); } });
 const up = () => $$('.pressed').forEach(b => b.classList.remove('pressed'));
 document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}

// ---------- BOOT ----------
function boot(){
 fit(); addEventListener('resize', fit);
 bulbs();
 S.grid = Array.from({length: 9}, () => randSym(Math.random));
 renderGrid(); renderArmy(); renderHeat(); renderTape(false); renderControls();
 bindGesture(bay, 'lever'); bindGesture($('#window'), 'window');
 lever.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); if (S.busy) skipNow(); else autoPull('key'); } });
 lever.addEventListener('click', e => { if (e.detail === 0 && !S.busy) autoPull('key'); }); // keyboard "click" on the button
 $('#spin').onclick = () => { if (S.busy) return skipNow(); autoPull('button'); };
 $('#blast').onclick = () => { if (!S.busy && S.blasts > 0) setBlastMode(!S.blastMode); };
 $('#endturn').onclick = endTurn;
 document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.code === 'Space'){ e.preventDefault(); if (S.busy) skipNow(); else autoPull('space'); }
  else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) nudge(+e.code.slice(-1) - 1);
  else if (e.key === 'b' || e.key === 'B'){ if (!S.busy && S.blasts > 0) setBlastMode(!S.blastMode); }
  else if (e.key === 'Escape' && S.blastMode) setBlastMode(false);
  else if (e.key === '`' || e.key === 'd' || e.key === 'D') $('#dbgBtn').click();
  stopAttract(); armIdle();
 });
 document.addEventListener('pointerdown', () => { stopAttract(); armIdle(); }, true);
 pressDepth(); bindDebug(); syncDbg();
 bus.on('lever_release', () => {}); // placeholder: audio layer subscribes here
 poll(); setInterval(poll, 4000);
 armIdle(); bay.classList.add('beckon');
 window.lab = {
  S, bus, spin: () => autoPull('api'), pull: p => canSpin() && fire(p ?? .5, 1), nudge, blast: blastSym, endTurn,
  force: k => { S.force = k; syncDbg(); renderTape(false); }, rig: (k, v = true) => { if (k === 'nudge') S.rigNudge = v; else S.rigBlast = v; syncDbg(); },
  waitCue: name => new Promise(r => { const off = bus.on(name, d => { off(); r(d); }); }),
  idle: () => new Promise(r => { const t = setInterval(() => { if (!S.busy){ clearInterval(t); r(); } }, 50); }),
 };
 bus.emit('ready');
}
boot();
})();
