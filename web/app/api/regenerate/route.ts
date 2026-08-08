import { spawn } from 'child_process';
import { setStatus } from '@/lib/db';
import { listChars, listPoses } from '@/lib/sprites';
import { SF_ROOT, TSX_CLI, GEN_TOOL, ADMIN_TOKEN } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = req.headers.get('x-admin-token') ?? '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return new Response('unauthorized', { status: 403 });
  if (!process.env.OPENAI_API_KEY) return new Response('OPENAI_API_KEY not set on server', { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { char?: string; pose?: string };
  const char = String(body.char ?? '').toUpperCase();
  const pose = String(body.pose ?? '');
  if (!listChars().includes(char) || !listPoses(char).includes(pose)) {
    return new Response('unknown sprite', { status: 400 });
  }

  setStatus(char, pose, 'generating');
  const child = spawn(process.execPath, [TSX_CLI, GEN_TOOL, 'REGEN', char, pose], {
    cwd: SF_ROOT,
    env: { ...process.env, SF_IMG_QUALITY: 'high', SF_IMG_MODEL: 'gpt-image-2' },
    stdio: 'ignore',
  });
  child.on('exit', (code) => setStatus(char, pose, code === 0 ? 'ok' : 'error', code === 0 ? null : `gen exited ${code}`));
  child.on('error', (e) => setStatus(char, pose, 'error', e.message));

  return Response.json({ status: 'generating' });
}
