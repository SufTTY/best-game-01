import { rand } from './config.js';

export class Particles {
  constructor() { this.list = []; this.spores = []; this.pops = []; }
  pop(x, y, text, color) { this.pops.push({ x, y, text, color, life: 0.9 }); }
  initSpores(n) {
    this.spores = [];
    for (let i = 0; i < n; i++) this.spores.push({ x: rand(0, 1280), y: rand(0, 800), r: rand(1, 3), s: rand(4, 18), a: rand(0.15, 0.5), ph: rand(0, 6.28) });
  }
  burst(x, y, color, n, spd = 180, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(spd * 0.3, spd);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(life * 0.5, life), max: life, r: rand(1.5, 4), color });
    }
  }
  update(dt) {
    for (const s of this.spores) {
      s.y += s.s * dt; s.ph += dt;
      if (s.y > 810) { s.y = -10; s.x = rand(0, 1280); }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt; p.y -= 40 * dt;
      if (p.life <= 0) this.pops.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const s of this.spores) {
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(s.ph * 2));
      ctx.fillStyle = '#7fe8ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      ctx.globalAlpha = Math.min(1, p.life / 0.9);
      ctx.font = 'bold 15px monospace';
      ctx.shadowBlur = 10; ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}
