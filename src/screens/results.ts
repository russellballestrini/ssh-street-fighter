import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import * as db from '../db/db.js';

export const results = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    const r = s.result;
    if (!r) { bigCenter(f, Math.floor(f.rows / 2) - 3, 'MATCH OVER', THEME.text, THEME.bgTop, 2); return; }
    const big = r.youWon ? 'YOU WIN' : 'YOU LOSE';
    const col = r.youWon ? THEME.good : THEME.bad;
    bigCenter(f, Math.floor(f.rows / 2) - 5, big, col, THEME.bgTop, 3);
    f.center(Math.floor(f.rows / 2) + 3, `${r.winner} DEFEATED ${r.loser}`, THEME.text, THEME.bgBot, true);
    if (r.rating) {
      const sign = r.rating.delta >= 0 ? '+' : '';
      f.center(Math.floor(f.rows / 2) + 5, `ELO  ${r.rating.before}  →  ${r.rating.after}  (${sign}${r.rating.delta})`, r.rating.delta >= 0 ? THEME.good : THEME.bad, THEME.bgBot, true);
    } else f.center(Math.floor(f.rows / 2) + 5, 'UNRATED MATCH', THEME.textDim, THEME.bgBot);
    if (s.player) f.center(Math.floor(f.rows / 2) + 7, `RECORD:  ${s.player.wins} W  -  ${s.player.losses} L`, THEME.textDim, THEME.bgBot);
    keyHints(f, f.rows - 2, [['ENTER', 'MAIN MENU']]);
  },
  onKey(s: Session, _k: Key): void {
    if (s.fp) s.player = db.getByFingerprint(s.fp) ?? s.player;
    s.goTo('menu');
  },
};
