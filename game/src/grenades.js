// Grenades: a thrown frag is a physics ball — gravity, wall bounce, timed fuse — that
// damages every pawn in its blast radius with distance falloff. Sixty dollars of pure
// chaos for three hundred dollars of credit.

import { FRAG_PRICE } from './config.js';
import { slide, groundHeight, WALLS } from './map.js';
import { PAWN_RADIUS } from './pawns.js';

const BLAST_RADIUS = 5.5;
const MAX_DAMAGE = 110;
const FUSE = 2.1;

export function createGrenades(rng, hooks) {
  const live = [];

  function throwFrag(origin, direction, power) {
    live.push({
      x: origin[0], y: origin[1], z: origin[2],
      vx: direction[0] * power, vy: direction[1] * power + 2.2, vz: direction[2] * power,
      fuse: FUSE,
    });
  }

  function step(dt, player, allPawns, explodeFx) {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const g = live[i];
      g.fuse -= dt;
      if (g.fuse <= 0) {
        live.splice(i, 1);
        detonate(g, player, allPawns, explodeFx);
        continue;
      }
      // Integrate; bounce off the ground and slide off walls (cheap but readable).
      g.vy -= 9.8 * dt;
      const [nx, nz] = slide(g.x, g.z, 0.18, g.vx * dt, g.vz * dt);
      if (nx !== g.x + g.vx * dt) g.vx *= -0.35;
      if (nz !== g.z + g.vz * dt) g.vz *= -0.35;
      g.x = nx; g.z = nz;
      g.y += g.vy * dt;
      const ground = groundHeight(g.x, g.z) + 0.18;
      if (g.y < ground) {
        g.y = ground;
        g.vy = Math.abs(g.vy) * 0.3;
        if (Math.abs(g.vy) < 0.4) g.vy = 0;
      }
    }
    return live;
  }

  function detonate(g, player, allPawns, explodeFx) {
    if (explodeFx) explodeFx(g.x, g.y, g.z);
    for (const pawn of allPawns()) {
      if (!pawn.alive) continue;
      const d = Math.hypot(pawn.x - g.x, (pawn.y + 0.9) - g.y, pawn.z - g.z);
      if (d > BLAST_RADIUS) continue;
      const falloff = 1 - d / BLAST_RADIUS;
      const amount = MAX_DAMAGE * falloff * falloff;
      if (pawn.isPlayer && hooks.playerGrenadeHit) hooks.playerGrenadeHit(amount);
      else if (hooks.botDamage) hooks.botDamage(pawn, amount, false, g);
    }
  }

  return { live, throwFrag, step };
}

export { FRAG_PRICE, BLAST_RADIUS };
