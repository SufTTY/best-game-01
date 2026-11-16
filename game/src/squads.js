// Squad AI for both teams. Every bot runs a small task machine:
//   push     — walk its route lane toward the site (EMBER) or a hold point (COBALT)
//   plant    — stand on the site and arm the charge (the carrier only)
//   engage   — stop, strafe, and shoot the enemy it can see
//   rotate   — after the arm, everyone converges on the charge
// Bots buy better guns as their purse grows; aim wobble and burst discipline come from
// the seeded stream, so the match replays exactly per seed.

import { BOT, ROSTER } from './config.js';
import { rand, randInt, clamp, turnToward, distance2 } from './util.js';
import { lineOfSight, onSite, groundHeight, SITE, ROUTES, slide } from './map.js';
import { findPath } from './nav.js';
import { createBot, movePawn, pawnEyeY, PAWN_RADIUS } from './pawns.js';
import { weaponById } from './weapons.js';

const DEFEND_HOLDS = [[8.5, 4.2], [3.8, 2.8], [12.8, 3.2], [8.2, -4.5]];
const ATTACK_SPAWNS = [[-14, -13], [0, -14], [14, -13]];
const DEFEND_SPAWNS = [[7.6, 6.4], [10.4, 6.2], [4.4, 4.2], [12.6, 4.6]];

export function createSquads(rng, rounds, hooks) {
  const bots = { items: [] };

  function spawnTeams(player) {
    bots.items.length = 0;
    const routeIndex = rounds.state.route % ATTACK_SPAWNS.length;
    for (let i = 0; i < ROSTER.ember; i += 1) {
      const [sx, sz] = ATTACK_SPAWNS[routeIndex];
      const bot = createBot('ember', sx + rand(rng, -1.4, 1.4), sz + rand(rng, -1.4, 1.4), i < 2 ? 'k40' : 'p9');
      bot.route = routeIndex;
      bots.items.push(bot);
    }
    for (let i = 0; i < ROSTER.cobalt; i += 1) {
      const [sx, sz] = DEFEND_SPAWNS[i % DEFEND_SPAWNS.length];
      const bot = createBot('cobalt', sx + rand(rng, -1, 1), sz + rand(rng, -1, 1), i < 2 ? 'k40' : 'p9');
      bot.hold = DEFEND_HOLDS[i % DEFEND_HOLDS.length];
      bots.items.push(bot);
    }
    // The player takes a defender slot: the first cobalt bot is dropped if the player is in.
    if (player) {
      const spare = bots.items.find((b) => b.team === 'cobalt');
      if (spare) bots.items.splice(bots.items.indexOf(spare), 1);
    }
    // Each bot gets its own smoothed grid path: attackers to the site edge, defenders to
    // their hold point. Re-routing after a shove keeps a fight from wedging on a corner.
    for (const bot of bots.items) {
      if (bot.team === 'ember') {
        bot.carrier = bot.carrier || false;
        const offset = rand(rng, -1.2, 1.2);
        bot.path = findPath(bot.x, bot.z, SITE.x + offset, SITE.z + offset);
      } else {
        bot.path = findPath(bot.x, bot.z, bot.hold[0], bot.hold[1]);
      }
      bot.waypoint = 0;
    }
    const carrier = bots.items.find((b) => b.team === 'ember');
    if (carrier) carrier.carrier = true;
  }

  function byTeam(team) {
    return bots.items.filter((b) => b.team === team);
  }
  function aliveByTeam(team) {
    return bots.items.filter((b) => b.team === team && b.alive).length;
  }
  function hasCarrier() {
    return bots.items.some((b) => b.alive && b.carrier);
  }

  function visibleEnemies(bot, player) {
    const eye = pawnEyeY(bot);
    const foes = [];
    if (player && player.alive && player.team !== bot.team) {
      if (lineOfSight(bot.x, eye, bot.z, player.x, pawnEyeY(player), player.z)) foes.push(player);
    }
    for (const other of bots.items) {
      if (!other.alive || other.team === bot.team) continue;
      if (lineOfSight(bot.x, eye, bot.z, other.x, pawnEyeY(other), other.z)) foes.push(other);
    }
    return foes;
  }

  function enemiesOf(team, player) {
    const foes = [];
    if (player && player.alive && player.team !== team) foes.push(player);
    for (const b of bots.items) if (b.alive && b.team !== team) foes.push(b);
    return foes;
  }

  // One AI step for every bot. dt is the fixed step; fire() is injected by main.js.
  function step(dt, player, fire) {
    for (const bot of bots.items) {
      if (!bot.alive) continue;
      const eye = pawnEyeY(bot);
      const foes = enemiesOf(bot.team, player);
      // Perception: nearest visible foe wins; remember the last spot for a short chase.
      let foe = null;
      let bestD = Infinity;
      for (const f of foes) {
        const d = distance2(bot.x, bot.z, f.x, f.z);
        if (d < bestD && d < BOT.engageRange && lineOfSight(bot.x, eye, bot.z, f.x, pawnEyeY(f), f.z)) {
          bestD = d; foe = f;
        }
      }
      if (foe) {
        bot.lastSeen = { x: foe.x, z: foe.z };
        // Fresh contacts cost aim time; a target already tracked keeps its cadence.
        if (bot.target !== foe) bot.reaction = Math.max(bot.reaction, rand(rng, BOT.reactionMin, BOT.reactionMax));
        bot.target = foe;
      }

      if (foe && bot.reaction <= 0) {
        engage(dt, bot, foe, bestD, fire, player);
        continue;
      }
      bot.reaction = Math.max(0, bot.reaction - dt);

      // Objective behaviour when not fighting.
      if (rounds.state.phase === 'planted') { rotateToCharge(dt, bot, player); continue; }
      if (bot.team === 'ember') {
        if (bot.carrier && onSite(bot.x, bot.z) && rounds.state.phase === 'live') {
          rounds.state.armProgress += dt;
          if (rounds.state.armProgress >= 3) rounds.goPlanted(bot);
          faceToward(bot, SITE.x, SITE.z, dt);
          continue;
        }
        followPath(dt, bot, BOT.sprintSpeed);
      } else {
        holdPosition(dt, bot, player);
      }
    }
    // Pawn separation: bots stack when a lane funnels, so shove close pairs apart gently.
    const alive = bots.items.filter((b) => b.alive);
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.7 || d < 1e-4) continue;
        const push = (0.7 - d) / 2;
        const nx = dx / d, nz = dz / d;
        [a.x, a.z] = slide(a.x, a.z, PAWN_RADIUS, -nx * push, -nz * push);
        [b.x, b.z] = slide(b.x, b.z, PAWN_RADIUS, nx * push, nz * push);
      }
    }
  }

  function engage(dt, bot, foe, dist, fire, player) {
    // Combat: face the foe, strafe a little, fire bursts with aim wobble.
    bot.strafe -= dt;
    if (bot.strafe <= 0) { bot.strafeDir = rng() < 0.5 ? -1 : 1; bot.strafe = rand(rng, 0.4, 1.1); }
    const dx = foe.x - bot.x, dz = foe.z - bot.z;
    const len = Math.hypot(dx, dz) || 1;
    faceToward(bot, foe.x, foe.z, dt);
    // Keep fighting distance: back off if too close for a rifle, close if far.
    let mx = 0, mz = 0;
    if (dist > 16) { mx = dx / len; mz = dz / len; }
    else if (dist < 5) { mx = -dx / len; mz = -dz / len; }
    const px = -dz / len * (bot.strafeDir || 1) * 0.6;
    const pz = dx / len * (bot.strafeDir || 1) * 0.6;
    movePawn(bot, mx + px, mz + pz, BOT.walkSpeed, dt);
    bot.pause -= dt;
    if (bot.pause <= 0) {
      fire(bot, foe);
      bot.burst -= 1;
      if (bot.burst <= 0) { bot.burst = randInt(rng, BOT.fireBurst[0], BOT.fireBurst[1]); bot.pause = rand(rng, BOT.burstPause[0], BOT.burstPause[1]); }
    }
  }

  // Path following: walk the smoothed waypoint list, re-routing when shoved off it or when
  // a shove leaves the bot facing a wall it cannot walk through.
  function followPath(dt, bot, speed) {
    if (!bot.path || bot.path.length === 0) { bot.path = findPath(bot.x, bot.z, SITE.x, SITE.z); bot.waypoint = 0; }
    let point = bot.path[Math.min(bot.waypoint, bot.path.length - 1)];
    let d = distance2(bot.x, bot.z, point[0], point[1]);
    if (d < 0.75 && bot.waypoint < bot.path.length - 1) {
      bot.waypoint += 1;
      point = bot.path[bot.waypoint];
      d = distance2(bot.x, bot.z, point[0], point[1]);
    }
    const before = [bot.x, bot.z];
    steerToward(dt, bot, point[0], point[1], speed);
    // Stuck watchdog: a bot that moved nowhere for a second re-plans.
    bot.stuck = (Math.hypot(bot.x - before[0], bot.z - before[1]) < 0.004) ? (bot.stuck || 0) + dt : 0;
    if (bot.stuck > 1) {
      const target = bot.team === 'ember' ? [SITE.x, SITE.z] : (bot.hold || DEFEND_HOLDS[0]);
      bot.path = findPath(bot.x, bot.z, target[0] + rand(rng, -1, 1), target[1] + rand(rng, -1, 1));
      bot.waypoint = 0;
      bot.stuck = 0;
    }
  }

  function rotateToCharge(dt, bot, player) {
    // Attackers guard the charge; defenders push to defuse.
    if (bot.team === 'cobalt') {
      if (onSite(bot.x, bot.z)) faceToward(bot, SITE.x, SITE.z, dt);
      else followPath(dt, bot, BOT.sprintSpeed);
    } else {
      const d = distance2(bot.x, bot.z, SITE.x, SITE.z);
      if (d > 6) steerToward(dt, bot, SITE.x, SITE.z, BOT.walkSpeed);
      else faceToward(bot, player && player.alive ? player.x : SITE.x, player && player.alive ? player.z : SITE.z, dt);
    }
  }

  function holdPosition(dt, bot, player) {
    // Defenders walk their path to the hold point, then scan; a live enemy in view is
    // handled by engage() before this runs.
    const point = bot.hold || DEFEND_HOLDS[0];
    const d = distance2(bot.x, bot.z, point[0], point[1]);
    if (d > 1.2) followPath(dt, bot, BOT.walkSpeed);
    else if (player && player.alive && player.team !== bot.team) faceToward(bot, player.x, player.z, dt);
    else bot.yaw += dt * 0.3 * (bot.strafeDir || 1); // lazy scan while holding
  }

  function steerToward(dt, bot, tx, tz, speed) {
    const dx = tx - bot.x, dz = tz - bot.z;
    const len = Math.hypot(dx, dz) || 1;
    faceToward(bot, tx, tz, dt);
    movePawn(bot, dx / len, dz / len, speed, dt);
  }

  function faceToward(bot, tx, tz, dt) {
    const want = Math.atan2(tx - bot.x, tz - bot.z);
    const turn = turnToward(bot.yaw, want);
    bot.yaw += clamp(turn, -dt * 6, dt * 6);
  }

  // Economy: bots upgrade their rifle when they can afford it between rounds.
  function shop() {
    for (const bot of bots.items) {
      const purse = rounds.state.money[bot.team];
      if (purse >= 2400 && bot.loadout !== 'm6') { bot.loadout = 'm6'; rounds.spend(bot.team, 2400); }
      else if (purse >= 1900 && bot.loadout === 'p9') { bot.loadout = 'k40'; rounds.spend(bot.team, 1900); }
      if (purse >= 1000 && bot.armor === 0) { bot.armor = 50; rounds.spend(bot.team, 650); }
    }
  }

  return {
    bots,
    spawnTeams,
    step,
    shop,
    byTeam,
    aliveByTeam,
    hasCarrier,
  };
}

export { DEFEND_HOLDS, ATTACK_SPAWNS, DEFEND_SPAWNS };
// The task machine above stays small on purpose: perceive, decide, move, fire.
