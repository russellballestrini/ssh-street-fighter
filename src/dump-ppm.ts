// Dump a composed scene as a PPM (P6) to stdout for visual verification.
import { composeScene } from './game/scene.js';
import { ATTACKS, makeFighter, makeMatch } from './game/engine.js';
import { WORLD_W, WORLD_H } from './game/engine.js';
import type { Pose } from './game/types.js';

const a = makeFighter('a', 'BYU', 'a');
const b = makeFighter('b', 'MEN', 'b');
const m = makeMatch(a, b);
m.phase = 'fight';
m.message = process.argv[2] ?? 'FIGHT';
a.pose = (process.argv[3] as Pose) ?? 'punch';
b.pose = (process.argv[4] as Pose) ?? 'hit';
if (a.pose === 'punch') { a.attack = 'punch'; a.attackFrame = ATTACKS.punch.startup; }
a.hp = 78; b.hp = 44; a.wins = 1;
b.x = a.x + 34; b.facing = -1;

const g = composeScene(m);
const scale = 4;
const W = WORLD_W * scale, H = WORLD_H * scale;
const header = Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii');
const body = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  const row = g[Math.floor(y / scale)];
  for (let x = 0; x < W; x++) {
    const p = row?.[Math.floor(x / scale)] ?? null;
    const i = (y * W + x) * 3;
    body[i] = p ? p.r : 0;
    body[i + 1] = p ? p.g : 0;
    body[i + 2] = p ? p.b : 0;
  }
}
process.stdout.write(Buffer.concat([header, body]));
