/**
 * Who the current request is and what they may do: the one place a page, the console's chrome, the assistant's route,
 * its tools and a view tool ask.
 *
 * This is the console's policy, in Meridian's shape (`current`, `bind`, `allows`, `name`, then `gate` and
 * `chromeAccess`). The gateway is the authority on who is asking, so every answer starts from one gateway read made as
 * the person themselves, `GET /api/console/me` (`src/data/gateway.ts`), and what that person holds is read off the role
 * table (`src/data/roles.ts`):
 *
 * - `/me` is placed before it is believed (`ask`). No session is nobody. A session the console is refused, and a body
 *   whose role the table does not have or whose `role` and `superadmin` disagree, is somebody refused: never a member's
 *   access and never a superadmin's. A gateway that is down, or has no address, is an outage and is thrown.
 * - A page, the chrome and a view tool share one read: `identity` is `ask` cached by React for the length of the request
 *   it is called in, and nowhere else, so two requests never share an answer.
 * - The assistant's policy asks afresh on every call, because its tools run long after the route answered: a role
 *   change, a team switch or a sign-out takes effect at the next operation.
 * - `bind` returns the collection as it is. A collection's rows are a gateway read made with the caller's own
 *   credential, so the gateway has already applied the predicate: a member's read comes back as their team's rows and
 *   a superadmin's as every team's. There is no second, wider copy for a scope to be bound away from.
 *
 * None of this widens a read: the gateway refuses what the person may not read whatever this says.
 *
 * `authorizationKey` changes whenever what the scope may see changes: the person, their role, the team they act for
 * and their memberships.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache, type JSX } from 'react';
import { nav } from '@/app.config';
import { collections } from '@/data/collections';
import { FEATURES, type FeatureId } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import { MAIN_ROLES, effective, type ConsoleGrant, type ConsoleNeed, type MainRole } from '@/data/roles';
import type { Me } from '@/lib/api-shapes';
import type { AnyCollection, ChromeAccess } from '@/lib/collection';
import { ownPath } from '@/lib/own-path';
import { NoAccess } from '@/views/no-access';

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

/** Who `/me` named: nobody, somebody the console is refused (with the sentence they are shown), or a person on the role table. */
type Identity =
  | { is: 'nobody' }
  | { is: 'refused'; reason: string }
  | { is: 'person'; me: Me; role: MainRole };

/** What a person is told when `/me` let them in and named them in a way the role table cannot place. */
const UNPLACED = 'The platform did not name a role this console knows, so nothing here is open to you.';

/**
 * One read of `/me`, placed. No session (401) is nobody. A session the console is refused (403, or a 200 that does not
 * say `mayRead: true`) is refused with the gateway's own sentence, and so is a body the role table cannot place.
 * Anything else, a gateway that is down among them, is an outage and is thrown: counted as "not signed in" it would
 * tell a signed-in person to sign in again.
 */
async function ask(): Promise<Identity> {
  let me: Partial<Me>;
  try {
    me = (await gatewayGet<Partial<Me> | null>('/me')) ?? {};
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) return { is: 'nobody' };
    if (error instanceof GatewayError && error.status === 403) return { is: 'refused', reason: error.message };
    throw error;
  }
  if (me.mayRead !== true) {
    return { is: 'refused', reason: me.why ?? `You are signed in as ${me.email ?? 'someone'}, but the console needs a browser sign-in.` };
  }
  // The platform names its two roles in lower case and says the same thing a second time in `superadmin`: both have to
  // agree, on a role the table has, before either is believed.
  const role = MAIN_ROLES.find((r) => r.toLowerCase() === me.role);
  if (!role || me.superadmin !== (role === 'Superadmin') || typeof me.email !== 'string' || !me.email || !Array.isArray(me.teams)) {
    return { is: 'refused', reason: UNPLACED };
  }
  return { is: 'person', me: me as Me, role };
}

/** `ask`, once for the request it is called in: React keeps the answer for that request's render and no longer. */
const identity = cache(ask);

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

/** The destination each collection is the list of: an agent is offered the list where the rail offers the page. */
const COLLECTION_NEEDS: Record<string, ConsoleNeed> = {
  teams: FEATURES.teams.needs,
  initiatives: FEATURES.initiatives.needs,
  knowledge: FEATURES.knowledge.needs,
  knowledge_log: FEATURES.knowledge.needs,
  people: FEATURES.people.needs,
  plugins: FEATURES.plugins.needs,
  skills: FEATURES.runs.needs,
  activity: FEATURES.activity.needs,
  tokens: FEATURES.settings.needs,
};

/**
 * What a page lets a person change, by the grant that permits it, so the assistant can say where it is done (`onPage`
 * in `src/data/gateway-collection.ts`). Courtesy, like the Settings tiers it mirrors: the gateway validates each write.
 */
const PAGE_CHANGES: Record<string, ConsoleGrant> = {
  teams: 'teams:manage',
  people: 'people:manage',
  tokens: 'tokens:manage',
};

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
    const who = await ask();
    return who.is === 'person' ? scopeOf(who) : null;
  },
  bind: (_scope, name) => collections.find((c) => c.name === name),
  allows: async (scope, name, op) => {
    const who = await ask();
    // The same person, still acting for the same thing: a session that changed hands since the scope was resolved
    // is allowed nothing.
    if (who.is !== 'person' || scopeOf(who).authorizationKey !== scope.authorizationKey) return false;
    const need = COLLECTION_NEEDS[name];
    if (!need || !satisfies(who.role, need)) return false;
    if (op === 'read') return true;
    const change = PAGE_CHANGES[name];
    return change !== undefined && satisfies(who.role, change);
  },
  name: async () => {
    const who = await ask();
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
 * one the role table cannot place, is sent to the sign-in page's denied state with the sentence that says why. A person
 * who lacks the feature's grant gets the NoAccess view as a normal 200 answer, awaited because the view is an async
 * server component and a page hands a renderer an element, not a promise. `null` means the feature is held and the
 * page may render. An outage is thrown: nothing is opened on an answer the gateway did not give.
 */
export async function gate(feature: FeatureId): Promise<JSX.Element | null> {
  const who = await identity();
  if (who.is === 'nobody') redirect(await signIn());
  if (who.is === 'refused') redirect(`/login?denied=1&reason=${encodeURIComponent(who.reason)}`);
  if (!satisfies(who.role, FEATURES[feature].needs)) return await NoAccess({ feature });
  return null;
}

/**
 * Who the console is being read by, for the rail and the command palette, resolved behind the frame the layout streams.
 *
 * `only` is the nav's own destinations whose `needs` this person satisfies. It is what the rail and the palette draw,
 * and it is presentation only: hiding a destination is not the gate, which every page carries itself. There is nobody
 * to view the console as, so `viewAs` is left out. `team` is the team the person acts for, which the superadmin's
 * scope names. With nobody the role table can place this rejects `Unauthenticated`, and the chrome keeps its
 * placeholder rather than naming anyone.
 */
export async function chromeAccess(): Promise<ConsoleChromeAccess> {
  const who = await identity();
  if (who.is !== 'person') throw new Unauthenticated();
  return {
    only: nav.flatMap((g) => g.items).filter((i) => satisfies(who.role, i.needs)).map((i) => i.href),
    user: { name: who.me.name || who.me.email, role: who.role },
    team: who.me.activeTeam,
  };
}

/** The release's chrome answer and the team the person acts for: `null` for none, left out where nobody said. */
export type ConsoleChromeAccess = ChromeAccess & { team?: string | null };
