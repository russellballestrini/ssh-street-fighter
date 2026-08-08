// Reusable HUD components. Every function draws into a PixelGrid, so screens
// compose UIs declaratively (panels, menus, inputs, modals, tables, bars).
import { fillRect, rgb, type PixelGrid, type RGB, type Pixel } from '../render/pixel.js';
import { drawText, textWidth } from '../render/font.js';
import { THEME } from './theme.js';

/** Full-screen vertical gradient background. */
export function gradientBg(g: PixelGrid, top: RGB = THEME.bgTop, bot: RGB = THEME.bgBot): void {
  const h = g.length, w = g[0]?.length ?? 0;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    fillRect(g, 0, y, w, 1, rgb(
      Math.round(top.r + (bot.r - top.r) * t),
      Math.round(top.g + (bot.g - top.g) * t),
      Math.round(top.b + (bot.b - top.b) * t)));
  }
}

/** Centered horizontal text helper. */
export function centerText(g: PixelGrid, text: string, y: number, color: Pixel, scale = 1): void {
  const w = g[0]?.length ?? 0;
  drawText(g, text, Math.round(w / 2 - textWidth(text, scale) / 2), y, color, scale);
}

export interface PanelOpts { title?: string; fill?: RGB; border?: RGB; titleColor?: RGB; }

/** A bordered panel with an optional title. Returns the inner content rect. */
export function panel(g: PixelGrid, x: number, y: number, w: number, h: number, o: PanelOpts = {}):
  { x: number; y: number; w: number; h: number } {
  const fill = o.fill ?? THEME.panel;
  const border = o.border ?? THEME.panelBorder;
  fillRect(g, x, y, w, h, fill);
  // 1px border
  fillRect(g, x, y, w, 1, border);
  fillRect(g, x, y + h - 1, w, 1, border);
  fillRect(g, x, y, 1, h, border);
  fillRect(g, x + w - 1, y, 1, h, border);
  let top = y + 3;
  if (o.title) {
    fillRect(g, x + 1, y + 1, w - 2, 9, THEME.shadow);
    drawText(g, o.title, x + 4, y + 3, o.titleColor ?? THEME.panelTitle, 1);
    fillRect(g, x + 1, y + 10, w - 2, 1, border);
    top = y + 13;
  }
  return { x: x + 3, y: top, w: w - 6, h: h - (top - y) - 3 };
}

export interface MenuOpts { rowH?: number; scale?: number; align?: 'left' | 'center'; disabled?: number[]; }

/** Vertical menu list with a highlighted selection. */
export function menuList(g: PixelGrid, x: number, y: number, w: number, items: string[], selected: number, o: MenuOpts = {}): void {
  const rowH = o.rowH ?? 11;
  const scale = o.scale ?? 1;
  for (let i = 0; i < items.length; i++) {
    const ry = y + i * rowH;
    const isSel = i === selected;
    const disabled = o.disabled?.includes(i);
    if (isSel) {
      fillRect(g, x, ry - 1, w, rowH, THEME.select);
      fillRect(g, x, ry - 1, 2, rowH, THEME.accent);
    }
    const label = items[i]!;
    const color = disabled ? THEME.textDim : (isSel ? THEME.selectText : THEME.text);
    const tx = o.align === 'center' ? Math.round(x + w / 2 - textWidth(label, scale) / 2) : x + 4;
    drawText(g, label, tx, ry + 1, color, scale);
  }
}

export interface InputOpts { label?: string; focus?: boolean; frame?: number; placeholder?: string; max?: number; }

/** Single-line labeled text input with a blinking cursor when focused. */
export function textInput(g: PixelGrid, x: number, y: number, w: number, value: string, o: InputOpts = {}): void {
  if (o.label) { drawText(g, o.label, x, y, THEME.textDim, 1); y += 9; }
  const boxH = 12;
  fillRect(g, x, y, w, boxH, rgb(18, 16, 30));
  const bc = o.focus ? THEME.accent : THEME.panelBorder;
  fillRect(g, x, y, w, 1, bc); fillRect(g, x, y + boxH - 1, w, 1, bc);
  fillRect(g, x, y, 1, boxH, bc); fillRect(g, x + w - 1, y, 1, boxH, bc);
  const shown = value.length ? value : (o.placeholder ?? '');
  const color = value.length ? THEME.text : THEME.textDim;
  drawText(g, shown, x + 4, y + 3, color, 1);
  if (o.focus && (Math.floor((o.frame ?? 0) / 8) % 2 === 0)) {
    const cx = x + 4 + textWidth(value, 1);
    fillRect(g, cx, y + 3, 2, 6, THEME.accent);
  }
}

/** Centered modal overlay (dims the background, draws a titled panel of lines). */
export function modal(g: PixelGrid, title: string, lines: string[], footer?: string): void {
  const W = g[0]?.length ?? 0, H = g.length;
  // dim
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = g[y]![x];
    if (p) g[y]![x] = rgb(p.r >> 2, p.g >> 2, (p.b >> 2) + 8);
  }
  const pw = Math.min(W - 20, Math.max(140, ...lines.map((l) => textWidth(l, 1) + 16)));
  const ph = 22 + lines.length * 9 + (footer ? 12 : 0);
  const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
  const inner = panel(g, px, py, pw, ph, { title });
  let ly = inner.y;
  for (const line of lines) { drawText(g, line, inner.x, ly, THEME.text, 1); ly += 9; }
  if (footer) centerText(g, footer, py + ph - 10, THEME.accent2, 1);
}

/** A simple columnar table (used by the leaderboard). */
export function table(g: PixelGrid, x: number, y: number, colX: number[], headers: string[], rows: string[][], highlight = -1): void {
  for (let c = 0; c < headers.length; c++) drawText(g, headers[c]!, x + colX[c]!, y, THEME.accent2, 1);
  fillRect(g, x, y + 8, colX[colX.length - 1]! + 60, 1, THEME.panelBorder);
  for (let r = 0; r < rows.length; r++) {
    const ry = y + 12 + r * 10;
    if (r === highlight) fillRect(g, x - 2, ry - 1, colX[colX.length - 1]! + 64, 9, rgb(60, 50, 90));
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      drawText(g, row[c]!, x + colX[c]!, ry, r === highlight ? THEME.accent : THEME.text, 1);
    }
  }
}

/** Reusable HP bar. pct 0..1. mirror=true fills from the right (player 2). */
export function healthBar(g: PixelGrid, x: number, y: number, w: number, h: number, pct: number, mirror = false): void {
  fillRect(g, x - 1, y - 1, w + 2, h + 2, THEME.text);
  fillRect(g, x, y, w, h, rgb(40, 20, 20));
  const fw = Math.max(0, Math.round(pct * w));
  const col = pct <= 0.3 ? THEME.hpLow : THEME.hpFull;
  if (mirror) fillRect(g, x + (w - fw), y, fw, h, col);
  else fillRect(g, x, y, fw, h, col);
}

/** Footer control hints, e.g. [["A/D","MOVE"],["J","PUNCH"]]. */
export function keyHints(g: PixelGrid, y: number, hints: [string, string][]): void {
  const W = g[0]?.length ?? 0;
  const parts = hints.map(([k, l]) => `${k} ${l}`);
  const gap = 8;
  const total = parts.reduce((s, p) => s + textWidth(p, 1), 0) + gap * (parts.length - 1);
  let x = Math.round((W - total) / 2);
  for (let i = 0; i < hints.length; i++) {
    const [k, l] = hints[i]!;
    drawText(g, k, x, y, THEME.accent, 1); x += textWidth(k + ' ', 1);
    drawText(g, l, x, y, THEME.textDim, 1); x += textWidth(l, 1) + gap;
  }
}
