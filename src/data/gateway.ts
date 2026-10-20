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
import type { Revisions } from '@/lib/live';
import { READ_BOUND_MS } from '@/views/context';

/** The gateway's own name for the console session (`CONSOLE_COOKIE` in services/gateway/src/identity.ts). */
const SESSION_COOKIE = 'zz_console';

/**
 * The header a console read's revision travels in: `<collection>:<boot>:<n>`, the collection the gateway keeps the read
 * under and its revision for this caller, sampled before the read ran. COUPLED: `REVISION_HEADER` in zz-stack's
 * services/gateway/src/console/live-revision.ts, the fake gateway's `scripts/fake-gateway/live.ts`, and the browser's
 * reading of it in `src/lib/api.ts`.
 */
const REVISION_HEADER = 'x-zz-revision';
const REVISED = /^([A-Za-z0-9_-]+):([A-Za-z0-9_-]+:\d+)$/;

/** A read's revision header as the revisions `useLive` takes, or none for a read that carried none, a test's stand-in
 *  for a response with no headers at all among them. */
const revisionsIn = (res: Response): Revisions | undefined => {
  const m = REVISED.exec(res.headers?.get(REVISION_HEADER) ?? '');
  return m ? { [m[1]!]: m[2]! } : undefined;
};

/**
 * The revisions each answer `gatewayGet` returned was read at, by the answer itself: kept beside it rather than in it,
 * so no answer's shape changes and every caller that reads only the answer reads exactly what it did.
 */
const read = new WeakMap<object, Revisions>();

/** The revisions the gateway answered `answer` at, for the `useLive` of the page it is drawn on; none for an answer
 *  that carried none, or one `gatewayGet` did not read. */
export const answeredAt = (answer: unknown): Revisions | undefined =>
  (answer !== null && typeof answer === 'object' ? read.get(answer) : undefined);

/**
 * A page's server read with the revisions it was answered at, which the page hands its `useLive` so the tab's first
 * stream asks whether anything moved since rather than reading it all again. None when any read behind it carried none,
 * a read that failed or never answered among them: the stream then resyncs what the page follows, as it always did.
 */
export type Revised<R> = R & { revisions?: Revisions };

/**
 * The revisions of every read a page was served, as one: for each collection the oldest any read was answered at, so
 * a change after the earliest of them still moves it. None when any read carried none; a collection whose reads name
 * two boots is left out, and the stream resyncs it.
 */
export function revisionsOf(...reads: (Revisions | undefined)[]): Revisions | undefined {
  if (reads.length === 0 || reads.some((r) => r === undefined)) return undefined;
  const at = new Map<string, { boot: string; n: number } | null>();
  for (const [name, revision] of reads.flatMap((r) => Object.entries(r!))) {
    const [boot, n] = [revision.slice(0, revision.lastIndexOf(':')), Number(revision.slice(revision.lastIndexOf(':') + 1))];
    const held = at.get(name);
    at.set(name, held === undefined ? { boot, n } : held === null || held.boot !== boot ? null : { boot, n: Math.min(held.n, n) });
  }
  const out = Object.fromEntries([...at].flatMap(([name, r]) => (r ? [[name, `${r.boot}:${r.n}`]] : [])));
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A gateway answer that was not a 200, with the gateway's own sentence and the revision the refusal was read at. */
export class GatewayError extends Error {
  // Declared and assigned rather than a parameter property: this repository is compiled by erasure.
  readonly status: number;
  readonly revisions: Revisions | undefined;
  constructor(status: number, message: string, revisions?: Revisions) {
    super(message);
    this.status = status;
    this.revisions = revisions;
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
 *
 * `/me` is bounded by `READ_BOUND_MS` (src/views/context.ts), the bound every read of the console's keeps: unanswered by
 * then, it is a 504 with a sentence that says so, which `gate` throws as the outage it is, so a gateway that takes the
 * request and never answers draws the console's error page instead of holding every page on its gate. The page reads
 * race the same bound into their own states, so this bounds `/me` alone.
 *
 * The revision the gateway answered the read at is kept for `answeredAt`, and a refusal carries its own on the
 * `GatewayError`, since a refusal is an answer a page draws too.
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
  const abort = new AbortController();
  const timer = path === '/me' ? setTimeout(() => abort.abort(), READ_BOUND_MS) : undefined;
  try {
    const res = await fetch(`${base}/api/console${scoped}`, { headers: { accept: 'application/json', ...asCaller }, cache: 'no-store', signal: abort.signal });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new GatewayError(res.status, body?.error ?? `HTTP ${res.status}`, revisionsIn(res));
    }
    const answer = (await res.json()) as T;
    const revisions = revisionsIn(res);
    if (revisions && answer !== null && typeof answer === 'object') read.set(answer, revisions);
    return answer;
  } catch (error) {
    if (abort.signal.aborted) throw new GatewayError(504, 'The platform did not answer in time, so who is signed in could not be read.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
