// Acceptance: the CONTROLS screen is reachable from the main menu, shows the
// default layout, rejects reserved keys during capture, and applies a rebind.
const externalPort = parseInt(process.env.SF_TEST_PORT ?? '0', 10);
if (!externalPort) process.env.SF_DB = '/tmp/sf-controls-test.db';
import ssh2 from 'ssh2';
import { unlinkSync } from 'fs';

if (!externalPort) try { unlinkSync(process.env.SF_DB!); } catch { /* fresh */ }
const PORT = externalPort || 22995;
let server: import('ssh2').Server | null = null;
if (!externalPort) {
  const { startServer } = await import('./net/ssh-server.js');
  server = startServer(PORT, '127.0.0.1', 'keys/host.key');
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (check: () => boolean, timeout = 4000): Promise<boolean> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (check()) return true; await sleep(40); }
  return check();
};

let transcript = '';
// In-place updates arrive as diffed cell runs with cursor motions between
// them, so matching happens on the escape-stripped text.
const plain = (from = 0): string => transcript.slice(from).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const conn = new ssh2.Client();
const stream = await new Promise<any>((resolve, reject) => {
  conn.on('ready', () => conn.shell({ term: 'xterm', cols: 112, rows: 36 }, (error, shell) => {
    if (error) return reject(error);
    shell.on('data', (data: Buffer) => { transcript += data.toString('utf8'); });
    resolve(shell);
  }));
  conn.on('error', reject);
  conn.connect({ host: '127.0.0.1', port: PORT, username: 'controls', password: 'x', hostVerifier: () => true });
});

await sleep(200);
const handle = externalPort ? `CTL${Date.now().toString().slice(-6)}` : 'CTLTEST';
stream.write(`${handle}\r\n`);
await waitFor(() => transcript.includes('MAIN MENU'));
await sleep(180);
const menuShowsControls = transcript.includes('CONTROLS');

stream.write('ssss'); await sleep(150);   // menu: move to CONTROLS (index 4)
stream.write('\r');
const screenOpened = await waitFor(() => transcript.includes('FIGHT KEYS'));
const showsDefaults = await waitFor(() => transcript.includes('[ W ]') && transcript.includes('[ E ]') && transcript.includes('[ SPC ]'));

await sleep(180);                          // clear the post-transition CRLF guard
stream.write('\r');                        // capture a new PUNCH key
const capturePrompt = await waitFor(() => plain().includes('PRESS KEY'));
const beforeReserved = transcript.length;
stream.write('q');                         // reserved: must be refused, not quit
const reservedRejected = await waitFor(() => plain(beforeReserved).includes('Q IS RESERVED'));
stream.write('j');
const rebound = await waitFor(() => plain().includes('[ J ]'));

const beforeExit = transcript.length;
stream.write('\x1b');
const backToMenu = await waitFor(() => plain(beforeExit).includes('MAIN MENU'));

conn.end();
server?.close();
const checks = { menuShowsControls, screenOpened, showsDefaults, capturePrompt, reservedRejected, rebound, backToMenu };
for (const [name, passed] of Object.entries(checks)) console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'CONTROLS TEST: PASS' : 'CONTROLS TEST: FAIL');
process.exit(ok ? 0 : 1);
