export const W = 1280;
export const H = 800;
export const DEPTHS = 10;
export const HULL_MAX = 3;
export const SURGE_TIME = 6;
export const LANTERN_MAX = 100;
export const INVULN = 1.5;
export const PLAYER_SPEED = 300;
export const FIRE_CD = 0.22;
export const SURGE_FIRE_CD = 0.11;
export const MAGNET_R = 160;
export const MAX_DT = 0.05;

export const depthParams = (d) => ({
  waves: 2 + Math.min(4, Math.floor(d / 2)),
  jelly: 3 + d,
  fang: Math.max(0, d - 1),
  dart: d >= 2 ? 1 + Math.floor(d / 2) : 0,
  speed: 1 + (d - 1) * 0.08,
  hp: d >= 7 ? 2 : 1,
});

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
