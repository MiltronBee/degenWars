// degenWars · gamepad (2026-11-26, owner's layout, built for the ROG Ally; any standard-mapping pad works:
// Xbox, ROG Ally, Steam Deck, DualSense in Chrome or Edge). Console style: a gold highlight moves over the UI with
// the left stick or D-pad and A presses what it is on. On the field, A grabs a unit, the stick carries it and A drops
// it: on a matching unit it merges, on any other unit they swap places. Glyphs on the buttons show the shortcuts. The
// highlight and glyphs show only while the pad is the last input; touching the screen or moving a mouse hides them.
//
//   A  press / grab and drop a unit     B  back (close, put the unit back, cancel blast)
//   X  spin (slam stop while the reels run)                    Y  blast (holding a unit: scrap it)
//   LB battle   LT shop   RT battle speed   RB kit   Menu settings   View codex   right stick scrolls
//
// Loaded after the game script; it drives the game through the game's own globals (R, busy, view, autoPull,
// startBattle, mergeUnits, place, renderField...) so every action takes the same path as a tap.
(() => {
'use strict';
if (!navigator.getGamepads) return;

const BT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const GRAB_SPEED = [38, 30]; // world units per second at full stick (the field is 100 x 60, your side 45 wide)

// ---------- layer: highlight ring, tooltip, button glyphs, context legend ----------
const STYLE = `
.gp-ring{position:fixed;left:0;top:0;z-index:400;pointer-events:none;display:none;border-radius:10px;border:2px solid #ffd77a;
 box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 14px 2px rgba(255,196,84,.55),inset 0 0 10px rgba(255,210,120,.22);
 transition:transform .08s ease-out,width .08s ease-out,height .08s ease-out;animation:gpPulse 1.4s ease-in-out infinite}
@keyframes gpPulse{50%{box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 22px 5px rgba(255,196,84,.78),inset 0 0 12px rgba(255,210,120,.34)}}
.gp-g{position:fixed;left:0;top:0;z-index:401;pointer-events:none;display:none;align-items:center;justify-content:center;
 min-width:21px;height:21px;padding:0 5px;border-radius:11px;background:#151312;border:1.5px solid currentColor;
 font:700 12px/1 var(--f-num,'Arial Narrow'),system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 2px 6px rgba(0,0,0,.65)}
.gp-g svg{width:11px;height:11px;display:block}
.gp-g.on{display:inline-flex}.gp-g.dim{opacity:.4}
.gp-A{color:#7fd65c}.gp-B{color:#f25a4e}.gp-X{color:#55a1f2}.gp-Y{color:#f5cb3b}
.gp-LB,.gp-RB,.gp-LT,.gp-RT,.gp-MENU,.gp-VIEW,.gp-L{color:#ebe3d1;font-size:11px}
.gp-LB,.gp-RB{border-radius:5px}.gp-LT,.gp-RT{border-radius:10px 10px 4px 4px}
.gp-tip{position:fixed;left:0;top:0;z-index:402;pointer-events:none;display:none;max-width:260px;padding:6px 10px;border-radius:8px;
 background:rgba(20,18,16,.96);border:1px solid #6b5636;color:#ecdfc6;font:500 13px/1.3 var(--f-ui,system-ui),sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.6)}
.gp-tip.on{display:block}
.gp-legend{position:fixed;left:50%;bottom:12px;z-index:402;pointer-events:none;display:none;transform:translateX(-50%);gap:16px;padding:7px 14px;
 border-radius:12px;background:rgba(16,14,12,.93);border:1px solid #5a4a33;color:#ecdfc6;font:600 14px/1 var(--f-ui,system-ui),sans-serif;
 box-shadow:0 6px 20px rgba(0,0,0,.6);white-space:nowrap}
.gp-legend.on{display:flex}
.gp-legend span{display:inline-flex;align-items:center;gap:6px}.gp-legend .gp-g{position:static;display:inline-flex}
html.gp-on,html.gp-on *{cursor:none!important}
html.gp-on :focus-visible{outline:none}
.gp-ring.dim{border-color:rgba(255,215,122,.5);animation:none;box-shadow:0 0 0 2px rgba(0,0,0,.5)}`;
const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
const mk = cls => { const e = document.createElement('div'); e.className = cls; document.body.appendChild(e); return e; };
const ring = mk('gp-ring'), tip = mk('gp-tip'), legend = mk('gp-legend');
const ICON = {
  MENU: '<svg viewBox="0 0 12 12"><path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" stroke-width="1.6"/></svg>',
  VIEW: '<svg viewBox="0 0 12 12"><rect x="1.3" y="1.3" width="6.2" height="5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="4.5" y="5.2" width="6.2" height="5" fill="#151312" stroke="currentColor" stroke-width="1.3"/></svg>'
};
const glyph = g => `<i class="gp-g gp-${g} on">${ICON[g] || g}</i>`;
// which on-screen button each shortcut belongs to (shown only when that button is in the active layer)
const GLYPHS = [
  ['#spin', 'X'], ['#blast', 'Y', () => !grab], ['#scrap', 'Y', () => !!grab], ['#fight2', 'LB'], ['#shop', 'LT'], ['#spd', 'RT'],
  ['#parts', 'RB'], ['#hudSet', 'MENU'], ['#hudCodex', 'VIEW'], ['#homeSet', 'MENU'], ['#homeCodex', 'VIEW'],
  ['#bmDone', 'B'], ['#close', 'B'], ['#setOk', 'B'], ['#cx-close', 'B']
].map(([sel, g, when]) => { const e = document.createElement('i'); e.className = `gp-g gp-${g}`; e.innerHTML = ICON[g] || g; document.body.appendChild(e); return { sel, when, e }; });

// ---------- state ----------
let on = false, running = false, lastT = 0, pads = [];
let cur = null, curKey = null, curRect = null, curSym = false, focusT = 0, autoF = false;
let lastRoot = null, lastOvlChild = null, lastView = null, lastRun = null, prev = new Array(17).fill(false);
let navHeld = null, navNext = 0, slideT = 0, defT = 0, legendHTML = '';
let grab = null; // {id, x, y, hot, held, moved}: a unit carried by the pad
const memo = new Map(); // layer root -> key of the last highlighted element, so closing a dialog returns there
let mx = -1, my = -1;

const ovl = () => { const o = document.getElementById('ovl'); return o && o.firstElementChild ? o : null; };
const codexOpen = () => document.querySelector('#codex.show');
const scope = () => codexOpen() || ovl() || document.getElementById('app') || document.body;
const inGame = () => view === 'game' && !!R;
const free = () => inGame() && !ovl() && !codexOpen(); // the game screen with nothing on top

// ---------- what the highlight can land on ----------
const SEL = 'button,[role=button]:not([data-cores]),a[href],input[type=range],label.tog,[tabindex]:not([tabindex="-1"]):not([data-cores]),[data-core]';
function vis(el) {
  if (!el || el.closest('[aria-hidden="true"],[inert]')) return false;
  if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
  const r = el.getBoundingClientRect(); return r.width >= 4 && r.height >= 4;
}
const ok = el => !!el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && vis(el); // a place the highlight can move to
function cands(root) {
  const set = new Set(root.querySelectorAll(SEL));
  if (root.id === 'app' && inGame()) {
    if (R.blast) document.querySelectorAll('#reels .sym[data-i]').forEach(e => set.add(e));
    if (R.phase !== 'battle') document.querySelectorAll('#field .fu[data-id]').forEach(e => set.add(e));
  }
  set.delete(root);
  return [...set].filter(ok);
}
// where the highlight may stay: a button that is disabled for a moment (a nudge mid-spin) keeps it, so it doesn't wander
function holdable(el) {
  if (!el || !el.isConnected || !scope().contains(el)) return false;
  if (el.matches('#reels .sym') && !(R && R.blast)) return false;
  if (el.matches('#field .fu[data-id]') && !(R && R.phase !== 'battle')) return false;
  return vis(el);
}
// a stable name for an element, so the highlight finds it again after the game re-renders (id, else tag + data-*)
function keyOf(el) {
  if (!el) return null; if (el.id) return '#' + CSS.escape(el.id);
  const a = [...el.attributes].filter(x => x.name.startsWith('data-') && !/^data-(t|next|codex-badge)$/.test(x.name)).map(x => `[${x.name}="${x.value.replace(/["\\]/g, '\\$&')}"]`).join('');
  return a ? el.tagName.toLowerCase() + a : null;
}
function byKey(root, key) { if (!key) return null; try { return [...root.querySelectorAll(key)].find(e => keyOf(e) === key && holdable(e)) || null; } catch (e) { return null; } }
const boxOf = el => (el.matches('#field .fu') && el.querySelector('.body') || el).getBoundingClientRect();
// where the highlight starts in a fresh layer: the main action of that dialog or screen
const PREF = ['#ccGo', '.ccard', '.opt', '#again', '.otag', 'input[type=range]', '#bmDone', '#setOk', '#close', '.cx-item.on', '.cx-cat.on', '#cx-close', '#go', '#spin', '#fight2', '#lever'];
function pickDefault(list) { for (const s of PREF) { const e = list.find(x => x.matches(s)); if (e) return e; } return list[0] || null; }

function focusEl(el, auto = false) {
  autoF = auto;
  if (!el) { cur = null; curKey = null; return; }
  const changed = el !== cur; cur = el; curKey = keyOf(el); curRect = el.getBoundingClientRect(); curSym = el.matches('#reels .sym');
  if (changed) focusT = performance.now();
  const ae = document.activeElement;
  if (el.matches('button,input,a[href],[tabindex]')) { try { el.focus({ preventScroll: true }); } catch (e) {} }
  else if (ae && ae !== document.body && ae.blur) ae.blur();
  el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); // hover effects (blast target preview)
  ensureVisible(el);
}
const canScroll = el => { const cs = getComputedStyle(el);
  return (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) || (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2); };
function ensureVisible(el) { // scroll only real scrollers (never overflow:hidden boxes like the field), then the page
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (!canScroll(p)) continue;
    const r = el.getBoundingClientRect(), q = p.getBoundingClientRect(), m = 12;
    if (p.scrollHeight > p.clientHeight + 2) { if (r.top < q.top + m) p.scrollTop -= q.top + m - r.top; else if (r.bottom > q.bottom - m) p.scrollTop += r.bottom - q.bottom + m; }
    if (p.scrollWidth > p.clientWidth + 2) { if (r.left < q.left + m) p.scrollLeft -= q.left + m - r.left; else if (r.right > q.right - m) p.scrollLeft += r.right - q.right + m; }
  }
  const r = el.getBoundingClientRect(), m = 16;
  if (r.top < m) scrollBy(0, r.top - m); else if (r.bottom > innerHeight - m) scrollBy(0, Math.min(r.top - m, r.bottom - innerHeight + m));
}
// the highlighted element was re-rendered or removed: find it again, or the nearest thing to where it was
function refind() {
  const root = scope(), list = cands(root);
  let el = byKey(root, curKey);
  if (!el && curSym) el = list.find(e => e.id === 'blast') || null; // a blast just landed: back to the Blast button
  if (!el && root.id === 'ovl' && root.firstElementChild !== lastOvlChild) return focusEl(pickDefault(list), true); // a new dialog
  if (!el && curRect && list.length) {
    const cx = curRect.left + curRect.width / 2, cy = curRect.top + curRect.height / 2; let bd = Infinity;
    for (const e of list) { const r = e.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); if (d < bd) { bd = d; el = e; } }
  }
  focusEl(el || pickDefault(list), autoF);
}

// ---------- spatial navigation ----------
function score(a, b, dx, dy) {
  const h = dx !== 0, s = h ? dx : dy;
  const dc = h ? (b.left + b.width / 2) - (a.left + a.width / 2) : (b.top + b.height / 2) - (a.top + a.height / 2);
  if (dc * s <= 1) return Infinity;
  const edge = h ? (s > 0 ? b.left - a.right : a.left - b.right) : (s > 0 ? b.top - a.bottom : a.top - b.bottom);
  const gap = h ? Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)) : Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
  const off = h ? Math.abs((b.top + b.height / 2) - (a.top + a.height / 2)) : Math.abs((b.left + b.width / 2) - (a.left + a.width / 2));
  return Math.max(0, edge) + Math.abs(dc) * .15 + gap * 2.5 + off * .3;
}
function nav(dx, dy) {
  autoF = false;
  if (holdable(cur) && cur.matches('input[type=range]') && dx) return slide(cur, dx);
  const list = cands(scope());
  if (!holdable(cur)) return focusEl(pickDefault(list));
  const a = boxOf(cur); let best = null, bs = Infinity;
  for (const el of list) { if (el === cur) continue; const s = score(a, boxOf(el), dx, dy); if (s < bs) { bs = s; best = el; } }
  if (best) { focusEl(best); try { SFX.play('click', { vol: .16 }); } catch (e) {} }
  else ring.animate([{ translate: '0 0' }, { translate: `${dx * 5}px ${dy * 5}px` }, { translate: '0 0' }], { duration: 140 });
}
function slide(el, d) {
  const step = ((+el.max || 100) - (+el.min || 0)) / 20 || 5;
  el.value = Math.max(+el.min || 0, Math.min(+el.max || 100, +el.value + d * step));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  clearTimeout(slideT); slideT = setTimeout(() => el.dispatchEvent(new Event('change', { bubbles: true })), 260);
}

// ---------- the field: grab, carry, drop (mirrors the touch drag in game.src.html bindDrag) ----------
function grabUnit(id) {
  if (!R || R.phase === 'battle' || busy) return;
  const u = R.army.find(x => x.id === id); if (!u) return;
  grab = { id, x: u.x, y: u.y, hot: null, held: true, moved: 0 };
  R.sel = id; renderField(); // the info panel shows the unit (stats, Scrap) and matching units glow
  const el = unitEl(id), sh = el && el.querySelector('.sheet'); if (sh && SHEETS[u.type]?.clips.walk) play(sh, 'walk');
  bus.emit('unit_pick', { unit: u.type }); buzz(8);
}
function grabTick(dt, ix, iy) {
  const u = R && R.army.find(x => x.id === grab.id);
  if (!u || !free() || R.phase === 'battle' || busy || R.sel !== grab.id) return dropGrab(false);
  ix = Math.max(-1, Math.min(1, ix)); iy = Math.max(-1, Math.min(1, iy));
  if (ix || iy) {
    const ox = grab.x, oy = grab.y;
    [grab.x, grab.y] = clampDeploy(grab.x + ix * GRAB_SPEED[0] * dt, grab.y + iy * GRAB_SPEED[1] * dt);
    if (grab.held) grab.moved += Math.hypot(grab.x - ox, grab.y - oy);
  }
  let hot = null, best = 4.5; // same reach as the touch drag
  for (const v of R.army) { if (v === u) continue; const d = Math.hypot((v.x - grab.x) / 1.4, v.y - grab.y); if (d < best) { best = d; hot = v; } }
  if (hot !== grab.hot) { if (grab.hot) unitEl(grab.hot.id)?.classList.remove('mergehot', 'swaphot'); grab.hot = hot; if (hot) { buzz(5); rumble(.15, 30); } }
  if (hot) unitEl(hot.id)?.classList.add(canMerge(u, hot) ? 'mergehot' : 'swaphot');
  document.getElementById('field')?.classList.add('placing', 'dragging-on');
  const el = unitEl(u.id); // re-applied every frame: a re-render puts the unit back home otherwise
  if (el) { el.classList.add('dragging'); el.classList.remove('sel'); place(el, grab.x, grab.y, u.type); el.style.zIndex = 999; }
}
// drop=true: land it here (merge / swap / move). drop=false: put it back where it was.
function dropGrab(drop = true) {
  const g = grab; grab = null; if (!g || !R) return;
  document.querySelectorAll('#field .fu.mergehot,#field .fu.swaphot').forEach(o => o.classList.remove('mergehot', 'swaphot'));
  document.getElementById('field')?.classList.remove('dragging-on');
  const u = R.army.find(x => x.id === g.id);
  if (!drop || !u || R.phase === 'battle' || busy) { if (R.sel === g.id) R.sel = null; if (u && R.phase !== 'battle' && !busy && document.getElementById('field')) renderField(); return; }
  const hot = g.hot && R.army.includes(g.hot) ? g.hot : null, el = unitEl(u.id);
  el?.classList.remove('dragging');
  if (hot && canMerge(u, hot)) { bus.emit('unit_drop', { unit: u.type, merge: true }); curKey = `div[data-id="${hot.id}"]`; return mergeUnits(u, hot); }
  R.sel = null;
  if (hot) { // swap: the carried unit takes the other's spot, the other walks to where the carried one started
    const hx = hot.x, hy = hot.y; hot.x = u.x; hot.y = u.y; u.x = hx; u.y = hy;
    if (el) place(el, hx, hy, u.type);
    const oe = unitEl(hot.id); if (oe) { oe.classList.add('glide'); oe.style.transitionDuration = '320ms'; place(oe, hot.x, hot.y, hot.type); }
    bus.emit('unit_drop', { unit: u.type }); setTimeout(() => R && R.phase !== 'battle' && renderField(), 340); return;
  }
  u.x = g.x; u.y = g.y;
  if (el) { const c = rc(el); FX.dust(c.x, c.y + c.h * .35, 3); el.classList.add('landed'); }
  buzz(10); bus.emit('unit_drop', { unit: u.type }); setTimeout(() => R && R.phase !== 'battle' && renderField(), 220);
}

// ---------- buttons ----------
function pressA() {
  if (grab) { if (!grab.held) dropGrab(true); return; }
  const list = cands(scope());
  if (!holdable(cur)) return focusEl(pickDefault(list));
  autoF = false;
  const el = cur;
  if (el.id === 'lever' || el.id === 'spin' && el.disabled) return spinPad(); // a locked spin still gets the game's "why not" feedback
  if (el.disabled) return;
  if (el.matches('#field .fu[data-id]')) return grabUnit(+el.dataset.id);
  if (el.matches('input[type=range]')) return;
  if (el.matches('.machine .controls .btn,.nudges button')) { el.classList.add('pressed'); bus.emit('button_press', { id: el.id || 'nudge' }); setTimeout(() => el.classList.remove('pressed'), 140); }
  el.click();
}
function back() {
  if (grab) return dropGrab(false);
  const tips = document.querySelectorAll('.ctip'); if (tips.length) return tips.forEach(t => t.remove());
  if (codexOpen()) { const b = [...document.querySelectorAll('#codex [data-back]')].find(ok); return b ? b.click() : Codex.close(); }
  const o = ovl(); if (o) { const c = ['#bmDone', '#close', '#setOk'].map(s => o.querySelector(s)).find(ok); if (c) c.click(); return; } // a choice (class, cache, run end) has no back
  if (!inGame() || busy) return;
  if (R.blast) { document.getElementById('blast')?.click(); return focusEl(document.getElementById('blast')); }
  if (R.sel != null && R.phase !== 'battle') { R.sel = null; renderField(); }
}
function spinPad() { // the same as Space: pull the lever, or slam-stop a spin that is running
  if (!free()) return;
  if (grab) dropGrab(false);
  const lb = document.getElementById('leverbay');
  if (!lb || !lb.offsetParent) { const m = document.getElementById('mode'); if (m && !m.disabled && m.dataset.m === 'slot') m.click(); return; } // phone layout on the Field tab
  if (busy) return skipNow();
  if (!canSpin()) return window.grab({ pointerId: -1, clientY: 0, timeStamp: performance.now(), currentTarget: lb, preventDefault() {} }, 'lever'); // the game's own "can't spin" feedback
  autoPull('pad');
}
function blastPad() {
  if (!free()) return;
  if (grab) { const id = grab.id; grab = null; if (R.sel === id && R.phase !== 'battle' && !busy) { rumble(.5, 120); scrap(); } return; }
  const b = document.getElementById('blast'); if (!b || b.disabled) return;
  b.click();
  if (R.blast) focusEl(document.querySelector('#reels .sym[data-i="4"]') || document.getElementById('blast'));
  else focusEl(document.getElementById('blast'));
}
function battlePad() {
  if (!free()) return;
  if (grab) dropGrab(false);
  const b = document.getElementById('fight2');
  if (b && !b.disabled) b.click(); else if (R.phase !== 'battle' && !busy && !army().length) startBattle(); // says "no units"
}
function shopPad() {
  if (codexOpen()) return;
  const o = ovl(); if (o) { o.querySelector('#bmDone')?.click(); return; } // LT again closes the Black Market
  if (!inGame()) return; if (grab) dropGrab(false);
  const b = document.getElementById('shop'); if (b && !b.disabled) b.click();
}
function kitPad() {
  if (codexOpen()) return;
  const o = ovl(); if (o) { if (o.querySelector('.kitcores')) o.querySelector('#close')?.click(); return; }
  if (!inGame()) return; if (grab) dropGrab(false);
  document.getElementById('parts')?.click();
}
function speedPad() { if (free()) document.getElementById('spd')?.click(); }
function settingsPad() {
  if (codexOpen()) return;
  const o = ovl(); if (o) { o.querySelector('#setOk')?.click(); return; }
  if (grab) dropGrab(false); openSettings();
}
function codexPad() { if (codexOpen()) return Codex.close(); if (ovl()) return; if (grab) dropGrab(false); Codex.open(); }
function scrollPad(rx, ry, dt) {
  const root = scope(); let t = null;
  if (root.id === 'codex') { const d = root.querySelector('#cx-doc'); if (d && canScroll(d)) t = d; }
  for (let p = cur && cur.isConnected && cur.parentElement; !t && p && p !== document.body; p = p.parentElement) if (canScroll(p)) t = p;
  if (!t && root.id !== 'app') t = [...root.querySelectorAll('*')].find(canScroll) || null;
  const v = 1100 * dt;
  if (t) { t.scrollLeft += rx * v; t.scrollTop += ry * v; } else scrollBy(rx * v, ry * v);
}

// ---------- rumble on the game's own cues ----------
function rumble(m, ms) {
  if (!on) return;
  for (const p of pads) { const a = p.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, weakMagnitude: Math.min(1, m), strongMagnitude: Math.min(1, m * .8) }).catch(() => {}); }
}
const RUMBLE = { lever_release: d => [.3 + .5 * (d.power || 0), 90], lever_denied: () => [.35, 60], slam_stop: () => [.4, 50], line_win: () => [.35, 70],
  jackpot: () => [1, 450], merge: () => [.7, 160], life_lost: () => [.9, 300], nudge_clunk: () => [.3, 45], lever_ratchet: () => [.12, 25], unit_drop: () => [.25, 40] };
window.degenCues?.on('*', (e, d) => { const f = RUMBLE[e]; if (f) rumble(...f(d || {})); });

// ---------- input mode: the pad shows the layer, a mouse or a touch hides it ----------
function wake() {
  on = true; document.documentElement.classList.add('gp-on');
  if (!holdable(cur)) focusEl(pickDefault(cands(scope())), true);
}
function sleepPad() {
  if (!on) return; on = false; document.documentElement.classList.remove('gp-on');
  if (grab) dropGrab(false);
  ring.classList.remove('on'); ring.style.display = ''; tip.classList.remove('on'); legend.classList.remove('on'); GLYPHS.forEach(g => g.e.classList.remove('on'));
}
addEventListener('pointerdown', e => { if (e.isTrusted) sleepPad(); }, { capture: true, passive: true });
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const d = Math.abs(e.screenX - mx) + Math.abs(e.screenY - my); mx = e.screenX; my = e.screenY; if (d > 3) sleepPad(); }, { capture: true, passive: true });
addEventListener('keydown', e => { if (e.isTrusted) sleepPad(); }, { capture: true, passive: true });

// ---------- the loop ----------
function readPads() {
  pads = [...navigator.getGamepads()].filter(p => p && p.connected);
  if (!pads.length) return null;
  const btn = new Array(17).fill(false), ax = [0, 0, 0, 0];
  for (const p of pads) { // merged: a handheld can expose its built-in pad twice
    p.buttons.forEach((b, i) => { if (i < 17 && (i === BT.LT || i === BT.RT ? b.value > .45 : b.pressed || b.value > .5)) btn[i] = true; });
    for (let i = 0; i < 4; i++) if (Math.abs(p.axes[i] || 0) > Math.abs(ax[i])) ax[i] = p.axes[i] || 0;
  }
  return { btn, ax };
}
const dz = (x, y, d) => { const m = Math.hypot(x, y); if (m < d) return [0, 0]; const k = Math.min(1, (m - d) / (1 - d)) / m; return [x * k, y * k]; };
function step(s, t, dt) {
  const now = s.btn, hit = i => now[i] && !prev[i];
  const [lx, ly] = dz(s.ax[0], s.ax[1], .2), [rx, ry] = dz(s.ax[2], s.ax[3], .2);
  const dpx = (now[BT.RIGHT] ? 1 : 0) - (now[BT.LEFT] ? 1 : 0), dpy = (now[BT.DOWN] ? 1 : 0) - (now[BT.UP] ? 1 : 0);
  const pressed = now.some((v, i) => v && !prev[i]), moving = Math.hypot(lx, ly) > .3 || Math.hypot(rx, ry) > .3;
  const woke = (pressed || moving) && !on;
  if (woke) wake();
  if (pressed || moving) { try { stopAttract(); armIdle(); } catch (e) {} }
  if (pressed) { try { const c = SFX.init(); if (c && c.state === 'suspended') c.resume(); if (SFX.track && SFX.track.el.paused) SFX.track.el.play().catch(() => {}); } catch (e) {} }
  if (on) {
    if (hit(BT.A) && !woke) pressA(); // the first touch of the pad only shows the highlight
    if (!now[BT.A] && prev[BT.A] && grab && grab.held) { grab.held = false; if (grab.moved > 2.5) dropGrab(true); } // hold A, carry, let go
    if (hit(BT.B)) back();
    if (hit(BT.X)) spinPad();
    if (hit(BT.Y)) blastPad();
    if (hit(BT.LB)) battlePad();
    if (hit(BT.LT)) shopPad();
    if (hit(BT.RT)) speedPad();
    if (hit(BT.RB)) kitPad();
    if (hit(BT.MENU)) settingsPad();
    if (hit(BT.VIEW)) codexPad();
    if (grab) { navHeld = null; grabTick(dt, lx + dpx, ly + dpy); }
    else {
      let d = null;
      if (dpx || dpy) d = dpx && (!dpy || Math.abs(dpx) >= Math.abs(dpy)) ? [dpx, 0] : [0, dpy];
      else if (Math.hypot(lx, ly) > .55) d = Math.abs(lx) > Math.abs(ly) ? [Math.sign(lx), 0] : [0, Math.sign(ly)];
      const k = d && d.join();
      if (!k) navHeld = null;
      else if (k !== navHeld) { navHeld = k; navNext = t + 380; if (!woke) nav(d[0], d[1]); }
      else if (t >= navNext) { navNext = t + 115; nav(d[0], d[1]); }
    }
    if (rx || ry) scrollPad(rx, ry, dt);
  }
  prev = now;
}
function paint(t) {
  const root = scope();
  if (view !== lastView || R !== lastRun) { // base <-> run, or a new run: start on the main button
    lastView = view; lastRun = R; memo.clear();
    if (root.id === 'app') { lastRoot = root; focusEl(pickDefault(cands(root)), true); }
  }
  if (root !== lastRoot) { // a dialog opened or closed: remember where we were, come back to it later
    if (lastRoot && cur && lastRoot.contains(cur)) memo.set(lastRoot, curKey);
    lastRoot = root; const back = byKey(root, memo.get(root));
    cur = null; focusEl(back || pickDefault(cands(root)), !back);
  } else if (!holdable(cur)) refind();
  else if (autoF && root.id !== 'app' && t > defT) { defT = t + 250; const d = pickDefault(cands(root)); if (d && d !== cur) focusEl(d, true); } // a better default appeared (cache cards dealt)
  lastOvlChild = document.getElementById('ovl')?.firstElementChild || null;
  if (cur && cur.isConnected) curRect = cur.getBoundingClientRect();

  const showRing = !grab && cur && cur.isConnected;
  if (showRing) { const r = boxOf(cur); ring.style.transform = `translate(${r.left - 4}px,${r.top - 4}px)`; ring.style.width = r.width + 8 + 'px'; ring.style.height = r.height + 8 + 'px'; }
  ring.style.display = showRing ? 'block' : 'none'; ring.classList.toggle('dim', !!(showRing && cur.disabled));

  let txt = '';
  if (showRing && t - focusT > 380) {
    if (cur.matches('#field .fu[data-id]') && R) { const u = R.army.find(x => x.id === +cur.dataset.id); if (u) txt = `${uname(u)} · Lv${u.lvl}`; }
    else txt = cur.getAttribute('title') || '';
  }
  if (txt) {
    if (tip.textContent !== txt) tip.textContent = txt;
    tip.classList.add('on');
    const r = boxOf(cur), w = tip.offsetWidth, h = tip.offsetHeight; let y = r.bottom + 10; if (y + h > innerHeight - 4) y = r.top - h - 10;
    tip.style.transform = `translate(${Math.max(4, Math.min(innerWidth - w - 4, r.left + r.width / 2 - w / 2))}px,${Math.max(4, y)}px)`;
  } else tip.classList.remove('on');

  for (const g of GLYPHS) {
    const el = (!g.when || g.when()) && root.querySelector(g.sel); let show = false;
    if (el && (!el.checkVisibility || el.checkVisibility({ checkVisibilityCSS: true }))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) { show = true; g.e.style.transform = `translate(${Math.max(2, r.left - 8)}px,${Math.max(2, r.top - 8)}px)`; g.e.classList.toggle('dim', !!el.disabled); }
    }
    g.e.classList.toggle('on', show);
  }

  let L = '';
  if (grab && R) {
    const u = R.army.find(x => x.id === grab.id), act = grab.hot ? (canMerge(u, grab.hot) ? 'Merge' : 'Swap') : 'Drop';
    L = `<span>${glyph('L')}Move</span><span>${glyph('A')}${act}</span><span>${glyph('B')}Put back</span><span>${glyph('Y')}Scrap</span>`;
  } else if (root.id === 'app' && inGame() && R.blast) L = `<span>${glyph('A')}Blast this symbol</span><span>${glyph('B')}Cancel</span>`;
  else if (root.id === 'app' && cur && cur.matches('#field .fu[data-id]')) L = `<span>${glyph('A')}Grab</span><span>${glyph('L')}Carry it onto a match to merge</span>`;
  if (L !== legendHTML) { legendHTML = L; legend.innerHTML = L; }
  legend.classList.toggle('on', !!L);
}
function frame(t) {
  const dt = Math.min(.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  try { const s = readPads(); if (s) step(s, t, dt); if (on) paint(t); } catch (e) { console.warn('gamepad', e); }
  requestAnimationFrame(frame);
}
function start() { if (running) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }
addEventListener('gamepadconnected', start);
addEventListener('gamepaddisconnected', () => { if (![...navigator.getGamepads()].some(p => p && p.connected)) sleepPad(); });
if ([...navigator.getGamepads()].some(Boolean)) start();
})();
