import sharp from 'sharp';
import { loadPacked } from '@/lib/sprites';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ char: string; pose: string }> }) {
  const { char, pose } = await params;
  const name = pose.replace(/\.png$/, '');
  const s = loadPacked(char, name);
  if (!s) return new Response('not found', { status: 404 });
  const rgba = Buffer.from(s.data, 'base64');
  const png = await sharp(rgba, { raw: { width: s.w, height: s.h, channels: 4 } }).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
}
