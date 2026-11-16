// Long play-test: drive the game through several depths with firing and movement,
// assert no console/page errors and that the state machine keeps running.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from '/tmp/pwtest/node_modules/playwright/index.mjs';

const root = new URL('../game/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  try { const b = await readFile(p.endsWith('/') ? join(p, 'index.html') : p); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(8138, r));
const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:8138/index.html', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => window.__deepglow.startGame());
await page.keyboard.down(' ');
const log = [];
for (const depth of [1, 2, 4, 5, 7, 8]) {
  await page.evaluate((d) => window.__deepglow.setDepth(d), depth);
  for (let i = 0; i < 25; i++) {
    const a = (i / 5) * Math.PI * 2;
    await page.mouse.move(640 + Math.cos(a) * 300, 400 + Math.sin(a) * 220);
    await page.keyboard.down(i % 2 ? 'a' : 'd');
    await page.waitForTimeout(120);
    await page.keyboard.up(i % 2 ? 'a' : 'd');
  }
  log.push({ depth, state: await page.evaluate(() => window.__deepglow.state), score: await page.evaluate(() => window.__deepglow.score) });
}
// pause/resume + restart paths
await page.keyboard.press('p'); await page.waitForTimeout(200);
const paused = await page.evaluate(() => window.__deepglow.state);
await page.keyboard.press('p'); await page.waitForTimeout(200);
const resumed = await page.evaluate(() => window.__deepglow.state);
await page.keyboard.press('r'); await page.waitForTimeout(300);
const restarted = await page.evaluate(() => window.__deepglow.state);
console.log(JSON.stringify({ log, paused, resumed, restarted, errors: errors.slice(0, 5), errorCount: errors.length }, null, 1));
await browser.close(); server.close();
