// TUNING: every number that shapes BREACH LINE's feel lives here. Combat designers tune;
// the modules below only read. Weapons are priced so a full buy costs most of a round win,
// armour and frags stay affordable, and the marksman rifle stays a gamble at long range.

export const PALETTE = {
  sky: 0x232a33,
  ground: 0x3a4049,
  wall: 0x4a5361,
  wallTop: 0x5a6574,
  crate: 0x5a6473,
  accent: 0x3f9b8f,
  cobalt: 0x3d6fb8,
  ember: 0xc4572e,
  charge: 0xe05038,
  beam: 0x35c4b0,
  muzzle: 0xffd27a,
};

export const TIMING = {
  buyPhase: 12,
  livePhase: 95,
  detonation: 40,
  defuseSeconds: 5,
  armSeconds: 3,
  roundsToWin: 5,
  maxRounds: 12,
};

export const ECONOMY = {
  start: 800,
  kill: 300,
  plant: 300,
  defuse: 300,
  winRound: 2800,
  loseRound: 1900,
  lossStreak: 500,
  lossStreakCap: 3400,
};

export const ROSTER = { cobalt: 4, ember: 5 };

// id, name, price, damage, headshot multiplier, magazine, reserve, rpm, spread degrees
// (standing still / moving), reload seconds. The sidearm is free; everything else is a
// decision the buy phase makes you weigh against armour and a frag.
export const WEAPONS = [
  { id: 'p9',   name: 'P-9 SERVICE',    price: 0,    damage: 22, headMult: 2.4, mag: 12, reserve: 48, rpm: 300, spreadStill: 1.4, spreadMove: 5.0, reload: 1.6 },
  { id: 'k40',  name: 'K-40 SWIFT',     price: 1900, damage: 26, headMult: 2.2, mag: 25, reserve: 75, rpm: 660, spreadStill: 1.1, spreadMove: 4.6, reload: 2.2 },
  { id: 'm6',   name: 'M-6 BULWARK',    price: 2400, damage: 34, headMult: 2.0, mag: 20, reserve: 60, rpm: 520, spreadStill: 1.6, spreadMove: 5.6, reload: 2.6 },
  { id: 's8',   name: 'S-8 CLEAVER',    price: 2200, damage: 12, headMult: 1.6, mag: 8,  reserve: 32, rpm: 480, spreadStill: 4.5, spreadMove: 6.5, reload: 3.0, pellets: 7, falloff: 0.55 },
  { id: 'a3',   name: 'A-3 LONGSHADOW', price: 3100, damage: 62, headMult: 2.6, mag: 10, reserve: 30, rpm: 190, spreadStill: 0.5, spreadMove: 6.0, reload: 3.2 },
  { id: 'v7',   name: 'V-7 RANGER',     price: 4300, damage: 115, headMult: 2.8, mag: 5,  reserve: 15, rpm: 75,  spreadStill: 0.2, spreadMove: 7.0, reload: 3.8 },
];

export const ARMOR_PRICE = 650;
export const FRAG_PRICE = 350;
export const ARMOR_SOAK = 0.5; // armour halves incoming body damage, then its plate breaks

export const BOT = {
  walkSpeed: 3.4,
  sprintSpeed: 5.0,
  aimError: 0.055,       // radians of aim wobble at reaction
  reactionMin: 0.3,
  reactionMax: 0.7,
  fireBurst: [2, 5],     // shots per burst, min..max
  burstPause: [0.25, 0.7],
  engageRange: 34,
  loseSightSeconds: 2.4,
};

export const PLAYER = {
  height: 1.62,
  crouchHeight: 1.05,
  walkSpeed: 4.2,
  sprintSpeed: 6.1,
  crouchSpeed: 2.2,
  jumpVelocity: 4.4,
  gravity: 13.5,
};

export const SITE = { x: 8.2, z: 0, radius: 3.4 };

// Every value above was tuned by hand against the headless match probe, for feel over speed.
