// node tools/sim-run.mjs <page.html> <jobs.json> <out.json> [tabs]: runs window.dwSim.run(job) for every job in headless Chrome (PORT 9451), several tabs in parallel
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [page, jobsF, outF, nTabs = '8'] = process.argv.slice(2);
const PORT = process.env.PORT || 9451, jobs = JSON.parse(fs.readFileSync(jobsF, 'utf8'));
const T = page.replace(/\.html$/, '') + '._sim.html';
fs.writeFileSync(T, fs.readFileSync(page, 'utf8').split('\n').filter(l => !l.includes('fonts.googleapis')).join('\n'));
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/dw-sim-' + PORT, '--allow-file-access-from-files',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--renderer-process-limit=64', '--site-per-process', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break } catch { await sleep(250) } }
const url = 'file://' + fs.realpathSync(T) + '?sim=1';
async function tab() {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id] }
    if (m.method === 'Runtime.exceptionThrown') console.error('EXC', JSON.stringify(m.params.exceptionDetails).slice(0, 400)) };
  const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) });
  await send('Runtime.enable');
  for (let i = 0; i < 80; i++) { const r = await send('Runtime.evaluate', { expression: '!!window.dwSim', returnByValue: true }); if (r.result?.result?.value) break; await sleep(250) }
  return { ev: async job => { const r = await send('Runtime.evaluate', { expression: `window.dwSim.${process.env.PROBE?"probe":"run"}(${JSON.stringify(job)})`, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value } };
}
const tabs = await Promise.all(Array.from({ length: +nTabs }, tab));
const out = []; let next = 0, t0 = Date.now();
await Promise.all(tabs.map(async tb => { while (next < jobs.length) { const k = next++; out[k] = await tb.ev(jobs[k]); process.stderr.write(`${out.filter(Boolean).length}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)}s\r`) } }));
fs.writeFileSync(outF, JSON.stringify(out)); console.error('\ndone', ((Date.now() - t0) / 1000).toFixed(1) + 's');
ch.kill(); fs.unlinkSync(T); process.exit(0);
