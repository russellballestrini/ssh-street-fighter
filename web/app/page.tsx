import { listChars, listPoses, spriteMtime } from '@/lib/sprites';
import { ADMIN_TOKEN } from '@/lib/paths';
import Gallery from './Gallery';

export const dynamic = 'force-dynamic';

export default function Page() {
  const chars = listChars().map((id) => ({
    id,
    poses: listPoses(id).map((name) => ({ name, mtime: spriteMtime(id, name) })),
  }));
  return <Gallery chars={chars} adminEnabled={ADMIN_TOKEN.length > 0} />;
}
