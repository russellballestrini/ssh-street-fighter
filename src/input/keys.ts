// Translate raw SSH keystrokes into fight inputs (Street-Fighter-style).
//
// Terminals send only key-DOWN bytes (auto-repeating while held), so held
// directions use a short expiry window kept alive by auto-repeat:
//   Arrows  ← →  move,  ↑ jump (edge),  ↓ crouch (held)
//   W punch (edge),  E kick (edge)
//   BLOCK is not a key: hold the direction AWAY from your opponent (the engine
//   derives it from movement vs. facing), exactly like the arcade games.
import { emptyInputs, type Inputs } from '../game/types.js';

const HOLD_MS = 240;
const MOTION_MS = 720; // how long a direction stays in the special-move buffer

export class InputState {
  private leftUntil = 0;
  private rightUntil = 0;
  private downUntil = 0;
  private jumpEdge = false;
  private punchEdge = false;
  private kickEdge = false;
  private motion: { d: string; t: number }[] = []; // recent directions for special moves
  private carry = ''; // bytes left over when a chunk split mid escape-sequence
  quit = false;

  private pushMotion(d: string, now: number): void {
    while (this.motion.length && now - this.motion[0]!.t > MOTION_MS) this.motion.shift();
    if (this.motion.length && this.motion[this.motion.length - 1]!.d === d) { this.motion[this.motion.length - 1]!.t = now; return; }
    this.motion.push({ d, t: now });
    if (this.motion.length > 8) this.motion.shift();
  }

  private arrow(d: string | undefined, now: number): void {
    if (d === 'D') { this.leftUntil = now + HOLD_MS; this.pushMotion('L', now); }
    else if (d === 'C') { this.rightUntil = now + HOLD_MS; this.pushMotion('R', now); }
    else if (d === 'A') { this.jumpEdge = true; this.pushMotion('U', now); }
    else if (d === 'B') { this.downUntil = now + HOLD_MS; this.pushMotion('D', now); }
  }

  feed(data: Buffer): void {
    const s = this.carry + data.toString('latin1');
    this.carry = '';
    let i = 0;
    while (i < s.length) {
      const c = s[i]!;
      const now = Date.now();
      if (c === '\x1b') {
        // Need the full 3-byte CSI sequence (ESC [ X). If it's split across
        // chunks, stash the tail and finish it when the next chunk arrives.
        if (i + 2 >= s.length) { this.carry = s.slice(i); break; }
        if (s[i + 1] === '[' || s[i + 1] === 'O') { this.arrow(s[i + 2], now); i += 3; continue; }
        i += 1; // lone ESC / unknown — skip it
        continue;
      }
      switch (c.toLowerCase()) {
        case 'w': this.punchEdge = true; break;
        case 'e': this.kickEdge = true; break;
        case ' ': this.jumpEdge = true; break;
        case 'q': case '\x03': this.quit = true; break;
      }
      i++;
    }
  }

  snapshot(): Inputs {
    const now = Date.now();
    const inp: Inputs = emptyInputs();
    inp.moveX = (now < this.rightUntil ? 1 : 0) - (now < this.leftUntil ? 1 : 0);
    inp.down = now < this.downUntil;
    inp.jump = this.jumpEdge;
    inp.punch = this.punchEdge;
    inp.kick = this.kickEdge;
    while (this.motion.length && now - this.motion[0]!.t > MOTION_MS) this.motion.shift();
    inp.motion = this.motion.map((m) => m.d).join('');
    this.jumpEdge = this.punchEdge = this.kickEdge = false;
    return inp;
  }
}
