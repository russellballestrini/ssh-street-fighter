import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { fitGrid, rgb } from '../render/pixel.js';
import { composeWaitingStage, SELECT_STAGE } from '../game/select-scene.js';
import { bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import { characterAt } from '../game/roster.js';

const BLACK = rgb(0, 0, 0);

export const lobbyWait = {
  render(s: Session, f: Frame): void {
    const pw = f.cols * 2, ph = f.rows * 4;
    f.usePixel(fitGrid(composeWaitingStage(s.cursor, s.frame), pw, ph, BLACK));
    const scale = Math.min(pw / SELECT_STAGE.W, ph / SELECT_STAGE.H);
    const oy = (ph - SELECT_STAGE.H * scale) / 2;
    const toRow = (ly: number) => Math.round((oy + ly * scale) / 4);

    const c = characterAt(s.cursor);
    bigCenter(f, 1, c.name, THEME.accent, THEME.bgTop, 1);
    const dots = '.'.repeat(1 + (Math.floor(s.frame / 10) % 3));
    f.center(toRow(SELECT_STAGE.floor + 10), `WAITING FOR OPPONENT${dots}`, THEME.text, undefined, true);
    f.center(toRow(SELECT_STAGE.floor + 10) + 2, 'Have a friend SSH in and join the lobby', THEME.textDim);
    keyHints(f, f.rows - 1, [['ESC', 'CANCEL']]);
  },
  onKey(s: Session, k: Key): void {
    if (k.t === 'esc' || (k.t === 'char' && k.ch.toLowerCase() === 'q')) s.cancelLobby();
  },
};
