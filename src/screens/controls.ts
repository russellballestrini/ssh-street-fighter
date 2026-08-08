import type { Frame } from '../render/frame.js';
import type { Key } from '../ui/key.js';
import type { Session } from '../net/session.js';
import { box, bigCenter, keyHints } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import {
  ACTION_LABEL,
  BINDABLE_ACTIONS,
  actionUsing,
  bindingFromKey,
  bindingLabel,
  bindingProblem,
} from '../input/bindings.js';

export const controls = {
  render(s: Session, f: Frame): void {
    f.gradient(THEME.bgTop, THEME.bgBot);
    if (f.rows >= 22) bigCenter(f, 1, 'CONTROLS', THEME.accent, THEME.bgTop, 1);
    else f.center(0, 'COMBAT CONTROLS', THEME.accent, THEME.bgTop, true);

    const panelY = f.rows >= 22 ? 7 : 1;
    const panelW = Math.min(54, f.cols - 4);
    const panelH = Math.min(11, f.rows - panelY - 3);
    const inner = box(f, Math.floor((f.cols - panelW) / 2), panelY, panelW, panelH, { title: 'YOUR KEY BINDINGS', style: 'double' });
    const maxRows = Math.max(0, Math.min(BINDABLE_ACTIONS.length, inner.h));

    for (let i = 0; i < maxRows; i++) {
      const action = BINDABLE_ACTIONS[i]!;
      const y = inner.y + i;
      const selected = i === s.controlsCursor;
      const capturing = selected && s.bindingCapture === action;
      const bg = selected ? THEME.select : THEME.panel;
      if (selected) f.fill(inner.x - 1, y, inner.w + 2, 1, bg);
      const marker = selected ? '▶' : ' ';
      const label = ACTION_LABEL[action].padEnd(14);
      const value = capturing ? 'PRESS A KEY…' : bindingLabel(s.keyBindings[action]);
      f.write(inner.x, y, `${marker} ${label}`.slice(0, inner.w), selected ? THEME.selectText : THEME.text, bg, selected);
      const valueX = inner.x + Math.min(18, Math.max(0, inner.w - value.length));
      f.write(valueX, y, value.slice(0, Math.max(0, inner.w - (valueX - inner.x))), capturing ? THEME.accent2 : THEME.accent, bg, true);
    }

    if (f.rows >= 20) {
      const persistence = s.guest ? 'GUEST SETTINGS LAST FOR THIS SESSION' : 'SAVED TO YOUR VERIFIED SSH IDENTITY';
      f.center(panelY + panelH + 1, 'BLOCK = HOLD AWAY  ·  ? MOVES  ·  V GFX  ·  Q EXIT', THEME.textDim, THEME.bgBot);
      f.center(panelY + panelH + 2, persistence, s.guest ? THEME.textDim : THEME.good, THEME.bgBot, true);
    }
    const noticeY = f.rows >= 20 ? panelY + panelH + 4 : f.rows - 3;
    if (s.controlsNotice) f.center(noticeY, s.controlsNotice.slice(0, Math.max(0, f.cols - 4)), THEME.accent2, THEME.bgBot, true);
    const normalHints: [string, string][] = f.cols < 52
      ? [['↑/↓', 'PICK'], ['ENTER', 'CHANGE'], ['ESC', 'BACK']]
      : [['↑/↓', 'ACTION'], ['ENTER', 'CHANGE'], ['R', 'RESET'], ['ESC', 'BACK']];
    keyHints(f, f.rows - 1, s.bindingCapture ? [['KEY', 'ASSIGN'], ['ESC', 'CANCEL']] : normalHints);
  },

  onKey(s: Session, key: Key): void {
    if (s.bindingCapture) {
      if (key.t === 'esc') { s.bindingCapture = null; s.controlsNotice = 'CHANGE CANCELLED'; return; }
      const binding = bindingFromKey(key);
      if (!binding) { s.controlsNotice = 'USE AN ARROW, SPACE, LETTER, NUMBER, OR SYMBOL'; return; }
      const problem = bindingProblem(binding);
      if (problem) { s.controlsNotice = problem; return; }
      const duplicate = actionUsing(s.keyBindings, binding, s.bindingCapture);
      if (duplicate) { s.controlsNotice = `${bindingLabel(binding)} IS ALREADY USED BY ${ACTION_LABEL[duplicate]}`; return; }
      const action = s.bindingCapture;
      s.setKeyBinding(action, binding);
      s.bindingCapture = null;
      s.controlsNotice = `${ACTION_LABEL[action]} SET TO ${bindingLabel(binding)}`;
      return;
    }

    if (key.t === 'up' || (key.t === 'char' && key.ch.toLowerCase() === 'w')) {
      s.controlsCursor = (s.controlsCursor - 1 + BINDABLE_ACTIONS.length) % BINDABLE_ACTIONS.length;
    } else if (key.t === 'down' || (key.t === 'char' && key.ch.toLowerCase() === 's')) {
      s.controlsCursor = (s.controlsCursor + 1) % BINDABLE_ACTIONS.length;
    } else if (key.t === 'enter') {
      s.bindingCapture = BINDABLE_ACTIONS[s.controlsCursor]!;
      s.controlsNotice = `PRESS THE NEW KEY FOR ${ACTION_LABEL[s.bindingCapture]}`;
    } else if (key.t === 'char' && key.ch.toLowerCase() === 'r') {
      s.resetKeyBindings();
      s.controlsNotice = 'DEFAULT KEY BINDINGS RESTORED';
    } else if (key.t === 'esc') {
      s.goTo('menu');
    }
  },
};
