import type { Duplex } from 'stream';
import { HIDE_CURSOR, SHOW_CURSOR, CLEAR_SCREEN, RESET } from '../render/pixel.js';
import { Frame, diffCells, type RenderMode, type Cell } from '../render/frame.js';
import { parseKeys, type Key } from '../ui/key.js';
import { InputState } from '../input/keys.js';
import { composeScene } from '../game/scene.js';
import { makeFighter, makeMatch, stepMatch, TICK_HZ } from '../game/engine.js';
import { emptyInputs, type Match } from '../game/types.js';
import { characterAt } from '../game/roster.js';
import * as db from '../db/db.js';
import { SCREENS, type ScreenName } from '../screens/index.js';
import { drawFightHud } from '../screens/fight-hud.js';

const MAX_RENDER_HZ = 15; // visual refresh rate (sim/input stay at TICK_HZ = 30)
const MAX_COLS = 300, MAX_ROWS = 120;
const NOWRAP = '\x1b[?7l';
const WRAP = '\x1b[?7h';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const COLOR_STEP = clamp(parseInt(process.env.SF_COLOR_STEP ?? '1', 10) || 1, 1, 64);
const INDEXED_COLOR = process.env.SF_COLOR_MODE === '256';

export interface MatchResult {
  winner: string;
  loser: string;
  youWon: boolean;
  winnerChar: string;
  rating?: { before: number; after: number; delta: number };
}

export class Session {
  // identity
  fp: string | null;
  guest: boolean;
  player: db.Player | null = null;

  // transport
  cols = 120; rows = 40;
  prevFrame: Cell[] | null = null;
  alive = true;
  private loopTimer: NodeJS.Timeout | null = null;
  private outputBlocked = false;

  // ui state
  screen: ScreenName = 'username';
  frame = 0;
  menuIndex = 0;
  cursor = 0;              // character-select cursor
  selectMode: 'lobby' | 'practice' = 'lobby';
  usernameBuf = '';
  errorMsg = '';
  helpOpen = false;
  renderMode: RenderMode = 'half';
  leader: db.LeaderRow[] = [];
  result: MatchResult | null = null;
  loungeFocus: 'chat' | 'players' = 'chat';
  loungeCursor = 0;
  chatBuf = '';
  loungeNotice = '';
  incomingChallenge: Session | null = null;
  outgoingChallenge: Session | null = null;
  private lastChatAt = 0;

  // fight
  match: Match | null = null;
  role: 'a' | 'b' = 'a';
  peer: Session | null = null;
  isStepper = false;
  practice = false;
  fightInput = new InputState();

  constructor(public username: string, public stream: Duplex, fp: string | null) {
    this.fp = fp;
    this.guest = !fp;
    if (fp) {
      this.player = db.touchOrCreate(fp);
      if (this.player.username) { this.username = this.player.username; this.screen = 'menu'; this.cursor = this.player.main_char; }
      else this.screen = 'username';
    } else {
      this.screen = 'username'; // guests still pick a display name (not persisted)
    }
  }

  get displayName(): string { return this.player?.username ?? this.username; }

  start(): void {
    this.write(HIDE_CURSOR + NOWRAP + CLEAR_SCREEN);
    this.stream.on('data', (d: Buffer) => this.onData(d));
    this.stream.on('close', () => this.close());
    this.stream.on('error', () => this.close());
    this.loopTimer = setInterval(() => this.tick(), Math.round(1000 / TICK_HZ));
  }

  write(s: string): void {
    if (!this.alive || this.outputBlocked) return;
    try {
      if (!this.stream.write(s)) {
        // Never queue an unbounded history of obsolete animation frames for a
        // slow SSH client. Wait for drain, then diff from the last queued frame.
        this.outputBlocked = true;
        this.stream.once('drain', () => { this.outputBlocked = false; });
      }
    } catch { /* ignore */ }
  }

  resize(cols: number, rows: number): void {
    if (cols > 0) this.cols = cols;
    if (rows > 0) this.rows = rows;
    this.prevFrame = null;
    this.write(CLEAR_SCREEN);
  }

  goTo(screen: ScreenName): void {
    if (this.screen === 'lounge' && screen !== 'lounge') SOCIAL.leave(this);
    this.screen = screen;
    this.menuIndex = 0;
    this.errorMsg = '';
    this.prevFrame = null;
    this.write(CLEAR_SCREEN);
    if (screen === 'leaderboard') this.leader = db.leaderboard(10);
  }

  // ---------- input ----------
  private onData(d: Buffer): void {
    if (!this.alive) return;
    if (this.helpOpen) { this.helpOpen = false; this.prevFrame = null; return; }
    let data = d;
    // 'v' toggles the pixel renderer (octant <-> half-block) everywhere except
    // while typing a username (where 'v' is a normal character).
    if (this.screen !== 'username' && this.screen !== 'lounge' && /[vV]/.test(data.toString('latin1'))) {
      this.renderMode = this.renderMode === 'octant' ? 'half' : 'octant';
      this.prevFrame = null;
      data = Buffer.from(data.toString('latin1').replace(/[vV]/g, ''), 'latin1');
      if (data.length === 0) return;
    }
    if (this.screen === 'fight') {
      // Fight controls use their own hold/motion parser, so handle the overlay
      // key here before forwarding bytes. Any key closes help without also
      // becoming an accidental punch, kick, movement, or quit input.
      if (data.toString('latin1').includes('?')) { this.helpOpen = true; this.prevFrame = null; return; }
      this.fightInput.feed(data);
      return;
    }
    for (const key of parseKeys(data)) {
      if (this.helpOpen) { this.helpOpen = false; this.prevFrame = null; continue; }
      if (key.t === 'help') { this.helpOpen = true; this.prevFrame = null; continue; }
      if (key.t === 'quit') { this.close(); return; }
      SCREENS[this.screen].onKey(this, key);
    }
  }

  // ---------- loop ----------
  private tick(): void {
    if (!this.alive) return;
    this.frame++;
    if (this.screen === 'fight') {
      if (this.practice) this.stepPractice();
      else if (this.isStepper && this.match && this.peer && this.peer.alive) {
        stepMatch(this.match, this.fightInput.snapshot(), this.peer.fightInput.snapshot());
        if (this.fightInput.quit) return this.forfeit(this);
        if (this.peer.fightInput.quit) return this.forfeit(this.peer);
        this.checkVersusEnd();
      } else if (!this.practice && this.fightInput.quit) {
        return this.leaveFight();
      }
    } else {
      SCREENS[this.screen].tick?.(this);
    }
    // sim + input run at TICK_HZ (responsive); rendering is throttled to
    // RENDER_HZ to cut the streamed bytes without hurting input latency.
    const renderCells = clamp(this.cols || 120, 24, MAX_COLS) * clamp(this.rows || 40, 12, MAX_ROWS);
    const renderHz = renderCells > 30_000 ? 8 : renderCells > 16_000 ? 10 : renderCells > 8_000 ? 12 : MAX_RENDER_HZ;
    this.renderAccum += renderHz;
    if (this.renderAccum >= TICK_HZ) {
      this.renderAccum -= TICK_HZ;
      if (!this.outputBlocked) this.renderCurrent();
    }
  }
  private renderAccum = 0;

  renderCurrent(): void {
    const cols = clamp(this.cols || 120, 24, MAX_COLS);
    const rows = clamp(this.rows || 40, 12, MAX_ROWS);
    const f = new Frame(cols, rows, this.renderMode);
    if (this.screen === 'fight' && this.match) {
      // render the stage at the terminal's native pixel resolution — more cells
      // => more world pixels => sharper sprites (zoom out for higher fidelity).
      // The fight HUD shares the native PixelGrid renderer with the stage;
      // only the compact key legend remains terminal text for tiny displays.
      f.usePixel(composeScene(this.match, true, cols * 2, rows * 4, this.practice));
      drawFightHud(f, this.match, this.practice);
    } else {
      SCREENS[this.screen].render(this, f);
    }
    if (this.helpOpen) SCREENS.help.render(this, f);
    const nextCells = f.toCells(COLOR_STEP);
    const out = diffCells(this.prevFrame, nextCells, cols, rows, INDEXED_COLOR);
    if (out) this.write(out);
    this.prevFrame = nextCells;
  }

  // ---------- fight orchestration ----------
  startVersus(match: Match, role: 'a' | 'b', peer: Session, isStepper: boolean): void {
    this.match = match; this.role = role; this.peer = peer; this.isStepper = isStepper;
    this.practice = false; this.fightInput = new InputState();
    this.screen = 'fight'; this.prevFrame = null;
    this.write(CLEAR_SCREEN + HIDE_CURSOR + NOWRAP);
  }

  startPractice(charIdx: number): void {
    const you = characterAt(charIdx);
    const dummy = characterAt(charIdx + 1);
    const fa = makeFighter('a', you.name, 'a', you.palette);
    const fb = makeFighter('b', dummy.name, 'b', dummy.palette);
    const m = makeMatch(fa, fb);
    m.phase = 'fight'; m.phaseTimer = 0; m.message = '';
    this.match = m; this.role = 'a'; this.peer = null; this.isStepper = true;
    this.practice = true; this.fightInput = new InputState();
    this.screen = 'fight'; this.prevFrame = null;
    this.write(CLEAR_SCREEN + HIDE_CURSOR + NOWRAP);
  }

  private stepPractice(): void {
    const m = this.match!;
    stepMatch(m, this.fightInput.snapshot(), emptyInputs());
    if (this.fightInput.quit) { this.goTo('menu'); return; }
    // endless sandbox: player invincible, dummy respawns, no rounds/timer
    m.phase = 'fight'; m.phaseTimer = 0; m.message = ''; m.roundTime = 99;
    m.a.hp = 100;
    if (m.b.hp <= 0) { m.b.hp = 100; m.b.pose = 'idle'; m.b.stun = 0; m.b.attack = 'none'; m.b.attackFrame = 0; }
  }

  private checkVersusEnd(): void {
    const m = this.match!;
    if (!(m.phase === 'match-over' && m.phaseTimer <= 0)) return;
    const aWon = m.a.wins > m.b.wins;
    const winner = aWon ? m.a : m.b;
    const loser = aWon ? m.b : m.a;
    const winSess = aWon ? this : this.peer!;    // this is role 'a' stepper
    const loseSess = aWon ? this.peer! : this;
    const rating = db.recordMatch(winSess.fp, loseSess.fp, winSess.displayName, loseSess.displayName, winner.name, loser.name, winner.wins);
    if (winSess.fp) winSess.player = db.getByFingerprint(winSess.fp) ?? winSess.player;
    if (loseSess.fp) loseSess.player = db.getByFingerprint(loseSess.fp) ?? loseSess.player;
    for (const [sess, won] of [[winSess, true], [loseSess, false]] as const) {
      if (!sess.alive) continue;
      const ownRating = rating ? (won
        ? { before: rating.winnerBefore, after: rating.winnerAfter, delta: rating.delta }
        : { before: rating.loserBefore, after: rating.loserAfter, delta: -rating.delta }) : undefined;
      sess.result = { winner: winSess.displayName, loser: loseSess.displayName, youWon: won, winnerChar: winner.name, rating: ownRating };
      sess.match = null; sess.peer = null; sess.isStepper = false;
      sess.goTo('results');
    }
  }

  private forfeit(quitter: Session): void {
    const other = quitter === this ? this.peer! : this;
    if (other && other.alive && !this.practice) {
      const rating = db.recordMatch(other.fp, quitter.fp, other.displayName, quitter.displayName, 'n/a', 'n/a', 2);
      if (other.fp) other.player = db.getByFingerprint(other.fp) ?? other.player;
      other.result = {
        winner: other.displayName, loser: quitter.displayName, youWon: true, winnerChar: 'n/a',
        rating: rating ? { before: rating.winnerBefore, after: rating.winnerAfter, delta: rating.delta } : undefined,
      };
      other.match = null; other.peer = null; other.isStepper = false;
      other.goTo('results');
    }
    quitter.leaveFight();
  }

  private leaveFight(): void { this.match = null; this.peer = null; this.isStepper = false; this.goTo('menu'); }

  joinLobby(): void { ARENA.enqueue(this); }
  cancelLobby(): void { ARENA.remove(this); this.goTo('menu'); }

  enterLounge(): void {
    this.goTo('lounge');
    SOCIAL.enter(this);
  }
  loungePlayers(): Session[] { return SOCIAL.online(this); }
  loungeMessages(): readonly db.ChatMessage[] { return SOCIAL.history(); }
  sendChat(): void {
    const message = this.chatBuf.replace(/[^\x20-\x7e]/g, '').trim().slice(0, 140);
    if (!message) return;
    const now = Date.now();
    if (now - this.lastChatAt < 700) { this.loungeNotice = 'SLOW DOWN - ONE MESSAGE AT A TIME'; return; }
    this.lastChatAt = now;
    this.chatBuf = '';
    SOCIAL.send(this, message);
  }
  challengeSelected(): void {
    const players = this.loungePlayers();
    if (!players.length) { this.loungeNotice = 'NO OTHER PLAYERS IN THE LOUNGE'; return; }
    this.loungeCursor = clamp(this.loungeCursor, 0, players.length - 1);
    SOCIAL.challenge(this, players[this.loungeCursor]!);
  }
  acceptChallenge(): void { SOCIAL.accept(this); }
  declineChallenge(): void { SOCIAL.decline(this); }

  close(): void {
    if (!this.alive) return;
    this.alive = false;
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null; }
    ARENA.remove(this);
    SOCIAL.leave(this);
    // if mid versus fight, award the peer
    if (this.screen === 'fight' && !this.practice && this.peer && this.peer.alive) {
      const other = this.peer;
      const rating = db.recordMatch(other.fp, this.fp, other.displayName, this.displayName, 'n/a', 'n/a', 2);
      if (other.fp) other.player = db.getByFingerprint(other.fp) ?? other.player;
      other.result = {
        winner: other.displayName, loser: this.displayName, youWon: true, winnerChar: 'n/a',
        rating: rating ? { before: rating.winnerBefore, after: rating.winnerAfter, delta: rating.delta } : undefined,
      };
      other.match = null; other.peer = null; other.isStepper = false;
      other.goTo('results');
    }
    try { this.stream.write(SHOW_CURSOR + WRAP + RESET + '\r\n'); this.stream.end(); } catch { /* ignore */ }
  }
}

// ---------- matchmaking ----------
class Arena {
  private waiting: Session | null = null;

  enqueue(s: Session): void {
    if (this.waiting && this.waiting.alive && this.waiting !== s) {
      const a = this.waiting; this.waiting = null;
      this.pair(a, s);
    } else {
      this.waiting = s;
      s.goTo('lobbyWait');
    }
  }

  pair(a: Session, b: Session): void {
    const ca = characterAt(a.cursor);
    const cb = characterAt(b.cursor);
    const fa = makeFighter('a', ca.name, 'a', ca.palette);
    const fb = makeFighter('b', cb.name, 'b', cb.palette);
    const match = makeMatch(fa, fb);
    a.startVersus(match, 'a', b, true);
    b.startVersus(match, 'b', a, false);
  }

  remove(s: Session): void { if (this.waiting === s) this.waiting = null; }
}

export const ARENA = new Arena();

class SocialHub {
  private members = new Set<Session>();
  private messages: db.ChatMessage[] | null = null;

  enter(s: Session): void {
    this.members.add(s);
    s.loungeNotice = 'TAB SWITCHES BETWEEN CHAT AND PLAYERS';
    this.touch();
  }

  leave(s: Session): void {
    if (!this.members.delete(s) && !s.incomingChallenge && !s.outgoingChallenge) return;
    const incoming = s.incomingChallenge;
    const outgoing = s.outgoingChallenge;
    s.incomingChallenge = null; s.outgoingChallenge = null;
    if (incoming?.outgoingChallenge === s) { incoming.outgoingChallenge = null; incoming.loungeNotice = `${s.displayName} LEFT THE LOUNGE`; }
    if (outgoing?.incomingChallenge === s) { outgoing.incomingChallenge = null; outgoing.loungeNotice = `${s.displayName} CANCELLED THE CHALLENGE`; }
    this.touch();
  }

  online(viewer: Session): Session[] {
    return [...this.members]
      .filter((s) => s !== viewer && s.alive && s.screen === 'lounge')
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  history(): readonly db.ChatMessage[] {
    if (!this.messages) this.messages = db.chatHistory(100);
    return this.messages;
  }

  send(s: Session, text: string): void {
    const message = db.addChatMessage(s.displayName, text);
    const list = this.messages ?? db.chatHistory(99);
    list.push(message);
    this.messages = list.slice(-100);
    s.loungeNotice = 'MESSAGE SENT';
    this.touch();
  }

  challenge(from: Session, to: Session): void {
    if (!this.members.has(from) || !this.members.has(to) || !from.alive || !to.alive) { from.loungeNotice = 'PLAYER IS NO LONGER AVAILABLE'; return; }
    if (from.incomingChallenge || from.outgoingChallenge) { from.loungeNotice = 'FINISH YOUR CURRENT CHALLENGE FIRST'; return; }
    if (to.incomingChallenge || to.outgoingChallenge) { from.loungeNotice = `${to.displayName} IS ALREADY BUSY`; return; }
    from.outgoingChallenge = to;
    to.incomingChallenge = from;
    from.loungeNotice = `CHALLENGE SENT TO ${to.displayName}`;
    to.loungeNotice = `${from.displayName} CHALLENGED YOU`;
    from.prevFrame = null; to.prevFrame = null;
  }

  accept(to: Session): void {
    const from = to.incomingChallenge;
    if (!from || !from.alive || from.outgoingChallenge !== to || !this.members.has(from) || !this.members.has(to)) {
      to.incomingChallenge = null; to.loungeNotice = 'CHALLENGE EXPIRED'; return;
    }
    from.outgoingChallenge = null; to.incomingChallenge = null;
    this.members.delete(from); this.members.delete(to);
    this.touch();
    ARENA.pair(from, to);
  }

  decline(to: Session): void {
    const from = to.incomingChallenge;
    if (!from) { to.loungeNotice = 'NO CHALLENGE TO DECLINE'; return; }
    to.incomingChallenge = null;
    if (from.outgoingChallenge === to) from.outgoingChallenge = null;
    to.loungeNotice = `DECLINED ${from.displayName}`;
    from.loungeNotice = `${to.displayName} DECLINED YOUR CHALLENGE`;
    from.prevFrame = null; to.prevFrame = null;
  }

  private touch(): void { for (const s of this.members) s.prevFrame = null; }
}

const SOCIAL = new SocialHub();
