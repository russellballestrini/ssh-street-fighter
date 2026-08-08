# Architecture

SSH Street Fighter treats the terminal as a thin display and input device. One Node.js process owns SSH transport, sessions, matchmaking, simulation, and frame production.

```text
OpenSSH client
   │ keys + terminal resize + input bytes
   ▼
ssh2 server ──► Session ──► screen / Arena / SocialHub
                   │                  │
                   │                  ├── SQLite: identity, ELO, matches, chat
                   │                  └── optional Discord event queue
                   ▼
             30 Hz combat engine
                   │ shared Match state
                   ▼
       stage + sprites + motifs + pixel HUD
                   │
                   ▼
      RGB PixelGrid → terminal cells → ANSI diff
                   │ zlib + backpressure
                   ▼
              OpenSSH client
```

## Rendering

The scene is composed into an RGB pixel grid. A terminal cell represents a pair of vertical color regions in half-block mode, giving two addressable pixels per cell with independent foreground and background colors. The renderer then compares the new terminal-cell array with the previous frame and emits cursor moves plus only the SGR channels that changed.

The fight world and HUD share this renderer. Menus use a text-cell layer with the same color model, so overlays remain crisp at terminal-native resolution.

The server preserves 24-bit values by default. `SF_COLOR_STEP` and `SF_COLOR_MODE=256` exist only as explicit compatibility controls.

## Timing and backpressure

- Input parsing and deterministic combat advance at 30 Hz.
- Visual output is capped at 15 Hz, then reduced for very large terminal areas.
- Stage motifs animate at 7.5 Hz.
- Scene and sprite scaling use bounded caches.
- A failed stream write marks the session output-blocked. Intermediate obsolete frames are discarded until `drain`, preventing slow clients from accumulating an unbounded animation history.
- Terminal dimensions are capped at 300×120 for render work. The client may request a larger PTY, but the game never allocates beyond that safety boundary.

## Combat and moves

Combat is deterministic shared state. For a versus match, one session advances a `Match`; both sessions render the same object and contribute separate input snapshots. A motion buffer converts packet-safe direction histories into relative direction codes. Move ownership and presentation live in `game/moves.ts`, which keeps special attacks data-driven.

## Identity and ratings

Public-key authentication verifies the supplied signature, then hashes the key into a stable fingerprint used by SQLite. Password or keyboard-interactive connections are deliberately treated as anonymous guests. Only matches between two distinct verified identities change ELO, preventing rating farming with disposable guests.

Schema upgrades are additive at startup. The game never needs a separate migration command for existing installations.

## Social layer

The in-process `SocialHub` owns lounge presence and direct challenge state. Chat history is durable in SQLite; presence and pending challenges are intentionally ephemeral. Challenges can be accepted, declined, or cancelled; acceptance removes both players from the lounge and pairs them directly through the same `Arena` path used by matchmaking.
