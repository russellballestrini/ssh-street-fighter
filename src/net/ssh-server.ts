import ssh2 from 'ssh2';
import { readFileSync } from 'fs';
import type { Duplex } from 'stream';
import { Session } from './session.js';
import { fingerprintOf, verifyPubkey } from './identity.js';
import { initDb } from '../db/db.js';

const { Server } = ssh2;

export function startServer(port: number, host: string, hostKeyPath: string) {
  initDb();
  const hostKey = readFileSync(hostKeyPath);

  const server = new Server(
    {
      hostKeys: [hostKey],
      banner: 'SSH STREET FIGHTER\r\n',
      // Force zlib: drop 'none' from the compression list so every client
      // negotiates compression. Terminal ANSI compresses ~4-5x (lossless).
      algorithms: { compress: ['zlib@openssh.com', 'zlib'] },
    },
    (client) => {
      let username = 'PLAYER';
      let fingerprint: string | null = null;

      client.on('authentication', (ctx) => {
        username = (ctx.username || 'PLAYER').slice(0, 12);
        if (ctx.method === 'publickey') {
          // record identity; verify signature on the signed attempt
          const candidate = fingerprintOf(ctx.key.data);
          if (ctx.signature) {
            if (verifyPubkey(ctx)) { fingerprint = candidate; return ctx.accept(); }
            return ctx.reject();
          }
          // probe: signal the client to sign with this key
          fingerprint = candidate;
          return ctx.accept();
        }
        if (ctx.method === 'none') {
          // nudge clients to offer a key first, but allow keyless guests through
          return ctx.reject(['publickey', 'keyboard-interactive', 'password'], false);
        }
        // password / keyboard-interactive => keyless guest
        fingerprint = null;
        return ctx.accept();
      });

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept();
          let cols = 120, rows = 40;
          let sess: Session | null = null;
          session.on('pty', (a, _r, info) => { cols = info.cols || cols; rows = info.rows || rows; if (sess) sess.resize(cols, rows); a && a(); });
          session.on('window-change', (a, _r, info) => { cols = info.cols || cols; rows = info.rows || rows; if (sess) sess.resize(cols, rows); a && a(); });
          const begin = (accept2: () => unknown) => {
            const stream = accept2() as unknown as Duplex;
            sess = new Session(username, stream, fingerprint);
            sess.cols = cols; sess.rows = rows;
            sess.start();
          };
          session.on('shell', (accept2) => begin(accept2 as () => unknown));
          session.on('exec', (accept2) => begin(accept2 as () => unknown));
        });
      });

      client.on('error', () => { /* ignore transport errors */ });
    },
  );

  server.listen(port, host, () => {
    console.log(`SSH Street Fighter listening on ${host}:${port}`);
  });
  return server;
}
