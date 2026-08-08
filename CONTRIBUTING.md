# Contributing

Thanks for helping make a terminal fighting game feel impossibly good.

## Local setup

```bash
pnpm install --frozen-lockfile
pnpm run keygen
pnpm test
pnpm start
```

Connect locally with `ssh -p 2223 localhost`. Use a different `SF_PORT` or `SF_DB` when another instance is already running.

## Before opening a pull request

Run:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
cd web && pnpm install --frozen-lockfile && pnpm build
```

Keep commits focused. Explain what changed, how you tested it, and whether a visual change was checked at both a common terminal size (around 120×40) and a narrow one (around 80×24).

## Design invariants

- Full 24-bit color is the default. Palette reduction must remain an explicit operator choice.
- Input and combat stay responsive even when rendering is throttled.
- Never allow a slow client to grow an unbounded frame queue.
- Every roster member owns exactly three data-defined special moves.
- A new move must have its required pose assets, help text, mechanics coverage, and asset-contract coverage.
- Generated sprites need a transparent background, consistent proportions, a stable ground line, and continuity with that fighter's anchor image.
- SQLite changes are additive. Existing player, match, and chat data must survive upgrades.
- New instrumentation belongs in the local analytics ledger first. Discord is restricted to the documented vital-event allowlist.
- Public analytics must aggregate player activity and must never expose IP addresses, connection IDs, or raw event rows.
- Webhooks and API keys never belong in source, fixtures, screenshots, or logs.

## Adding a fighter or move

1. Add the fighter metadata in `src/game/roster.ts`.
2. Define moves in `src/game/moves.ts`; avoid character-name conditionals in the engine.
3. Add all common and special frames under `assets/sprites/<NAME>/`.
4. Run `pnpm test:engine` and `pnpm test:assets`.
5. Render the selection screen, the help card, and every new attack before opening the PR.

The packed JSON files are the runtime source of truth. `assets/sprites/<NAME>/raw/idle_1.png` is the checked-in identity anchor; other raw generation intermediates stay ignored.

## Adding analytics or a profile view

Read [docs/ANALYTICS.md](docs/ANALYTICS.md) first. Prefer engine definitions for authoritative move damage/frame data and aggregated event queries for observed usage. Do not copy balance numbers into a second hand-maintained table, and do not publish raw telemetry fields.

## Reporting bugs

Include your terminal, terminal dimensions, OS, SSH client, exact keys pressed, and whether the issue reproduces in practice mode. For visual bugs, a screenshot is extremely useful.
