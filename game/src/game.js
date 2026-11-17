import { W, H, DEPTHS, HULL_MAX, SURGE_TIME, LANTERN_MAX, depthParams, rand, clamp, lerp } from './config.js';
import { G, Player, Enemy, Lumen, Bullet } from './entities.js';
import { Warden } from './warden.js';

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.pl = new Player();
    this.enemies = []; this.bullets = []; this.lumens = [];
    this.shots = [];
    this.warden = null; this.wave = 0; this.spawnT = 0; this.depthDone = false;
    this.onEvent = null; this.onBurst = null; this.onPop = null;
  }
  startDepth(d) {
    G.depth = d;
    this.enemies.length = 0; this.bullets.length = 0; this.lumens.length = 0; this.shots.length = 0;
    this.warden = null; this.wave = 0; this.spawnT = 0.6; this.depthDone = false;
    G.banner = { text: `DEPTH ${d}`, color: '#2ee6c8', alpha: 1 }; G.bannerT = 2.4;
    if (d % 3 === 0) {
      this.warden = new Warden();
      this.warden.maxHp = this.warden.hp = 40 + d * 8;
      this.banner('WARDEN INBOUND', '#ff4fd8');
    } else {
      this.wave = depthParams(d).waves;
    }
  }
  banner(text, color) { G.banner = { text, color, alpha: 1 }; G.bannerT = 2.2; }
  spawnWave() {
    const p = depthParams(G.depth);
    this.wave--;
    for (let i = 0; i < p.jelly; i++) this.enemies.push(new Enemy('jelly', rand(80, 1200), rand(-160, -40), p.hp));
    for (let i = 0; i < p.fang; i++) this.enemies.push(new Enemy('fang', rand(80, 1200), rand(-220, -60), p.hp));
    for (let i = 0; i < p.dart; i++) this.enemies.push(new Enemy('dart', rand(80, 1200), rand(-100, -20), 1));
  }
  update(dt, inp) {
    G.time += dt;
    G.shake = Math.max(0, G.shake - dt * 30);
    if (G.bannerT > 0) { G.bannerT -= dt; G.banner.alpha = Math.min(1, G.bannerT); if (G.bannerT <= 0) G.banner = null; }
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
    if (G.surge > 0) G.surge -= dt;
    this.pl.update(dt, inp, this.bullets, this.audio);
    const speed = depthParams(G.depth).speed;
    if (!this.warden && this.wave > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnWave(); this.spawnT = 2.2; }
    }
    if (!this.warden && this.wave <= 0 && this.enemies.length === 0 && !this.depthDone) {
      this.depthDone = true;
      this.banner('DEPTH CLEAR', '#ffe259');
      setTimeout(() => { if (G.state === 'play') this.nextDepth(); }, 1400);
    }
    this.updateEnemies(dt, speed);
    this.updateBullets(dt);
    this.updateLumens(dt);
    if (this.warden) this.updateWarden(dt);
  }
  updateEnemies(dt, speed) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this.pl, speed, this.enemies);
      if (e.y > 820) { this.enemies.splice(i, 1); continue; }
      if (this.pl.alive && this.pl.inv <= 0 && (e.x - this.pl.x) ** 2 + (e.y - this.pl.y) ** 2 < (e.r + this.pl.r) ** 2) {
        this.enemies.splice(i, 1);
        this.hurtPlayer();
      }
    }
  }
  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.update(dt)) { this.bullets.splice(i, 1); continue; }
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < (b.r + e.r) ** 2) {
          e.hp--; this.audio.hit();
          this.onBurst && this.onBurst(e.x, e.y, '#ff5ce0', 6, 180);
          if (e.hp <= 0) this.killEnemy(j);
          consumed = true; break;
        }
      }
      if (!consumed && this.warden && !this.warden.dead) {
        const segs = this.warden.segs;
        for (let k = 0; k < segs.length; k++) {
          const s = segs[k];
          if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < (b.r + 26) ** 2) {
            if (this.warden.hit(k === 0 ? 4 : 1)) this.wardenDeath();
            else this.onBurst && this.onBurst(b.x, b.y, '#ffe259', 4, 140);
            consumed = true; break;
          }
        }
      }
      if (consumed) this.bullets.splice(i, 1);
    }
  }
  killEnemy(j) {
    const e = this.enemies[j];
    this.enemies.splice(j, 1);
    G.combo++; G.comboT = 3;
    const mult = G.surge > 0 ? 2 : 1;
    const gained = 10 * mult * Math.max(1, G.combo);
    G.score += gained;
    this.onPop && this.onPop(e.x, e.y - 18, `+${gained} x${G.combo}`, '#ffe259');
    this.onBurst && this.onBurst(e.x, e.y, '#ff5ce0', 14, 220);
    this.lumens.push(new Lumen(e.x, e.y));
    if (e.kind === 'jelly') this.lumens.push(new Lumen(e.x + rand(-24, 24), e.y + rand(-24, 24)));
  }
  updateLumens(dt) {
    for (let i = this.lumens.length - 1; i >= 0; i--) {
      const l = this.lumens[i];
      if (l.update(dt, this.pl)) {
        this.lumens.splice(i, 1);
        G.lantern += 12;
        G.score += 5 * (G.surge > 0 ? 2 : 1);
        this.onPop && this.onPop(l.x, l.y - 12, '+5', '#ffc766');
        this.audio.pickup();
        if (G.lantern >= LANTERN_MAX && G.surge <= 0) {
          G.lantern = 0; G.surge = SURGE_TIME;
          this.audio.surge();
          this.banner('LUMEN SURGE', '#ffe259');
          this.onBurst && this.onBurst(this.pl.x, this.pl.y, '#ffe259', 30, 260);
        } else if (G.lantern > LANTERN_MAX) G.lantern = LANTERN_MAX;
      }
    }
  }
  updateWarden(dt) {
    const w = this.warden;
    w.update(dt, this.pl, this.shots, () => this.hurtPlayer());
    if (w.dead) this.wardenDeath();
  }
  wardenDeath() {
    const w = this.warden;
    if (!w || w.counted) return;
    w.counted = true;
    G.score += 250 * (G.surge > 0 ? 2 : 1);
    this.onBurst && this.onBurst(w.x, w.y, '#ffe259', 40, 300);
    this.onBurst && this.onBurst(w.x, w.y, '#ff4fd8', 30, 220);
    this.audio.surge();
    this.warden = null;
    this.banner('WARDEN DOWN', '#ffe259');
    setTimeout(() => { if (G.state === 'play') this.nextDepth(); }, 1600);
  }
  hurtPlayer() {
    if (this.pl.hurt()) {
      this.audio.hit();
      G.shake = 1;
      this.onBurst && this.onBurst(this.pl.x, this.pl.y, '#ff5f7a', 20, 240);
      this.banner('HULL BREACH', '#ff5f7a');
      if (!this.pl.alive && this.onEvent) this.onEvent('dead');
    }
  }
  nextDepth() {
    if (G.depth >= DEPTHS) { if (this.onEvent) this.onEvent('win'); return; }
    this.startDepth(G.depth + 1);
  }
}
