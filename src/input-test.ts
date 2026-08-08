// Custom key bindings must drive the fight input parser, and binding
// validation must protect the reserved fight keys (Q quit, V gfx, ? moves).
import { InputState } from './input/keys.js';
import { DEFAULT_BINDINGS, parseBindings, serializeBindings, validateBinding } from './input/bindings.js';

const assert = (ok: boolean, message: string): void => {
  if (!ok) { console.error(`FAIL  ${message}`); process.exitCode = 1; }
  else console.log(`PASS  ${message}`);
};

const defaults = new InputState();
defaults.feed(Buffer.from('we '));
let snap = defaults.snapshot();
assert(snap.punch && snap.kick && snap.jump, 'default layout: W punch, E kick, SPACE jump');

const custom = new InputState({ punch: 'j', kick: 'k', jump: 'i' });
custom.feed(Buffer.from('we '));
snap = custom.snapshot();
assert(!snap.punch && !snap.kick && !snap.jump, 'old keys are inert once rebound');
custom.feed(Buffer.from('JKi'));
snap = custom.snapshot();
assert(snap.punch && snap.kick && snap.jump, 'rebound keys register (case-insensitive)');
custom.feed(Buffer.from('q'));
custom.snapshot();
assert(custom.quit, 'Q still quits regardless of bindings');

assert(validateBinding('punch', 'j', { ...DEFAULT_BINDINGS }) === null, 'free printable key is accepted');
assert(validateBinding('punch', 'q', { ...DEFAULT_BINDINGS }) !== null, 'reserved quit key is rejected');
assert(validateBinding('punch', 'v', { ...DEFAULT_BINDINGS }) !== null, 'reserved gfx key is rejected');
assert(validateBinding('punch', 'e', { ...DEFAULT_BINDINGS }) !== null, 'key already used by kick is rejected');
assert(validateBinding('kick', 'e', { ...DEFAULT_BINDINGS }) === null, 'rebinding an action to its own key is a no-op, not an error');

assert(parseBindings(null).punch === 'w', 'missing row falls back to defaults');
assert(parseBindings('not json').kick === 'e', 'corrupt row falls back to defaults');
assert(parseBindings('{"punch":"e","kick":"w"}').punch === 'e', 'swapped defaults load as a whole set');
assert(parseBindings('{"punch":"q"}').punch === 'w', 'stored reserved key falls back to defaults');
assert(parseBindings('{"punch":"e"}').punch === 'w', 'stored duplicate set falls back to defaults');
const roundTrip = parseBindings(serializeBindings({ punch: 'J', kick: 'k', jump: ' ' }));
assert(roundTrip.punch === 'j' && roundTrip.jump === ' ', 'serialize/parse round-trips and lowercases');

console.log(process.exitCode ? 'INPUT TEST: FAIL' : 'INPUT TEST: PASS');
process.exit(process.exitCode ?? 0);
