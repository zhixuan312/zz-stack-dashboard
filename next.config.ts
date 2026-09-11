import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output so a derived app ships as a single container without
  // extra config. Harmless for `next dev` / `next start`.
  output: 'standalone',
};

export default nextConfig;
