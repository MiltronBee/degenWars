// node cdp.mjs <url> <out.png> <waitMs> : headless Chrome via DevTools, prints console errors, saves a screenshot
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [url, out, wait = '3000'] = process.argv.slice(2);
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--password-store=basic', '--remote-debugging-port=' + (process.env.PORT||9333) + '', '--user-data-dir=' + (process.env.PROF||'/tmp/dw-cdp'), '--allow-file-access-from-files', '--window-size=1600,1000',
  '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:' + (process.env.PORT||9333) + '/json')).json(); break } catch { await sleep(250) } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })) });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id] }
  if (m.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', JSON.stringify(m.params.exceptionDetails).slice(0, 600));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'log'].includes(m.params.type)) console.log('console.' + m.params.type, m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') console.log('LOG', m.params.entry.text.slice(0, 200), m.params.entry.url || ''); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +(process.env.W||1600), height: +(process.env.H||1000), deviceScaleFactor: 1, mobile: +(process.env.W||1600) < 980 });
await send('Page.navigate', { url }); await sleep(+wait);
const r = await send('Runtime.evaluate', { expression: '"scroll "+document.documentElement.scrollHeight+"/"+innerHeight+" body "+document.body.scrollHeight+" app "+document.querySelector("#app").offsetHeight+" | "+document.querySelectorAll(".fu").length+" fu, "+document.querySelectorAll(".fu.sp").length+" sprite units"', returnByValue: true });
console.log('dom:', r?.result?.value);
const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
ch.kill(); process.exit(0);
