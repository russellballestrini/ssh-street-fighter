// Offline visual smoke test: compose a scene and print it to stdout.
import { renderOctantGrid } from './render/pixel.js';
import { composeScene } from './game/scene.js';
import { ATTACKS, makeFighter, makeMatch } from './game/engine.js';
import type { Pose } from './game/types.js';

const a = makeFighter('a', 'BYU', 'a');
const b = makeFighter('b', 'MEN', 'b');
const m = makeMatch(a, b);
m.phase = 'fight';
m.message = process.argv[2] ?? '';

// pose overrides via CLI: node render-test "FIGHT!" punch hit
a.pose = (process.argv[3] as Pose) ?? 'idle';
b.pose = (process.argv[4] as Pose) ?? 'idle';
if (a.pose === 'punch') { a.attack = 'punch'; a.attackFrame = ATTACKS.punch.startup; }
a.hp = 78; b.hp = 44; a.wins = 1;
m.roundTime = 59;

const rows = renderOctantGrid(composeScene(m));
process.stdout.write('\x1b[2J\x1b[H');
process.stdout.write(rows.join('\n') + '\n');
process.stdout.write('\x1b[0m');
console.log(`\n[${rows.length} rows x ~${(rows[0]?.length ?? 0)} bytes]`);
