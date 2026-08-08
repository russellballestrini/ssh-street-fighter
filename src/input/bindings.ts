// Per-player fight key bindings. Movement stays on the arrow keys; the three
// action buttons (punch, kick, jump) are rebindable. Bindings are stored
// lowercase; SPACE is a legal binding and displays as "SPC".
export interface KeyBindings { punch: string; kick: string; jump: string; }

export const DEFAULT_BINDINGS: Readonly<KeyBindings> = { punch: 'w', kick: 'e', jump: ' ' };

export const BINDABLE_ACTIONS = ['punch', 'kick', 'jump'] as const;
export type BindableAction = (typeof BINDABLE_ACTIONS)[number];

// Keys with a fixed meaning during a fight can never become an action button:
// Q quits, V toggles the renderer, ? opens the move list.
const RESERVED_KEYS = new Set(['q', 'v', '?']);

function usableKey(key: string): boolean {
  return key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) < 0x7f && !RESERVED_KEYS.has(key);
}

export function keyLabel(key: string): string {
  return key === ' ' ? 'SPC' : key.toUpperCase();
}

/** Returns an error message, or null when the key may be bound to the action. */
export function validateBinding(action: BindableAction, key: string, current: KeyBindings): string | null {
  const lower = key.toLowerCase();
  if (lower.length !== 1 || lower.charCodeAt(0) < 0x20 || lower.charCodeAt(0) >= 0x7f) return 'PRESS A PRINTABLE KEY';
  if (RESERVED_KEYS.has(lower)) return `${keyLabel(lower)} IS RESERVED`;
  for (const other of BINDABLE_ACTIONS) {
    if (other !== action && current[other] === lower) return `${keyLabel(lower)} IS ALREADY ${other.toUpperCase()}`;
  }
  return null;
}

/**
 * Parse a stored bindings JSON string. The set is accepted or rejected
 * wholesale (swapped defaults like punch=E/kick=W are legal, so per-action
 * validation against defaults would wrongly reject them); anything unusable
 * falls back to the default layout.
 */
export function parseBindings(raw: string | null | undefined): KeyBindings {
  if (!raw) return { ...DEFAULT_BINDINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<BindableAction, unknown>>;
    const candidate: KeyBindings = { ...DEFAULT_BINDINGS };
    for (const action of BINDABLE_ACTIONS) {
      const value = parsed[action];
      if (typeof value === 'string') candidate[action] = value.toLowerCase();
    }
    const keys = BINDABLE_ACTIONS.map((action) => candidate[action]);
    if (keys.every(usableKey) && new Set(keys).size === keys.length) return candidate;
  } catch { /* corrupt row — defaults */ }
  return { ...DEFAULT_BINDINGS };
}

export function serializeBindings(bindings: KeyBindings): string {
  return JSON.stringify({ punch: bindings.punch, kick: bindings.kick, jump: bindings.jump });
}
