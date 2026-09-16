import type { NextConfig } from 'next';

/**
 * LOCAL DEVELOPMENT ONLY, and opt-in: nothing here changes unless `ZZ_GATEWAY` is set.
 *
 * The console calls `/api/console/...` as a RELATIVE path on purpose — in production Caddy
 * routes that path on the console's own host to the gateway, so the page and its API are
 * one origin and this app never holds anybody's credential. See `src/lib/api.ts`.
 *
 * On a laptop there is no Caddy, so every call 404s against `next dev` and the console
 * cannot be looked at. This rewrite puts a gateway behind that path locally — the same
 * routing Caddy does, in the one place a laptop has to do it. The browser still holds the
 * session cookie and still sends it to the origin it is looking at; nothing is minted,
 * stored or read here.
 *
 * Point it at a gateway with `ZZ_GATEWAY=https://…` in `.env.local`. Unset, the rewrite
 * does not exist and a local call fails exactly as it did before.
 */
const gateway = process.env.ZZ_GATEWAY;

const nextConfig: NextConfig = {
  // Standalone output so a derived app ships as a single container without
  // extra config. Harmless for `next dev` / `next start`.
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
