import { rand } from './config.js';

export class World {
  constructor() {
    this.flora = [];
    for (let i = 0; i < 34; i++) {
      this.flora.push({
        x: rand(30, 1250), y: rand(620, 790), h: rand(30, 110), sway: rand(0.4, 1.4),
        ph: rand(0, 6.28), hue: rand() < 0.5 ? '#2ee6c8' : '#4f9dff', layer: rand() < 0.5 ? 0.4 : 0.8,
      });
    }
    this.rocks = [];
    for (let i = 0; i < 14; i++) this.rocks.push({ x: rand(0, 1280), y: rand(700, 800), w: rand(40, 130), h: rand(14, 40) });
    this.shafts = [];
    for (let i = 0; i < 6; i++) this.shafts.push({ x: rand(40, 1240), w: rand(26, 80), ph: rand(0, 6.28), sp: rand(0.15, 0.4) });
    this.motes = [];
    for (let i = 0; i < 90; i++) this.motes.push({ x: rand(0, 1280), y: rand(0, 800), r: rand(0.8, 2.6), s: rand(6, 22), ph: rand(0, 6.28), hue: i % 2 ? '#7fe8ff' : '#2ee6c8' });
    this.bubbles = [];
    for (let i = 0; i < 24; i++) this.bubbles.push({ x: rand(0, 1280), y: rand(0, 800), r: rand(1.5, 4.5), s: rand(25, 60), ph: rand(0, 6.28) });
    this.ridges = [];
    for (let i = 0; i < 4; i++) this.ridges.push({ y: 560 + i * 55, amp: rand(30, 70), ph: rand(0, 6.28), seed: rand(0, 10) });
    this.depth = 0;
  }
  setDepth(d) { this.depth = d; }
  update(dt) {
    for (const f of this.flora) f.ph += dt * f.sway;
    for (const m of this.motes) {
      m.y += m.s * dt; m.ph += dt;
      if (m.y > 810) { m.y = -10; m.x = rand(0, 1280); }
    }
    for (const b of this.bubbles) {
      b.y -= b.s * dt; b.ph += dt * 3;
      if (b.y < -10) { b.y = 810; b.x = rand(0, 1280); }
    }
  }
  draw(ctx, W, H, t) {
    const d = this.depth;
    const base = ctx.createLinearGradient(0, 0, 0, H);
    const c1 = 8 + d * 2, c2 = 14 + d * 3;
    base.addColorStop(0, `rgb(${c1},${c1 + 2},${c1 + 10})`);
    base.addColorStop(0.6, `rgb(${c2},${c2 + 1},${c2 + 14})`);
    base.addColorStop(1, `rgb(${Math.max(2, c2 - 6)},2,${Math.max(6, c2 + 4)})`);
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.35, 600);
    glow.addColorStop(0, `rgba(46,230,200,${0.05 + 0.02 * Math.sin(t * 0.7)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    for (const s of this.shafts) {
      const sx = s.x + Math.sin(t * 0.3 + s.ph) * 60;
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
      g.addColorStop(0, 'rgba(160,240,255,0.10)');
      g.addColorStop(1, 'rgba(160,240,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - s.w * 0.35, 0); ctx.lineTo(sx + s.w * 0.35, 0);
      ctx.lineTo(sx + s.w, H * 0.75); ctx.lineTo(sx - s.w, H * 0.75);
      ctx.closePath(); ctx.fill();
    }
    for (const r of this.ridges) {
      ctx.fillStyle = 'rgba(10,22,38,0.55)';
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) {
        const y = r.y + Math.sin(x * 0.008 + r.ph + t * 0.05) * r.amp * 0.4 + Math.sin(x * 0.02 + r.seed) * r.amp * 0.15;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    for (const m of this.motes) {
      const a = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(m.ph * 1.5 + m.y * 0.01));
      ctx.globalAlpha = a;
      ctx.fillStyle = m.hue;
      ctx.beginPath(); ctx.arc(m.x + Math.sin(m.ph) * 14, m.y, m.r, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of this.bubbles) {
      const wob = Math.sin(b.ph) * 6;
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#bfeaff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x + wob, b.y, b.r, 0, 6.29); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const f of this.flora) {
      const sway = Math.sin(f.ph) * 10 * f.layer;
      ctx.strokeStyle = f.hue; ctx.globalAlpha = 0.35 * f.layer + 0.1; ctx.lineWidth = 3 * f.layer;
      ctx.shadowBlur = 12; ctx.shadowColor = f.hue;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x + sway, f.y - f.h * 0.5, f.x + sway * 1.6, f.y - f.h);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5 * f.layer;
      for (let k = 1; k <= 3; k++) {
        const ly = f.y - f.h * (k / 3.4);
        const lx = f.x + sway * (k / 3.4) * 1.6;
        const dir = k % 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo(lx + dir * 10 * f.layer, ly - 6 * f.layer, lx + dir * 16 * f.layer, ly - 12 * f.layer);
        ctx.stroke();
      }
      ctx.fillStyle = f.hue;
      ctx.beginPath(); ctx.arc(f.x + sway * 1.6, f.y - f.h, 4 * f.layer + 1, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.fillStyle = '#060a14';
    for (const r of this.rocks) {
      ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w * 0.2, r.y); ctx.lineTo(r.x + r.w * 0.6, r.y + r.h * 0.3);
      ctx.lineTo(r.x + r.w, r.y + r.h * 0.1); ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.closePath(); ctx.fill();
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
}
