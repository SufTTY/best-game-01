// MERIDIAN STATION: a 38 x 32 m control station yard, the BREACH LINE map. Attackers
// (EMBER) spawn in the south, defenders (COBALT) in the north, and the demo site sits
// mid-west behind a container maze, reachable by two lanes and a mid spur. Every box is
// a collider for players and bots and a surface bullets stop on. Plain geometry only.
import * as THREE from 'three';
import { PALETTE, TEAMS } from './palette.js';

export const ARENA = { minX: -17, maxX: 17, minZ: -14, maxZ: 14 };

export const SITE = { x: -6.5, z: -4.5, radius: 3.6 };

export const SPAWNS = {
  cobalt: [
    { x: -2.5, z: -12.0 }, { x: 0.5, z: -12.6 }, { x: 3.5, z: -12.0 }, { x: 6.0, z: -11.4 }, { x: -5.5, z: -11.6 },
  ],
  ember: [
    { x: -3.0, z: 12.4 }, { x: 0.0, z: 12.8 }, { x: 3.0, z: 12.4 }, { x: 5.5, z: 11.6 }, { x: -6.0, z: 11.8 },
  ],
};

// Bot routes: a list of waypoints, the last one the bot's goal. Defender holds keep them
// watching the lanes; attacker pushes end at the site.
export const ROUTES = {
  emberWest: [
    { x: -6.0, z: 9.0 }, { x: -10.5, z: 4.0 }, { x: -11.0, z: -3.0 }, { x: -6.5, z: -4.5 },
  ],
  emberEast: [
    { x: 5.5, z: 9.5 }, { x: 10.5, z: 3.0 }, { x: 11.0, z: -5.0 }, { x: 1.0, z: -8.0 }, { x: -5.5, z: -5.0 },
  ],
  emberMid: [
    { x: 0.0, z: 7.0 }, { x: -1.5, z: 0.0 }, { x: -4.0, z: -3.5 },
  ],
  cobaltHold: [
    { x: -6.5, z: -6.0 }, { x: -10.5, z: -7.5 }, { x: -2.0, z: -7.0 }, { x: 3.0, z: -6.0 }, { x: 8.0, z: -7.0 },
  ],
};

// Watch angles (radians, atan2-style facing) for defenders holding positions.
export const HOLDS = [
  { x: -6.5, z: -6.0, yaw: 0.1 },            // on the site, watching the east gap
  { x: -10.5, z: -7.5, yaw: Math.PI / 2 },   // west lane mouth
  { x: -2.0, z: -7.0, yaw: 0.6 },            // mid spur
  { x: 3.0, z: -6.0, yaw: 0.9 },             // east cover
  { x: 8.0, z: -7.0, yaw: 0.5 },             // east lane
];

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }
  const teamMaterials = {
    cobalt: new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAMS.cobalt), roughness: 0.8 }),
    ember: new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAMS.ember), roughness: 0.8 }),
  };

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Floor and the four walls.
  box(38.4, 0.4, 32.4, 0, -0.2, 0, 'canvas');
  box(0.4, 5.0, 32.4, -19.2, 2.5, 0, 'surface');
  box(0.4, 5.0, 32.4, 19.2, 2.5, 0, 'surface');
  box(38.4, 5.0, 0.4, 0, 2.5, -16.2, 'surface');
  box(38.4, 5.0, 0.4, 0, 2.5, 16.2, 'surface');

  // --- Site: the walled plant yard mid-west. Two entrances (north gap, east gap). ---
  box(0.5, 3.0, 7.0, -10.0, 1.5, -3.0, 'hairline');   // west wall of site yard
  box(7.0, 3.0, 0.5, -6.5, 1.5, -8.5, 'hairline');    // north wall (gap near x=-3)
  box(0.5, 3.0, 3.0, -3.0, 1.5, -8.0, 'hairline');    // north wall east stub
  box(3.5, 3.0, 0.5, -3.0, 1.5, -1.2, 'hairline');    // east wall (gap at z=-6.5)
  // Plant platform: a low slab the charge is armed on.
  box(2.4, 0.35, 2.4, SITE.x, 0.18, SITE.z, 'surface');

  // Site interior cover.
  box(1.6, 1.3, 1.6, -8.2, 0.65, -6.2, 'hairline');
  box(1.6, 1.3, 1.6, -4.8, 0.65, -3.0, 'hairline');

  // --- Mid spur: broken service corridor between spawns. ---
  box(2.2, 2.8, 1.2, 0.5, 1.4, 1.5, 'hairline');
  box(1.2, 2.8, 3.4, 3.0, 1.4, -2.5, 'hairline');
  box(3.4, 1.1, 1.2, -1.0, 0.55, 4.5, 'hairline');
  box(1.2, 1.1, 3.4, -4.5, 0.55, 5.5, 'hairline');

  // --- West lane cover. ---
  box(2.6, 1.3, 1.4, -12.0, 0.65, 6.0, 'hairline');
  box(1.4, 1.3, 2.6, -14.0, 0.65, -1.5, 'hairline');
  box(2.0, 0.9, 2.0, -14.5, 0.45, 10.5, 'hairline');

  // --- East lane cover. ---
  box(1.4, 1.3, 2.6, 10.0, 0.65, 6.5, 'hairline');
  box(2.6, 1.3, 1.4, 13.0, 0.65, -1.0, 'hairline');
  box(2.0, 0.9, 2.0, 14.5, 0.45, 9.5, 'hairline');

  // --- Defender side cover (north). ---
  box(3.4, 1.4, 1.2, 0.0, 0.7, -9.5, 'hairline');
  box(1.2, 1.4, 3.4, 8.5, 0.7, -10.0, 'hairline');
  box(2.0, 0.8, 2.0, -14.0, 0.4, -11.5, 'hairline');
  box(2.0, 0.8, 2.0, 13.5, 0.4, -11.5, 'hairline');

  // --- Attacker side cover (south). ---
  box(3.4, 1.4, 1.2, -3.0, 0.7, 9.0, 'hairline');
  box(1.2, 1.4, 3.4, 7.5, 0.7, 9.5, 'hairline');
  box(2.0, 0.8, 2.0, -13.5, 0.4, 9.0, 'hairline');
  box(2.0, 0.8, 2.0, 13.0, 0.4, 12.0, 'hairline');

  // Site marker: a slim emissive pylon over the plant platform plus a soft light.
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.8, 0.14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  );
  beacon.position.set(SITE.x, 1.4, SITE.z - 1.4);
  group.add(beacon);
  const siteLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 7, 9);
  siteLight.position.set(SITE.x, 2.2, SITE.z);
  group.add(siteLight);

  // Plant-zone ring: a flat accent frame so the objective reads at a glance.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SITE.radius - 0.15, SITE.radius, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(SITE.x, 0.05, SITE.z);
  group.add(ring);

  // Spawn pads tinted per team.
  for (const team of ['cobalt', 'ember']) {
    for (const spot of SPAWNS[team]) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 1.6),
        teamMaterials[team],
      );
      pad.position.set(spot.x, 0.04, spot.z);
      group.add(pad);
    }
  }

  // Lighting: warm hemisphere fill, one shadowed key, one cool rim.
  scene.add(new THREE.HemisphereLight(new THREE.Color(PALETTE.surface), new THREE.Color(PALETTE.canvas), 1.9));
  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 3.0);
  key.position.set(11, 15, 9);
  key.target.position.set(0, 0, -2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.7);
  rim.position.set(-9, 10, -11);
  scene.add(rim);

  return { colliders, shootables, group, siteRing: ring };
}
