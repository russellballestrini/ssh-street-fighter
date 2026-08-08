import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { fitGrid, rgb } from '../render/pixel.js';
import { composeSelectStage, SELECT_STAGE, fighterSlot } from '../game/select-scene.js';
import { bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import { ROSTER, characterAt } from '../game/roster.js';
import * as db from '../db/db.js';

const BLACK = rgb(0, 0, 0);

export const select = {
  render(s: Session, f: Frame): void {
    const pw = f.cols * 2, ph = f.rows * 4;
    // rendered fighter sprites go in the pixel layer
    f.usePixel(fitGrid(composeSelectStage(s.cursor, s.frame), pw, ph, BLACK));
    // fit transform: logical world -> terminal cell
    const scale = Math.min(pw / SELECT_STAGE.W, ph / SELECT_STAGE.H);
    const ox = (pw - SELECT_STAGE.W * scale) / 2, oy = (ph - SELECT_STAGE.H * scale) / 2;
    const toCol = (lx: number) => Math.round((ox + lx * scale) / 2);
    const toRow = (ly: number) => Math.round((oy + ly * scale) / 4);

    // crisp text overlay
    bigCenter(f, 0, 'SELECT FIGHTER', THEME.accent, THEME.bgTop, 1);
    f.center(6, s.selectMode === 'practice' ? 'PRACTICE  -  PICK A FIGHTER' : 'VERSUS LOBBY  -  PICK A FIGHTER', THEME.accent2);

    const n = ROSTER.length;
    const sel = ((s.cursor % n) + n) % n;
    for (let i = 0; i < n; i++) {
      const c = characterAt(i);
      const slot = fighterSlot(i, n);
      const col = toCol(slot.x);
      const nameRow = toRow(slot.baseline + 6);
      const isSel = i === sel;
      f.write(col - Math.floor(c.name.length / 2), nameRow, c.name, isSel ? THEME.accent : THEME.textDim, undefined, isSel);
      if (isSel) f.write(col - 3, nameRow + 1, '▲ PICK', THEME.accent, undefined, true);
    }

    const chosen = characterAt(sel);
    f.center(f.rows - 2, chosen.tagline.toUpperCase(), THEME.text);
    keyHints(f, f.rows - 1, [['A/D', 'CHOOSE'], ['ENTER', 'START'], ['ESC', 'BACK']]);
  },

  onKey(s: Session, k: Key): void {
    if (k.t === 'left' || (k.t === 'char' && k.ch.toLowerCase() === 'a')) s.cursor = (s.cursor - 1 + ROSTER.length) % ROSTER.length;
    else if (k.t === 'right' || (k.t === 'char' && k.ch.toLowerCase() === 'd')) s.cursor = (s.cursor + 1) % ROSTER.length;
    else if (k.t === 'esc' || (k.t === 'char' && k.ch.toLowerCase() === 'q')) s.goTo('menu');
    else if (k.t === 'enter' || (k.t === 'char' && (k.ch === 'j' || k.ch === ' '))) {
      if (!s.guest && s.fp) db.setMainChar(s.fp, s.cursor);
      if (s.selectMode === 'practice') s.startPractice(s.cursor);
      else s.joinLobby();
    }
  },
};
