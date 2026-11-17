import { rand } from './config.js';

export class World {
  constructor() {
    this.flora = [];
    for (let i = 0; i < 26; i++) {
      this.flora.push({
        x: rand(30, 1250), y: rand(620, 790), h: rand(30, 110), sway: rand(0.4, 1.4),
        ph: rand(0, 6.28), hue: rand() < 0.5 ? '#2ee6c8' : '#4f9dff', layer: rand() < 0.5 ? 0.4 : 0.8,
      });
    }
    this.rocks = [];
    for (let i = 0; i < 14; i++) this.rocks.push({ x: rand(0, 1280), y: rand(700, 800), w: rand(40, 130), h: rand(14, 40) });
    this.depth = 0;
  }
  setDepth(d) { this.depth = d; }
  update(dt) { for (const f of this.flora) f.ph += dt * f.sway; }
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
    for (const f of this.flora) {
      const sway = Math.sin(f.ph) * 10 * f.layer;
      ctx.strokeStyle = f.hue; ctx.globalAlpha = 0.35 * f.layer + 0.1; ctx.lineWidth = 3 * f.layer;
      ctx.shadowBlur = 12; ctx.shadowColor = f.hue;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      ctx.quadraticCurveTo(f.x + sway, f.y - f.h * 0.5, f.x + sway * 1.6, f.y - f.h);
      ctx.stroke();
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
