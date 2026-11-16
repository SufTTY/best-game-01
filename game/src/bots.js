// Team bots for both sides of BREACH LINE. EMBER bots push one of three routes to the
// site; the charge carrier arms the demo on the platform. COBALT bots hold assigned
// positions watching lanes, rotate on the plant and defuse when it is safe. Every bot
// engages the nearest enemy it can see, strafes while firing and respects walls.
// Bot-vs-bot shots are deterministic: the same seed yields the same hits, every run.
import * as THREE from 'three';
import { TEAMS } from './palette.js';
import { SITE, SPAWNS, ROUTES, HOLDS } from './world.js';

const RADIUS = 0.36;
const HEIGHT = 1.7;
const EYE = 1.35;
const ENGAGE_RANGE = 17;
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 5.0;
const TELEGRAPH = 0.38;

// Loadout tiers escalate with the round number, standing in for the bots' own economy.
const TIERS = [
  { damage: 24, gap: 0.34, error: 0.060 },
  { damage: 26, gap: 0.28, error: 0.052 },
  { damage: 30, gap: 0.21, error: 0.044 },
  { damage: 32, gap: 0.17, error: 0.037 },
  { damage: 36, gap: 0.14, error: 0.031 },
];

function buildUnitMeshes(scene, team) {
  const shell = new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAMS[team]), roughness: 0.55, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#22262e'), roughness: 0.8 });
  const visor = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f0a830') });

  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.34), shell);
  torso.position.y = 1.18;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), dark);
  head.position.y = 1.62;
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.02), visor);
  visorMesh.position.set(0, 1.63, -0.16);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.22), shell);
  legL.position.set(-0.15, 0.41, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.14), shell);
  armL.position.set(-0.36, 1.14, -0.06);
  const armR = armL.clone();
  armR.position.x = 0.36;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.5), dark);
  gun.position.set(0.36, 1.2, -0.36);
  group.add(torso, head, visorMesh, legL, legR, armL, armR, gun);
  group.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  scene.add(group);
  return { group, torso, head, visorMesh, legL, legR, gun };
}

export function createBots(scene, world, rng, hooks) {
  const items = [];
  const hitMeshes = [];
  const raycaster = new THREE.Raycaster();
  const probe = new THREE.Box3();
  const toTarget = new THREE.Vector3();
  let chargeCarrier = null;

  function blocked(from, to) {
    toTarget.copy(to).sub(from);
    const length = toTarget.length();
    if (length < 0.01) return false;
    raycaster.set(from, toTarget.normalize());
    raycaster.far = length;
    return raycaster.intersectObjects(world.shootables, false).length > 0;
  }

  function overlaps(x, z, y) {
    probe.min.set(x - RADIUS, y + 0.05, z - RADIUS);
    probe.max.set(x + RADIUS, y + HEIGHT, z + RADIUS);
    for (const collider of world.colliders) if (probe.intersectsBox(collider)) return collider;
    return null;
  }

  function spawnTeam(team, count, tier, carrierIndex) {
    for (let index = 0; index < count; index += 1) {
      const spot = SPAWNS[team][index % SPAWNS[team].length];
      const parts = buildUnitMeshes(scene, team);
      const routeKeys = team === 'ember' ? ['emberWest', 'emberEast', 'emberMid'] : ['cobaltHold'];
      const route = ROUTES[routeKeys[index % routeKeys.length]];
      const unit = {
        parts,
        team,
        position: new THREE.Vector3(spot.x, 0, spot.z),
        yaw: team === 'ember' ? Math.PI : 0,
        health: 100,
        alive: true,
        tier,
        stats: TIERS[Math.min(tier, TIERS.length - 1)],
        state: 'task',
        telegraph: 0,
        fireCooldown: 0.6 + rng() * 0.8,
        waypoint: 0,
        route,
        hold: HOLDS[(index + 1) % HOLDS.length],
        holdShift: 0,
        carrier: team === 'ember' && index === carrierIndex,
        planting: false,
        plantProgress: 0,
        defusing: false,
        defuseProgress: 0,
        strafeDir: rng() < 0.5 ? -1 : 1,
        strafeLeft: 1 + rng() * 1.5,
        reposition: 14 + rng() * 10,
        lastSeen: null,
        huntTimer: 0,
        walkPhase: rng() * Math.PI * 2,
        dieTime: 0,
        reward: 300,
      };
      if (unit.carrier) chargeCarrier = unit;
      parts.torso.userData.unit = unit;
      parts.head.userData.unit = unit;
      parts.head.userData.part = 'head';
      parts.torso.userData.part = 'torso';
      hitMeshes.push(parts.torso, parts.head);
      items.push(unit);
    }
  }

  function damage(unit, amount, headshot) {
    if (!unit.alive) return { killed: false, damage: 0, reward: 0 };
    unit.health -= amount;
    if (unit.health <= 0) {
      unit.alive = false;
      unit.state = 'dead';
      unit.dieTime = 0;
      if (unit.carrier) {
        chargeCarrier = null;
        hooks.chargeDropped(unit);
      }
      unit.parts.torso.userData.unit = null;
      unit.parts.head.userData.unit = null;
      return { killed: true, damage: amount, reward: unit.reward * (headshot ? 2 : 1), unit };
    }
    return { killed: false, damage: amount, unit };
  }

  function enemiesOf(team) {
    return items.filter((unit) => unit.alive && unit.team !== team);
  }

  function playerEnemy(team, body) {
    return body.alive && team === 'ember';
  }

  function nearestVisibleEnemy(unit, body) {
    const eye = new THREE.Vector3(unit.position.x, unit.position.y + EYE, unit.position.z);
    let best = null;
    let bestDistance = Infinity;
    for (const enemy of enemiesOf(unit.team)) {
      const target = new THREE.Vector3(enemy.position.x, enemy.position.y + 1.3, enemy.position.z);
      const distance = eye.distanceTo(target);
      if (distance > ENGAGE_RANGE || distance >= bestDistance) continue;
      if (blocked(eye, target)) continue;
      best = { point: target, distance, isPlayer: false, body: enemy };
      bestDistance = distance;
    }
    if (playerEnemy(unit.team, body)) {
      const target = new THREE.Vector3(body.position.x, body.position.y + body.eye, body.position.z);
      const distance = eye.distanceTo(target);
      if (distance <= ENGAGE_RANGE && distance < bestDistance && !blocked(eye, target)) {
        best = { point: target, distance, isPlayer: true, body: null };
      }
    }
    return best;
  }

  function fire(unit, target) {
    const from = new THREE.Vector3(unit.position.x, unit.position.y + 1.2, unit.position.z);
    const distance = from.distanceTo(target.point);
    const dir = target.point.clone().sub(from).normalize();
    const aimError = unit.stats.error * (1 + distance * 0.02);
    dir.x += (rng() * 2 - 1) * aimError;
    dir.y += (rng() * 2 - 1) * aimError * 0.6;
    dir.z += (rng() * 2 - 1) * aimError;
    dir.normalize();
    const hitChance = Math.max(0.05, Math.min(0.4, 0.34 - distance * 0.012));
    const hit = rng() < hitChance;
    hooks.botFired(unit, from, target, hit);
    if (hit) {
      const headshot = rng() < 0.14;
      const amount = unit.stats.damage * (headshot ? 2.4 : 1);
      if (target.isPlayer) hooks.onPlayerHit(amount, headshot, unit);
      else {
        const result = damage(target.body, amount, headshot);
        if (result.killed) hooks.botKilled(unit, target.body);
      }
    }
  }

  function moveStep(unit, stepX, stepZ) {
    // One collision-checked move with axis fallback, shared by routes and combat strafes.
    const nx = unit.position.x + stepX;
    const nz = unit.position.z + stepZ;
    if (!overlaps(nx, nz, unit.position.y)) {
      unit.position.x = nx;
      unit.position.z = nz;
      return true;
    }
    if (!overlaps(nx, unit.position.z, unit.position.y)) {
      unit.position.x = nx;
      return true;
    }
    if (!overlaps(unit.position.x, nz, unit.position.y)) {
      unit.position.z = nz;
      return true;
    }
    return false;
  }

  function moveToward(unit, goal, speed, dt) {
    const dx = goal.x - unit.position.x;
    const dz = goal.z - unit.position.z;
    const flat = Math.hypot(dx, dz);
    if (flat < 0.25) return true;
    const moved = moveStep(unit, (dx / flat) * speed * dt, (dz / flat) * speed * dt);
    if (!moved) unit.holdShift = 0.5; // stuck: pause and try again next tick
    return false;
  }

  function atSite(unit) {
    return Math.hypot(unit.position.x - SITE.x, unit.position.z - SITE.z) < SITE.radius;
  }

  function step(dt, body, context) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const unit = items[index];
      const { group } = unit.parts;

      if (!unit.alive) {
        unit.dieTime += dt;
        const fall = Math.min(1, unit.dieTime / 0.45);
        group.rotation.x = -fall * 1.5;
        group.position.y = -fall * 0.1;
        if (unit.dieTime > 1.8 && unit.dieTime < 2.0) group.position.y = -(0.1 + (unit.dieTime - 0.45) * 0.4);
        if (unit.dieTime > 2.0) {
          scene.remove(group);
          group.traverse((mesh) => { if (mesh.isMesh && mesh.material.dispose) mesh.material.dispose?.(); });
          items.splice(index, 1);
        }
        continue;
      }

      unit.fireCooldown = Math.max(0, unit.fireCooldown - dt);
      unit.holdShift = Math.max(0, unit.holdShift - dt);
      const enemy = nearestVisibleEnemy(unit, body);
      let speed = 0;
      let busy = false;

      if (enemy) {
        // Engage: face the threat, sidestep on the ring, fire after a short telegraph.
        const dx = enemy.point.x - unit.position.x;
        const dz = enemy.point.z - unit.position.z;
        unit.yaw = Math.atan2(dx, dz);
        unit.strafeLeft -= dt;
        if (unit.strafeLeft <= 0) {
          unit.strafeDir = rng() < 0.5 ? -1 : 1;
          unit.strafeLeft = 0.8 + rng() * 1.4;
        }
        speed = 1.6;
        const flat = Math.hypot(dx, dz) || 1;
        if (enemy.distance > 9) {
          speed = 2.8;
          moveStep(unit, (dx / flat) * speed * dt, (dz / flat) * speed * dt);
        } else if (enemy.distance < 4) {
          moveStep(unit, (-dx / flat) * speed * dt, (-dz / flat) * speed * dt);
        } else {
          moveStep(unit, (-dz / flat) * speed * dt * 0.8 * unit.strafeDir, (dx / flat) * speed * dt * 0.8 * unit.strafeDir);
        }
        unit.telegraph += dt;
        if (unit.telegraph >= TELEGRAPH && unit.fireCooldown <= 0) {
          unit.fireCooldown = unit.stats.gap * 11;
          unit.telegraph = 0;
          fire(unit, enemy);
        }
        unit.lastSeen = { x: enemy.point.x, z: enemy.point.z };
        unit.huntTimer = 5;
      } else if (unit.team === 'ember' && unit.carrier && !context.planted && atSite(unit) && context.phase === 'live') {
        // Arm the charge on the platform.
        unit.planting = true;
        unit.plantProgress += dt;
        busy = true;
        if (unit.plantProgress >= PLANT_TIME) {
          unit.planting = false;
          hooks.chargesPlanted(unit);
        }
      } else if (unit.team === 'cobalt' && context.planted && atSite(unit) && context.phase === 'live') {
        // Defuse while no enemy is watching.
        unit.defusing = true;
        unit.defuseProgress += dt;
        busy = true;
        if (unit.defuseProgress >= DEFUSE_TIME) {
          unit.defusing = false;
          hooks.chargeDefused(unit);
        }
      } else if (unit.team === 'cobalt' && context.planted && context.phase === 'live') {
        // Rotate to the site to retake.
        speed = 3.0;
        moveToward(unit, { x: SITE.x + (rng() - 0.5), z: SITE.z + 2 }, speed, dt);
      } else if (unit.team === 'ember' && unit.lastSeen && unit.huntTimer > 0) {
        // Commit to the last fight: push to where the enemy was seen instead of
        // ping-ponging between the route and the engage ring.
        speed = 3.6;
        unit.huntTimer -= dt;
        if (moveToward(unit, unit.lastSeen, speed, dt) || unit.huntTimer <= 0) {
          unit.lastSeen = null;
          unit.huntTimer = 0;
        }
      } else if (unit.holdShift <= 0) {
        // Follow the route (attackers) or hold position (defenders).
        if (unit.team === 'ember') {
          const goal = unit.route[Math.min(unit.waypoint, unit.route.length - 1)];
          speed = context.timerLow ? 4.2 : 3.5;
          if (moveToward(unit, goal, speed, dt)) {
            if (unit.waypoint < unit.route.length - 1) unit.waypoint += 1;
            else if (!context.planted) {
              // At the site without the charge: cover the carrier.
              speed = 1.2;
              moveToward(unit, { x: SITE.x + Math.sin(unit.walkPhase) * 2.5, z: SITE.z + 1.5 }, speed, dt);
            }
          }
        } else {
          speed = 2.6;
          moveToward(unit, unit.hold, speed, dt);
          const dx = Math.sin(unit.hold.yaw);
          const dz = Math.cos(unit.hold.yaw);
          unit.yaw = Math.atan2(dx, dz);
          if (Math.hypot(unit.position.x - unit.hold.x, unit.position.z - unit.hold.z) < 0.4) speed = 0;
          // Defenders reposition every so often so they never freeze in one angle.
          unit.reposition -= dt;
          if (unit.reposition <= 0 && speed === 0) {
            unit.reposition = 16 + rng() * 10;
            unit.hold = HOLDS[Math.floor(rng() * HOLDS.length)];
          }
        }
      }

      if (!enemy) {
        if (speed > 0.1) {
          unit.yaw = Math.atan2(
            (unit.team === 'ember' ? unit.route[Math.min(unit.waypoint, unit.route.length - 1)].x : unit.hold.x) - unit.position.x,
            (unit.team === 'ember' ? unit.route[Math.min(unit.waypoint, unit.route.length - 1)].z : unit.hold.z) - unit.position.z,
          );
        }
        if (!busy) unit.telegraph = Math.max(0, unit.telegraph - dt * 2);
      }

      group.position.set(unit.position.x, unit.position.y, unit.position.z);
      group.rotation.y = unit.yaw;
      unit.walkPhase += speed * dt * 3.4;
      const swing = speed > 0.1 ? Math.sin(unit.walkPhase) * 0.5 : 0;
      unit.parts.legL.rotation.x = swing;
      unit.parts.legR.rotation.x = -swing;
      const glow = (unit.telegraph > 0 || unit.planting || unit.defusing) ? 0xffdd55 : 0xf0a830;
      unit.parts.visorMesh.material.color.setHex(glow);
      unit.parts.visorMesh.scale.setScalar(unit.telegraph > 0 || unit.planting || unit.defusing ? 1.5 : 1);
    }
  }

  function resetForRound(tier, carrierIndex) {
    for (const unit of items) {
      scene.remove(unit.parts.group);
      unit.parts.group.traverse((mesh) => { if (mesh.isMesh && mesh.material?.dispose) mesh.material.dispose(); });
    }
    items.length = 0;
    hitMeshes.length = 0;
    chargeCarrier = null;
    // Defenders hold angles and cover, attackers bring numbers: a one-tier edge keeps
    // the site from folding the moment the push arrives.
    spawnTeam('cobalt', 4, Math.min(TIERS.length - 1, tier + 1), -1);
    spawnTeam('ember', 5, tier, carrierIndex);
  }

  return {
    items,
    hitMeshes,
    step,
    damage,
    spawnTeam,
    resetForRound,
    aliveByTeam(team) { return items.filter((unit) => unit.alive && unit.team === team).length; },
    hasCarrier() { return chargeCarrier !== null; },
    carrier() { return chargeCarrier; },
    clear() {
      for (const unit of items) {
        scene.remove(unit.parts.group);
        unit.parts.group.traverse((mesh) => { if (mesh.isMesh && mesh.material?.dispose) mesh.material.dispose(); });
      }
      items.length = 0;
      hitMeshes.length = 0;
      chargeCarrier = null;
    },
  };
}
