import { rand, clamp } from './config.js';
import { G } from './entities.js';
import { LANTERN_MAX } from './config.js';

export function render(ctx, W, H, world, pl, enemies, bullets, lumens, shots, warden, parts) {
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * 14, (Math.random() - 0.5) * G.shake * 14);
  world.draw(ctx, W, H, G.time);
  for (const l of lumens) l.draw(ctx);
  for (const e of enemies) e.draw(ctx);
  if (warden && !warden.dead) warden.draw(ctx);
  for (const b of bullets) b.draw(ctx);
  for (const s of shots) s.draw(ctx);
  if (pl.alive) pl.draw(ctx);
  parts.draw(ctx);
  if (pl.flash > 0) {
    ctx.fillStyle = `rgba(255,60,80,${pl.flash * 0.5})`;
    ctx.fillRect(-50, -50, W + 100, H + 100);
  }
  ctx.restore();
}

function glowText(ctx, text, x, y, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.shadowBlur = 26; ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawTitle(ctx, W, H, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * 2);
  glowText(ctx, 'DEEPGLOW', W / 2, 260, 84, '#2ee6c8', pulse);
  glowText(ctx, 'salvage the light, survive the trench', W / 2, 320, 20, '#7fd8ff', 0.9);
  glowText(ctx, 'CLICK TO DIVE', W / 2, 470 + Math.sin(t * 3) * 8, 26, '#ffe259', 0.7 + 0.3 * Math.sin(t * 5));
  const lines = ['WASD / ARROWS  move', 'MOUSE  aim', 'CLICK / SPACE  fire', 'P / ESC  pause    M  mute'];
  ctx.font = '15px monospace'; ctx.textAlign = 'center';
  lines.forEach((l, i) => glowText(ctx, l, W / 2, 560 + i * 26, 15, '#9fb8d8', 0.85));
  glowText(ctx, `10 depths - 3 wardens - 1 light`, W / 2, 700, 14, '#ff9df5', 0.7);
}

export function drawEnd(ctx, W, H, title, color, score, t) {
  ctx.fillStyle = 'rgba(2,4,10,0.72)'; ctx.fillRect(0, 0, W, H);
  glowText(ctx, title, W / 2, 300, 64, color, 0.8 + 0.2 * Math.sin(t * 3));
  glowText(ctx, `FINAL SCORE ${score}`, W / 2, 380, 30, '#ffe259');
  glowText(ctx, 'PRESS R OR CLICK TO DIVE AGAIN', W / 2, 460, 18, '#9fb8d8', 0.7 + 0.3 * Math.sin(t * 4));
}

export function drawPause(ctx, W, H, t) {
  ctx.fillStyle = 'rgba(2,4,10,0.6)'; ctx.fillRect(0, 0, W, H);
  glowText(ctx, 'PAUSED', W / 2, 340, 56, '#2ee6c8', 0.8 + 0.2 * Math.sin(t * 2));
  glowText(ctx, 'P / ESC to resume - M to mute', W / 2, 400, 18, '#9fb8d8', 0.85);
}
