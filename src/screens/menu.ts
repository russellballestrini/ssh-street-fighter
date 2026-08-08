import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { box, menu as menuWidget, bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import { characterAt, ROSTER } from '../game/roster.js';
import * as db from '../db/db.js';

const ITEMS = ['QUICK MATCH  (PLAY ONLINE)', 'FIGHT LOUNGE  (CHAT + CHALLENGE)', 'PRACTICE MODE', 'LEADERBOARD', 'HELP', 'QUIT'];

export const menu = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    bigCenter(f, 1, 'STREET FIGHTER', THEME.accent, THEME.bgTop, 1);
    f.center(8, `WELCOME, ${s.displayName}`, THEME.text, THEME.bgTop, true);

    const inner = box(f, Math.floor(f.cols / 2 - 34), 11, 38, 15, { title: 'MAIN MENU', style: 'double' });
    menuWidget(f, inner.x, inner.y + 1, inner.w, ITEMS, s.menuIndex);

    // char + stats panel on the right
    const rx = Math.floor(f.cols / 2 + 6);
    const rp = box(f, rx, 11, 24, 15, { title: 'YOUR FIGHTER' });
    const c = characterAt(s.cursor);
    f.write(rp.x, rp.y + 1, c.name, THEME.accent, THEME.panel, true);
    f.write(rp.x, rp.y + 2, c.tagline.toUpperCase(), THEME.textDim, THEME.panel);
    const p = s.player;
    const rank = s.fp ? db.playerRank(s.fp) : null;
    if (p) {
      f.write(rp.x, rp.y + 4, `WINS   ${p.wins}`, THEME.good, THEME.panel);
      f.write(rp.x, rp.y + 5, `LOSSES ${p.losses}`, THEME.bad, THEME.panel);
      f.write(rp.x, rp.y + 6, `ELO    ${p.elo}`, THEME.accent, THEME.panel, true);
      if (rank) f.write(rp.x, rp.y + 7, `RANK   #${rank}`, THEME.accent2, THEME.panel, true);
      f.write(rp.x, rp.y + 8, `WIN%   ${p.matches ? Math.round((p.wins / p.matches) * 100) : 0}`, THEME.text, THEME.panel);
    } else {
      f.write(rp.x, rp.y + 4, 'GUEST', THEME.textDim, THEME.panel);
      f.write(rp.x, rp.y + 5, 'stats not saved', THEME.textDim, THEME.panel);
    }

    keyHints(f, f.rows - 2, [['W/S', 'MOVE'], ['ENTER', 'SELECT'], ['?', 'HELP']]);
  },

  onKey(s: Session, k: Key): void {
    if (k.t === 'up' || (k.t === 'char' && k.ch.toLowerCase() === 'w')) s.menuIndex = (s.menuIndex - 1 + ITEMS.length) % ITEMS.length;
    else if (k.t === 'down' || (k.t === 'char' && k.ch.toLowerCase() === 's')) s.menuIndex = (s.menuIndex + 1) % ITEMS.length;
    else if (k.t === 'left' || (k.t === 'char' && k.ch.toLowerCase() === 'a')) s.cursor = (s.cursor - 1 + ROSTER.length) % ROSTER.length;
    else if (k.t === 'right' || (k.t === 'char' && k.ch.toLowerCase() === 'd')) s.cursor = (s.cursor + 1) % ROSTER.length;
    else if (k.t === 'enter' || (k.t === 'char' && (k.ch === 'j' || k.ch === ' '))) {
      switch (s.menuIndex) {
        case 0: s.selectMode = 'lobby'; s.goTo('select'); break;
        case 1: s.enterLounge(); break;
        case 2: s.selectMode = 'practice'; s.goTo('select'); break;
        case 3: s.goTo('leaderboard'); break;
        case 4: s.helpOpen = true; s.prevFrame = null; break;
        case 5: s.close(); break;
      }
    }
  },
};
