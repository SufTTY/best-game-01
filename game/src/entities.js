import { rand, clamp, angleTo, dist2, MAGNET_R } from './config.js';

export class Player {
  constructor() { this.reset(); }
  reset() {
    this.x = 640; this.y = 600; this.r = 14;
    this.hull = 3; this.inv = 0; this.fireT = 0; this.aim = -Math.PI / 2;
    this.trail = []; this.alive = true; this.flash = 0;
  }
  update(dt, inp, bullets, audio) {
    let mx = 0, my = 0;
    if (inp.down('a', 'arrowleft')) mx -= 1;
    if (inp.down('d', 'arrowright')) mx += 1;
    if (inp.down('w', 'arrowup')) my -= 1;
    if (inp.down('s', 'arrowdown')) my += 1;
    if (mx || my) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
    this.x = clamp(this.x + mx * 300 * dt, 30, 1250);
    this.y = clamp(this.y + my * 300 * dt, 60, 770);
    this.aim = angleTo(this.x, this.y, inp.mouse.x, inp.mouse.y);
    this.trail.push({ x: this.x, y: this.y, life: 0.5 });
    if (this.trail.length > 40) this.trail.shift();
    for (const t of this.trail) t.life -= dt;
    this.inv = Math.max(0, this.inv - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.fireT -= dt;
    const wantFire = inp.mouse.down || inp.down(' ');
    if (wantFire && this.fireT <= 0 && this.alive) {
      this.fireT = G.surge > 0 ? 0.11 : 0.22;
      const a = this.aim;
      bullets.push(new Bullet(this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20, Math.cos(a) * 620, Math.sin(a) * 620));
      if (G.surge > 0) bullets.push(new Bullet(this.x + Math.cos(a + 0.12) * 20, this.y + Math.sin(a + 0.12) * 20, Math.cos(a + 0.12) * 620, Math.sin(a + 0.12) * 620));
      audio.shoot();
    }
  }
  hurt() {
    if (this.inv > 0 || !this.alive) return false;
    this.hull--; this.inv = 1.5; this.flash = 0.3;
    if (this.hull <= 0) this.alive = false;
    return true;
  }
  draw(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life * 0.8;
      ctx.fillStyle = '#2ee6c8';
      ctx.beginPath(); ctx.arc(t.x, t.y, 4 * t.life + 1, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.inv > 0 && Math.floor(this.inv * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.aim + Math.PI / 2);
    ctx.shadowBlur = 24; ctx.shadowColor = '#2ee6c8';
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#3ff5d8';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(11, 12); ctx.lineTo(0, 6); ctx.lineTo(-11, 12);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dffff8';
    ctx.beginPath(); ctx.arc(0, -4, 4.5, 0, 6.29); ctx.fill();
    ctx.restore();
  }
}

export const G = {
  surge: 0, score: 0, combo: 0, comboT: 0, lantern: 0,
  depth: 1, state: 'title', shake: 0, time: 0, banner: null, bannerT: 0,
};

export class Lumen {
  constructor(x, y) { this.x = x; this.y = y; this.vx = rand(-40, 40); this.vy = rand(-40, 40); this.r = 6; this.t = rand(0, 6.28); }
  update(dt, pl) {
    this.t += dt * 4;
    if (dist2(this.x, this.y, pl.x, pl.y) < MAGNET_R * MAGNET_R) {
      const a = angleTo(this.x, this.y, pl.x, pl.y);
      this.vx += Math.cos(a) * 900 * dt; this.vy += Math.sin(a) * 900 * dt;
    } else { this.vx *= 0.98; this.vy *= 0.98; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    return dist2(this.x, this.y, pl.x, pl.y) < (this.r + pl.r) * (this.r + pl.r);
  }
  draw(ctx) {
    ctx.shadowBlur = 14; ctx.shadowColor = '#ffb347';
    ctx.fillStyle = '#ffc766';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r + Math.sin(this.t) * 1.5, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export class Bullet {
  constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = 5; this.life = 1.4; }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; return this.life > 0 && this.x > -20 && this.x < 1300 && this.y > -20 && this.y < 820; }
  draw(ctx) {
    ctx.shadowBlur = 12; ctx.shadowColor = '#7fffe9';
    ctx.fillStyle = '#c8fff4';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export class Enemy {
  constructor(kind, x, y, hp) {
    this.kind = kind; this.x = x; this.y = y; this.hp = hp; this.t = rand(0, 6.28);
    this.r = kind === 'jelly' ? 18 : kind === 'fang' ? 13 : 9;
    this.vx = 0; this.vy = 0; this.lunge = 0;
    if (kind === 'jelly') { this.vx = rand(-20, 20); this.vy = rand(15, 40); }
  }
  update(dt, pl, speed, enemies) {
    this.t += dt;
    if (this.kind === 'jelly') {
      this.x += this.vx * dt * speed; this.y += this.vy * dt * speed;
      if (this.x < 30 || this.x > 1250) this.vx *= -1;
      if (this.y > 780) this.y = 780;
    } else if (this.kind === 'fang') {
      const a = angleTo(this.x, this.y, pl.x, pl.y);
      const sp = 90 * speed;
      this.vx += (Math.cos(a) * sp - this.vx) * 2.2 * dt;
      this.vy += (Math.sin(a) * sp - this.vy) * 2.2 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      if (this.lunge <= 0) {
        const a = angleTo(this.x, this.y, pl.x, pl.y);
        this.vx = Math.cos(a) * 320 * speed; this.vy = Math.sin(a) * 320 * speed;
        this.lunge = 0.9;
      }
      this.lunge -= dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.x < -30 || this.x > 1310 || this.y < -30 || this.y > 830) this.hp = 0;
    }
    for (const e of enemies) {
      if (e !== this && e.kind === 'jelly' && dist2(e.x, e.y, this.x, this.y) < 30 * 30) {
        const a = angleTo(this.x, this.y, e.x, e.y);
        this.x -= Math.cos(a) * 20 * dt; this.y -= Math.sin(a) * 20 * dt;
      }
    }
  }
  split() {
    if (this.kind !== 'jelly' || this.hp > 1) return null;
    return { x: this.x, y: this.y };
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.kind === 'jelly') {
      ctx.shadowBlur = 18; ctx.shadowColor = '#ff4fd8';
      ctx.fillStyle = '#ff5ce0';
      ctx.beginPath(); ctx.arc(0, 0, this.r, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff9aea'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8, 0);
        ctx.quadraticCurveTo(i * 8 + Math.sin(this.t * 3 + i) * 6, 12, i * 8 + Math.sin(this.t * 4 + i) * 8, 22);
        ctx.stroke();
      }
    } else if (this.kind === 'fang') {
      ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff3df0';
      ctx.fillStyle = '#e02fd8';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd6fb';
      ctx.beginPath(); ctx.arc(0, -4, 3, 0, 6.29); ctx.fill();
    } else {
      ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff2f92';
      ctx.fillStyle = '#ff3f8f';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(6, 0); ctx.lineTo(0, 14); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export class Shot {
  constructor(x, y, vx, vy, r = 6, color = '#ff6ff0') { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = r; this.life = 5; this.color = color; }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; return this.life > 0 && this.x > -30 && this.x < 1310 && this.y > -30 && this.y < 830; }
  draw(ctx) {
    ctx.shadowBlur = 12; ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
  }
}
