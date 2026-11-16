# BREACH LINE

A round-based tactical first-person shooter built with three.js 0.187.0 — two teams, short
rounds won by elimination or by the objective, a between-round economy, and gunfire where
stopping to aim pays. Counter-Strike-*style* mechanics on an original map with original art,
sounds and names: nothing is copied from any commercial game.

## The match

You play for **COBALT**, the defending squad on **MERIDIAN STATION**. Five **EMBER** attackers
push one of three routes every round, trying to arm a demo charge on the site platform. Win a
round by eliminating the other team, by running down the round clock (defenders), or by
arming / defusing the charge. First side to 5 round wins takes the match.

- **Round flow** — 12 s buy phase → 95 s live phase → 40 s detonation countdown after the arm.
- **Economy** — $800 to start, $300 per kill, $300 plant bonus, $2,800 for a round win,
  $1,900 + $500 per consecutive loss (capped $3,400) for a loss. Money persists across rounds.
- **Buy menu** — press **B** during the buy phase: armor ($650), a frag grenade ($350), and
  five purchasable weapons from the K-40 SWIFT carbine to the V-7 RANGER marksman rifle.
  The P-9 SERVICE sidearm is always free.

## Gunplay

Accuracy over speed: every weapon has a spread model that blooms while moving and firing and
tightens when you stop or crouch. Headshots multiply damage. Armor halves incoming damage.
No health regeneration — round outcomes stick.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move (Shift to sprint, Ctrl to crouch) |
| Mouse | Look, left-click to fire |
| R | Reload |
| Space | Jump |
| B | Buy menu (buy phase only) |
| G | Frag grenade |
| Esc | Pause |

## Determinism

Every random decision in the simulation — bot routes, strafe choices, aim error, per-shot
outcomes — flows through one seeded stream (`?seed=N` in the URL, default `1337`). The
simulation runs at a fixed 60 Hz decoupled from rendering, so a given seed replays the same
bot-vs-bot match on any machine.

## Bot AI

Bots follow authored routes through the map, hold angles, react to line of sight and gunfire,
commit to the last position where they saw an enemy, rotate to the objective after the arm,
and escalate their loadout as the match goes on.

## Layout

```
game/            the playable game: static ES modules, no build step
game/src/        config.js (tuning) · util.js (seeded RNG) · input.js · audio.js (synth)
                 map.js (walls, lanes, collision, rays) · nav.js (grid paths) · pawns.js
                 squads.js (bot AI) · weapons.js · grenades.js · rounds.js (referee)
                 hud.js · shop.js · main.js (boot, loop, shots)
screenshots/     real in-browser captures taken by the maker
tools/           headless capture + full-match probe (Node 22 stdlib, Chrome via CHROME_BIN)
vendor/          make.fun dossier library (unchanged kit copy, vendor/makefun-game.ts)
main.ts          the entry program: copies game/ + screenshots/ and writes dossier.json
serve.ts         local static server: `node serve.ts`, then http://localhost:8080
```

## Running

Serve `game/` with any static file server and open `game/index.html` in desktop Chrome:

```
node serve.ts        # http://localhost:8080
```

Headless checks (used during development):

```
CHROME_BIN=<chrome> node tools/capture.mjs      # screenshots + smoke + determinism probe
CHROME_BIN=<chrome> node tools/matchprobe.mjs   # full bot-vs-bot match, JSON timeline
```

## License

MIT — see [LICENSE](LICENSE). `SPDX-License-Identifier: MIT`
