/**
 * Who the current request is and what they may do: the one place a page, the console's chrome, the assistant's route,
 * its tools and a view tool ask.
 *
 * This is the console's policy, in Meridian's shape (`current`, `bind`, `allows`, `name`, then `gate` and
 * `chromeAccess`). The gateway is the authority on who is asking, so every answer starts from one gateway read made as
 * the person themselves, `GET /api/console/me` (`src/data/gateway.ts`), and what that person holds is read off the role
 * table (`src/data/roles.ts`):
 *
 * - `/me` is placed before it is believed (`ask`). No session is nobody. A session the console is refused, a body whose
 *   role the table does not have or whose `role` and `superadmin` disagree, and a member said to act for a team they
 *   are not in, is somebody refused: never a member's access and never a superadmin's. Who is refused is told why by a
 *   code (`app/login/refusals.ts`), never by a sentence the sign-in page would repeat. A gateway that is down, or has
 *   no address, is an outage and is thrown.
 * - Every check one request makes shares one read (`identity`): a page's, the chrome's and a view tool's through React's
 *   `cache`, which keeps the answer for the render it is called in, and the assistant's route, its policy and the tools
 *   its answer runs included, through `askedOnce`, which keeps it for the route's own work, however late that runs. Two
 *   requests never share an answer, and a role change, a team switch or a sign-out takes effect at the next request,
 *   the assistant's next message among them. Outside both, every check asks.
 * - `bind` returns the collection as it is. A collection's figures are a gateway read made with the caller's own
 *   credential, so the gateway has already applied the predicate: a member's read comes back as their team's and the
 *   platform's public figures, a superadmin's as every team's, and a read only the superadmin may make, as Teams and
 *   People are, refuses anyone else. There is no second, wider copy for a scope to be bound away from.
 *
 * None of this widens a read: the gateway refuses what the person may not read whatever this says.
 *
 * `authorizationKey` changes whenever what the scope may see changes: the person, their role, the team they act for
 * and their memberships.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache, type JSX } from 'react';
import { nav, refusal } from '@/app.config';
import { collections } from '@/data/collections';
import { FEATURES, type FeatureId } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import { MAIN_ROLES, effective, type ConsoleNeed, type MainRole } from '@/data/roles';
import type { Me } from '@/lib/api-shapes';
import type { AnyCollection, ChromeAccess } from '@/lib/collection';
import { ownPath } from '@/lib/own-path';
import { MISSING_METADATA } from '@/views/missing';
import { NoAccess } from '@/views/no-access';
import type { RefusalCode } from '../../app/login/refusals';

export type AccessScope = Readonly<{
  tenantId: string;
  subjectId: string;
  authorizationKey: string;
}>;

type Operation = 'read' | 'create' | 'update' | 'remove';

type Policy = {
  /** The current request's scope, or null when no session can be established. */
  current: () => Promise<AccessScope | null>;
  /** The scope's own collection by name, or undefined when there is none. */
  bind: (scope: AccessScope, name: string) => AnyCollection | undefined;
  /** What the scope may do with a collection; `ids` are the records an update or a removal touches. */
  allows: (scope: AccessScope, name: string, op: Operation, ids?: string[]) => Promise<boolean>;
  /** The person's name, for a record of what an agent did for them; kept out of the scope, which keys the cache. */
  name?: (scope: AccessScope) => Promise<string | null>;
};

export class Unauthenticated extends Error {
  constructor() {
    super('Sign in to continue.');
    this.name = 'Unauthenticated';
  }
}

/** One message for a collection that does not exist and one the scope may not use, so neither is disclosed. */
export class AccessDenied extends Error {
  constructor() {
    super('You do not have access to that.');
    this.name = 'AccessDenied';
  }
}

/** Who `/me` named: nobody, somebody the console is refused (with the code that says why), or a person on the role table. */
type Identity =
  | { is: 'nobody' }
  | { is: 'refused'; reason: RefusalCode }
  | { is: 'person'; me: Me; role: MainRole };

/**
 * One read of `/me`, placed. No session (401) is nobody. A session the platform refuses (403) is `refused`, one it
 * lets in that the console does not answer (a 200 that does not say `mayRead: true`) is `door`, and a body the role
 * table cannot place, or a member said to act for a team they are not in, is `unplaced`. Anything else, a gateway that
 * is down among them, is an outage and is thrown: counted as "not signed in" it would tell a signed-in person to sign
 * in again.
 */
async function ask(): Promise<Identity> {
  let me: Partial<Me>;
  try {
    me = (await gatewayGet<Partial<Me> | null>('/me')) ?? {};
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) return { is: 'nobody' };
    if (error instanceof GatewayError && error.status === 403) return { is: 'refused', reason: 'refused' };
    throw error;
  }
  if (me.mayRead !== true) return { is: 'refused', reason: 'door' };
  // The platform names its two roles in lower case and says the same thing a second time in `superadmin`: both have to
  // agree, on a role the table has, before either is believed.
  const role = MAIN_ROLES.find((r) => r.toLowerCase() === me.role);
  if (!role || me.superadmin !== (role === 'Superadmin') || typeof me.email !== 'string' || !me.email || !Array.isArray(me.teams)) {
    return { is: 'refused', reason: 'unplaced' };
  }
  // The team they act for, when they act for one, is one they are in; a superadmin may act for any team (FR-2).
  const acting = me.activeTeam ?? null;
  if (acting !== null && (typeof acting !== 'string' || (role !== 'Superadmin' && !me.teams.some((t) => t?.slug === acting)))) {
    return { is: 'refused', reason: 'unplaced' };
  }
  return { is: 'person', me: me as Me, role };
}

/** The assistant route's one read, held for everything its work asks, however late (`askedOnce`). */
const asked = new AsyncLocalStorage<{ who?: Promise<Identity> }>();

/** `ask`, once for the page render it is called in: React keeps the answer for that render and no longer. */
const rendered = cache(ask);

/** `ask`, once for the request it is called in: the route's when `askedOnce` holds one, the render's otherwise. */
function identity(): Promise<Identity> {
  const held = asked.getStore();
  if (!held) return rendered();
  held.who ??= ask();
  return held.who;
}

/**
 * Runs a route handler's work as one request: every check inside it, the tools of a streamed answer included, shares
 * one read of `/me`. React's `cache` keeps nothing in a route handler, where no page is rendered, so the route asks
 * for this itself.
 */
export function askedOnce<T>(work: () => Promise<T>): Promise<T> {
  return asked.run({}, work);
}

function scopeOf({ me, role }: { me: Me; role: MainRole }): AccessScope {
  // The team the person acts for. A superadmin in no team acts for none, and the empty string is no team's slug.
  const tenantId = me.activeTeam ?? '';
  const teams = me.teams.map((t) => `${t.slug}=${t.role}`).sort().join('+');
  return { tenantId, subjectId: me.email, authorizationKey: `${tenantId}:${me.email}:${role}:${teams}` };
}

/** Whether a role satisfies a need: `public` is anyone the console lets in, a grant is asked of the role table, an `allOf` of every grant. */
function satisfies(role: MainRole, need: ConsoleNeed): boolean {
  if (need === 'public') return true;
  const grants = effective(role);
  return typeof need === 'string' ? grants.has(need) : need.allOf.every((grant) => grants.has(grant));
}

/** What reading each collection needs: the grant of the page that shows its figures (`src/data/prepared.ts`). */
const COLLECTION_NEEDS: Record<string, ConsoleNeed> = Object.fromEntries(PREPARED.map((r) => [r.name, r.needs]));

function accessFrom(policy: Policy) {
  async function resolveAccess(): Promise<AccessScope> {
    const scope = await policy.current();
    if (!scope) throw new Unauthenticated();
    return scope;
  }
  function collectionFor(scope: AccessScope, name: string): AnyCollection {
    const c = policy.bind(scope, name);
    if (!c) throw new AccessDenied();
    return c;
  }
  async function can(scope: AccessScope, name: string, op: Operation, ids?: string[]): Promise<boolean> {
    return policy.bind(scope, name) !== undefined && policy.allows(scope, name, op, ids);
  }
  /** The person's name for a record of what an agent did for them, or null when the policy does not say. */
  async function nameOf(scope: AccessScope): Promise<string | null> {
    return (await policy.name?.(scope)) ?? null;
  }
  return { resolveAccess, collectionFor, can, nameOf };
}

export const { resolveAccess, collectionFor, can, nameOf } = accessFrom({
  current: async () => {
    const who = await identity();
    return who.is === 'person' ? scopeOf(who) : null;
  },
  bind: (_scope, name) => collections.find((c) => c.name === name),
  allows: async (scope, name, op) => {
    const who = await identity();
    // The same person, still acting for the same thing: a session that changed hands since the scope was resolved
    // is allowed nothing.
    if (who.is !== 'person' || scopeOf(who).authorizationKey !== scope.authorizationKey) return false;
    const need = COLLECTION_NEEDS[name];
    // Read, and nothing else: no collection takes a change from an agent, so no grant permits one here.
    return op === 'read' && need !== undefined && satisfies(who.role, need);
  },
  name: async () => {
    const who = await identity();
    return who.is === 'person' ? who.me.name : null;
  },
});

/**
 * What the current request may do, asked the one way a page, a control, a view tool and the route ask it. Rejects
 * `Unauthenticated` when nobody the role table can place is asking, which is the caller's to catch: this answers about
 * a person, not for one. A page does not catch it; it opens with `gate`.
 */
export async function may(need: ConsoleNeed): Promise<boolean> {
  const who = await identity();
  if (who.is !== 'person') throw new Unauthenticated();
  return satisfies(who.role, need);
}

/** What a view tool calls before it reads: `may` asked one way, refused as the one `AccessDenied` message. */
export async function requireNeed(need: ConsoleNeed): Promise<void> {
  if (!(await may(need))) throw new AccessDenied();
}

// COUPLED: `proxy.ts` writes this header on every page request, over whatever the browser sent. The two move together.
const PATH_HEADER = 'x-zz-path';

/** Where sign-in sends the person back to: the address this request asked for, when `proxy.ts` said it and it is this site's. */
async function signIn(): Promise<string> {
  const asked = (await headers()).get(PATH_HEADER);
  return asked !== null && ownPath(asked) ? `/login?next=${encodeURIComponent(asked)}` : '/login';
}

/**
 * The one page gate, called as every page's first statement so the check is what stops the read, never the rail:
 * `chromeAccess().only` hides a destination but forbids nothing.
 *
 * A request with no session is sent to sign in, with the address it asked for. A session the console is refused, or
 * one the role table cannot place, is sent to the sign-in page's denied state with the code that says why, which the
 * page shows as its own fixed sentence: never words the address could carry. A person
 * who lacks the feature's grant gets the product's `refusal` as a normal 200 answer (`NoAccess`): under `absent` the
 * missing page, exactly what an address that names nothing draws, and under `explain` the page's title and who can open
 * it. It is awaited because the view is an async server component and a page hands a renderer an element, not a
 * promise. Neither throws `notFound()`. `null` means the feature is held and the page may render. An outage is thrown:
 * nothing is opened on an answer the gateway did not give.
 */
export async function gate(feature: FeatureId): Promise<JSX.Element | null> {
  const who = await identity();
  if (who.is === 'nobody') redirect(await signIn());
  if (who.is === 'refused') redirect(`/login?denied=1&reason=${who.reason}`);
  if (!satisfies(who.role, FEATURES[feature].needs)) return await NoAccess({ feature });
  return null;
}

/**
 * The title a gated page carries, called from its `generateMetadata` so the tab agrees with what `gate` answers: under
 * `refusal: 'absent'` a person the role table places who lacks the feature's grant gets the missing page's title, kept
 * out of search, and anyone else the page's own. Under `explain` the page's own title is the answer for everyone, as the
 * no-access view names the page anyway, and nobody is read. Nobody, or a session the console refuses, keeps the page's
 * own title: `gate` sends either to sign in.
 */
export async function gatedMetadata(feature: FeatureId, metadata: Metadata): Promise<Metadata> {
  if (refusal !== 'absent') return metadata;
  const who = await identity();
  if (who.is !== 'person' || satisfies(who.role, FEATURES[feature].needs)) return metadata;
  return MISSING_METADATA;
}

/**
 * Who the console is being read by, for the rail and the command palette, resolved behind the frame the layout streams.
 *
 * `only` is the nav's own destinations whose `needs` this person satisfies. It is what the rail and the palette draw,
 * and it is presentation only: hiding a destination is not the gate, which every page carries itself. There is nobody
 * to view the console as, so `viewAs` is left out. The person card's second line, the release's `user.role` slot, is
 * the team the person acts for, for everybody, and empty when they act for none: the chrome names no role
 * (reconciliation 77). `team` is that team again, as the chrome's own field. `caller` is their address, which every
 * browser read's key carries with the team and the role (`ConsoleCaller` in `src/lib/api.ts`). With nobody the role
 * table can place this rejects `Unauthenticated`, and the chrome keeps its placeholder rather than naming anyone.
 */
export async function chromeAccess(): Promise<ConsoleChromeAccess> {
  const who = await identity();
  if (who.is !== 'person') throw new Unauthenticated();
  return {
    only: nav.flatMap((g) => g.items).filter((i) => satisfies(who.role, i.needs)).map((i) => i.href),
    user: { name: who.me.name || who.me.email, role: who.me.activeTeam ?? '' },
    team: who.me.activeTeam,
    caller: who.me.email,
  };
}

/** The release's chrome answer, the team the person acts for (`null` for none, left out where nobody said) and their address. */
export type ConsoleChromeAccess = ChromeAccess & { team?: string | null; caller?: string };
