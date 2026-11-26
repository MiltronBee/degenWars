import {spawn} from 'child_process';import fs from 'fs';
const port=9350+Math.floor(Math.random()*40),dir='/tmp/dwtest-slot';fs.mkdirSync(dir,{recursive:true});
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${dir}/prof${port}`,'about:blank'],{stdio:'ignore',detached:true});
const LOG=(...a)=>fs.appendFileSync('/tmp/dwtest-slot/out.txt',a.join(' ')+'\n');console.log=LOG;setTimeout(()=>{LOG('WATCHDOG timeout; errors:',JSON.stringify(errs));try{process.kill(-ch.pid)}catch(e){};ch.kill('SIGKILL');process.exit(2)},170000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
LOG("port",port);for(let i=0;i<40;i++){try{await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(e){}await sleep(250)}
const URL0='file:///home/miltron/degenWars/lab/_test-slot.html';let ws,connected=false;
const MK=await (await fetch('http://127.0.0.1:8811/api/market')).text();
async function connect(tag){if(connected)return;connected=true;const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const pg=list.find(t=>t.type==='page');ws=new WebSocket(pg.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);ws.onmessage=onmsg;await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Log.enable');
 await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const MK=${JSON.stringify(MK)};const f=window.fetch;window.fetch=(u,o)=>String(u).includes('/api/market')?Promise.resolve(new Response(MK,{headers:{'content-type':'application/json'}})):f(u,o)})()`});}
let id=0;const pend={},errs=[];
const onmsg=m=>{const d=JSON.parse(m.data);if(d.id&&pend[d.id]){pend[d.id](d);delete pend[d.id]}
 if(d.method==='Runtime.exceptionThrown')errs.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);
 if(d.method==='Runtime.consoleAPICalled'&&(d.params.type==='error'||d.params.type==='warning'))errs.push('console: '+d.params.args.map(a=>a.value||a.description).join(' '));
 if(d.method==='Log.entryAdded'&&d.params.entry.level==='error')errs.push('log: '+d.params.entry.text+' '+(d.params.entry.url||''))};
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
const ev=async e=>{const r=await Promise.race([cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true}),sleep(15000).then(()=>({result:{exceptionDetails:{exception:{description:'TIMEOUT'}}}}))]);if(r.result?.exceptionDetails)errs.push('eval: '+e.slice(0,60)+' -> '+r.result.exceptionDetails.exception?.description);return r.result?.result?.value};
const shot=async n=>{const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${dir}/slot-${n}.png`,Buffer.from(r.result.data,'base64'))};
const reset=`(lab.S.energy=150,lab.S.spinsUsed=0,lab.S.nudges=3,lab.S.blasts=3,1)`;
async function run(w,h,mobile,tag){LOG("run",tag);
 await connect(tag);await cmd('Page.bringToFront');LOG('conn');await cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:mobile?2:1,mobile});
 LOG('metrics');await cmd('Page.navigate',{url:URL0+'?'+tag});LOG('reloaded');await sleep(2800);LOG('probe',await ev('document.readyState+" "+typeof lab+" "+document.querySelectorAll(".sym").length'));
 await shot(tag+'-idle');LOG('shot');
 const geo=await ev(`JSON.stringify({doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cab:document.querySelector('#cab').getBoundingClientRect().toJSON(),lever:document.querySelector('#leverbay').getBoundingClientRect().toJSON()})`);
 console.log(tag,'geo',geo);console.log(tag,'mk',await ev(`fetch('/api/market').then(r=>r.text()).then(t=>t.slice(0,80)+' | '+JSON.stringify(lab.S.mk)).catch(e=>'ERR '+e)`));
 // near miss
 await ev(reset);await ev(`lab.force('near');lab.spin()`);
 await ev(`lab.waitCue('tease_start')`);await sleep(350);await shot(tag+'-tease');
 await ev(`lab.waitCue('near_miss')`);await sleep(250);await shot(tag+'-nearmiss');
 await ev(`lab.idle()`);await sleep(300);
 // combo
 await ev(reset);await ev(`lab.force('combo');lab.spin()`);
 await ev(`lab.waitCue('stamp')`);await sleep(260);await shot(tag+'-combo');
 await ev(`lab.idle()`);await sleep(400);
 // chain: rigged nudge, then blast
 await ev(reset);await ev(`lab.rig('nudge');void lab.nudge(0)`);await ev(`lab.idle()`);
 await ev(`lab.rig('blast');void lab.blast(4)`);await ev(`lab.waitCue('blast_boom')`);await sleep(120);await shot(tag+'-blast');await ev(`lab.idle()`);
 // full board
 await ev(reset);await ev(`lab.force('full');lab.spin()`);await ev(`lab.waitCue('stamp')`);await sleep(400);await shot(tag+'-full');await ev(`lab.idle()`);
 // lever drag with mouse
 await ev(reset);
 const L=JSON.parse(await ev(`JSON.stringify(document.querySelector('#leverbay').getBoundingClientRect())`));
 const x=L.x+L.width/2,y0=L.y+L.height*.2;
 await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y:y0,button:'left',clickCount:1});
 for(let k=1;k<=12;k++){await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:y0+k*22,button:'left',buttons:1});await sleep(16)}
 await shot(tag+'-leverpulled');
 await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x,y:y0+264,button:'left',clickCount:1});
 await sleep(100);
 const cues=await ev(`lab.bus.log.slice(-40).map(c=>c.e).filter(e=>e.startsWith('lever')||e==='spin_start').join(',')`);
 console.log(tag,'lever cues:',cues);
 await ev(`lab.idle()`);
 await ev(`lab.endTurn()`);await ev(`lab.idle()`);
 const st=await ev(`JSON.stringify({army:lab.S.army.length,turn:lab.S.turn,energy:lab.S.energy,cues:[...new Set(lab.bus.log.map(c=>c.e))].join(' ')})`);
 console.log(tag,'state',st);
}
await run(390,844,true,"phone");await run(1366,768,false,"laptop");
console.log('errors:',errs.length?errs:'none');ws.close();try{process.kill(-ch.pid)}catch(e){};ch.kill('SIGKILL');process.exit(0);
