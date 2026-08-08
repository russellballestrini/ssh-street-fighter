import { rgb, type RGB } from '../render/pixel.js';

export const THEME = {
  bgTop: rgb(24, 20, 40),
  bgBot: rgb(48, 30, 60),
  panel: rgb(30, 26, 48),
  panelBorder: rgb(120, 100, 180),
  panelTitle: rgb(250, 224, 96),
  text: rgb(232, 228, 240),
  textDim: rgb(150, 142, 168),
  accent: rgb(250, 224, 96),   // gold
  accent2: rgb(96, 220, 240),  // cyan
  select: rgb(210, 60, 52),    // highlight red
  selectText: rgb(255, 250, 240),
  good: rgb(96, 220, 120),
  bad: rgb(224, 72, 64),
  hpFull: rgb(224, 196, 40),
  hpLow: rgb(210, 48, 40),
  shadow: rgb(16, 12, 24),
} as const;

export type ThemeColor = RGB;
