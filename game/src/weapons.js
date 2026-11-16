// Weapons: definitions live in config.js; this module owns magazines, reloads, spread
// bloom and the actual firing (ray vs walls and pawns). Spread blooms while you move or
// spam and tightens when you stand still or crouch — stopping to aim pays.

import { WEAPONS, PLAYER } from './config.js';
import { rand, clamp } from './util.js';
import { rayWalls } from './map.js';

export function weaponById(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function createArsenal(rng, ownerTeam) {
  return {
    team: ownerTeam,
    slots: ['p9'],
    current: 0,
    mag: { p9: 12 },
    reserve: { p9: 48 },
    cooldown: 0,
    reloading: 0,
    bloom: 0,

    equip(index) {
      const id = this.slots[index];
      if (!id || this.reloading > 0) return false;
      this.current = index;
      this.cooldown = Math.max(this.cooldown, 0.25);
      return true;
    },

    held() {
      return weaponById(this.slots[this.current]);
    },

    // True bloom factors: movement and rate of fire. Returns the current spread in degrees.
    spreadDeg(moving, crouching) {
      const def = this.held();
      const base = moving ? def.spreadMove : def.spreadStill;
      const bloomAdd = this.bloom * (moving ? def.spreadMove : def.spreadStill) * 0.8;
      return Math.max(0.05, base + bloomAdd) * (crouching ? 0.65 : 1);
    },

    startReload() {
      const def = this.held();
      const id = def.id;
      if (this.reloading > 0 || this.mag[id] >= def.mag || this.reserve[id] <= 0) return false;
      this.reloading = def.reload;
      return true;
    },

    step(dt, moving) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.bloom = clamp(this.bloom - dt * 1.8 - (moving ? 0 : 0.6 * dt), 0, 1.6);
      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) {
          const def = this.held();
          const id = def.id;
          const need = def.mag - this.mag[id];
          const take = Math.min(need, this.reserve[id]);
          this.mag[id] += take;
          this.reserve[id] -= take;
          this.reloading = 0;
        }
      }
    },

    // Fire one shot: returns null when out of ammo/cooldown, else a bullet descriptor.
    fire(origin, direction, moving, crouching) {
      const def = this.held();
      const id = def.id;
      if (this.cooldown > 0 || this.reloading > 0) return null;
      if ((this.mag[id] || 0) <= 0) return 'empty';
      this.mag[id] -= 1;
      this.cooldown = 60 / def.rpm;
      this.bloom = clamp(this.bloom + 0.28, 0, 1.6);
      const spreadDeg = this.spreadDeg(moving, crouching);
      const bullets = [];
      const pellets = def.pellets || 1;
      for (let p = 0; p < pellets; p += 1) {
        const ang = (rng() - 0.5) * (spreadDeg * Math.PI) / 180;
        const yaw = (rng() - 0.5) * (spreadDeg * Math.PI) / 180;
        const dir = rotateAround(direction, ang, yaw);
        bullets.push(dir);
      }
      return { def, bullets };
    },
  };
}

// Rotate a unit direction by small yaw (around Y) and pitch (around camera-right) angles.
export function rotateAround(dir, pitch, yaw) {
  const [x, y, z] = dir;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  let nx = x * cosY - z * sinY;
  let nz = x * sinY + z * cosY;
  const len = Math.hypot(nx, y, nz) || 1;
  nx /= len; nz /= len;
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const ny = clamp(y * cosP - Math.hypot(nx, nz) * sinP, -0.98, 0.98);
  const horiz = Math.sqrt(Math.max(0, 1 - ny * ny));
  const nl = Math.hypot(nx, nz) || 1;
  return [nx / nl * horiz, ny, nz / nl * horiz];
}

export { PLAYER };
