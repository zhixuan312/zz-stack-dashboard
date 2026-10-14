/**
 * The server's read of the gateway: the same `/api/console/*` routes a page reads from the browser, asked by this app's
 * server as the person whose request it is.
 *
 * Every page's data is read from the browser (`src/lib/api.ts`), and this module does not change that. It exists for
 * the two things the server has to know for itself. One is who is asking, which a page's gate and the console's chrome
 * settle before anything is drawn and the assistant's route settles before a model is reached (`src/data/access.ts`).
 * The other is the assistant's tools, which look records up while the reply is being written. Both ask the gateway,
 * which is the only authority on either.
 *
 * DELIBERATE: one credential goes upstream, and only to the gateway that issued it. In a deployment that is the
 * `zz_console` session cookie the person's own request carried, named here and copied alone: no other cookie and no
 * other header of theirs is forwarded. On a laptop there is no such cookie (`proxy.ts` says why), so the same
 * `ZZ_DEV_PAT` that file attaches is used, behind the same production guard. Nothing is stored, and the address is
 * `ZZ_GATEWAY`, which only the deployment sets.
 */
import { cookies } from 'next/headers';

/** The gateway's own name for the console session (`CONSOLE_COOKIE` in services/gateway/src/identity.ts). */
const SESSION_COOKIE = 'zz_console';

/** A gateway answer that was not a 200, with the gateway's own sentence. */
export class GatewayError extends Error {
  // Declared and assigned rather than a parameter property: this repository is compiled by erasure.
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GatewayError';
  }
}

async function credential(): Promise<Record<string, string>> {
  const pat = process.env.NODE_ENV === 'production' ? undefined : process.env.ZZ_DEV_PAT;
  if (pat) return { authorization: `Bearer ${pat}` };
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  return session ? { cookie: `${SESSION_COOKIE}=${session}` } : {};
}

/**
 * One GET under `/api/console`, as the person this request belongs to.
 *
 * `scope=platform` is always asked for, and it is the gateway that answers it: `resolveScope` honours the parameter
 * only for a superadmin and otherwise answers exactly what the parameterless request would have got. So this reads
 * the widest thing the caller may read, a superadmin every team and a member their own, without this app deciding
 * which of the two the caller is.
 *
 * Two reads are the caller's own whatever they hold, and take no scope: `/me`, which is who they are, and `/search`,
 * which the platform runs as the team they act for. The gateway refuses a search asked for under the platform's name
 * rather than answering one team's as the fleet's.
 */
export async function gatewayGet<T>(path: string): Promise<T> {
  // DELIBERATE: the request before the address. `next build` prerenders with no request and no gateway address (the
  // image is built without one); reading the cookies is what leaves a gated page to request time, and refusing for the
  // address first failed the build on every page. tests/gateway-read.test.ts holds the order.
  const asCaller = await credential();
  const base = process.env.ZZ_GATEWAY?.replace(/\/+$/, '');
  if (!base) throw new GatewayError(503, 'This console has no gateway address to read from.');
  const own = path === '/me' || path === '/search' || path.startsWith('/search?');
  const scoped = own ? path : `${path}${path.includes('?') ? '&' : '?'}scope=platform`;
  const res = await fetch(`${base}/api/console${scoped}`, { headers: { accept: 'application/json', ...asCaller }, cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new GatewayError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
