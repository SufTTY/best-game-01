import { rand } from './config.js';

export class World {
  constructor() {
    this.flora = [];
    for (let i = 0; i < 34; i++) {
      this.flora.push({
        x: rand(20, 1260), y: rand(600, 795), h: rand(35, 150), sway: rand(0.4, 1.6),
        ph: rand(0, 6.28), hue: rand() < 0.5 ? '#2ee6c8' : (rand() < 0.5 ? '#4f9dff' : '#7affd0'),
        layer: rand() < 0.5 ? 0.4 : 0.85, leaves: 2 + Math.floor(rand(0, 3)),
      });
    }
    this.rocks = [];
    for (let i = 0; i < 16; i++) this.rocks.push({ x: rand(0, 1280), y: rand(690, 800), w: rand(40, 140), h: rand(14, 44) });
    this.motes = [];
    for (let i = 0; i < 90; i++) this.motes.push({ x: rand(0, 1280), y: rand(0, 800), r: rand(0.6, 2.2), s: rand(3, 14), a: rand(0.08, 0.4), ph: rand(0, 6.28), hue: rand() < 0.7 ? '#9fe8ff' : '#ffe9b0' });
    this.bubbles = [];
    for (let i = 0; i < 24; i++) this.bubbles.push({ x: rand(0, 1280), y: rand(0, 800), r: rand(1.5, 4.5), s: rand(18, 46), ph: rand(0, 6.28) });
    this.ridges = [];
    for (let i = 0; i < 5; i++) {
      const pts = [];
      let y = rand(430, 560);
      for (let x = -40; x <= 1320; x += 90) { y += rand(-38, 38); y = Math.max(300, Math.min(620, y)); pts.push({ x, y }); }
      this.ridges.push({ pts, alpha: rand(0.10, 0.22), drift: rand(4, 14) });
    }
    this.depth = 0;
  }
  setDepth(d) { this.depth = d; }
  update(dt) {
    for (const f of this.flora) f.ph += dt * f.sway;
    for (const m of this.motes) { m.y += m.s * dt; m.x += Math.sin(m.ph + m.y * 0.01) * 8 * dt; if (m.y > 810) { m.y = -10; m.x = rand(0, 1280); } }
    for (const b of this.bubbles) { b.y -= b.s * dt; b.x += Math.sin(b.ph + b.y * 0.02) * 12 * dt; if (b.y < -10) { b.y = 810; b.x = rand(0, 1280); } }
  }
  draw(ctx, W, H, t) {
    const d = this.depth;
    const base = ctx.createLinearGradient(0, 0, 0, H);
    const c1 = 8 + d * 2, c2 = 14 + d * 3;
    base.addColorStop(0, `rgb(${c1},${c1 + 2},${c1 + 10})`);
    base.addColorStop(0.6, `rgb(${c2},${c2 + 1},${c2 + 14})`);
    base.addColorStop(1, `rgb(${Math.max(2, c2 - 6)},2,${Math.max(6, c2 + 4)})`);
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    // surface light shafts
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const x = ((i * 233) % 1280) + Math.sin(t * 0.25 + i * 1.7) * 40;
      const wTop = 60 + (i % 3) * 40;
      const g = ctx.createLinearGradient(x, 0, x + wTop * 0.6, H);
      g.addColorStop(0, `rgba(120,220,255,${0.075 + 0.03 * Math.sin(t * 0.6 + i)})`);
      g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - wTop / 2, -10); ctx.lineTo(x + wTop / 2, -10);
      ctx.lineTo(x + wTop * 1.4, H + 10); ctx.lineTo(x - wTop * 0.6, H + 10);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.35, 600);
    glow.addColorStop(0, `rgba(46,230,200,${0.05 + 0.02 * Math.sin(t * 0.7)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // distant parallax ridges
    for (const r of this.ridges) {
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle = '#0a1626';
      ctx.beginPath();
      ctx.moveTo(-50, H + 20);
      for (const p of r.pts) ctx.lineTo(p.x + Math.sin(t * 0.1 + r.drift) * r.drift * 0.3, p.y);
      ctx.lineTo(W + 50, H + 20);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // drifting motes
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 1.5 + m.ph));
      ctx.fillStyle = m.hue;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // bubbles
    ctx.strokeStyle = 'rgba(160,230,255,0.28)';
    for (const b of this.bubbles) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.29); ctx.stroke();
    }
    for (const f of this.flora) {
      const sway = Math.sin(f.ph) * 12 * f.layer;
      ctx.strokeStyle = f.hue; ctx.globalAlpha = 0.4 * f.layer + 0.12; ctx.lineWidth = 3 * f.layer;
      ctx.shadowBlur = 14; ctx.shadowColor = f.hue;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x + sway, f.y - f.h * 0.5, f.x + sway * 1.6, f.y - f.h);
      ctx.stroke();
      for (let li = 0; li < f.leaves; li++) {
        const fy = f.y - f.h * (0.35 + li * 0.22);
        const fx = f.x + sway * (0.6 + li * 0.35);
        ctx.beginPath(); ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + (li % 2 ? 14 : -14) * f.layer, fy - 6, fx + (li % 2 ? 22 : -22) * f.layer, fy - 14);
        ctx.stroke();
      }
      ctx.fillStyle = f.hue;
      ctx.beginPath(); ctx.arc(f.x + sway * 1.6, f.y - f.h, 4.5 * f.layer + 1, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.fillStyle = '#060a14';
    for (const r of this.rocks) {
      ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w * 0.2, r.y); ctx.lineTo(r.x + r.w * 0.6, r.y + r.h * 0.3);
      ctx.lineTo(r.x + r.w, r.y + r.h * 0.1); ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(80,160,220,0.18)';
      ctx.beginPath(); ctx.moveTo(r.x + r.w * 0.2, r.y); ctx.lineTo(r.x + r.w * 0.6, r.y + r.h * 0.3); ctx.stroke();
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
}
