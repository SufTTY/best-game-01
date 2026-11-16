import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const GAME = '/root/makefun/bots/best-game-01/game';
const SHOTS = '/root/makefun/bots/best-game-01/tools/shots';
mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = join(GAME, p);
  if (!file.startsWith(GAME) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(8123, r));

const errors = [];
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('page: ' + e.message));

await page.goto('http://localhost:8123/index.html');
await page.waitForFunction(() => window.__deepglow, null, { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: join(SHOTS, '1-title.png') });

await page.evaluate(() => window.__deepglow.startGame());
await page.waitForTimeout(2000);
await page.screenshot({ path: join(SHOTS, '2-play.png') });

await page.evaluate(() => window.__deepglow.setDepth(3));
await page.waitForTimeout(1200);
await page.screenshot({ path: join(SHOTS, '3-warden.png') });

await page.evaluate(() => window.__deepglow.killPlayer());
await page.waitForTimeout(600);
await page.screenshot({ path: join(SHOTS, '4-over.png') });

await page.evaluate(() => window.__deepglow.winGame());
await page.waitForTimeout(600);
await page.screenshot({ path: join(SHOTS, '5-victory.png') });

await browser.close();
server.close();

for (const name of ['1-title', '2-play', '3-warden', '4-over', '5-victory']) {
  const p = join(SHOTS, name + '.png');
  if (!existsSync(p)) { console.error('MISSING ' + p); process.exit(1); }
  const size = readFileSync(p).length;
  if (size < 20 * 1024) { console.error('TOO SMALL ' + p + ' ' + size); process.exit(1); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('SMOKE OK');
