import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { box, bigCenter, input, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import * as db from '../db/db.js';

const NAME_RE = /^[A-Za-z0-9_\-]$/;

export const username = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    bigCenter(f, 2, 'STREET FIGHTER', THEME.accent, THEME.bgTop, 1);
    const pw = Math.min(52, f.cols - 6);
    const px = Math.floor((f.cols - pw) / 2);
    const inner = box(f, px, 9, pw, 8, { title: 'CHOOSE YOUR HANDLE', style: 'double' });
    input(f, inner.x, inner.y + 1, inner.w, s.usernameBuf, { focus: true, frame: s.frame, placeholder: '3-12 letters / numbers' });
    const msg = s.errorMsg ? [THEME.bad, s.errorMsg] as const
      : s.guest ? [THEME.textDim, 'GUEST — name not saved (connect with an SSH key)'] as const
      : [THEME.good, 'TIED TO YOUR SSH KEY — remembered next time'] as const;
    f.center(inner.y + 5, msg[1], msg[0], THEME.panel);
    keyHints(f, f.rows - 2, [['TYPE', 'NAME'], ['ENTER', 'CONFIRM'], ['CTRL-C', 'QUIT']]);
  },

  onKey(s: Session, k: Key): void {
    if (k.t === 'char' && NAME_RE.test(k.ch) && s.usernameBuf.length < 12) { s.usernameBuf += k.ch; s.errorMsg = ''; }
    else if (k.t === 'backspace') { s.usernameBuf = s.usernameBuf.slice(0, -1); s.errorMsg = ''; }
    else if (k.t === 'enter') {
      const name = s.usernameBuf.trim();
      if (name.length < 3) { s.errorMsg = 'TOO SHORT (MIN 3)'; return; }
      if (db.usernameTaken(name)) { s.errorMsg = 'NAME ALREADY TAKEN'; return; }
      if (!s.guest && s.fp) { if (!db.setUsername(s.fp, name)) { s.errorMsg = 'NAME ALREADY TAKEN'; return; } s.player = db.getByFingerprint(s.fp)!; }
      s.username = name;
      s.goTo('menu');
    }
  },
};
