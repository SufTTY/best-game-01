// BREACH LINE: main. Boots three.js, builds the scene from map.js, wires the player, the
// squads, the referee and the HUD together, and runs one fixed-step simulation decoupled
// from rendering. Debug hooks (window.__game) serve the headless test driver; ?shot= modes
// stage deterministic frames for the entry screenshots.

import * as THREE from 'three';
import { PALETTE, TIMING, WEAPONS, SITE, ROSTER } from './config.js';
import { makeRng, clamp, formatClock, distance2 } from './util.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildScene, lineOfSight, onSite, rayWalls, PLATFORM } from './map.js';
import { createRounds } from './rounds.js';
import { createSquads } from './squads.js';
import { createPlayer, createBot, movePawn, pawnEyeY, pawnHeadY, damagePawn, PAWN_RADIUS } from './pawns.js';
import { createArsenal, weaponById, rotateAround } from './weapons.js';
import { createGrenades } from './grenades.js';
import { createHud } from './hud.js';
import { createShop } from './shop.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1337);
const shot = params.get('shot');
const rng = makeRng(seed);

const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.sky, 30, 80);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 120);

scene.add(new THREE.AmbientLight(0xb8c2cc, 1.05));
const skyFill = new THREE.HemisphereLight(0x9fb2c8, 0x3a4049, 0.5);
scene.add(skyFill);
const sun = new THREE.DirectionalLight(0xf2e6cf, 1.35);
sun.position.set(12, 24, -8);
scene.add(sun);
scene.add(buildScene(THREE));

const hud = createHud();
const audio = createAudio();
const rounds = createRounds(rng, {
  onRoundStart: onRoundStart,
  onPhaseChange: onPhaseChange,
  onRoundEnd: onRoundEnd,
  onMatchEnd: onMatchEnd,
  onArm: () => audio.arm(),
  onDetonation: () => { audio.explode(); detonationFx(); },
});

const player = createPlayer();
const squads = createSquads(rng, rounds, {});
const grenades = createGrenades(rng, {});
const arsenal = createArsenal(rng, 'cobalt');
let frags = 0;

// Pawn meshes: one body box + one head box per bot, a viewmodel box for the player.
const botMeshes = new Map();
function dressBot(bot) {
  const color = bot.team === 'cobalt' ? PALETTE.cobalt : PALETTE.ember;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.28, 0.42), new THREE.MeshLambertMaterial({ color }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.72), new THREE.MeshLambertMaterial({ color: 0x22262d }));
  body.position.y = 0.64;
  head.position.y = 1.42;
  gun.position.set(0.22, 0.95, 0.3);
  const rig = new THREE.Group();
  rig.add(body); rig.add(head); rig.add(gun);
  scene.add(rig);
  botMeshes.set(bot, { rig, head });
}
for (const bot of squads.bots.items) dressBot(bot);

const viewmodel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.9), new THREE.MeshLambertMaterial({ color: 0x2c333d }));
viewmodel.position.set(0.34, -0.3, -0.62);
camera.add(viewmodel);
scene.add(camera);

// The demo charge prop and its beam, shown once the arm goes through.
const chargeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: PALETTE.charge }));
const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 9, 8), new THREE.MeshBasicMaterial({ color: PALETTE.beam, transparent: true, opacity: 0.6 }));
chargeMesh.position.set(SITE.x, 0.85, SITE.z);
beamMesh.position.set(SITE.x, 4.9, SITE.z);
chargeMesh.visible = false;
beamMesh.visible = false;
scene.add(chargeMesh); scene.add(beamMesh);

function detonationFx() {
  const flash = new THREE.PointLight(0xff8844, 8, 30);
  flash.position.set(SITE.x, 1.5, SITE.z);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 900);
}

const input = createInput(renderer.domElement, {
  key(code) {
    if (frozen) return;
    if (code === 'KeyB' && rounds.state.phase === 'buy') shop.toggle();
    if (code === 'KeyR') { if (arsenal.startReload()) audio.reload(); }
    if (code === 'KeyG') throwFrag();
    if (code === 'Digit2') arsenal.equip(1);
    if (code === 'Digit3') arsenal.equip(2);
    if (code === 'Digit4') arsenal.equip(3);
    if (code === 'Escape' && !shot) hud.showOverlay('paused');
  },
  lockChange(locked) {
    if (!locked && !shot && !matchEnded && !dead) hud.showOverlay('paused');
  },
});
const shop = createShop(rounds, {
  purchased(item) {
    if (item.kind === 'weapon') { arsenal.slots.push(item.id); arsenal.mag[item.id] = weaponById(item.id).mag; arsenal.reserve[item.id] = weaponById(item.id).reserve; arsenal.equip(arsenal.slots.length - 1); hud.setWeapon(item.name); }
    if (item.kind === 'armor') { player.armor = 100; hud.setArmor(100); }
    if (item.kind === 'frag') frags += 1;
    hud.setMoney(rounds.playerMoney());
    hud.setFrags(frags);
  },
  hasWeapon(id) { return arsenal.slots.includes(id); },
  armorLevel() { return player.armor; },
  fragCount() { return frags; },
}, audio);

let dead = false;
let matchEnded = false;
let frozen = false;
let elapsed = 0;
let botMoneyHooked = false;

// ---------- combat ----------

function bulletTrace(origin, dir, range) {
  const walls = rayWalls(origin[0], origin[1], origin[2], dir[0], dir[1], dir[2], range);
  return walls;
}

// One bullet from a pawn: walls, then pawns, nearest hit wins. Head box doubles damage class.
function fireBullet(shooter, origin, dir, def, range) {
  const wallDist = bulletTrace(origin, dir, range);
  let victim = null;
  let victimDist = Math.min(wallDist, range);
  let headshot = false;
  for (const pawn of allPawns()) {
    if (!pawn.alive || pawn === shooter || pawn.team === shooter.team) continue;
    const px = pawn.x - origin[0], py = (pawn.y + 1.15) - origin[1], pz = pawn.z - origin[2];
    const t = px * dir[0] + py * dir[1] + pz * dir[2];
    if (t < 0 || t > victimDist) continue;
    const missX = px - dir[0] * t, missY = py - dir[1] * t, missZ = pz - dir[2] * t;
    const off = Math.hypot(missX, missY, missZ);
    const headOff = Math.hypot(missX, missY - (pawnHeadY(pawn) - (pawn.y + 1.15)), missZ);
    if (headOff < 0.22) { victim = pawn; victimDist = t; headshot = true; }
    else if (off < PAWN_RADIUS + 0.15) { victim = pawn; victimDist = t; headshot = false; }
  }
  if (victim) {
    let amount = def.damage * (headshot ? def.headMult : 1);
    if (def.falloff) amount *= Math.max(def.falloff, 1 - victimDist / range);
    const result = damagePawn(victim, amount, headshot, { onDeath: onPawnDeath });
    if (shooter.isPlayer) {
      hud.hitMarker(result.killed || headshot, headshot ? 260 : 90);
      if (result.killed) { audio.kill(); hud.feedLine(headshot ? 'HEADSHOT — raider down' : 'Raider down', true); }
      else audio.hit();
      if (headshot && !result.killed) audio.headshot();
    } else if (victim.isPlayer) {
      audio.down();
      hud.damageFlash(amount);
    }
    if (result.killed) registerKill(shooter, victim, headshot);
    return true;
  }
  return false;
}

function registerKill(killer, victim, headshot) {
  if (killer.team === 'cobalt') rounds.earn('cobalt', 300);
  if (killer.team === 'ember') rounds.earn('ember', 300);
}

function onPawnDeath(pawn) {
  if (pawn.isPlayer) {
    dead = true;
    hud.showOverlay('dead');
  }
}

function allPawns() {
  return [player, ...squads.bots.items];
}

function aliveCount(team) {
  return allPawns().filter((p) => p.alive && p.team === team).length;
}

function throwFrag() {
  if (frags <= 0 || dead) return;
  frags -= 1;
  hud.setFrags(frags);
  const eye = [player.x, pawnEyeY(player), player.z];
  const dir = cameraDir();
  grenades.throwFrag(eye, dir, 9);
}

function cameraDir() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  return [dir.x, dir.y, dir.z];
}

// Bot trigger pull: aims with seeded angular wobble, then a real bullet from its eye.
function botFire(bot, foe) {
  const def = weaponById(bot.loadout);
  const eye = pawnEyeY(bot);
  const dx = foe.x - bot.x, dy = (pawnEyeY(foe) - 0.25) - eye, dz = foe.z - bot.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  // Wobble is an angle (~1.2 deg per unit of aim error), so range and skill both matter.
  const error = (rng() - 0.5) * 2 * 0.013;
  const dir = rotateAround([dx / dist, dy / dist, dz / dist], error, error);
  fireBullet(bot, [bot.x, eye, bot.z], dir, def, 60);
  if (distance2(bot.x, bot.z, player.x, player.z) < 22) audio.shot();
}

// ---------- round flow ----------

function onRoundStart(state) {
  dead = false;
  matchEnded = false;
  grenades.live.length = 0;
  chargeMesh.visible = false;
  beamMesh.visible = false;
  player.health = 100;
  player.alive = true;
  player.x = 7.6; player.y = 0; player.z = 6.4;
  player.armor = 0;
  squads.spawnTeams(player);
  for (const bot of squads.bots.items) if (!botMeshes.has(bot)) dressBot(bot);
  squads.shop();
  arsenal.mag.p9 = weaponById('p9').mag;
  arsenal.reserve.p9 = weaponById('p9').reserve;
  if (!botMoneyHooked) botMoneyHooked = true;
  hud.clearFeed();
  hud.banner(`ROUND ${state.round}`, 'Buy phase — press B for gear');
  audio.roundStart();
  syncHud();
}

function onPhaseChange(phase) {
  if (phase === 'live') {
    shop.hide();
    hud.banner('LIVE', 'Defend the site');
  }
  if (phase === 'planted') {
    chargeMesh.visible = true;
    beamMesh.visible = true;
    hud.banner('CHARGE ARMED', 'Defuse it or clear the clock');
  }
}

function onRoundEnd(winner, reason) {
  hud.banner(winner === 'cobalt' ? 'ROUND WON' : 'ROUND LOST', reason);
  if (winner === 'cobalt') audio.win(); else audio.lose();
  setTimeout(() => { if (!matchEnded && !frozen) { rounds.startRound(); } }, 2600);
}

function onMatchEnd(winner, score) {
  matchEnded = true;
  hud.showOverlay('match', `${winner === 'cobalt' ? 'COBALT' : 'EMBER'} takes the match ${score.cobalt} : ${score.ember}.`);
}

hud.onPlay(() => {
  audio.resume();
  hud.hideOverlay();
  if (matchEnded) restartMatch();
  else if (rounds.state.phase === 'over') rounds.startRound();
  renderer.domElement.requestPointerLock?.();
});

function restartMatch() {
  rounds.state.round = 0;
  rounds.state.score.cobalt = 0;
  rounds.state.score.ember = 0;
  rounds.state.money.cobalt = 800;
  rounds.state.money.ember = 800;
  rounds.state.lossStreak.cobalt = 0;
  rounds.state.lossStreak.ember = 0;
  rounds.startRound();
}

// ---------- simulation step ----------

function step(dt) {
  if (frozen || matchEnded) return;
  elapsed += dt;
  rounds.step(dt, aliveCount);

  // Player movement.
  if (player.alive && rounds.state.phase !== 'buy') {
    const k = input.state.keys;
    const fwd = k.has('KeyW') ? 1 : k.has('KeyS') ? -1 : 0;
    const strafe = k.has('KeyD') ? 1 : k.has('KeyA') ? -1 : 0;
    player.crouching = k.has('ControlLeft') || k.has('KeyC');
    const sprint = k.has('ShiftLeft') && !player.crouching && fwd > 0;
    const speed = player.crouching ? 2.2 : sprint ? 6.1 : 4.2;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const wx = strafe * cos - fwd * sin;
    const wz = -fwd * cos - strafe * sin;
    const len = Math.hypot(wx, wz) || 1;
    movePawn(player, wx / len * (fwd || strafe ? 1 : 0), wz / len * (fwd || strafe ? 1 : 0), speed, dt);
    if (k.has('Space')) { if (player.grounded) { player.vy = 4.4; player.grounded = false; } }
  }
  arsenal.step(dt, player.lastMoveSpeed > 0.6, player.crouching);

  // Bot brains and grenades.
  squads.step(dt, rounds.state.phase === 'over' ? null : player, botFire);
  grenades.step(dt, player, allPawns, (x, y, z) => {
    audio.explode();
    const flash = new THREE.PointLight(0xffaa55, 6, 16);
    flash.position.set(x, y + 0.5, z);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 400);
  });

  // Player trigger.
  if (input.state.firing && player.alive && !shop.isOpen() && rounds.state.phase !== 'buy') {
    const result = arsenal.fire([player.x, pawnEyeY(player), player.z], cameraDir(), player.lastMoveSpeed > 0.6, player.crouching);
    if (result === 'empty') { audio.empty(); input.state.firing = false; }
    else if (result) {
      audio.shot();
      for (const dir of result.bullets) fireBullet(player, [player.x, pawnEyeY(player), player.z], dir, result.def, 80);
    }
  }

  // Bots defuse: a defender standing on the site after the arm ticks the defuse meter.
  if (rounds.state.phase === 'planted') {
    let defusing = false;
    for (const pawn of allPawns()) {
      if (pawn.alive && pawn.team === 'cobalt' && onSite(pawn.x, pawn.z)) defusing = true;
    }
    if (defusing) {
      rounds.state.defuseProgress += dt;
      if (Math.floor(rounds.state.defuseProgress * 2) % 2 === 0) audio.beep();
      if (rounds.state.defuseProgress >= TIMING.defuseSeconds) {
        rounds.earn('cobalt', 300);
        rounds.settleRound('cobalt', 'Charge defused');
      }
    } else rounds.state.defuseProgress = Math.max(0, rounds.state.defuseProgress - dt * 2);
  }

  syncHud();
}

function syncHud() {
  const def = arsenal.held();
  hud.setAmmo(arsenal.mag[def.id] || 0, arsenal.reserve[def.id] || 0, def.name);
  hud.setMoney(rounds.playerMoney());
  hud.setScore(rounds.state.score.cobalt, rounds.state.score.ember);
  hud.setRoster(aliveCount('cobalt'), ROSTER.cobalt, aliveCount('ember'), ROSTER.ember);
  const warn = rounds.state.phase === 'planted';
  hud.setTimer(warn ? rounds.state.timer : rounds.state.timer, warn);
  hud.setObjective(
    warn ? 'CHARGE ARMED — DEFUSE'
      : rounds.state.phase === 'buy' ? 'BUY PHASE'
      : squads.hasCarrier() || rounds.state.planted ? 'STOP THE PUSH' : 'HOLD THE SITE',
    warn,
  );
  hud.setHealth(player.health);
  hud.setArmor(player.armor);
  hud.setSpread(arsenal.spreadDeg(player.lastMoveSpeed > 0.6, player.crouching));
}

// ---------- rendering ----------

function syncCamera() {
  const eye = pawnEyeY(player);
  camera.position.set(player.x, eye, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  viewmodel.visible = !dead;
  viewmodel.position.set(0.34, dead ? -0.8 : (player.crouching ? -0.36 : -0.3), -0.62);
}

function paint() {
  for (const bot of squads.bots.items) {
    const rig = botMeshes.get(bot);
    if (!rig) continue;
    rig.rig.visible = bot.alive;
    if (bot.alive) {
      rig.rig.position.set(bot.x, bot.y, bot.z);
      rig.rig.rotation.y = bot.yaw;
    }
  }
  renderer.render(scene, camera);
}

// ---------- main loops ----------

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) return;
  // Fixed-step accumulator: simulation always steps the same amount, rendering floats.
  accumulator += Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const look = input.drain();
  player.yaw -= look.dx * 0.0023;
  player.pitch = clamp(player.pitch - look.dy * 0.0023, -1.45, 1.45);
  while (accumulator >= FIXED_STEP) {
    step(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }
  syncCamera();
  paint();
}
let accumulator = 0;
let lastFrame = performance.now();

// Debug/test hooks, kept stable for the headless driver.
window.__game = {
  get stats() {
    return {
      round: rounds.state.round,
      phase: rounds.state.phase,
      score: { ...rounds.state.score },
      money: rounds.playerMoney(),
      enemies: aliveCount('ember'),
      allies: aliveCount('cobalt'),
      health: player.health,
      planted: rounds.state.planted,
      dead,
      seed,
      elapsed,
    };
  },
  input: input.state,
  // Diagnostic view of every bot for the headless driver (task, spot, health, ammo state).
  get bots() {
    return squads.bots.items.map((b) => ({
      t: b.team, x: +b.x.toFixed(1), z: +b.z.toFixed(1), hp: Math.round(b.health),
      alive: b.alive, wp: b.waypoint, loadout: b.loadout, reacting: +b.reaction.toFixed(2),
      target: b.target ? b.target.team : null,
    }));
  },
  arena: { rounds, squads, player },
  get units() {
    return allPawns().filter((p) => p.alive).map((p) => ({ t: p.team, x: +p.x.toFixed(1), z: +p.z.toFixed(1), hp: p.health }));
  },
  freeze() { frozen = true; },
  forceLive() { rounds.startLive(); hud.hideOverlay(); },
  walkForward(steps) {
    input.state.keys.add('KeyW');
    for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
    input.state.keys.delete('KeyW');
  },
  advance(steps) {
    for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
    syncCamera();
    hud.setHealth(player.health);
    hud.setAmmo(arsenal.mag[arsenal.held().id] || 0, arsenal.reserve[arsenal.held().id] || 0, arsenal.held().name);
    paint();
  },
  restartMatch,
};

// ---------- screenshot staging ----------

function paintTwiceThenReady() {
  let painted = 0;
  function tick() {
    requestAnimationFrame(tick);
    syncCamera();
    paint();
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(tick);
}

function aimAt(target) {
  const eye = pawnEyeY(player);
  const dx = target.x - player.x, dy = target.y - eye, dz = target.z - player.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

function runShot(name) {
  rounds.startRound();
  rounds.startLive();
  rounds.state.timer = rounds.state.phase === 'planted' ? 30 : 74;
  hud.hideOverlay();
  player.pitch = 0;
  player.yaw = 0;
  if (name === 'start') {
    player.x = -2.5; player.z = -12;
    for (let i = 0; i < 10; i += 1) step(FIXED_STEP);
    aimAt({ x: -6.5, y: 1.4, z: -4.5 });
    hud.setHealth(100);
    hud.setMoney(2800);
    hud.showOverlay('start');
  } else if (name === 'buy') {
    rounds.state.phase = 'buy';
    rounds.state.timer = 9;
    player.x = 8.2; player.z = 4.2;
    for (let i = 0; i < 10; i += 1) step(FIXED_STEP);
    aimAt({ x: SITE.x, y: 1.2, z: SITE.z });
    hud.setHealth(100);
    hud.setMoney(4700);
    shop.show();
  } else if (name === 'play') {
    player.x = 8.2; player.z = 4.2;
    for (let i = 0; i < 10; i += 1) step(FIXED_STEP);
    // Let both squads run their routes, then join the nearest fight in plain sight.
    for (let i = 0; i < 240; i += 1) step(FIXED_STEP);
    let nearest = null;
    let bestDistance = Infinity;
    for (const unit of squads.bots.items) {
      if (!unit.alive || unit.team !== 'ember') continue;
      if (!lineOfSight(player.x, pawnEyeY(player), player.z, unit.x, pawnEyeY(unit), unit.z)) continue;
      const d = Math.hypot(unit.x - player.x, unit.z - player.z);
      if (d < bestDistance) { bestDistance = d; nearest = unit; }
    }
    if (nearest) {
      aimAt({ x: nearest.x, y: 1.45, z: nearest.z });
      pullTrigger(0);
      for (let i = 0; i < 6; i += 1) step(FIXED_STEP);
      aimAt({ x: nearest.x, y: 1.45, z: nearest.z });
      pullTrigger(0);
      for (let i = 0; i < 4; i += 1) step(FIXED_STEP);
    } else aimAt({ x: SITE.x, y: 1.2, z: SITE.z });
    hud.setHealth(72);
    hud.setMoney(3400);
    if (aliveCount('ember') < ROSTER.ember) hud.feedLine('Raider down', false);
  } else if (name === 'end') {
    player.x = 8.2; player.z = 3.4;
    for (let i = 0; i < 10; i += 1) step(FIXED_STEP);
    rounds.state.planted = true;
    rounds.state.phase = 'planted';
    rounds.state.timer = 23;
    chargeMesh.visible = true;
    beamMesh.visible = true;
    for (let i = 0; i < 120; i += 1) step(FIXED_STEP);
    let raider = null;
    let bestDistance = Infinity;
    for (const unit of squads.bots.items) {
      if (!unit.alive || unit.team !== 'ember') continue;
      const d = Math.hypot(unit.x - player.x, unit.z - player.z);
      if (d < bestDistance) { bestDistance = d; raider = unit; }
    }
    if (raider) {
      aimAt({ x: raider.x, y: 1.62, z: raider.z });
      pullTrigger(0);
      for (let i = 0; i < 4; i += 1) step(FIXED_STEP);
    }
    hud.setHealth(38);
    hud.setMoney(4200);
    hud.feedLine('HEADSHOT — raider down', true);
    aimAt({ x: SITE.x, y: 0.55, z: SITE.z });
    rounds.state.score.cobalt = 5;
    rounds.state.score.ember = 3;
    for (let i = 0; i < 2; i += 1) step(FIXED_STEP);
    hud.showOverlay('match', 'COBALT holds MERIDIAN STATION 5 : 3. Play again to defend the station from round one.');
  }
  hud.setScore(rounds.state.score.cobalt, rounds.state.score.ember);
  hud.setAmmo(arsenal.mag[arsenal.held().id] || 0, arsenal.reserve[arsenal.held().id] || 0, arsenal.held().name);
  hud.setRoster(aliveCount('cobalt'), ROSTER.cobalt, aliveCount('ember'), ROSTER.ember);
  hud.hideBanner();
  hud.clearFeed();
  if (name !== 'start' && name !== 'end') hud.hideOverlay();
  paintTwiceThenReady();
}

function pullTrigger(ms) {
  const result = arsenal.fire([player.x, pawnEyeY(player), player.z], cameraDir(), false, false);
  if (result && result !== 'empty') {
    audio.shot();
    for (const dir of result.bullets) fireBullet(player, [player.x, pawnEyeY(player), player.z], dir, result.def, 80);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot: the shot modes stage a frozen frame; the interactive game starts paused on the title.
if (shot) runShot(shot);
else {
  rounds.startRound();
  hud.showOverlay('start');
  syncCamera();
  paint();
  requestAnimationFrame(frame);
}
