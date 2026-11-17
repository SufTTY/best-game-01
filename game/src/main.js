import { W, H, MAX_DT } from './config.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Particles } from './particles.js';
import { World } from './world.js';
import { G } from './entities.js';
import { Game } from './game.js';
import { render, drawTitle, drawEnd, drawPause } from './render.js';
import { drawHUD } from './hud.js';

const cnv = document.getElementById('game');
const ctx = cnv.getContext('2d');
const inp = new Input();
const audio = new Audio();
const parts = new Particles();
parts.initSpores(70);
const world = new World();
const game = new Game(audio);
game.onBurst = (x, y, c, n, s) => parts.burst(x, y, c, n, s);
game.onPop = (x, y, text, color) => parts.pop(x, y, text, color);
game.onEvent = (ev) => {
  if (ev === 'dead') { G.state = 'over'; }
  if (ev === 'win') { G.state = 'win'; }
};

function startTitle() {
  G.state = 'title'; G.score = 0; G.time = 0; G.surge = 0; G.lantern = 0; G.combo = 0; G.depth = 1;
  game.pl.reset(); game.enemies.length = 0; game.bullets.length = 0; game.lumens.length = 0;
  game.shots.length = 0; game.warden = null; game.wave = 0;
}
function startGame() {
  startTitle();
  G.state = 'play';
  game.startDepth(1);
  audio.ensure(); audio.startDrone();
}
function killPlayer() {
  game.pl.hull = 0; game.pl.alive = false; G.state = 'over';
}
function winGame() {
  G.state = 'win';
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(MAX_DT, (now - last) / 1000 || 0.016);
  last = now;
  step(dt);
  draw();
}
let last = performance.now();

function step(dt) {
  if (G.state === 'play') {
    game.update(dt, inp);
    parts.update(dt);
    world.update(dt);
  } else {
    parts.update(dt * 0.5);
    world.update(dt * 0.5);
    G.time += dt;
  }
  if (inp.hit('m')) { const m = audio.toggleMute(); banner(m ? 'MUTED' : 'SOUND ON', '#9fb8d8'); }
  if (inp.hit('p') || inp.hit('escape')) {
    if (G.state === 'play') G.state = 'pause';
    else if (G.state === 'pause') G.state = 'play';
  }
  if (inp.hit('r') && (G.state === 'over' || G.state === 'win' || G.state === 'pause')) startGame();
  if (inp.hit('enter') && G.state === 'title') startGame();
  if (inp.hit('click')) {
    audio.ensure(); audio.startDrone();
    if (G.state === 'title') startGame();
    else if (G.state === 'over' || G.state === 'win') startGame();
  }
  inp.endFrame();
}

function banner(text, color) { G.banner = { text, color, alpha: 1 }; G.bannerT = 1.2; }

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (G.state === 'title') {
    render(ctx, W, H, world, game.pl, [], [], [], [], null, parts);
    drawTitle(ctx, W, H, G.time);
    return;
  }
  render(ctx, W, H, world, game.pl, game.enemies, game.bullets, game.lumens, game.shots, game.warden, parts);
  drawHUD(ctx, W, H, game.pl, G.banner);
  if (game.warden && !game.warden.dead) game.warden.drawBar(ctx, W);
  if (G.state === 'pause') drawPause(ctx, W, H, G.time);
  if (G.state === 'over') drawEnd(ctx, W, H, 'SIGNAL LOST', '#ff5f7a', G.score, G.time);
  if (G.state === 'win') drawEnd(ctx, W, H, 'THE TRENCH GLOWS', '#ffe259', G.score, G.time);
}

window.__deepglow = {
  startTitle, startGame, killPlayer, winGame,
  setDepth: (n) => { if (G.state === 'play') game.startDepth(n); },
  get state() { return G.state; },
  get score() { return G.score; },
};

let scale = 1;
function fit() {
  const ww = window.innerWidth, wh = window.innerHeight;
  scale = Math.min(ww / W, wh / H);
  cnv.style.width = (W * scale) + 'px';
  cnv.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', fit);
fit();
requestAnimationFrame(frame);
