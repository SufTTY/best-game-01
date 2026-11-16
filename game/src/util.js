// Small shared helpers. One seeded stream drives every random decision in the simulation
// so a given seed replays the same bot-vs-bot match anywhere: routes, strafes, aim wobble,
// burst lengths and per-bullet tracers all pull from it. Rendering noise never touches it.

export function makeRng(seed) {
  // mulberry32: tiny, fast, good enough for a deterministic match replay.
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (rng, low, high) => low + rng() * (high - low);
export const randInt = (rng, low, high) => Math.floor(rand(rng, low, high + 1));
export const pick = (rng, items) => items[Math.floor(rng() * items.length) % items.length];

export function distance2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Shortest signed turn from heading a to heading b, in radians.
export function turnToward(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
