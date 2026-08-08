import type { Frame } from '../render/frame.js';
import type { Session } from '../net/session.js';
import { box } from '../ui/tui.js';
import { THEME } from '../ui/theme.js';
import { specialMoveInput, specialMovesFor, type AttackButton } from '../game/moves.js';
import { keyLabel, type KeyBindings } from '../input/bindings.js';

function lines(b: Readonly<KeyBindings>): [string, string][] {
  return [
    ['MOVE', '←  /  →   (arrow keys)'],
    ['JUMP', `↑ or ${keyLabel(b.jump)}   (hold a direction = leap)`],
    ['CROUCH', '↓   (hold to duck)'],
    ['PUNCH', `${keyLabel(b.punch)}   fast, short range`],
    ['KICK', `${keyLabel(b.kick)}   slower, longer, harder`],
    ['BLOCK', 'hold AWAY from your rival'],
    ['GFX', 'V  toggles octant / half-block'],
    ['QUIT', 'Q'],
  ];
}
const NOTES = [
  'Block by holding back (the way away from your foe).',
  'You can punch and kick while crouching (low hits).',
  'You always face your rival; jump over to cross up.',
  'First to 2 rounds wins; 60s per round.',
  'Rebind punch/kick/jump under CONTROLS in the menu.',
];

export const helpOverlay = {
  render(s: Session, f: Frame): void {
    if (s.screen === 'fight' && s.match) { renderFightMoves(s, f); return; }
    f.dim(0.3); // darken whatever is behind so the modal stands out
    const pw = Math.min(56, f.cols - 6), ph = 18;
    const px = Math.floor((f.cols - pw) / 2), py = Math.max(1, Math.floor((f.rows - ph) / 2));
    const inner = box(f, px, py, pw, ph, { title: 'HOW TO FIGHT', style: 'double' });
    let y = inner.y + 1;
    for (const [k, v] of lines(s.bindings)) {
      f.write(inner.x + 1, y, k.padEnd(8), THEME.accent, THEME.panel, true);
      f.write(inner.x + 10, y, v, THEME.text, THEME.panel);
      y++;
    }
    y++;
    for (const n of NOTES) { f.write(inner.x + 1, y, n, THEME.textDim, THEME.panel); y++; }
    f.center(py + ph - 2, 'PRESS ANY KEY TO CLOSE', THEME.accent2, THEME.panel, true);
  },
};

function renderFightMoves(s: Session, f: Frame): void {
  const fighter = s.match![s.role];
  const specials = specialMovesFor(fighter.name);
  const buttonKeys: Record<AttackButton, string> = { punch: keyLabel(s.bindings.punch), kick: keyLabel(s.bindings.kick) };
  const narrow = f.cols < 54;
  const pw = Math.min(narrow ? 34 : 62, f.cols - 4);
  const ph = Math.min(narrow ? 10 : 12, f.rows - 2);
  const px = Math.floor((f.cols - pw) / 2);
  const py = Math.max(1, Math.floor((f.rows - ph) / 2));

  f.dim(0.25);
  const inner = box(f, px, py, pw, ph, { title: `${fighter.name} MOVES`, style: 'double' });
  const contentBottom = py + ph - 3;
  let y = inner.y;

  const writeClipped = (x: number, text: string, color = THEME.text, bold = false): void => {
    const max = Math.max(0, px + pw - 2 - x);
    f.write(x, y, text.slice(0, max), color, THEME.panel, bold);
  };

  if (narrow) {
    if (specials.length) {
      for (const move of specials) {
        if (y > contentBottom) break;
        writeClipped(inner.x, `${move.shortName.padEnd(10)} ${specialMoveInput(move, fighter.facing, true, buttonKeys)}`, THEME.text, true);
        y++;
      }
    } else {
      writeClipped(inner.x, 'NO UNIQUE SPECIAL MOVES', THEME.textDim);
      y++;
    }
    if (y <= contentBottom) { y++; writeClipped(inner.x, `LOW PUNCH  ↓ + ${buttonKeys.punch}`); y++; }
    if (y <= contentBottom) { writeClipped(inner.x, `LOW KICK   ↓ + ${buttonKeys.kick}`); }
  } else {
    writeClipped(inner.x, `SPECIAL MOVES  ·  FACING ${fighter.facing === 1 ? '→' : '←'}`, THEME.accent2, true);
    y++;
    if (specials.length) {
      for (const move of specials) {
        if (y > contentBottom) break;
        writeClipped(inner.x, move.name.padEnd(18), THEME.accent, true);
        f.write(inner.x + 20, y, specialMoveInput(move, fighter.facing, false, buttonKeys), THEME.text, THEME.panel);
        y++;
      }
    } else {
      writeClipped(inner.x, 'No unique special moves yet.', THEME.textDim);
      y++;
    }
    if (y <= contentBottom) y++;
    if (y <= contentBottom) { writeClipped(inner.x, 'COMBINATIONS', THEME.accent2, true); y++; }
    if (y <= contentBottom) { writeClipped(inner.x, `LOW PUNCH`.padEnd(18), THEME.accent, true); f.write(inner.x + 20, y, `↓ + ${buttonKeys.punch}`, THEME.text, THEME.panel); y++; }
    if (y <= contentBottom) { writeClipped(inner.x, `LOW KICK`.padEnd(18), THEME.accent, true); f.write(inner.x + 20, y, `↓ + ${buttonKeys.kick}`, THEME.text, THEME.panel); }
  }

  f.center(py + ph - 2, 'PRESS ANY KEY TO CLOSE', THEME.accent2, THEME.panel, true);
}
