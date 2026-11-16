// MERIDIAN STATION: the map is data, not code paths. WALLS is a list of axis-aligned boxes
// (x1, z1, x2, z2, height) — every one is a collider the pawns slide along and a surface
// bullets stop at. Three lanes run south to north: garage (west), mid (centre) and window
// (east), each with its own cover story. SITE is the raised platform the demo charge goes on.

import { PALETTE, SITE } from './config.js';

export const WALLS = [
  // Outer shell (perimeter).
  { x1: -20, z1: -18, x2: 20, z2: -17, h: 4 },
  { x1: -20, z1: 17, x2: 20, z2: 18, h: 4 },
  { x1: -20, z1: -18, x2: -19, z2: 18, h: 4 },
  { x1: 19, z1: -18, x2: 20, z2: 18, h: 4 },
  // Garage lane (west): a corridor between two long walls, opening north.
  { x1: -16.5, z1: -12, x2: -15.5, z2: -1, h: 3.2 },
  { x1: -9.5, z1: -12, x2: -8.5, z2: -2, h: 3.2 },
  { x1: -8.5, z1: -2, x2: -3, z2: -1, h: 3.2 },
  // Mid lane (centre): open ground with hard cover, the fastest push.
  { x1: -2.5, z1: -7, x2: -1, z2: -4.5, h: 1.6 },
  { x1: 1, z1: -5, x2: 3, z2: -2.5, h: 1.6 },
  { x1: -1, z1: 1.5, x2: 1.5, z2: 3.5, h: 1.4 },
  // Window lane (east): mirrored corridor with a step-out at the north end.
  { x1: 9.5, z1: -12, x2: 10.5, z2: -2, h: 3.2 },
  { x1: 15.5, z1: -12, x2: 16.5, z2: -1, h: 3.2 },
  { x1: 9.5, z1: -2, x2: 12, z2: -1, h: 3.2 },
  { x1: 13, z1: -7, x2: 16, z2: -6, h: 1.6 },
  // Site ring: cover on the approach from every lane.
  { x1: 2, z1: 4, x2: 4.5, z2: 5.5, h: 2.4 },
  { x1: 12.5, z1: 4, x2: 15, z2: 5.5, h: 2.4 },
  { x1: 6, z1: 5.5, x2: 7, z2: 8, h: 1.5 },
  { x1: 11, z1: 5.5, x2: 12, z2: 8, h: 1.5 },
  { x1: 4, z1: -2, x2: 4.8, z2: 0.5, h: 1.2 },
  { x1: 12.2, z1: -2, x2: 13, z2: 0.5, h: 1.2 },
  // Defenders' back line, north of the site.
  { x1: -1, z1: 9, x2: 3, z2: 10, h: 2.8 },
  { x1: 14, z1: 9, x2: 18, z2: 10, h: 2.8 },
  { x1: -1, z1: 13.5, x2: 1, z2: 14.5, h: 2.8 },
  { x1: 16, z1: 13.5, x2: 18, z2: 14.5, h: 2.8 },
  // Site platform itself (raised slab, walkable).
  { x1: 5, z1: -2.5, x2: 11.5, z2: 2.5, h: 0.55, platform: true },
];

export const PLATFORM = WALLS.find((w) => w.platform);

// Lanes EMBER may push each round: garage, mid and window, spawn to the site edge.
export const ROUTES = [
  { name: 'garage', points: [[-14, -13], [-12, -9], [-12, -4], [-11, 1], [-7, 2.5], [-2, 1.5], [2, 1.2], [3.2, 2.5], [7, 3], [8.2, 1.5]] },
  { name: 'mid', points: [[0, -14], [0, -9], [0, -5.5], [0, -2.2], [1, -1.2], [2, 1.2], [6.5, 1.2], [8.2, 1.2]] },
  { name: 'window', points: [[14, -13], [12.5, -9], [12.5, -4], [14, -1.5], [13, 1.5], [10.5, 2.5], [8.8, 1.5]] },
];

// Where COBALT spreads out while the round is live: two site anchors, two rovers.
export const HOLDPOINTS = [
  [8.5, 4.2], [3.8, 2.8], [12.8, 3.2], [8.2, -4.5],
];

export function buildScene(THREE) {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.2, 36),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  floor.position.set(0, -0.1, 0);
  group.add(floor);

  for (const wall of WALLS) {
    const w = wall.x2 - wall.x1;
    const d = wall.z2 - wall.z1;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, wall.h, d),
      new THREE.MeshLambertMaterial({ color: wall.platform ? PALETTE.wallTop : (wall.h > 2 ? PALETTE.wall : PALETTE.crate) }),
    );
    mesh.position.set((wall.x1 + wall.x2) / 2, wall.h / 2, (wall.z1 + wall.z2) / 2);
    group.add(mesh);
    wall.mesh = mesh;
  }

  // Site marker: a flat ring painted around the platform.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SITE.radius - 0.25, SITE.radius, 40),
    new THREE.MeshBasicMaterial({ color: PALETTE.beam, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(SITE.x, 0.58, SITE.z);
  group.add(ring);

  return group;
}

// Axis-separated slide: move x, resolve, move z, resolve. Pawns are circles of `radius`
// against AABBs; the platform counts only as ground height, never as a wall.
export function slide(px, pz, radius, dx, dz) {
  let x = px + dx;
  let z = pz;
  for (const w of WALLS) {
    if (w.platform) continue;
    if (x + radius > w.x1 && x - radius < w.x2 && z + radius > w.z1 && z - radius < w.z2) {
      x = dx > 0 ? w.x1 - radius : w.x2 + radius;
    }
  }
  z = pz + dz;
  for (const w of WALLS) {
    if (w.platform) continue;
    if (x + radius > w.x1 && x - radius < w.x2 && z + radius > w.z1 && z - radius < w.z2) {
      z = dz > 0 ? w.z1 - radius : w.z2 + radius;
    }
  }
  x = Math.max(-19 + radius, Math.min(19 - radius, x));
  z = Math.max(-17 + radius, Math.min(17 - radius, z));
  return [x, z];
}

// Eye-level ground height at a point: 0.55 on the platform slab, 0 elsewhere.
export function groundHeight(x, z) {
  return (x > PLATFORM.x1 && x < PLATFORM.x2 && z > PLATFORM.z1 && z < PLATFORM.z2) ? PLATFORM.h : 0;
}

export function onSite(x, z) {
  return Math.hypot(x - SITE.x, z - SITE.z) < SITE.radius;
}

// Closest hit of a ray (origin, direction, max range) against the wall boxes, for bullets.
// Returns the hit distance, or Infinity when nothing blocks the ray.
export function rayWalls(ox, oy, oz, dx, dy, dz, range) {
  let best = range;
  for (const w of WALLS) {
    if (w.platform) continue;
    const t = rayBox(ox, oy, oz, dx, dy, dz, w.x1, 0, w.z1, w.x2, w.h, w.z2);
    if (t !== null && t < best) best = t;
  }
  const groundT = dy < -1e-6 ? (oy - 0.02) / -dy : Infinity;
  if (groundT > 0 && groundT < best) best = groundT;
  return best;
}

// Slab-method ray vs AABB; null when the ray misses or starts behind the box.
function rayBox(ox, oy, oz, dx, dy, dz, x1, y1, z1, x2, y2, z2) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [[ox, dx, x1, x2], [oy, dy, y1, y2], [oz, dz, z1, z2]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : null;
}

export function lineOfSight(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  return rayWalls(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 1e-6;
}

export { SITE };
