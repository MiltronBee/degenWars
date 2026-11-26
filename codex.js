// degenWars Codex: data-driven dossier archive (Mass Effect style).
// Data: data/codex.json. Plates: art/codex/<id with dots as dashes>.webp (optional).
// Progress lives in localStorage 'degenWars.codex.v1' = {u:{id:1}, r:{id:1}} (unlocked, read).
// Game hooks: Codex.unlock(type, ref). Dev: add ?codex=all to the URL to preview every entry.
window.Codex = (() => {
  const KEY = 'degenWars.codex.v1';
  // The MVP's enemy ids differ from the design names; map them for unlock refs.
  const ALIAS = { drone: 'saucer', scrap: 'scrapbot', jugg: 'juggernaut', overlord: 'overlord', brute: 'mother-rot',
    // shop item ids in the MVP -> Codex item names
    cell: 'power-cell', gear: 'reverse-gear', coil: 'nudge-coil', damp: 'cost-dampener', kevlar: 'kevlar-weave',
    over: 'overclock', charge: 'blast-charge', recruit: 'recruit-papers', battery: 'battery-pack' };
  let data = null, st = { u: {}, r: {} }, view = { cat: null, id: null }, queue = [], holdToasts = () => false;
  const all = new URLSearchParams(location.search).get('codex') === 'all';
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.u) st = s; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s ?? '').toLowerCase().replace(/^the[-\s]+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const isOpen = e => all || !!st.u[e.id];
  const plate = e => `art/codex/${e.id.replace(/\./g, '-')}.webp`;

  const ready = fetch('data/codex.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => {
    data = d && d.entries ? d : { categories: [], entries: [] };
    unlock('start', 'first-launch'); unlock('start', 'tutorial');
    return data;
  }).catch(() => { data = { categories: [], entries: [] }; });

  // ---- unlocking -------------------------------------------------------------
  function matches(e, type, ref) {
    const u = e.unlock || {};
    if (u.type !== type) return false;
    if (u.ref == null) return true;
    if (ref == null) return false;
    const a = slug(ALIAS[ref] || ref), b = slug(u.ref);
    return a === b;
  }
  function unlock(type, ref) {
    if (!data) { ready.then(() => unlock(type, ref)); return; }
    const fresh = data.entries.filter(e => !st.u[e.id] && matches(e, type, ref));
    if (!fresh.length) return;
    fresh.forEach(e => { st.u[e.id] = 1; queue.push(e); });
    save(); badge(); flush();
  }
  function flush() {
    if (!queue.length || holdToasts() || document.querySelector('.cx-stamp')) return;
    const e = queue.shift();
    const t = document.createElement('button');
    t.className = 'cx-stamp';
    t.innerHTML = `<span class="cx-stamp-k">New dossier</span><b>${esc(e.title)}</b><small>${esc(catName(e.category))}</small>`;
    t.onclick = () => { t.remove(); open(e.id); };
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); flush(); }, 400); }, 3200);
  }

  // ---- helpers ----------------------------------------------------------------
  const cats = () => data.categories.filter(c => data.entries.some(e => e.category === c.id));
  const catName = id => (data.categories.find(c => c.id === id) || { name: id }).name;
  const inCat = id => data.entries.filter(e => e.category === id);
  const unread = () => data ? data.entries.filter(e => isOpen(e) && !st.r[e.id]).length : 0;
  function progress() {
    if (!data || !data.entries.length) return { pct: 0, open: 0, total: 0, unread: 0 };
    const open = data.entries.filter(isOpen).length;
    return { pct: Math.round(100 * open / data.entries.length), open, total: data.entries.length, unread: unread() };
  }
  function badge() {
    document.querySelectorAll('[data-codex-badge]').forEach(b => {
      const n = unread(); b.textContent = n ? n : ''; b.hidden = !n;
    });
  }
  function hint(e) {
    const u = e.unlock || {}, r = u.ref ? String(u.ref).replace(/-/g, ' ') : '';
    return ({
      summon: `Summon a ${r} to declassify.`, encounter: `Encounter a ${r} in battle.`, kill: `Destroy a ${r}.`,
      boss: `Defeat ${r}.`, core: 'Acquire this core.', item: 'Acquire this item.', faction: 'Join or meet this faction.',
      call: 'Make a Call on a judgement wave.', liquidation: 'Survive a liquidation.', weather: `Fight in ${r || 'this'} weather.`,
      building: 'Build this at the Forward Base.', wave: `Reach wave ${r}.`, start: 'Available from the start.'
    })[u.type] || 'Keep fighting to declassify.';
  }

  // ---- rendering ----------------------------------------------------------------
  function shell() {
    let o = document.getElementById('codex');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'codex'; o.className = 'cx'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Codex');
    o.innerHTML = `<div class="cx-in"><header class="cx-top"><div class="cx-brand">Codex <span id="cx-prog"></span></div>
      <button class="cx-x" id="cx-close" aria-label="Close codex">✕</button></header>
      <nav class="cx-cats" id="cx-cats"></nav><div class="cx-list" id="cx-list"></div><article class="cx-doc" id="cx-doc"></article></div>`;
    document.body.appendChild(o);
    o.querySelector('#cx-close').onclick = close;
    o.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
    return o;
  }
  function draw() {
    const o = shell(), p = progress();
    o.querySelector('#cx-prog').textContent = `${p.pct}% · ${p.open}/${p.total} declassified${all ? ' · preview: all unlocked' : ''}`;
    o.querySelector('#cx-cats').innerHTML = cats().map(c => {
      const es = inCat(c.id), n = es.filter(isOpen).length, nu = es.filter(e => isOpen(e) && !st.r[e.id]).length;
      return `<button class="cx-cat ${c.id === view.cat ? 'on' : ''}" data-c="${esc(c.id)}"><b>${esc(c.name)}</b><small>${n}/${es.length}${nu ? ` · <i>${nu} new</i>` : ''}</small></button>`;
    }).join('');
    const es = inCat(view.cat);
    o.querySelector('#cx-list').innerHTML = `<h3>${esc(catName(view.cat))}</h3>` + es.map(e => {
      const op = isOpen(e);
      return `<button class="cx-item ${e.id === view.id ? 'on' : ''} ${op ? '' : 'locked'} ${op && !st.r[e.id] ? 'new' : ''}" data-id="${esc(e.id)}">
        <b>${op ? esc(e.title) : '▇▇▇▇ ▇▇▇'}</b><small>${op ? esc(e.subtitle || '') : 'Classified'}</small>${e.kind === 'primary' ? '<em>Primary</em>' : ''}</button>`;
    }).join('');
    o.querySelectorAll('.cx-cat').forEach(b => b.onclick = () => { view.cat = b.dataset.c; const f = inCat(view.cat).find(isOpen); view.id = f ? f.id : null; o.classList.remove('reading'); draw(); });
    o.querySelectorAll('.cx-item').forEach(b => b.onclick = () => { view.id = b.dataset.id; o.classList.add('reading'); draw(); o.querySelector('#cx-doc').scrollTop = 0; });
    doc();
  }
  function doc() {
    const el = document.getElementById('cx-doc'), e = data.entries.find(x => x.id === view.id);
    if (!e) { el.innerHTML = `<div class="cx-empty">Select a dossier.</div>`; return; }
    if (!isOpen(e)) {
      el.innerHTML = `<button class="cx-back" data-back>← Back</button><div class="cx-sealed"><div class="cx-seal">CLASSIFIED</div><p>${esc(hint(e))}</p></div>`;
    } else {
      st.r[e.id] = 1; save(); badge();
      const stats = e.stats && Object.keys(e.stats).length ? `<table class="cx-stats"><tbody>${Object.entries(e.stats).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('')}</tbody></table>` : '';
      el.innerHTML = `<button class="cx-back" data-back>← Back</button>
        <figure class="cx-plate"><img alt="" src="${plate(e)}" onerror="this.parentNode.classList.add('none');this.remove()"><span class="cx-plate-k">${esc((e.category || '').toUpperCase())}</span></figure>
        <div class="cx-head"><span class="cx-class">${esc(e.classification || 'Open')}</span><span>${esc(e.source || 'Exchange Archive')}${e.ledgerYear ? ` · Year ${esc(e.ledgerYear)} of the Ledger` : ''}</span></div>
        <h2>${esc(e.title)}</h2>${e.subtitle ? `<p class="cx-sub">${esc(e.subtitle)}</p>` : ''}
        ${(e.text || []).map(t => `<p>${esc(t)}</p>`).join('')}
        ${stats}
        ${e.fieldNotes ? `<aside class="cx-notes"><b>Field notes</b>${esc(e.fieldNotes)}</aside>` : ''}
        ${e.kind === 'primary' ? '<p class="cx-narr">Primary dossier · narration coming</p>' : ''}`;
    }
    el.querySelector('[data-back]').onclick = () => { document.getElementById('codex').classList.remove('reading'); };
    document.querySelectorAll('#cx-list .cx-item').forEach(b => b.classList.toggle('new', !!(st.u[b.dataset.id] && !st.r[b.dataset.id] && !all)));
  }
  async function open(id) {
    await ready;
    shell();
    const e = id && data.entries.find(x => x.id === id);
    view.cat = e ? e.category : (view.cat || (cats()[0] || {}).id);
    view.id = e ? e.id : (view.id || ((inCat(view.cat).find(isOpen)) || {}).id || null);
    const o = document.getElementById('codex');
    o.classList.add('show'); if (e) o.classList.add('reading');
    draw(); o.querySelector('#cx-close').focus();
  }
  function close() { const o = document.getElementById('codex'); if (o) o.classList.remove('show', 'reading'); flush(); }

  return {
    ready, open, close, unlock, progress, badge,
    // the game tells the Codex when toasts must wait (e.g. during a battle)
    setHold(fn) { holdToasts = fn; }, flush,
  };
})();
