import { dirname } from 'path';
import { fileURLToPath } from 'url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // native modules must not be bundled
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  typescript: { ignoreBuildErrors: false },
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
};
export default nextConfig;
