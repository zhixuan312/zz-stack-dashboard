import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two things, on two kinds of request. Every page request is told its own address (`page`, at the foot of this file),
 * in every build. The rest of this comment is about the other: a request for one of the gateway's own paths.
 *
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

/**
 * What a document route will read, hinted from the response headers before a line of script runs.
 *
 * `useConsole` writes this same hint into the HTML when it renders on the server (`src/lib/api.ts`, `preload`), and
 * that is what makes `GET /api/console/me` answer in 345 ms on a mid-range phone on Slow 4G while a document read
 * answers at 2,361 ms. A route with an unknown dynamic param cannot render its page on the server at all — `AppShell`
 * calls `usePathname` at its top, so the boundary above it is postponed and the prerendered HTML holds only
 * `ShellPending` — and a hint can only be written by something that renders. So the read waits for the route's own JS,
 * and the reader waits behind it: measured on `/initiatives/<team>/<slug>/<document>` at 390px, FCP 2,140 ms, the read
 * answered 2,361 ms, and the document's first line — the largest contentful paint — painted at 3,060 ms against a
 * floor of 2,500 ms.
 *
 * A proxy runs on the request itself and its path is in the request line: this is the one place the route is known
 * before the app renders. Nothing here reads, writes or authorizes anything; it says what the page is about to ask
 * for so the browser can start asking while it parses the HTML.
 *
 * The URL has to match what `withScope` will build exactly, or the browser fetches twice and the hint buys nothing.
 * The console's mode starts at `platform` while `/me` is in flight and is never part of a query key, so the first read
 * a page makes is the scoped one; that is the URL written here.
 *
 * DELIBERATE: written in every build, production included, as a page's own address is (`page` below) — unlike the
 * rewrite at the foot of this file, which is a laptop's.
 */
const DOCUMENT = /^\/initiatives\/([^/]+)\/([^/]+)\/(.+)$/;

/** The hint for this path, or null when the route is not one a document is read on. */
function documentHint(pathname: string): string | null {
  const found = DOCUMENT.exec(pathname);
  if (!found) return null;
  const [, team, slug, path] = found;
  // `crossorigin=anonymous` as `preload` sets it: on a same-origin URL the credentials mode stays `same-origin`, so the
  // session cookie goes with the hint exactly as it goes with the fetch that will reuse the response.
  return `</api/console/document/${team}/${slug}/${path}?scope=platform>; rel=preload; as=fetch; crossorigin=anonymous`;
}

/** Adds the hint to a response that is going to be a page. */
function hint(res: NextResponse, pathname: string): NextResponse {
  const value = documentHint(pathname);
  if (value) res.headers.append('Link', value);
  return res;
}

/** The gateway's own paths, which a laptop routes to it. Everything else this file matches is a page. */
const GATEWAY_PATH = /^\/(api\/console|auth)(\/|$)/;

// COUPLED: `gate` in `src/data/access.ts` reads this header to send a signed-out person back where they were going.
const PATH_HEADER = 'x-zz-path';

/**
 * A page request, told its own address. A Server Component is not given the request, so the gate cannot know what was
 * asked for unless it is written here: the path and its query, on the headers the app is handed, over whatever the
 * browser sent under that name. Nothing else about the request changes, and it is never sent anywhere but the app.
 */
function page(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname + search);
  return hint(NextResponse.next({ request: { headers } }), pathname);
}

/**
 * A last segment that is a file's name: `favicon.ico`, `b.webp`, `teams.json`, `backup.7z`. An extension holds a letter,
 * so a release's version (`0.97.0`, `0.98.0-rc.1`), whose last dot is followed by digits alone, is not one.
 */
const FILE_NAME = /\.(?=[a-z0-9]{1,8}$)[0-9]*[a-z][a-z0-9]*$/i;

/** The two routes whose address ends in a file's name: a document, and a knowledge node (`spec.md`, `nodes/0002-….md`). */
const NAMES_A_FILE = /^\/(initiatives\/[^/]+\/[^/]+|knowledge\/[^/]+)\/.+$/;

/**
 * An address ending in a file's name that neither of those routes takes is never a console page: a bare 404, answered
 * here because this is the one place before the app renders. With Cache Components a page streams its shell as a 200
 * before it can call `notFound()`, so without this a missing `/favicon.ico` was a 200 page in the shell, with a `/me`
 * read, from the catch-all (`app/(dash)/[...missing]/page.tsx`). It says nothing about which pages exist: no page has
 * an address like it. The files under `public/` are outside the matcher, so a real one never reaches this.
 */
function notAPage(pathname: string): boolean {
  return FILE_NAME.test(pathname.slice(pathname.lastIndexOf('/') + 1)) && !NAMES_A_FILE.test(pathname);
}

export function proxy(req: NextRequest) {
  // A page first, in every build, and never past this line: what follows sends a request to the gateway.
  if (!GATEWAY_PATH.test(req.nextUrl.pathname)) {
    return notAPage(req.nextUrl.pathname) ? new NextResponse(null, { status: 404 }) : page(req);
  }

  // The production guard comes before anything a laptop does and is not a matcher condition, because
  // a matcher is configuration and this is a rule. Anything below it is a laptop's business only.
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
  // Every page, and the gateway's own paths for the laptop's rewrite. Not Next's internals or the files under
  // `public/`: nothing here has anything to say about a script, a stylesheet or an image.
  matcher: ['/((?!_next/|assets/|icon\\.png|apple-icon\\.png).*)'],
};
