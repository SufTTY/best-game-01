// Pawns: the player body and every bot, walking the map with the same collision, taking
// damage through the same armour rule. A pawn is a circle on the ground plane plus a head
// box for the headshot check; three.js meshes are dressed onto them by main.js.

import { PLAYER, ARMOR_SOAK } from './config.js';
import { slide, groundHeight } from './map.js';

export const PAWN_RADIUS = 0.42;

export function createPlayer() {
  return {
    team: 'cobalt',
    isPlayer: true,
    x: -8.5, y: 0, z: 0.5,
    pitch: 0, yaw: 0,
    crouching: false,
    grounded: true,
    vy: 0,
    health: 100,
    armor: 0,
    alive: true,
    lastMoveSpeed: 0,
  };
}

export function createBot(team, x, z, loadoutId) {
  return {
    team,
    isPlayer: false,
    x, y: 0, z,
    yaw: 0,
    health: 100,
    armor: 0,
    alive: true,
    loadout: loadoutId,
    // AI scratch space (owned by squads.js)
    task: null,
    target: null,
    waypoint: 0,
    reaction: 0,
    burst: 0,
    pause: 0,
    strafe: 0,
    lastSeen: null,
  };
}

export function pawnHeadY(pawn) {
  const base = pawn.isPlayer ? (pawn.crouching ? PLAYER.crouchHeight : PLAYER.height) : 1.5;
  return pawn.y + base;
}

export function pawnEyeY(pawn) {
  return pawnHeadY(pawn) - 0.12;
}

export function damagePawn(pawn, amount, headshot, hooks) {
  if (!pawn.alive) return { killed: false };
  let hit = amount;
  if (pawn.armor > 0 && !headshot) {
    hit = amount * ARMOR_SOAK;
    pawn.armor = Math.max(0, pawn.armor - amount * 0.75);
    if (pawn.armor === 0 && hooks && hooks.armorBreak) hooks.armorBreak(pawn);
  }
  pawn.health -= hit;
  const killed = pawn.health <= 0;
  if (killed) {
    pawn.alive = false;
    pawn.health = 0;
    if (hooks && hooks.onDeath) hooks.onDeath(pawn);
  }
  return { killed, damage: hit };
}

// Shared movement integration for a pawn: wish direction (world XZ), speed, dt.
export function movePawn(pawn, wishX, wishZ, speed, dt) {
  const [nx, nz] = slide(pawn.x, pawn.z, PAWN_RADIUS, wishX * speed * dt, wishZ * speed * dt);
  pawn.lastMoveSpeed = Math.hypot(nx - pawn.x, nz - pawn.z) / Math.max(dt, 1e-6);
  pawn.x = nx;
  pawn.z = nz;
  const ground = groundHeight(pawn.x, pawn.z);
  // Gravity only matters for the player's jump; bots stay glued to their ground height.
  if (pawn.isPlayer) {
    pawn.y += pawn.vy * dt;
    pawn.vy -= PLAYER.gravity * dt;
    if (pawn.y <= ground) { pawn.y = ground; pawn.vy = 0; pawn.grounded = true; }
    else pawn.grounded = false;
  } else {
    pawn.y = ground;
  }
}

export function tryJump(pawn) {
  if (pawn.grounded) {
    pawn.vy = PLAYER.jumpVelocity;
    pawn.grounded = false;
    return true;
  }
  return false;
}
