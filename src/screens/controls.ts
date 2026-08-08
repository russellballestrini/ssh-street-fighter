// Rebind the fight action keys (punch / kick / jump). Navigation is
// arrows-only here because letter keys are exactly what players come to
// reassign. Verified players keep bindings across connections; guests keep
// them for the session.
import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { box, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import { BINDABLE_ACTIONS, DEFAULT_BINDINGS, keyLabel, validateBinding } from '../input/bindings.js';

const DESCRIPTIONS: Record<(typeof BINDABLE_ACTIONS)[number], string> = {
  punch: 'FAST, SHORT RANGE',
  kick: 'SLOWER, LONGER, HARDER',
  jump: 'ALSO ALWAYS ON ↑',
};

export const controls = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    f.center(2, 'CONTROLS', THEME.accent, THEME.bgTop, true);
    f.center(4, 'MOVEMENT STAYS ON THE ARROW KEYS', THEME.textDim, THEME.bgTop);

    const pw = Math.min(46, f.cols - 4), ph = 10;
    const px = Math.floor((f.cols - pw) / 2), py = 6;
    const inner = box(f, px, py, pw, ph, { title: 'FIGHT KEYS', style: 'double' });
    BINDABLE_ACTIONS.forEach((action, i) => {
      const y = inner.y + 1 + i * 2;
      const selected = i === s.menuIndex;
      const rowBg = selected ? THEME.select : THEME.panel;
      f.fill(inner.x, y, inner.w, 1, rowBg);
      f.putChar(inner.x + 1, y, selected ? '▶' : ' ', THEME.accent, rowBg, true);
      f.write(inner.x + 3, y, action.toUpperCase().padEnd(7), selected ? THEME.selectText : THEME.text, rowBg, selected);
      const shown = selected && s.controlsCapture ? 'PRESS KEY…' : `[ ${keyLabel(s.bindings[action])} ]`;
      f.write(inner.x + 11, y, shown.padEnd(12), THEME.accent2, rowBg, true);
      f.write(inner.x + 23, y, DESCRIPTIONS[action].slice(0, Math.max(0, inner.w - 24)), THEME.textDim, rowBg);
    });

    if (s.errorMsg) f.center(py + ph + 1, s.errorMsg, THEME.bad, undefined, true);
    keyHints(f, f.rows - 2, s.controlsCapture
      ? [['ANY KEY', 'BIND'], ['ESC', 'CANCEL']]
      : [['↑↓', 'SELECT'], ['ENTER', 'REBIND'], ['R', 'DEFAULTS'], ['ESC', 'BACK']]);
  },

  onKey(s: Session, k: Key): void {
    if (s.controlsCapture) {
      const action = BINDABLE_ACTIONS[s.menuIndex]!;
      if (k.t === 'esc') { s.controlsCapture = false; s.errorMsg = ''; return; }
      if (k.t !== 'char') { s.errorMsg = 'PRESS A LETTER, NUMBER, OR SYMBOL KEY'; return; }
      const error = validateBinding(action, k.ch, s.bindings);
      if (error) { s.errorMsg = error; return; }
      s.setBindings({ ...s.bindings, [action]: k.ch.toLowerCase() });
      s.controlsCapture = false;
      s.errorMsg = '';
      return;
    }
    if (k.t === 'up') s.menuIndex = (s.menuIndex - 1 + BINDABLE_ACTIONS.length) % BINDABLE_ACTIONS.length;
    else if (k.t === 'down') s.menuIndex = (s.menuIndex + 1) % BINDABLE_ACTIONS.length;
    else if (k.t === 'enter') { s.controlsCapture = true; s.errorMsg = ''; }
    else if (k.t === 'esc') s.goTo('menu');
    else if (k.t === 'char' && k.ch.toLowerCase() === 'r') { s.setBindings({ ...DEFAULT_BINDINGS }); s.errorMsg = ''; }
  },
};
