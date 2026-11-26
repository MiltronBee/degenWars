// degenWars server: static files + live market feed.
// Run: node server.mjs  (PORT=8811, binds 127.0.0.1)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8811;
const BLOCK = /^\/(tools|server\.mjs|node_modules)(\/|$)|\/\./; // no scripts, no dotfiles
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary' };

// ---------- market feed ----------
const sol = { price: null, t: 0, src: null, candles: [] }; // candles: [t,o,h,l,c] ascending, 1-minute
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'degenwars-feed' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
async function pollTicker() {
  try {
    const j = await getJSON('https://api.exchange.coinbase.com/products/SOL-USD/ticker');
    sol.price = +j.price; sol.t = Date.parse(j.time) || Date.now(); sol.src = 'coinbase';
  } catch {
    try {
      const j = await getJSON('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
      sol.price = +j.price; sol.t = Date.now(); sol.src = 'binance';
    } catch (e) { console.error('ticker failed', e.message); }
  }
}
async function pollCandles() {
  try {
    const rows = await getJSON('https://api.exchange.coinbase.com/products/SOL-USD/candles?granularity=60');
    // coinbase: [time, low, high, open, close, volume], newest first
    sol.candles = rows.slice(0, 60).reverse().map(([t, l, h, o, c]) => [t * 1000, o, h, l, c]);
  } catch (e) { console.error('candles failed', e.message); }
}
const pct = (a, b) => (a && b ? (100 * (a - b)) / b : 0);
function snapshot() {
  const c = sol.candles, n = c.length, p = sol.price ?? (n ? c[n - 1][4] : null);
  const closeAgo = (m) => (n > m ? c[n - 1 - m][4] : n ? c[0][1] : null);
  const rets = [];
  for (let i = Math.max(1, n - 15); i < n; i++) rets.push(pct(c[i][4], c[i - 1][4]));
  const mean = rets.reduce((s, x) => s + x, 0) / (rets.length || 1);
  const vol = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length || 1)); // % stdev of 1m returns
  const chg1m = pct(p, closeAgo(1)), chg5m = pct(p, closeAgo(5)), chg15m = pct(p, closeAgo(15));
  // Market weather. Thresholds are first guesses; tune with real play.
  let weather = 'crab';
  if (vol > 0.18 || Math.abs(chg1m) > 0.35) weather = 'volatile';
  else if (chg5m > 0.25) weather = 'bull';
  else if (chg5m < -0.25) weather = 'bear';
  return {
    ok: p != null, now: Date.now(),
    sol: { price: p, t: sol.t, src: sol.src, chg1m, chg5m, chg15m, vol, candles: c.slice(-30) },
    token: null, // our pump.fun token goes here after launch (price, holders, recent buys)
    weather,
  };
}
pollTicker(); pollCandles();
setInterval(pollTicker, 3000);
setInterval(pollCandles, 20000);

// ---------- http ----------
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/market') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(snapshot()));
  }
  if (url.pathname === '/api/ground' && req.method === 'POST') { // ground-plane calibration from lab/ground.html
    let body = '';
    req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      try {
        const j = JSON.parse(body), out = {};
        for (const k of ['field', 'tall']) {
          const g = j[k];
          if (!g) continue;
          const okQuad = Array.isArray(g.quad) && g.quad.length === 4 && g.quad.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) < 5));
          if (!okQuad || !Number.isFinite(g.nearH) || g.nearH <= 0 || g.nearH > 1) throw new Error('bad ' + k);
          out[k] = { quad: g.quad, nearH: g.nearH };
          if (g.horizon !== undefined) { if (!Number.isFinite(g.horizon) || Math.abs(g.horizon) > 5) throw new Error('bad horizon ' + k); out[k].horizon = g.horizon; }
        }
        fs.writeFileSync(path.join(ROOT, 'data', 'ground.json'), JSON.stringify(out, null, 1));
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (e) { res.writeHead(400); res.end(String(e.message)); }
    });
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || BLOCK.test(p)) { res.writeHead(404); return res.end('not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const head = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': p.endsWith('.html') ? 'no-cache' : 'max-age=300', 'Accept-Ranges': 'bytes' };
    // byte ranges: the browser needs them to seek in audio (music resumes where it left off)
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let a = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`degenWars on http://127.0.0.1:${PORT}`));
