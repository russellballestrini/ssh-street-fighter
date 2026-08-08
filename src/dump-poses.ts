import { drawFighter, RED_PALETTE } from './game/sprites.js';
import { createGrid, blit, fillRect, rgb, type Pixel } from './render/pixel.js';
import type { Pose } from './game/types.js';
import { writeFileSync } from 'fs';

const poses: [Pose, number, number][] = [
  ['idle', 0, 0], ['walk', 1.2, 0], ['crouch', 0, 0], ['jump', 0, 0], ['block', 0, 0],
  ['punch', 0, 1], ['kick', 0, 1], ['crouchpunch', 0, 1], ['crouchkick', 0, 1], ['crouchblock', 0, 0],
];
const g = createGrid(poses.length * 36, 60, rgb(24, 20, 40));
poses.forEach(([p, ph, ext], i) => {
  fillRect(g, i * 36 + 3, 54, 30, 2, rgb(60, 50, 70));
  blit(g, drawFighter(p, RED_PALETTE, ph, ext), i * 36 + 3, 2, false);
});
const scale = 5, W = g[0]!.length * scale, H = g.length * scale;
const body = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const px: Pixel = g[Math.floor(y / scale)]![Math.floor(x / scale)] ?? null;
  const i = (y * W + x) * 3; body[i] = px ? px.r : 0; body[i + 1] = px ? px.g : 0; body[i + 2] = px ? px.b : 0;
}
writeFileSync('/tmp/poses.ppm', Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), body]));
console.log('ok');
