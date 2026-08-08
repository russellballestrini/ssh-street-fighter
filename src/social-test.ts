// Two-client E2E for the live lounge: persistent chat, player selection,
// challenge delivery/acceptance, then direct transition into a streamed fight.
process.env.SF_DB = '/tmp/sf-social-test.db';
import ssh2 from 'ssh2';
import { unlinkSync } from 'fs';

try { unlinkSync(process.env.SF_DB); } catch { /* fresh */ }
const PORT = 22997;
const { startServer } = await import('./net/ssh-server.js');
const server = startServer(PORT, '127.0.0.1', 'keys/host.key');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Client { conn: ssh2.Client; stream: any; transcript: string; bytes: number }
async function connect(handle: string): Promise<Client> {
  const client = await new Promise<Client>((resolve, reject) => {
    const conn = new ssh2.Client();
    conn.on('ready', () => conn.shell({ term: 'xterm', cols: 120, rows: 42 }, (error, stream) => {
      if (error) return reject(error);
      const c: Client = { conn, stream, transcript: '', bytes: 0 };
      stream.on('data', (data: Buffer) => { c.transcript += data.toString('utf8'); c.bytes += data.length; });
      resolve(c);
    }));
    conn.on('error', reject);
    conn.connect({ host: '127.0.0.1', port: PORT, username: handle, password: 'x', hostVerifier: () => true });
  });
  await sleep(200);
  client.stream.write(handle);
  client.stream.write('\r');
  await sleep(180);
  client.stream.write('\r'); // first menu item = lounge
  return client;
}

async function waitFor(check: () => boolean, timeout = 5000): Promise<boolean> {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (check()) return true; await sleep(50); }
  return check();
}

const alpha = await connect('ALPHA');
const bravo = await connect('BRAVO');
const loungeReady = await waitFor(() => alpha.transcript.includes('FIGHT LOUNGE') && bravo.transcript.includes('FIGHT LOUNGE'));

alpha.stream.write('hello from alpha'); alpha.stream.write('\r');
const chatDelivered = await waitFor(() => bravo.transcript.includes('hello from alpha'));

alpha.stream.write('\t'); await sleep(100); // players focus
alpha.stream.write('\r');
const challengeDelivered = await waitFor(() => bravo.transcript.includes('ALPHA CHALLENGED YOU'));
bravo.stream.write('y');
await sleep(700);
const before = alpha.bytes;
for (let i = 0; i < 18; i++) { alpha.stream.write(i % 2 ? 'w' : '\x1b[C'); bravo.stream.write(i % 3 ? 'e' : '\x1b[D'); await sleep(70); }
const fightStreamed = alpha.bytes - before > 8000;

const db = await import('./db/db.js');
const persisted = db.chatHistory(10).some((m) => m.username === 'ALPHA' && m.message === 'hello from alpha');
alpha.conn.end(); bravo.conn.end();

const checks = { loungeReady, chatDelivered, challengeDelivered, fightStreamed, persisted };
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'SOCIAL TEST: PASS' : 'SOCIAL TEST: FAIL');
await new Promise<void>((resolve) => server.close(() => resolve()));
await sleep(100);
process.exit(ok ? 0 : 1);
