import { InputState } from './input/keys.js';
import {
  DEFAULT_KEY_BINDINGS,
  actionUsing,
  bindingProblem,
  parseKeyBindings,
  serializeKeyBindings,
  withBinding,
} from './input/bindings.js';

let failed = false;
const check = (name: string, ok: boolean): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
};

const defaults = new InputState();
defaults.feed(Buffer.from('\x1b', 'latin1'));
defaults.feed(Buffer.from('[Cw', 'latin1'));
const defaultSnapshot = defaults.snapshot();
check('split arrow sequence survives packet boundary', defaultSnapshot.moveX === 1 && defaultSnapshot.motion === 'R');
check('default punch remains W', defaultSnapshot.punch);

let custom = withBinding(DEFAULT_KEY_BINDINGS, 'left', 'key:a');
custom = withBinding(custom, 'right', 'key:d');
custom = withBinding(custom, 'crouch', 'key:s');
custom = withBinding(custom, 'jump', 'key:i');
custom = withBinding(custom, 'punch', 'key:j');
custom = withBinding(custom, 'kick', 'key:k');
const configured = new InputState(custom);
configured.feed(Buffer.from('sdj', 'latin1'));
const customSnapshot = configured.snapshot();
check('custom directions drive movement and motion buffer', customSnapshot.moveX === 1 && customSnapshot.down && customSnapshot.motion === 'DR');
check('custom attack key drives punch', customSnapshot.punch && !customSnapshot.kick);

const roundTrip = parseKeyBindings(serializeKeyBindings(custom));
check('key map serialization round-trips', roundTrip.punch === 'key:j' && roundTrip.left === 'key:a');
check('duplicate assignment can be detected', actionUsing(custom, 'key:k', 'punch') === 'kick');
check('fixed game commands cannot be rebound', bindingProblem('key:q') !== null && bindingProblem('key:v') !== null && bindingProblem('key:?') !== null);
check('invalid stored key maps fail safely to defaults', parseKeyBindings('{broken').punch === DEFAULT_KEY_BINDINGS.punch);

console.log(failed ? 'INPUT TEST: FAIL' : 'INPUT TEST: PASS');
process.exit(failed ? 1 : 0);
