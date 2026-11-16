// Fragment grenade: a throw of up to two per round, a short fuse, and radial damage with
// distance falloff against every unit and the player. A bounced sphere is enough physics —
// it drops, settles, then detonates at a fixed time from the throw.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const FUSE = 1.5;
const RADIUS = 6.5;
const MAX_DAMAGE = 95;
const THROW_SPEED = 13;
const GRAVITY = 16;

export function createGrenades(scene) {
  const live = [];
  const geometry = new THREE.SphereGeometry(0.12, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) });

  function throwGrenade(from, direction, thrownAt, onExplode) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(from);
    scene.add(mesh);
    live.push({
      mesh,
      velocity: direction.clone().normalize().multiplyScalar(THROW_SPEED),
      timer: FUSE,
      thrownAt,
      onExplode,
      rest: false,
    });
  }

  function step(dt, targets) {
    for (let index = live.length - 1; index >= 0; index -= 1) {
      const grenade = live[index];
      grenade.timer -= dt;
      if (!grenade.rest) {
        grenade.velocity.y -= GRAVITY * dt;
        const next = grenade.mesh.position.clone().addScaledVector(grenade.velocity, dt);
        if (next.y <= 0.12) {
          next.y = 0.12;
          grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.25;
          grenade.velocity.x *= 0.6;
          grenade.velocity.z *= 0.6;
          if (grenade.velocity.length() < 0.6) grenade.rest = true;
        } else {
          grenade.mesh.position.copy(next);
        }
        grenade.mesh.position.x = Math.max(-18.5, Math.min(18.5, grenade.mesh.position.x));
        grenade.mesh.position.z = Math.max(-15.5, Math.min(15.5, grenade.mesh.position.z));
      }
      if (grenade.timer <= 0) {
        const center = grenade.mesh.position;
        for (const target of targets) {
          const distance = Math.hypot(
            center.x - target.position.x,
            center.y - (target.position.y + 1.0),
            center.z - target.position.z,
          );
          if (distance <= RADIUS) {
            const falloff = 1 - distance / RADIUS;
            target.onGrenade(Math.max(12, MAX_DAMAGE * falloff * falloff));
          }
        }
        scene.remove(grenade.mesh);
        live.splice(index, 1);
        grenade.onExplode(center.clone());
      }
    }
  }

  return { throwGrenade, step, count() { return live.length; } };
}
