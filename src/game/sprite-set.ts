// Loads generated sprites (packed RGBA at high resolution) and serves them by
// character + frame name, downscaled to the exact on-screen size on demand and
// mirrored for left-facing. Holding bytes (not per-pixel objects) keeps memory
// small while allowing high fidelity when the terminal is zoomed way out.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resizeRGBA, type PixelGrid } from '../render/pixel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, '../../assets/sprites');

interface Frame { w: number; h: number; anchorX: number; anchorY: number; rgba: Uint8Array; }
export interface Placed { grid: PixelGrid; anchorX: number; anchorY: number; }
const MAX_SCALE_CACHE = 128;

class SpriteSet {
  private chars = new Map<string, Map<string, Frame>>();
  private refH = new Map<string, number>(); // reference standing height per char (idle_1)
  private scaleCache = new Map<string, Placed>();
  private loaded = false;

  private ensure(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(BASE)) return;
    for (const id of readdirSync(BASE)) {
      const dir = resolve(BASE, id);
      let files: string[];
      try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { continue; }
      if (files.length === 0) continue;
      const frames = new Map<string, Frame>();
      for (const file of files) {
        try {
          const s = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as { w: number; h: number; anchorX: number; anchorY: number; data: string };
          if (!s.data) continue;
          frames.set(file.replace('.json', ''), { w: s.w, h: s.h, anchorX: s.anchorX, anchorY: s.anchorY, rgba: new Uint8Array(Buffer.from(s.data, 'base64')) });
        } catch { /* skip bad frame */ }
      }
      this.chars.set(id.toUpperCase(), frames);
      // reference = the standing idle height; every pose scales relative to it
      // so a crouch (shorter stored sprite) renders shorter, not stretched up.
      const ref = frames.get('idle_1')?.h ?? Math.max(...[...frames.values()].map((f) => f.h));
      this.refH.set(id.toUpperCase(), ref);
    }
  }

  has(charId: string): boolean { this.ensure(); return this.chars.has(charId.toUpperCase()); }

  /**
   * Get a frame sized so a full STANDING pose is `standH` on-screen pixels tall;
   * other poses scale RELATIVE to the standing reference (a crouch stays short,
   * a KO stays flat), mirrored for left.
   */
  getScaled(charId: string, name: string, facing: 1 | -1, standH: number): Placed | null {
    this.ensure();
    const cid = charId.toUpperCase();
    const f = this.chars.get(cid)?.get(name);
    if (!f) return null;
    const ref = this.refH.get(cid) ?? f.h;
    const targetH = Math.max(1, Math.round(standH * f.h / ref));
    const key = `${charId}|${name}|${facing}|${targetH}`;
    const cached = this.scaleCache.get(key);
    if (cached) {
      this.scaleCache.delete(key);
      this.scaleCache.set(key, cached);
      return cached;
    }
    const grid = resizeRGBA(f.rgba, f.w, f.h, targetH, facing === -1);
    const factor = targetH / f.h;
    const tw = grid[0]?.length ?? 0;
    const ax = Math.round(f.anchorX * factor);
    const placed: Placed = { grid, anchorX: facing === -1 ? tw - 1 - ax : ax, anchorY: Math.round(f.anchorY * factor) };
    if (this.scaleCache.size >= MAX_SCALE_CACHE) {
      const oldest = this.scaleCache.keys().next().value as string | undefined;
      if (oldest) this.scaleCache.delete(oldest);
    }
    this.scaleCache.set(key, placed);
    return placed;
  }
}

export const SPRITES = new SpriteSet();
