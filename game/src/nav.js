// Navigation: a coarse occupancy grid over the map's wall boxes, plus BFS paths that are
// string-pulled down to the few corner waypoints a bot actually has to walk. Bots use it to
// push lanes without wedging on corners, and re-route when they are shoved off a path.

import { WALLS, lineOfSight } from './map.js';

const CELL = 0.5;
const X0 = -19, Z0 = -17, X1 = 19, Z1 = 17;
const W = Math.round((X1 - X0) / CELL) + 1;
const H = Math.round((Z1 - Z0) / CELL) + 1;
const PAWN_SLACK = 0.5;

const blocked = new Uint8Array(W * H);
for (let gx = 0; gx < W; gx += 1) {
  for (let gz = 0; gz < H; gz += 1) {
    const x = X0 + gx * CELL;
    const z = Z0 + gz * CELL;
    for (const w of WALLS) {
      if (w.platform) continue;
      if (x + PAWN_SLACK > w.x1 && x - PAWN_SLACK < w.x2 && z + PAWN_SLACK > w.z1 && z - PAWN_SLACK < w.z2) {
        blocked[gz * W + gx] = 1;
        break;
      }
    }
  }
}

const cellOf = (x, z) => [
  Math.max(0, Math.min(W - 1, Math.round((x - X0) / CELL))),
  Math.max(0, Math.min(H - 1, Math.round((z - Z0) / CELL))),
];
const worldOf = (gx, gz) => [X0 + gx * CELL, Z0 + gz * CELL];
const walkable = (gx, gz) => gx >= 0 && gz >= 0 && gx < W && gz < H && !blocked[gz * W + gx];

function nearestWalkable(gx, gz) {
  if (walkable(gx, gz)) return [gx, gz];
  for (let r = 1; r <= 6; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        if (walkable(gx + dx, gz + dz)) return [gx + dx, gz + dz];
      }
    }
  }
  return null;
}

// BFS over the grid (8-connected, no corner cutting), then string-pull: from each kept point
// take the furthest later point a straight line can reach. Returns world-space waypoints
// excluding the start position.
export function findPath(sx, sz, tx, tz) {
  const [sgx, sgz] = nearestWalkable(...cellOf(sx, sz)) || [0, 0];
  const [tgx, tgz] = nearestWalkable(...cellOf(tx, tz)) || [0, 0];
  const startKey = sgz * W + sgx;
  const goalKey = tgz * W + tgx;
  const prev = new Int32Array(W * H).fill(-1);
  const seen = new Uint8Array(W * H);
  const queue = [startKey];
  seen[startKey] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = startKey === goalKey;
  for (let head = 0; head < queue.length && !found; head += 1) {
    const key = queue[head];
    const gx = key % W;
    const gz = (key - gx) / W;
    for (const [dx, dz] of dirs) {
      const nx = gx + dx;
      const nz = gz + dz;
      if (!walkable(nx, nz)) continue;
      // No corner cutting for diagonals.
      if (dx !== 0 && dz !== 0 && (!walkable(gx + dx, gz) || !walkable(gx, gz + dz))) continue;
      const nkey = nz * W + nx;
      if (seen[nkey]) continue;
      seen[nkey] = 1;
      prev[nkey] = key;
      if (nkey === goalKey) { found = true; break; }
      queue.push(nkey);
    }
  }
  if (!found) return [];
  const cells = [];
  for (let key = goalKey; key !== -1; key = prev[key]) {
    const gx = key % W;
    const gz = (key - gx) / W;
    cells.push(worldOf(gx, gz));
    if (key === startKey) break;
  }
  cells.reverse();
  const smoothed = [];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    for (; j > i + 1; j -= 1) {
      if (lineOfSight(cells[i][0], 1.1, cells[i][1], cells[j][0], 1.1, cells[j][1])) break;
    }
    smoothed.push(cells[j]);
    i = j;
  }
  return smoothed;
}

// Straight-line check for steering / line-of-fire helpers that do not need the grid.
export function pathClear(ax, az, bx, bz) {
  return lineOfSight(ax, 1.1, az, bx, 1.1, bz);
}

export { CELL, W, H };
