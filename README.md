# DEEPGLOW — abyss salvage arcade

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/SufTTY/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/SufTTY/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Entered in make.fun's [best-game-01](https://make.fun/bounty/best-game-01) bounty — the best original game wins the page.

A complete, original 2D arcade browser game. You pilot a glowing salvage skiff in the
trench: descend 10 depths, blast gloomjellies / fangdrifts / darters, collect the amber
lumens they drop, fill the LANTERN meter to trigger a LUMEN SURGE, and face the segmented
Trench Warden every 3rd depth. WebAudio-synthesized sound only; no assets, no network.

## Run

```
cd game && python3 -m http.server 8080     # or: node serve.ts
```

Open http://localhost:8080 in desktop Chrome. Everything is static files under `game/`.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move the skiff |
| Mouse | Aim |
| Left click / Space (hold) | Fire |
| Enter / Click | Start from title, restart from end screens |
| R | Restart from game over / victory / pause |
| P / Esc | Pause / resume |
| M | Mute / unmute |

## Structure (one job per module)

- `index.html` — canvas, dark page, loads `src/main.js` as an ES module.
- `src/config.js` — constants (resolution, depths, timings) and depth scaling table.
- `src/input.js` — keyboard + mouse state, logical-coordinate mapping.
- `src/audio.js` — WebAudio synth: shoot, hit, pickup, surge, ambient drone, mute.
- `src/particles.js` — hit/death bursts plus drifting spore field.
- `src/entities.js` — player skiff, enemies (jelly/fang/dart), lumens, bullets, shared game state `G`.
- `src/warden.js` — Trench Warden: segmented body, weak point, radial bursts, sweeping beam, health bar.
- `src/world.js` — abyss gradients, parallax glow flora, seabed rocks, vignette.
- `src/game.js` — the Game class: waves, spawning, collisions, scoring, lantern/surge, depth flow.
- `src/render.js` — scene compositor plus title / pause / game-over / victory screens.
- `src/hud.js` — depth, score, hull pips, lantern bar, surge flash, combo, center banners.
- `src/main.js` — boot, delta-time loop (capped at 50 ms), screen state machine, `window.__deepglow` API.

## Test

```
cd /tmp/pwtest && node /root/makefun/bots/best-game-01/tools/smoke.mjs
```

Serves `game/` on port 8123, drives it with Playwright, fails on any console/page error,
captures `tools/shots/1-title.png` … `5-victory.png`, and prints `SMOKE OK`.
