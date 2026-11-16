// Match-flow probe: drives full rounds headlessly and reports whether the objective,
// economy and round resolution behave (plant happens, defuse or detonation resolves,
// money moves, rounds are scored). Node 22 stdlib only, like capture.mjs.
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_BIN;
const PORT = 8124;
const here = new URL('.', import.meta.url).pathname;

async function serverUp(port) {
  try { const res = await fetch(`http://127.0.0.1:${port}/`); return (await res.text()).includes('BREACH'); } catch { return false; }
}
let ownServer = false;
let server = null;
if (!(await serverUp(PORT))) {
  server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
  ownServer = true;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 5000);
    server.stdout.on('data', (d) => { if (String(d).includes('http://')) { clearTimeout(t); resolve(); } });
    server.stderr.on('data', (d) => process.stderr.write('[serve] ' + d));
  });
}

const chromeArgs = [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=9344', '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', 'about:blank',
];
const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' });

async function connect() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch('http://127.0.0.1:9344/json/version');
      return (await res.json()).webSocketDebuggerUrl;
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error('chrome debug port never opened');
}

const wsUrl = await connect();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
const created = await send('Target.createTarget', { url: 'about:blank' });
const attached = await send('Target.attachToTarget', { targetId: created.result.targetId, flatten: true });
const s = attached.result.sessionId;
await send('Page.enable', {}, s);
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
` }, s);
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }, s);
await new Promise((r) => setTimeout(r, 2000));
await send('Runtime.evaluate', { expression: 'window.__errors=[];window.addEventListener("error",e=>window.__errors.push(String(e.message)))', returnByValue: true }, s);

async function evalJson(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true }, s);
  if (res.result?.exceptionDetails) throw new Error('eval threw: ' + JSON.stringify(res.result.exceptionDetails).slice(0, 400));
  const value = res.result?.result?.value;
  if (value === undefined || value === null) throw new Error('eval gave nothing: ' + JSON.stringify(res).slice(0, 300));
  if (typeof value === 'string') {
    if (value.trim() === '') throw new Error('eval gave empty string: ' + JSON.stringify(res).slice(0, 300));
    return JSON.parse(value);
  }
  return value;
}

for (let i = 0; i < 40; i += 1) {
  const probe = await send('Runtime.evaluate', { expression: 'typeof window.__game', returnByValue: true }, s);
  if (probe.result?.result?.value === 'object') break;
  await new Promise((r) => setTimeout(r, 250));
}

await evalJson(`(()=>{const g=window.__game; document.getElementById('play').click(); g.forceLive(); return '"ok"'})()`);
const timeline = [];
let matchOver = false;
for (let index = 0; index < 60 && !matchOver; index += 1) {
  await evalJson(`(()=>{window.__game.advance(600); return '"ok"'})()`);
  const snap = await evalJson(`JSON.stringify({stats: window.__game.stats, units: window.__game.units})`);
  const parsed = snap;
  timeline.push({ t: index * 10, ...parsed.stats, units: parsed.units });
  matchOver = parsed.stats.phase === 'end' && (parsed.stats.score.cobalt >= 5 || parsed.stats.score.ember >= 5);
}
const errors = await evalJson('(()=>{return JSON.stringify(window.__errors ?? ["__errors missing"])})()');
const summary = {
  matchOver,
  errors,
  timeline: timeline.map((u) => ({ t: u.t, round: u.round, phase: u.phase, score: u.score, money: u.money, enemies: u.enemies, allies: u.allies, planted: u.planted, dead: u.dead })),
  lastUnits: timeline[timeline.length - 1]?.units,
};
console.log(JSON.stringify(summary, null, 1));

ws.close();
chrome.kill();
if (ownServer && server) server.kill('SIGKILL');
process.exit(0);
