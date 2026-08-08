// Parse a raw SSH keystroke buffer into semantic UI key events (for menus and
// text entry). The in-fight controller uses a different, hold-based parser.
export type Key =
  | { t: 'up' } | { t: 'down' } | { t: 'left' } | { t: 'right' }
  | { t: 'enter' } | { t: 'esc' } | { t: 'backspace' } | { t: 'tab' }
  | { t: 'help' } | { t: 'quit' }
  | { t: 'char'; ch: string };

export function parseKeys(data: Buffer): Key[] {
  const s = data.toString('latin1');
  const keys: Key[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\x1b') {
      if (s[i + 1] === '[' || s[i + 1] === 'O') {
        const d = s[i + 2];
        if (d === 'A') keys.push({ t: 'up' });
        else if (d === 'B') keys.push({ t: 'down' });
        else if (d === 'C') keys.push({ t: 'right' });
        else if (d === 'D') keys.push({ t: 'left' });
        i += 2;
        continue;
      }
      keys.push({ t: 'esc' });
      continue;
    }
    if (c === '\r' || c === '\n') { keys.push({ t: 'enter' }); continue; }
    if (c === '\x7f' || c === '\b') { keys.push({ t: 'backspace' }); continue; }
    if (c === '\t') { keys.push({ t: 'tab' }); continue; }
    if (c === '\x03' || c === '\x04') { keys.push({ t: 'quit' }); continue; } // Ctrl-C / Ctrl-D
    if (c === '?') { keys.push({ t: 'help' }); continue; }
    const code = c.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) keys.push({ t: 'char', ch: c });
  }
  return keys;
}
