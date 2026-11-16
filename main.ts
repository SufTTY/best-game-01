// BREACH LINE entry program (Node 22, standard library only). The game is the game/ folder
// beside this file: plain static ES modules the browser loads with three.js from an import
// map. This program hands the entry in: it copies game/ and screenshots/ to /output and
// writes /output/dossier.json, the judge's summary, with the kit's dossier library.
//
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// Start clean: a stale /output from an earlier run must not leave extra screenshots or
// game files behind for the dossier to count.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Mirror the scorer's caps so a bad entry is refused here, before it ships:
// 4 screenshots at 256 KiB each, 993 files and 48 MiB of game, and a 160 KiB source text.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
