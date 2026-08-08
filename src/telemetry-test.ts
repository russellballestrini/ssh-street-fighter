process.env.SF_TELEMETRY_ALLOW_HTTP = '1';

import { createServer } from 'http';

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

const { actorRef, flushTelemetry, track } = await import('./telemetry/discord.js');
track('ssh_connected', { player: 'ALPHA', ip: '127.0.0.1' });
track('match_won', { winner: 'ALPHA', loser: 'BRAVO', rating_delta: 16 });
const flushed = await flushTelemetry(5000);
await new Promise<void>((resolve) => server.close(() => resolve()));

const payloads = received as Array<{ embeds?: Array<{ title?: string; fields?: Array<{ name: string; value: string }> }> }>;
const checks = {
  flushed,
  delivered_both: payloads.length === 2,
  event_title: payloads[1]?.embeds?.[0]?.title === 'MATCH WON',
  fields_preserved: payloads[1]?.embeds?.[0]?.fields?.some((f) => f.name === 'winner' && f.value === 'ALPHA') === true,
  verified_identity_hashed: /^key:[a-f0-9]{12}$/.test(actorRef('SHA256:private-fingerprint', 'fallback')),
  guest_identity_labeled: actorRef(null, 'abc123') === 'guest:abc123',
};
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'TELEMETRY TEST: PASS' : 'TELEMETRY TEST: FAIL');
process.exit(ok ? 0 : 1);

