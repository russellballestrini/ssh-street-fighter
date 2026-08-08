process.env.SF_TELEMETRY_ALLOW_HTTP = '1';
process.env.SF_DB = '/tmp/sf-telemetry-test.db';
delete process.env.SF_DISCORD_EVENTS;

import { createServer } from 'http';
import { unlinkSync } from 'fs';

const received: unknown[] = [];
const server = createServer((req, res) => {
  const parts: Buffer[] = [];
  req.on('data', (part: Buffer) => parts.push(part));
  req.on('end', () => {
    received.push(JSON.parse(Buffer.concat(parts).toString('utf8')));
    res.writeHead(204); res.end();
  });
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('test server did not bind');
process.env.SF_DISCORD_WEBHOOK = `http://127.0.0.1:${address.port}/api/webhooks/test`;

try { unlinkSync(process.env.SF_DB); } catch { /* fresh */ }
const db = await import('./db/db.js');
db.initDb();
const { actorRef, flushTelemetry, track } = await import('./telemetry/discord.js');

// Vital events reach Discord; routine gameplay noise stays in the events table.
track('chat_message', { player: 'ALPHA', message: 'good fight' });
track('match_started', { player_a: 'ALPHA', player_b: 'BRAVO' });
track('special_move_used', { player: 'ALPHA', move: 'HADOUKEN' });
track('renderer_changed', { mode: 'octant' });
track('terminal_resized', { cols: 120, rows: 40 });
const flushed = await flushTelemetry(5000);

// SF_DISCORD_EVENTS overrides the built-in vital list.
process.env.SF_DISCORD_EVENTS = 'special_move_used';
track('special_move_used', { player: 'BRAVO', move: 'FLASH KICK' });
track('chat_message', { player: 'BRAVO', message: 'not vital under override' });
const flushedOverride = await flushTelemetry(5000);
delete process.env.SF_DISCORD_EVENTS;

await new Promise<void>((resolve) => server.close(() => resolve()));

const payloads = received as Array<{ embeds?: Array<{ title?: string; fields?: Array<{ name: string; value: string }> }> }>;
const titles = payloads.map((p) => p.embeds?.[0]?.title);
const stored = db.recentEvents(20);
const checks = {
  flushed: flushed && flushedOverride,
  vital_delivered: titles[0] === 'CHAT MESSAGE' && titles[1] === 'MATCH STARTED',
  noise_filtered: payloads.length === 3 && !titles.includes('RENDERER CHANGED') && !titles.includes('TERMINAL RESIZED'),
  override_respected: titles[2] === 'SPECIAL MOVE USED',
  fields_preserved: payloads[0]?.embeds?.[0]?.fields?.some((f) => f.name === 'player' && f.value === 'ALPHA') === true,
  all_events_stored: stored.length === 7 && stored.some((e) => e.event === 'renderer_changed'),
  stored_fields_json: JSON.parse(stored.find((e) => e.event === 'terminal_resized')?.fields ?? '{}').cols === 120,
  verified_identity_hashed: /^key:[a-f0-9]{12}$/.test(actorRef('SHA256:private-fingerprint', 'fallback')),
  guest_identity_labeled: actorRef(null, 'abc123') === 'guest:abc123',
};
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'TELEMETRY TEST: PASS' : 'TELEMETRY TEST: FAIL');
process.exit(ok ? 0 : 1);
