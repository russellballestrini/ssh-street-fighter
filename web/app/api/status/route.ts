import { allStatuses } from '@/lib/db';
import { listChars, listPoses, spriteMtime } from '@/lib/sprites';

export const dynamic = 'force-dynamic';

export async function GET() {
  const statusMap = new Map(allStatuses().map((s) => [`${s.char}|${s.pose}`, s]));
  const out: Record<string, { status: string; mtime: number }> = {};
  for (const char of listChars()) {
    for (const pose of listPoses(char)) {
      const key = `${char}|${pose}`;
      out[key] = { status: statusMap.get(key)?.status ?? 'ok', mtime: spriteMtime(char, pose) };
    }
  }
  return Response.json(out);
}
