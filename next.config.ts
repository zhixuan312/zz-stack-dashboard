import type { NextConfig } from 'next';

/**
 * Local development only, and opt-in: the rewrite below does not exist unless `ZZ_GATEWAY`
 * is set, via `.env.local`.
 *
 * DELIBERATE: the console calls `/api/console/...` as a relative path. In production Caddy
 * routes that path on the console's own host to the gateway, so the page and its API are one
 * origin and this app never holds anybody's credential. See `src/lib/api.ts`. A laptop has no
 * Caddy, so this rewrite does that routing locally. The browser still holds the session cookie
 * and sends it to the origin it is looking at; nothing is minted, stored or read here.
 */
const gateway = process.env.ZZ_GATEWAY;

const nextConfig: NextConfig = {
  // Standalone output so a derived app ships as a single container. No effect on
  // `next dev` / `next start`.
  output: 'standalone',
  ...(gateway
    ? {
      async rewrites() {
        return [
          { source: '/api/console/:path*', destination: `${gateway}/api/console/:path*` },
          // The passkey ceremony too, or there is no way to obtain a session at all.
          { source: '/auth/:path*', destination: `${gateway}/auth/:path*` },
        ];
      },
    }
    : {}),
};

export default nextConfig;
