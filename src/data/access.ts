/**
 * Who the current request is and what they may do: the one place the assistant's route, its tools and a view tool ask.
 *
 * This is the console's policy, in Meridian's shape (`current`, `bind`, `allows`, `name`). The gateway is the authority
 * on every part of it, so each answer is a gateway read made as the person themselves (`src/data/gateway.ts`):
 *
 * - `current` asks `GET /api/console/me`. No session, or a session the console is refused, is no scope at all, and
 *   `resolveAccess` throws `Unauthenticated`.
 * - `bind` returns the collection as it is. A collection's rows are a gateway read made with the caller's own
 *   credential, so the gateway has already applied the predicate: a member's read comes back as their team's rows and
 *   a superadmin's as every team's. There is no second, wider copy for a scope to be bound away from.
 * - `allows` asks `/me` again on every call, so a role change or a deactivation takes effect at the next operation.
 *   What it answers is which lists and views an agent is offered, by the rule the rail draws its destinations with
 *   (`src/data/features.ts`). It never widens a read: the gateway refuses what the person may not read whatever this
 *   says.
 *
 * `authorizationKey` changes whenever what the scope may see changes: the person, their role, the team they act for
 * and their memberships.
 */
import { collections } from '@/data/collections';
import { FEATURES, PLATFORM } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { AnyCollection, Need } from '@/lib/collection';

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

/** The tenant of a superadmin, who reads every team. A member's tenant is the team they act for. */
const PLATFORM_TENANT = 'platform';

/**
 * The signed-in person as the gateway names them, or null: no session (401), or one the console is refused (403, or a
 * 200 saying `mayRead: false`). Anything else, a gateway that is down among them, is an outage and is thrown: counted
 * as "not signed in" it would tell a signed-in person to sign in again.
 */
async function signedIn(): Promise<Me | null> {
  try {
    const me = await gatewayGet<Me>('/me');
    return me.mayRead ? me : null;
  } catch (error) {
    if (error instanceof GatewayError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

function scopeOf(me: Me): AccessScope {
  const tenantId = me.superadmin ? PLATFORM_TENANT : `team:${me.activeTeam ?? ''}`;
  const teams = me.teams.map((t) => `${t.slug}=${t.role}`).sort().join('+');
  return { tenantId, subjectId: me.email, authorizationKey: `${tenantId}:${me.email}:${me.role}:${teams}` };
}

/** Whether this person satisfies a need: `public` is anyone the console lets in, `platform:read` a superadmin. */
function satisfies(me: Me, need: Need): boolean {
  if (need === 'public') return true;
  const holds = (grant: string) => grant === PLATFORM && me.superadmin;
  return typeof need === 'string' ? holds(need) : need.allOf.every(holds);
}

/** The destination each collection is the list of: an agent is offered the list where the rail offers the page. */
const COLLECTION_NEEDS: Record<string, Need> = {
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
 * What a page lets this person change, so the assistant can say where it is done (`onPage` in
 * `src/data/gateway-collection.ts`). Courtesy, like the Settings tiers it mirrors: the gateway validates each write.
 */
const PAGE_CHANGES: Record<string, (me: Me) => boolean> = {
  teams: (me) => me.superadmin,
  people: (me) => me.superadmin,
  tokens: () => true,
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
    const me = await signedIn();
    return me ? scopeOf(me) : null;
  },
  bind: (_scope, name) => collections.find((c) => c.name === name),
  allows: async (scope, name, op) => {
    const me = await signedIn();
    // The same person, still acting for the same thing: a session that changed hands since the scope was resolved
    // is allowed nothing.
    if (!me || scopeOf(me).authorizationKey !== scope.authorizationKey) return false;
    const need = COLLECTION_NEEDS[name];
    if (!need || !satisfies(me, need)) return false;
    return op === 'read' || (PAGE_CHANGES[name]?.(me) ?? false);
  },
  name: async () => (await signedIn())?.name ?? null,
});

/**
 * What the current request may do, asked the one way a view tool and the route ask it. Rejects `Unauthenticated` when
 * there is no session, which is the caller's to catch: this answers about a person, not for one.
 */
export async function may(need: Need): Promise<boolean> {
  const me = await signedIn();
  if (!me) throw new Unauthenticated();
  return satisfies(me, need);
}

/** What a view tool calls before it reads: `may` asked one way, refused as the one `AccessDenied` message. */
export async function requireNeed(need: Need): Promise<void> {
  if (!(await may(need))) throw new AccessDenied();
}
