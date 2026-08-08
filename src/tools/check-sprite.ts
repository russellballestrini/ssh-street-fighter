// Render one keyed sprite JSON on a light + dark split background to spot any
// chroma-key fringe.  tsx src/tools/check-sprite.ts BYU idle_1
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resizeRGBA } from '../render/pixel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const id = (process.argv[2] ?? 'BYU').toUpperCase();
const pose = process.argv[3] ?? 'idle_1';
const s = JSON.parse(readFileSync(resolve(__dirname, `../../assets/sprites/${id}/${pose}.json`), 'utf8')) as { w: number; h: number; data: string };
const grid = resizeRGBA(new Uint8Array(Buffer.from(s.data, 'base64')), s.w, s.h, 180, false);
const gw = grid[0]!.length, gh = grid.length;
const scale = 3, W = gw * scale, H = gh * scale;
const body = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = grid[Math.floor(y / scale)]![Math.floor(x / scale)];
  const half = x < W / 2 ? { r: 210, g: 210, b: 210 } : { r: 20, g: 20, b: 20 }; // light | dark
  const c = p ?? half;
  const i = (y * W + x) * 3; body[i] = c.r; body[i + 1] = c.g; body[i + 2] = c.b;
}
writeFileSync(`/tmp/check-${id}-${pose}.ppm`, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), body]));
console.log(`wrote /tmp/check-${id}-${pose}.ppm (${gw}x${gh})`);
