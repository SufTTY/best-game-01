// Boot and the one loop for BREACH LINE: a fixed 60 Hz simulation feeding a render at the
// display's rate. Every random decision flows through one seeded stream (?seed=N, default
// 1337), so spawns, bot aim and round outcomes are fully deterministic for a given seed.
// The player defends (COBALT) alongside four bot squadmates against five EMBER attackers.
// ?shot=start|play|end sets up a deterministic frame for a capture, renders it twice, then
// freezes and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';
import { createWorld, SITE } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS } from './weapon.js';
import { createGrenades } from './grenade.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createBuy } from './buy.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1337', 10) || 1337;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 26, 60);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const rng = createRng(seed);
const world = createWorld(scene);
const weapon = createWeapon(scene, camera);
const hud = createHud();
const audio = createAudio();
const player = createPlayer(world.colliders);
const body = player.state;

const rounds = createRounds(rng);
const grenades = createGrenades(scene);
const bots = createBots(scene, world, rng, {
  botFired(unit, from, target, hit) {
    const end = target.point.clone().add(new THREE.Vector3((rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4));
    weapon.addTracer(from, hit ? target.point : from.clone().add(end.sub(from).normalize().multiplyScalar(24)));
    audio.enemyShot();
    if (hit && target.isPlayer) hud.flashHurt();
  },
  onPlayerHit(amount, headshot, shooter) {
    const survived = player.hurt(amount, player.time());
    hud.setHealth(body.health);
    hud.setArmor(body.armor);
    hud.flashHurt();
    audio.hurt();
    if (!survived) {
      audio.death();
      hud.feedLine(`EMBER ${shooter ? 'raider' : 'blast'} took you down`, false);
    }
  },
  botKilled(killer, victim) {
    hud.feedLine(killer.team === 'cobalt' ? `COBALT dropped an EMBER raider` : `EMBER raider downed COBALT`, killer.team === 'cobalt');
  },
  chargesPlanted(unit) {
    rounds.state.planted = true;
    rounds.state.plantPos = { x: SITE.x, y: 0.4, z: SITE.z };
    rounds.plantBonus();
    audio.round();
    hud.bannerShow('CHARGE ARMED', 'Defuse it — 40 seconds', 2400);
    hud.feedLine('EMBER armed the charge on the platform', true);
  },
  chargeDefused(unit) {
    if (rounds.state.phase === 'planted') {
      audio.round();
      rounds.endRound('cobalt', 'Charge defused');
    }
  },
  chargeDropped(unit) {
    hud.feedLine('The charge carrier is down — stop the push', false);
  },
});
const buy = createBuy(rounds, {
  canBuy(item) {
    if (rounds.state.phase !== 'buy') return false;
    if (item.kind === 'weapon') return !weapon.owns(item.id) || weapon.current().id !== item.id;
    if (item.kind === 'armor') return body.armor < 50;
    if (item.kind === 'frag') return frags < 2;
    return false;
  },
  purchased(item) {
    if (item.kind === 'weapon') weapon.buy(item.id);
    if (item.kind === 'armor') body.armor = 50;
    if (item.kind === 'frag') frags += 1;
    hud.setMoney(rounds.playerMoney());
    hud.setFrags(frags);
  },
}, audio);

const input = createInput(renderer.domElement, onLockChange);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();

let frags = 0;
let elapsed = 0;
let frozen = false;
let dead = false;
let matchEnded = false;
let detonationMesh = null;
let accumulator = 0;
let lastTime = performance.now();
// One cached hit list per round: the world's surfaces plus every bot's head and torso.
let hitList = [];

rounds.hooks.onRoundStart = () => {
  const tier = Math.min(4, Math.floor((rounds.state.round - 1) / 2));
  bots.resetForRound(tier, rounds.state.carrierIndex);
  hitList = world.shootables.concat(bots.hitMeshes);
  weapon.reset();
  frags = 0;
  dead = false;
  player.spawnDefender(rounds.state.round);
  if (detonationMesh) {
    scene.remove(detonationMesh);
    detonationMesh = null;
  }
  hud.setAmmo(...ammoTriple());
  hud.setHealth(body.health);
  hud.setArmor(body.armor);
  hud.setMoney(rounds.playerMoney());
  hud.setFrags(frags);
  hud.setWeaponRow(weapon.current().name);
  hud.bannerShow(`ROUND ${rounds.state.round}`, 'Buy phase — press B for gear', 2400);
  hud.showOverlay('paused');
  if (shot) hud.hideOverlay();
  audio.round();
};
rounds.hooks.onPhaseChange = (phase) => {
  if (phase === 'planted' && !detonationMesh) {
    detonationMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff5533 }),
    );
    detonationMesh.position.set(SITE.x, 0.55, SITE.z);
    scene.add(detonationMesh);
  }
  buy.hide();
};
rounds.hooks.onRoundEnd = (winner, reason) => {
  audio.round();
  hud.bannerShow(
    winner === 'cobalt' ? 'ROUND WON' : 'ROUND LOST',
    reason,
    3200,
  );
  hud.feedLine(winner === 'cobalt' ? `COBALT takes the round — ${reason}` : `EMBER takes the round — ${reason}`, winner === 'cobalt');
};
rounds.hooks.onMatchEnd = (winner) => {
  matchEnded = true;
  hud.showOverlay('match', `${winner === 'cobalt' ? 'COBALT' : 'EMBER'} takes the match ${rounds.state.score.cobalt} : ${rounds.state.score.ember}.`);
  if (document.pointerLockElement) document.exitPointerLock();
};

hud.setScore(0, 0);
hud.setHealth(body.health);
hud.setMoney(rounds.playerMoney());
hud.onPlay(() => {
  if (shot) return;
  audio.resume();
  if (matchEnded) restartMatch();
  input.requestLock();
});

function ammoTriple() {
  const slot = weapon.ammo();
  return [slot.mag, slot.reserve, weapon.current().name];
}

function restartMatch() {
  matchEnded = false;
  rounds.state.score.cobalt = 0;
  rounds.state.score.ember = 0;
  rounds.state.money = 800;
  rounds.state.lossStreak = 0;
  rounds.state.matchOver = false;
  rounds.startRound();
  hud.setScore(0, 0);
  input.requestLock();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    hud.hideOverlay();
    if (rounds.state.phase === 'buy') buy.show();
  } else {
    buy.hide();
    if (!dead && !matchEnded) hud.showOverlay('paused');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch + body.recoilPitch, body.yaw + body.recoilYaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!weapon.takeRound()) {
    audio.empty();
    return false;
  }
  const def = weapon.current();
  syncCamera();
  camera.getWorldDirection(direction);
  direction.x += (rng() * 2 - 1) * spread;
  direction.y += (rng() * 2 - 1) * spread;
  direction.z += (rng() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(hitList, false)[0];
  const muzzle = weapon.muzzleWorld();
  const end = hit ? hit.point.clone() : camera.position.clone().add(direction.clone().multiplyScalar(60));
  weapon.addTracer(muzzle, end);
  if (hit && hit.object.userData.unit && hit.object.userData.unit.alive) {
    const headshot = hit.object.userData.part === 'head';
    const result = bots.damage(hit.object.userData.unit, def.damage * (headshot ? def.headMult : 1), headshot);
    hud.hitMarker(result.killed, shot ? 4000 : 90);
    if (result.killed) {
      rounds.killReward();
      hud.setMoney(rounds.playerMoney());
      audio.kill();
      if (headshot) audio.headshot();
      hud.feedLine(headshot ? 'HEADSHOT — raider down' : 'Raider down', headshot);
    } else {
      audio.hit();
    }
  }
  weapon.pullTrigger();
  audio.shot();
  player.recoil(def.recoil + rng() * 0.003, (rng() * 2 - 1) * 0.004);
  hud.setAmmo(...ammoTriple());
  return true;
}

function throwFrag() {
  if (frags <= 0 || dead) return;
  frags -= 1;
  syncCamera();
  camera.getWorldDirection(direction);
  const from = camera.position.clone().addScaledVector(direction, 0.6);
  grenades.throwGrenade(from, direction, elapsed, (center) => {
    audio.enemyShot();
    if (center.distanceTo(body.position) < 8 && body.alive) hud.flashHurt();
  });
  hud.setFrags(frags);
}

function step(dt) {
  elapsed += dt;
  rounds.step(dt, { planted: rounds.state.planted, plantPos: rounds.state.plantPos });
  // Free-look and movement only while the round is live and the player stands.
  const combatReady = rounds.state.phase === 'live' || rounds.state.phase === 'planted';
  if (combatReady && body.alive && !buy.isOpen()) {
    player.step(dt, input.state.keys);
  } else {
    player.idle(dt);
  }
  weapon.step(dt);
  bots.step(dt, body, {
    phase: rounds.state.phase,
    planted: rounds.state.planted,
    plantPos: rounds.state.plantPos,
    timerLow: rounds.state.phase === 'live' && !rounds.state.planted && rounds.state.timer < 40,
  });
  grenades.step(dt, grenadeTargets());
  rounds.checkElimination(bots.aliveByTeam('cobalt') + (body.alive ? 1 : 0), bots.aliveByTeam('ember'));
  if (!body.alive && !dead) {
    dead = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  // Firing and reload live in the fixed step, so scripted and live play behave identically.
  if (combatReady && body.alive && !buy.isOpen()) {
    if (input.state.firing && weapon.ready()) {
      const def = weapon.current();
      if (def.auto || !input.state.firedThisPress) {
        input.state.firedThisPress = true;
        shoot(shot ? 0 : weapon.spread(player.groundSpeed(), body.crouching));
      }
    } else if (!input.state.firing) {
      input.state.firedThisPress = false;
    }
    if (input.state.keys.has('KeyR')) weapon.reload();
    if (input.state.keys.has('KeyG') && !input.state.fragLatch) {
      input.state.fragLatch = true;
      throwFrag();
    } else if (!input.state.keys.has('KeyG')) {
      input.state.fragLatch = false;
    }
    for (const digit of ['Digit2', 'Digit3', 'Digit4']) {
      if (input.state.keys.has(digit)) {
        const def = WEAPONS[Number(digit.slice(-1)) - 1];
        if (def && weapon.switchTo(def.id)) hud.setWeaponRow(def.name);
      }
    }
  }
}

// The grenade's radial damage applies to every live bot and to the player.
function grenadeTargets() {
  const targets = [];
  for (const unit of bots.items) {
    if (!unit.alive) continue;
    targets.push({
      position: unit.position,
      position_y: unit.position.y,
      onGrenade: (amount) => {
        const result = bots.damage(unit, amount, false);
        if (result.killed) hud.feedLine(`A frag took ${unit.team === 'ember' ? 'an EMBER raider' : 'a COBALT teammate'} out`, unit.team === 'ember');
      },
    });
  }
  if (body.alive) {
    targets.push({
      position: body.position,
      onGrenade: (amount) => {
        const survived = player.hurt(amount * 0.6, player.time());
        hud.setHealth(body.health);
        hud.setArmor(body.armor);
        hud.flashHurt();
        audio.hurt();
        if (!survived) audio.death();
      },
    });
  }
  return targets;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    if (!buy.isOpen() && body.alive) player.look(look.x, look.y);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    hud.setHealth(body.health);
    hud.setSpread(1 + weapon.spread(player.groundSpeed(), body.crouching) * 55);
    hud.setTimer(rounds.state.phase === 'buy' ? rounds.state.timer : rounds.state.phase === 'planted' ? rounds.state.detonation : rounds.state.timer);
    hud.setScore(rounds.state.score.cobalt, rounds.state.score.ember);
    hud.setRoster(bots.aliveByTeam('cobalt'), 4, bots.aliveByTeam('ember'), 5);
    const objectiveText = rounds.state.phase === 'buy'
      ? 'BUY PHASE'
      : rounds.state.phase === 'planted'
        ? 'CHARGE ARMED — DEFUSE'
        : bots.hasCarrier() || rounds.state.planted ? 'STOP THE PUSH' : 'HOLD THE SITE';
    hud.setObjective(objectiveText, rounds.state.phase === 'planted');
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  rounds.startRound();
  rounds.startLive();
  rounds.state.timer = rounds.state.phase === 'planted' ? 30 : 74;
  hud.hideOverlay();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'start') {
    body.position.set(-2.5, 0, -12.0);
    settle(10);
    aimAt(new THREE.Vector3(-6.5, 1.4, -4.5));
    hud.setHealth(100);
    hud.setMoney(2800);
    hud.showOverlay('start');
  } else if (name === 'play') {
    body.position.set(-8.5, 0, 0.5);
    settle(10);
    // Let both squads run their routes for five seconds, then join the nearest fight.
    settle(300);
    let nearest = null;
    let bestDistance = Infinity;
    for (const unit of bots.items) {
      if (!unit.alive || unit.team !== 'ember') continue;
      const distance = Math.hypot(unit.position.x - body.position.x, unit.position.z - body.position.z);
      if (distance < bestDistance) { bestDistance = distance; nearest = unit; }
    }
    aimAt(nearest
      ? new THREE.Vector3(nearest.position.x, 1.45, nearest.position.z)
      : new THREE.Vector3(SITE.x, 1.2, SITE.z));
    if (nearest) {
      shoot(0);
      settle(6);
      aimAt(new THREE.Vector3(nearest.position.x, 1.45, nearest.position.z));
      shoot(0);
      settle(4);
    }
    hud.setHealth(72);
    hud.setMoney(3400);
    if (bots.aliveByTeam('ember') < 5) hud.feedLine('Raider down', false);
  } else if (name === 'buy') {
    // Buy phase with the menu open: money, weapons, armour and grenades on one panel.
    rounds.state.phase = 'buy';
    rounds.state.timer = 9;
    body.position.set(-8.5, 0, 0.5);
    settle(10);
    aimAt(new THREE.Vector3(SITE.x, 1.2, SITE.z));
    hud.setHealth(100);
    hud.setMoney(4700);
    buy.show();
  } else if (name === 'end') {
    body.position.set(-6.5, 0, -1.2);
    settle(10);
    // Charge armed: banner state, detonation cube on the platform.
    rounds.state.planted = true;
    rounds.state.phase = 'planted';
    rounds.state.detonation = 23;
    rounds.hooks.onPhaseChange('planted');
    settle(120);
    let raider = null;
    let bestDistance = Infinity;
    for (const unit of bots.items) {
      if (!unit.alive || unit.team !== 'ember') continue;
      const distance = Math.hypot(unit.position.x - body.position.x, unit.position.z - body.position.z);
      if (distance < bestDistance) { bestDistance = distance; raider = unit; }
    }
    if (raider) {
      aimAt(new THREE.Vector3(raider.position.x, 1.62, raider.position.z));
      shoot(0);
      settle(4);
    }
    hud.setHealth(38);
    hud.setMoney(4200);
    hud.feedLine('HEADSHOT — raider down', true);
    aimAt(new THREE.Vector3(SITE.x, 0.55, SITE.z));
    settle(2);
    // The match is settled: show the final score on the HUD.
    rounds.state.score.cobalt = 5;
    rounds.state.score.ember = 3;
  }
  hud.setScore(rounds.state.score.cobalt, rounds.state.score.ember);
  hud.setAmmo(...ammoTriple());
  hud.setRoster(bots.aliveByTeam('cobalt'), 4, bots.aliveByTeam('ember'), 5);
  hud.setTimer(rounds.state.phase === 'planted' ? rounds.state.detonation : rounds.state.timer);
  hud.setObjective(rounds.state.phase === 'planted' ? 'CHARGE ARMED — DEFUSE' : rounds.state.phase === 'buy' ? 'BUY PHASE' : 'HOLD THE SITE');
  hud.hideBanner();
  hud.clearFeed();
  if (name === 'start') hud.showOverlay('start');
  else if (name === 'end') hud.showOverlay('match', 'COBALT holds MERIDIAN STATION 5 : 3. Play again to defend the station from round one.');
  else hud.hideOverlay();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = {
  get stats() {
    return {
      round: rounds.state.round,
      phase: rounds.state.phase,
      score: { ...rounds.state.score },
      money: rounds.playerMoney(),
      enemies: bots.aliveByTeam('ember'),
      allies: bots.aliveByTeam('cobalt'),
      health: body.health,
      planted: rounds.state.planted,
      dead,
      seed,
      elapsed,
    };
  },
  input: input.state,
  // Debug hook: where every live bot stands, for scripted tests.
  get units() { return bots.items.filter((u) => u.alive).map((u) => ({ t: u.team, x: +u.position.x.toFixed(1), z: +u.position.z.toFixed(1), hp: u.health })); },
  freeze() {
    frozen = true;
  },
  // Test hook: skip the buy phase so scripted combat drills run at once.
  forceLive() {
    rounds.startLive();
    hud.hideOverlay();
  },
  // Test/dev hook: walk the player straight toward the site for scripted combat drills.
  walkForward(steps) {
    input.state.keys.add('KeyW');
    for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
    input.state.keys.delete('KeyW');
  },
  advance(steps) {
    for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
    syncCamera();
    hud.setHealth(body.health);
    hud.setAmmo(...ammoTriple());
  },
  // Test hook: buy a weapon by id, spend permitting.
  buyId(id) {
    const def = WEAPONS.find((w) => w.id === id);
    if (def && rounds.spend(def.price)) weapon.buy(id);
    hud.setAmmo(...ammoTriple());
    hud.setMoney(rounds.playerMoney());
  },
};

syncCamera();
if (shot) runShot(shot);
else {
  rounds.startRound();
  requestAnimationFrame(frame);
}
