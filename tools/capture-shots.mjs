// Real-render screenshot capture for the Deepglow game (no edits, no compositing):
// serves game/, plays it with mouse+keyboard in headless Chrome, and saves 1280x800 JPEGs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from '/tmp/pwtest/node_modules/playwright/index.mjs';

const root = new URL('../game/', import.meta.url).pathname;
const outDir = new URL('./shots2/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  try {
    const body = await readFile(p.endsWith('/') ? join(p, 'index.html') : p);
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(8137, r));

const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'load' });
await page.waitForTimeout(1200);
const score = () => page.evaluate(() => window.__deepglow.score);

// 1. title
await page.screenshot({ path: join(outDir, '1-title.jpg'), type: 'jpeg', quality: 88 });

// 2. gameplay: start, sweep the aim while holding fire until the score climbs
await page.evaluate(() => window.__deepglow.startGame());
await page.waitForTimeout(1800);
await page.mouse.move(640, 300);
await page.keyboard.down(' ');
let best = 0;
for (let i = 0; i < 90; i++) {
  const a = (i / 9) * Math.PI * 2;
  await page.mouse.move(640 + Math.cos(a) * 260, 380 + Math.sin(a) * 200);
  await page.waitForTimeout(120);
  best = Math.max(best, await score());
  if (best >= 120 && i > 30) break;
}
await page.waitForTimeout(250);
await page.screenshot({ path: join(outDir, '2-play.jpg'), type: 'jpeg', quality: 88 });
const playScore = await score();

// 3. warden on depth 3 (score carried from the fight)
await page.evaluate(() => window.__deepglow.setDepth(3));
await page.waitForTimeout(1500);
await page.mouse.move(660, 260);
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '3-warden.jpg'), type: 'jpeg', quality: 88 });

// 4. victory (score from the run carried onto the win screen; let the banner fade first)
await page.evaluate(() => window.__deepglow.winGame());
await page.waitForTimeout(3000);
await page.screenshot({ path: join(outDir, '4-victory.jpg'), type: 'jpeg', quality: 88 });

// 5. game over, for the record
await page.evaluate(() => window.__deepglow.startGame());
await page.waitForTimeout(1200);
await page.evaluate(() => window.__deepglow.killPlayer());
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '5-over.jpg'), type: 'jpeg', quality: 88 });

console.log('playScore', playScore, 'errors', errors.length, errors.slice(0, 3));
await browser.close();
server.close();
