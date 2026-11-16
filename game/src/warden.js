import { rand, clamp, angleTo, dist2 } from './config.js';
import { Shot } from './entities.js';

export class Warden {
  constructor() {
    this.x = 640; this.y = 200; this.tx = 640; this.ty = 200;
    this.hp = 60; this.maxHp = 60; this.t = 0;
    this.segs = []; this.angle = 0;
    this.burstT = 2; this.beamT = 5; this.beamA = 0; this.beamOn = 0; this.beamSweep = 0;
    this.hitFlash = 0; this.dead = false; this.counted = false;
    for (let i = 0; i < 6; i++) this.segs.push({ x: this.x, y: this.y + i * 34 });
  }
  update(dt, pl, shots, onHit) {
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.tx = 640 + Math.sin(this.t * 0.5) * 380;
    this.ty = 160 + Math.sin(this.t * 0.9) * 60;
    const da = angleTo(this.x, this.y, this.tx, this.ty);
    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    if (d > 4) { this.x += Math.cos(da) * Math.min(d, 60 * dt); this.y += Math.sin(da) * Math.min(d, 60 * dt); }
    this.segs[0].x = this.x; this.segs[0].y = this.y;
    for (let i = 1; i < this.segs.length; i++) {
      const p = this.segs[i - 1], s = this.segs[i];
      const a = angleTo(s.x, s.y, p.x, p.y);
      s.x = p.x - Math.cos(a) * 34; s.y = p.y - Math.sin(a) * 34;
    }
    this.angle = angleTo(this.x, this.y, pl.x, pl.y);
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = 2.6;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.t;
        shots.push(new Shot(this.x, this.y, Math.cos(a) * 170, Math.sin(a) * 170, 7, '#ff4fd8'));
      }
    }
    this.beamT -= dt;
    if (this.beamT <= 0) { this.beamT = 7; this.beamOn = 2.2; this.beamSweep = 0; }
    if (this.beamOn > 0) {
      this.beamOn -= dt; this.beamSweep += dt * 1.8;
      this.beamA = this.angle + Math.sin(this.beamSweep) * 1.1;
      const bx = this.x + Math.cos(this.beamA) * 900, by = this.y + Math.sin(this.beamA) * 900;
      if (this.beamOn < 2.0 && onHit && dist2(pl.x, pl.y, this.x, this.y) < 900 * 900) {
        const t = clamp(((pl.x - this.x) * Math.cos(this.beamA) + (pl.y - this.y) * Math.sin(this.beamA)) / 900, 0, 1);
        const cx = this.x + Math.cos(this.beamA) * t * 900, cy = this.y + Math.sin(this.beamA) * t * 900;
        if (dist2(pl.x, pl.y, cx, cy) < 40 * 40) onHit();
      }
      this.beamEnd = { x: bx, y: by };
    } else { this.beamA = this.angle; }
  }
  hit(dmg) {
    this.hp -= dmg; this.hitFlash = 0.1;
    if (this.hp <= 0 && !this.dead) { this.dead = true; return true; }
    return false;
  }
  draw(ctx) {
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i];
      const r = 30 - i * 3;
      ctx.shadowBlur = 20; ctx.shadowColor = '#c03fd8';
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : i === 0 ? '#8a2fc0' : '#5c2387';
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#e07bff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.shadowBlur = 22; ctx.shadowColor = '#ffe259';
    ctx.fillStyle = '#ffe259';
    ctx.beginPath(); ctx.arc(this.x, this.y, 10 + Math.sin(this.t * 6) * 2, 0, 6.29); ctx.fill();
    ctx.shadowBlur = 0;
    if (this.beamOn > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.beamOn) * 0.75;
      ctx.strokeStyle = '#ff9df5'; ctx.lineWidth = 14;
      ctx.shadowBlur = 30; ctx.shadowColor = '#ff4fd8';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.beamEnd.x, this.beamEnd.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.beamEnd.x, this.beamEnd.y); ctx.stroke();
      ctx.restore();
    }
  }
  drawBar(ctx, W) {
    const w = 560, x = (W - w) / 2, y = 16;
    ctx.fillStyle = 'rgba(10,14,26,0.7)';
    ctx.fillRect(x - 3, y - 3, w + 6, 18);
    ctx.fillStyle = '#241033';
    ctx.fillRect(x, y, w, 12);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff4fd8'); g.addColorStop(1, '#ff9df5');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * clamp(this.hp / this.maxHp, 0, 1), 12);
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff4fd8';
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd6fb'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('TRENCH WARDEN', W / 2, y + 26);
  }
}
