// The main fight HUD (bars, names, wins, round, timer and announcements) is
// rendered directly into the scene's PixelGrid. Keep only the one-row control
// legend in terminal text so key labels stay readable at the smallest sizes.
import type { Frame } from '../render/frame.js';
import type { Match } from '../game/types.js';
import { keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';

export function drawFightHud(f: Frame, m: Match, practice: boolean): void {
  const cols = f.cols, rows = f.rows;
  void m;
  if (practice && rows > 12) f.center(8, 'PRACTICE  -  Q TO EXIT', THEME.accent, THEME.shadow, true);
  f.fill(0, rows - 1, cols, 1, THEME.shadow);
  keyHints(f, rows - 1, [
    ['←→', 'MOVE'], ['↑', 'JUMP'], ['↓', 'CROUCH'], ['W', 'PUNCH'], ['E', 'KICK'], ['BACK', 'BLOCK'], ['?', 'MOVES'], ['V', 'GFX'], ['Q', practice ? 'EXIT' : 'QUIT'],
  ]);
}
