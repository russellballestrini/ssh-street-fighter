// Text-mode HUD widgets drawn as real terminal characters (crisp at any size).
// All operate on a Frame's text-cell layer.
import type { Frame } from '../render/frame.js';
import type { RGB } from '../render/pixel.js';
import { glyphRows } from '../render/font.js';
import { THEME } from './theme.js';

const B = { // box-drawing sets
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', lt: '├', rt: '┤' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', lt: '╠', rt: '╣' },
  round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', lt: '├', rt: '┤' },
};

export interface Rect { x: number; y: number; w: number; h: number; }

export interface BoxOpts { fg?: RGB; bg?: RGB; title?: string; titleFg?: RGB; style?: 'single' | 'double' | 'round'; }

/** Draw a bordered box (optionally titled). Returns the inner content rect. */
export function box(f: Frame, x: number, y: number, w: number, h: number, o: BoxOpts = {}): Rect {
  const s = B[o.style ?? 'round'];
  const fg = o.fg ?? THEME.panelBorder;
  const bg = o.bg ?? THEME.panel;
  f.fill(x, y, w, h, bg);
  f.putChar(x, y, s.tl, fg, bg, true); f.putChar(x + w - 1, y, s.tr, fg, bg, true);
  f.putChar(x, y + h - 1, s.bl, fg, bg, true); f.putChar(x + w - 1, y + h - 1, s.br, fg, bg, true);
  for (let i = 1; i < w - 1; i++) { f.putChar(x + i, y, s.h, fg, bg, true); f.putChar(x + i, y + h - 1, s.h, fg, bg, true); }
  for (let i = 1; i < h - 1; i++) { f.putChar(x, y + i, s.v, fg, bg, true); f.putChar(x + w - 1, y + i, s.v, fg, bg, true); }
  let top = y + 1;
  if (o.title) {
    const label = ` ${o.title} `;
    f.write(x + 2, y, label, o.titleFg ?? THEME.panelTitle, bg, true);
    top = y + 2;
  }
  return { x: x + 2, y: top, w: w - 4, h: h - (top - y) - 1 };
}

/** Big block-letter text (each glyph pixel = one █ cell → crisp). */
export function bigText(f: Frame, x: number, y: number, str: string, fg: RGB, bg: RGB, scale = 1): void {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = glyphRows(ch);
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy]![gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) f.putChar(cx + gx * scale + sx, y + gy * scale + sy, '█', fg, bg, false);
      }
    }
    cx += (3 + 1) * scale;
  }
}
export function bigWidth(str: string, scale = 1): number { return str.length * (3 + 1) * scale - scale; }
export function bigCenter(f: Frame, y: number, str: string, fg: RGB, bg: RGB, scale = 1): void {
  bigText(f, Math.max(0, Math.floor((f.cols - bigWidth(str, scale)) / 2)), y, str, fg, bg, scale);
}

export interface MenuOpts { bg?: RGB; disabled?: number[]; }
/** Vertical menu; selected row gets a highlight bar + ► marker. */
export function menu(f: Frame, x: number, y: number, w: number, items: string[], sel: number, o: MenuOpts = {}): void {
  const bg = o.bg ?? THEME.panel;
  for (let i = 0; i < items.length; i++) {
    const ry = y + i * 2;
    const isSel = i === sel;
    const rowBg = isSel ? THEME.select : bg;
    const fg = o.disabled?.includes(i) ? THEME.textDim : (isSel ? THEME.selectText : THEME.text);
    f.fill(x, ry, w, 1, rowBg);
    f.putChar(x + 1, ry, isSel ? '▶' : ' ', THEME.accent, rowBg, true);
    f.write(x + 3, ry, items[i]!, fg, rowBg, isSel);
  }
}

export interface InputOpts { label?: string; focus?: boolean; frame?: number; placeholder?: string; }
export function input(f: Frame, x: number, y: number, w: number, value: string, o: InputOpts = {}): void {
  if (o.label) { f.write(x, y, o.label, THEME.textDim); y += 1; }
  const bg = THEME.shadow;
  const bc = o.focus ? THEME.accent : THEME.panelBorder;
  f.fill(x, y, w, 3, bg);
  for (let i = 0; i < w; i++) { f.putChar(x + i, y, '─', bc, bg, true); f.putChar(x + i, y + 2, '─', bc, bg, true); }
  f.putChar(x, y, '┌', bc, bg, true); f.putChar(x + w - 1, y, '┐', bc, bg, true);
  f.putChar(x, y + 2, '└', bc, bg, true); f.putChar(x + w - 1, y + 2, '┘', bc, bg, true);
  f.putChar(x, y + 1, '│', bc, bg, true); f.putChar(x + w - 1, y + 1, '│', bc, bg, true);
  const shown = value.length ? value : (o.placeholder ?? '');
  f.write(x + 2, y + 1, shown, value.length ? THEME.text : THEME.textDim, bg, value.length > 0);
  if (o.focus && Math.floor((o.frame ?? 0) / 8) % 2 === 0) f.putChar(x + 2 + value.length, y + 1, '▏', THEME.accent, bg, true);
}

export function table(f: Frame, x: number, y: number, colX: number[], headers: string[], rows: string[][], highlight = -1, bg: RGB = THEME.panel): void {
  for (let c = 0; c < headers.length; c++) f.write(x + colX[c]!, y, headers[c]!, THEME.accent2, bg, true);
  const rule = '─'.repeat((colX[colX.length - 1] ?? 0) + 8);
  f.write(x, y + 1, rule, THEME.panelBorder, bg);
  for (let r = 0; r < rows.length; r++) {
    const ry = y + 2 + r;
    const rbg = r === highlight ? THEME.select : bg;
    if (r === highlight) f.fill(x - 1, ry, (colX[colX.length - 1] ?? 0) + 10, 1, rbg);
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) f.write(x + colX[c]!, ry, row[c]!, r === highlight ? THEME.selectText : THEME.text, rbg, r === highlight);
  }
}

/** Centered footer hints: [["A/D","MOVE"],...]. Sits on whatever bg is there. */
export function keyHints(f: Frame, y: number, hints: [string, string][]): void {
  const parts = hints.map(([k, l]) => `${k} ${l}`);
  const total = parts.join('   ').length;
  let x = Math.max(0, Math.floor((f.cols - total) / 2));
  for (const [k, l] of hints) {
    f.write(x, y, k, THEME.accent, undefined, true); x += k.length + 1;
    f.write(x, y, l, THEME.textDim); x += l.length + 3;
  }
}

/** A crisp cell-based HP bar using block shading. pct 0..1, mirror fills from right. */
export function healthBar(f: Frame, x: number, y: number, w: number, pct: number, mirror = false, bg: RGB = THEME.shadow): void {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * w);
  const col = pct <= 0.3 ? THEME.hpLow : THEME.hpFull;
  for (let i = 0; i < w; i++) {
    const on = mirror ? i >= w - filled : i < filled;
    f.putChar(x + i, y, on ? '█' : '░', on ? col : THEME.textDim, bg, false);
  }
}
