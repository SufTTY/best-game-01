import { G } from './entities.js';
import { LANTERN_MAX, SURGE_TIME } from './config.js';

export function drawHUD(ctx, W, H, pl, banner) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px monospace';
  ctx.shadowBlur = 8; ctx.shadowColor = '#2ee6c8';
  ctx.fillStyle = '#7ffce8';
  ctx.fillText(`DEPTH ${G.depth}/10`, 20, 32);
  ctx.fillStyle = '#ffd98a'; ctx.shadowColor = '#ffb347';
  ctx.fillText(`SCORE ${G.score}`, 20, 58);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#ffd98a';
  ctx.fillText(`x${G.combo > 1 ? G.combo : 1}`, 170, 58);
  ctx.shadowBlur = 0;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < pl.hull ? '#ff5f7a' : 'rgba(255,95,122,0.15)';
    ctx.shadowBlur = i < pl.hull ? 10 : 0; ctx.shadowColor = '#ff5f7a';
    ctx.beginPath(); ctx.arc(30 + i * 26, 84, 9, 0, 6.29); ctx.fill();
  }
  ctx.shadowBlur = 0;
  const bw = 260, bx = W - bw - 24, by = 24;
  ctx.fillStyle = 'rgba(10,14,26,0.7)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, 18);
  const frac = Math.min(1, G.lantern / LANTERN_MAX);
  const lg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  lg.addColorStop(0, '#ffb347'); lg.addColorStop(1, '#ffe259');
  ctx.fillStyle = lg;
  ctx.fillRect(bx, by, bw * frac, 14);
  if (G.surge > 0) {
    ctx.strokeStyle = `rgba(255,226,89,${0.6 + 0.4 * Math.sin(G.time * 14)})`;
    ctx.lineWidth = 3; ctx.strokeRect(bx - 3, by - 3, bw + 6, 20);
    ctx.fillStyle = '#ffe259'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffe259';
    ctx.fillText(`LUMEN SURGE ${G.surge.toFixed(1)}s`, W - 24, by + 36);
  } else {
    ctx.fillStyle = '#ffd98a'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('LANTERN', W - 24, by + 30);
  }
  ctx.shadowBlur = 0;
  if (banner) {
    const a = banner.alpha;
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px monospace';
    ctx.shadowBlur = 24; ctx.shadowColor = banner.color || '#2ee6c8';
    ctx.fillStyle = banner.color || '#2ee6c8';
    ctx.globalAlpha = a;
    ctx.fillText(banner.text, W / 2, H * 0.32);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  ctx.restore();
}
