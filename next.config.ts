import type { NextConfig } from 'next';

/**
 * `ZZ_GATEWAY` is the address this app's server reads the gateway at, and every page needs it:
 * a page's gate asks it who is calling before the page renders (`src/data/gateway.ts`). Where it
 * is set when Next loads this file (a laptop's `.env.local`, or verify's fake gateway), the
 * rewrite below also routes the browser's own reads to it; the image is built without it.
 *
 * DELIBERATE: the console calls `/api/console/...` as a relative path. In production Caddy
 * routes that path on the console's own host to the gateway, so the page and its API are one
 * origin and no page of this app holds anybody's credential. See `src/lib/api.ts`. A laptop has no
 * Caddy, so this rewrite does that routing locally. The browser still holds the session cookie
 * and sends it to the origin it is looking at; nothing is minted, stored or read here.
 */
const gateway = process.env.ZZ_GATEWAY;

const nextConfig: NextConfig = {
  // Standalone output so a derived app ships as a single container. No effect on
  // `next dev` / `next start`.
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // The assistant reads the product brief on every reply (`src/lib/assistant/brief.ts`), with `node:fs`, so the
  // standalone build has to be told the file belongs to that route or the image ships without it.
  outputFileTracingIncludes: { '/api/assistant': ['./docs/brief.md'] },
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
