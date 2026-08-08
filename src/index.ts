import { existsSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './net/ssh-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PORT = parseInt(process.env.SF_PORT ?? '2223', 10);
const HOST = process.env.SF_HOST ?? '0.0.0.0';
const HOST_KEY = resolve(ROOT, 'keys/host.key');

function ensureHostKey(): void {
  if (existsSync(HOST_KEY)) return;
  mkdirSync(dirname(HOST_KEY), { recursive: true });
  console.log('Generating SSH host key...');
  execFileSync('ssh-keygen', ['-t', 'ed25519', '-f', HOST_KEY, '-N', '', '-q']);
}

ensureHostKey();
startServer(PORT, HOST, HOST_KEY);
