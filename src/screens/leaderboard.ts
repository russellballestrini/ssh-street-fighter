import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { box, table, bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';

export const leaderboard = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    bigCenter(f, 1, 'LEADERBOARD', THEME.accent, THEME.bgTop, 1);
    const pw = Math.min(68, f.cols - 6);
    const inner = box(f, Math.floor((f.cols - pw) / 2), 8, pw, f.rows - 12, { title: 'TOP FIGHTERS', style: 'double' });
    const colX = [0, 5, 25, 34, 40, 46];
    const headers = ['#', 'FIGHTER', 'ELO', 'W', 'L', 'WIN%'];
    const rows = s.leader.map((r, i) => [String(i + 1), r.username, String(r.elo), String(r.wins), String(r.losses), `${Math.round(r.win_pct * 100)}%`]);
    const myIdx = s.leader.findIndex((r) => r.username === s.displayName);
    if (rows.length === 0) f.center(inner.y + 3, 'NO MATCHES YET - BE THE FIRST!', THEME.textDim, THEME.panel);
    else table(f, inner.x, inner.y + 1, colX, headers, rows, myIdx, THEME.panel);
    keyHints(f, f.rows - 2, [['ESC', 'BACK']]);
  },
  onKey(s: Session, k: Key): void {
    if (k.t === 'esc' || k.t === 'enter' || (k.t === 'char' && k.ch.toLowerCase() === 'q')) s.goTo('menu');
  },
};
