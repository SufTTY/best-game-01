// The arsenal: five purchasable hitscan weapons plus the free sidearm. Each has its own
// magazine, fire gap, damage, head multiplier and a spread model that punishes moving
// fire and rewards standing still or crouching — stopping to aim is how rounds are won.
// The view model is one rifle-ish group whose proportions change per weapon.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const MOVE_REFERENCE = 5.2;
const MUZZLE_TIME = 0.06;
const TRACER_TIME = 0.055;

export const WEAPONS = [
  {
    id: 'p9', name: 'P-9 SERVICE', price: 0, mag: 12, reserve: 48,
    damage: 26, headMult: 3.0, gap: 0.17, reload: 1.4,
    spreadStill: 0.004, spreadMove: 0.030, spreadCrouch: 0.7, recoil: 0.010, auto: false,
  },
  {
    id: 'k40', name: 'K-40 SWIFT', price: 1300, mag: 30, reserve: 120,
    damage: 23, headMult: 2.6, gap: 0.082, reload: 1.9,
    spreadStill: 0.008, spreadMove: 0.024, spreadCrouch: 0.8, recoil: 0.008, auto: true,
  },
  {
    id: 'v7', name: 'V-7 RANGER', price: 2700, mag: 30, reserve: 90,
    damage: 34, headMult: 4.0, gap: 0.108, reload: 2.2,
    spreadStill: 0.0024, spreadMove: 0.036, spreadCrouch: 0.55, recoil: 0.012, auto: true,
  },
  {
    id: 'l1', name: 'L-1 LONGSHOT', price: 4600, mag: 5, reserve: 25,
    damage: 108, headMult: 2.0, gap: 1.15, reload: 2.6,
    spreadStill: 0.0012, spreadMove: 0.070, spreadCrouch: 0.4, recoil: 0.030, auto: false,
  },
];

export function createWeapon(scene, camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), metal);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.1), grip);
  sight.position.set(0, 0.08, -0.12);
  model.add(receiver, barrel, stock, sight);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const tracerGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1, true);
  tracerGeometry.rotateX(Math.PI / 2);
  const tracerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.85, depthWrite: false,
  });
  const tracers = [];

  function addTracer(from, to) {
    const mesh = new THREE.Mesh(tracerGeometry, tracerMaterial.clone());
    const length = from.distanceTo(to);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.set(1, 1, length);
    mesh.lookAt(to);
    scene.add(mesh);
    tracers.push({ mesh, life: TRACER_TIME });
  }

  // Owned weapons and ammo live per weapon id; switching preserves each magazine.
  const owned = new Map([[WEAPONS[0].id, { mag: WEAPONS[0].mag, reserve: WEAPONS[0].reserve }]]);
  let current = WEAPONS[0];
  const state = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, currentId: current.id };
  let reloadSwapGuard = 0;

  function ammo() {
    return owned.get(current.id) ?? { mag: current.mag, reserve: current.reserve };
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (current.reload - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const slot = owned.get(current.id);
        const need = current.mag - slot.mag;
        const take = Math.min(need, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
      }
    }
    for (let index = tracers.length - 1; index >= 0; index -= 1) {
      const tracer = tracers[index];
      tracer.life -= dt;
      tracer.mesh.material.opacity = Math.max(0, tracer.life / TRACER_TIME) * 0.85;
      if (tracer.life <= 0) {
        scene.remove(tracer.mesh);
        tracer.mesh.material.dispose();
        tracers.splice(index, 1);
      }
    }
    reloadSwapGuard = Math.max(0, reloadSwapGuard - dt);
  }

  return {
    WEAPONS,
    state,
    current() { return current; },
    ammo,
    model,
    step,
    addTracer,
    buy(id) {
      const def = WEAPONS.find((w) => w.id === id);
      if (!def) return false;
      owned.set(def.id, { mag: def.mag, reserve: def.reserve });
      current = def;
      state.currentId = def.id;
      state.reloadLeft = 0;
      state.cooldown = Math.max(state.cooldown, 0.4);
      return true;
    },
    owns(id) { return owned.has(id); },
    reset() {
      owned.clear();
      owned.set(WEAPONS[0].id, { mag: WEAPONS[0].mag, reserve: WEAPONS[0].reserve });
      current = WEAPONS[0];
      state.currentId = current.id;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    switchTo(id) {
      if (!owned.has(id) || current.id === id || reloadSwapGuard > 0) return false;
      current = WEAPONS.find((w) => w.id === id);
      state.currentId = current.id;
      state.reloadLeft = 0;
      reloadSwapGuard = 0.3;
      return true;
    },
    ready() {
      return ammo().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = current.gap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.055;
    },
    takeRound() {
      const slot = ammo();
      if (slot.mag <= 0) return false;
      slot.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0) return;
      const slot = ammo();
      if (slot.mag === current.mag || slot.reserve === 0) return;
      state.reloadLeft = current.reload;
    },
    spread(speed, crouching) {
      const base = current.spreadStill + Math.min(1, speed / MOVE_REFERENCE) * current.spreadMove;
      return crouching ? base * current.spreadCrouch : base;
    },
    muzzleWorld() {
      return flash.getWorldPosition(new THREE.Vector3());
    },
  };
}
