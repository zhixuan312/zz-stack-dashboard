import { NextResponse, type NextRequest } from 'next/server';

/**
 * The laptop's session, and nothing else. Dev-only, opt-in, and inert without both keys.
 *
 * `next.config.ts` routes `/api/console/*` and `/auth/*` to a gateway on a laptop, but a rewrite
 * cannot add a header — and the gateway then asks who is calling. In production the browser
 * answers with the `zz_console` cookie it holds for the console's own origin. On `localhost` there
 * is no such cookie and no way to obtain one: sign-in is a passkey, a passkey is bound to the RP
 * ID it was registered against, and `passkey.ts` pins `expectedOrigin` to the gateway's own
 * origin, so a tunnel hostname fails the same check one step later.
 *
 * `mayReadConsole()` in `services/gateway/src/console/shared.ts` already accepts a superadmin PAT
 * as a first-class way into these routes. This attaches one, so the laptop authenticates the way
 * the platform says scripts do rather than by impersonating a browser session.
 *
 * DELIBERATE: safe to have in the tree.
 *   - `NODE_ENV === 'production'` returns immediately, so a production build cannot use this path
 *     even if someone sets the variable in the container's environment.
 *   - Without `ZZ_DEV_PAT` it does nothing and the cookie route works untouched.
 *   - It reads a token from the environment and forwards it. It mints nothing, stores nothing and
 *     writes nothing to disk.
 *
 * Not a back door: the token is the caller's own credential, carrying exactly the authority their
 * principal already has. Put it in `.env.local`, which is gitignored.
 */

const GATEWAY = process.env.ZZ_GATEWAY;
const DEV_PAT = process.env.ZZ_DEV_PAT;

export function middleware(req: NextRequest) {
  // The production guard is first and is not a matcher condition, because a matcher is
  // configuration and this is a rule. Anything below it is a laptop's business only.
  if (process.env.NODE_ENV === 'production') return NextResponse.next();
  if (!GATEWAY || !DEV_PAT) return NextResponse.next();

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, GATEWAY);
  const headers = new Headers(req.headers);
  headers.set('authorization', `Bearer ${DEV_PAT}`);
  // The cookie goes, or the gateway resolves it instead of the token. Its identity adapters run
  // in order — PAT, then session — and each one refuses rather than falling through, so a stale
  // `zz_console` would end the request with "session expired" while a good token sat unread in
  // the header beside it.
  headers.delete('cookie');
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/api/console/:path*', '/auth/:path*'],
};
