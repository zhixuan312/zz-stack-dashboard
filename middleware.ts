import { NextResponse, type NextRequest } from 'next/server';

/**
 * THE LAPTOP'S SESSION, AND NOTHING ELSE. Dev-only, opt-in, and inert without both keys.
 *
 * `next.config.ts` already routes `/api/console/*` and `/auth/*` to a gateway on a laptop —
 * the job Caddy does in production. What it cannot do is add a header, and that was the whole
 * gap: a rewrite puts the call in front of the gateway and the gateway then asks who is
 * calling. In production the browser answers with the `zz_console` cookie it holds for the
 * console's own origin. On `localhost` there is no such cookie and no way to obtain one,
 * because sign-in is a passkey and a passkey is bound to the RP ID it was registered against.
 * `https://165-232-169-165.nip.io` is not `http://localhost:3000`, so the ceremony is refused
 * by the browser before the gateway ever sees it — correctly, and no flag changes it. An
 * ngrok or nip.io hostname does not help either: `passkey.ts` pins `expectedOrigin` to the
 * gateway's own origin, so a tunnel fails the same check one step later.
 *
 * The documented way round it was to copy the `zz_console` cookie out of DevTools by hand,
 * per browser profile, every time it expired. That is a manual step in front of every single
 * UI change, which is the kind of friction that ends with people not looking at their work
 * locally at all — and then shipping a release to see a layout.
 *
 * THE PLATFORM ALREADY HAD THE ANSWER AND NOBODY WIRED IT UP. `mayReadConsole()` in
 * `services/gateway/src/console/shared.ts` reads:
 *
 *     if (id.via === "session") return true;   // signed in through the browser
 *     return isSuper(id);                      // or a superadmin PAT, for scripts
 *
 * A superadmin PAT is already a first-class way into these routes. This attaches one, so the
 * laptop authenticates the way the platform says scripts do rather than by impersonating a
 * browser session.
 *
 * WHY IT IS SAFE TO HAVE IN THE TREE:
 *   - `NODE_ENV === 'production'` returns immediately. A production build cannot use this
 *     path even if someone sets the variable in the container's environment.
 *   - Without `ZZ_DEV_PAT` it does nothing at all and the cookie route still works untouched.
 *   - It reads a token from the environment and forwards it. It mints nothing, stores
 *     nothing, and writes nothing to disk — the property `src/lib/api.ts` claims for the app
 *     still holds.
 *
 * WHY IT IS NOT A BACK DOOR: the token is the caller's own credential, carrying exactly the
 * authority their principal already has. It grants nothing they could not do with `curl`.
 * Put it in `.env.local`, which is gitignored, and treat it as the live credential it is.
 */

const GATEWAY = process.env.ZZ_GATEWAY;
const DEV_PAT = process.env.ZZ_DEV_PAT;

export function middleware(req: NextRequest) {
  // THE PRODUCTION GUARD IS FIRST and is not a matcher condition, because a matcher is
  // configuration and this is a rule. Anything below it is a laptop's business only.
  if (process.env.NODE_ENV === 'production') return NextResponse.next();
  if (!GATEWAY || !DEV_PAT) return NextResponse.next();

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, GATEWAY);
  const headers = new Headers(req.headers);
  headers.set('authorization', `Bearer ${DEV_PAT}`);
  // THE COOKIE GOES, or the gateway resolves it INSTEAD of the token. Its identity adapters
  // run in order — PAT, then session — and each one REFUSES rather than falling through, so
  // a stale `zz_console` left over from an experiment would end the request with "session
  // expired" while a perfectly good token sat unread in the header beside it.
  headers.delete('cookie');
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/api/console/:path*', '/auth/:path*'],
};
