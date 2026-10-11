# Cache Components, scoped reads and writes

This is the route a product takes from a console that renders every request to one whose shell prerenders, whose pages
read through an authorized and cached `read()`, and whose writes drop exactly their tenant's collection. Every
migration `update` reports for 0.5.0 names a section below. `live.md` carries the live stream and its
refresh.

The starters are the template's own files. A product keeps their shape and replaces the policy, the session and the
database predicates with its own. Copy a starter whole, then change only what the section says is yours to change.

## Turn Cache Components on

Set both flags in the Next config (`optional:next.config.ts`):

```ts
const config: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};
```

Every route that is not an API route must then be static or partial. A route that reads the request, the clock or an
uncached source puts that part inside a `Suspense` boundary of its own, so the rest of the route prerenders and the
boundary streams in. A page or layout that `await`s `connection()` at its top opts the whole route out of prerendering;
remove that and read the request-dependent data behind a boundary. A promise built from `connection()`, such as
`connection().then(() => ...)`, that a component resolves behind a boundary is how the shell reads the environment
without blocking the frame. `node scripts/route-policy.ts` classifies every route of a production build and fails a
route that is neither static nor partial, unless `optional:scripts/verify.config.ts` lists it in `requestDependentRoutes` with a
reason.

A navigation is as fast as where its data comes from. Data read through `read()` (cached and tagged, so a write
refreshes it) is in the prerendered shell; prefetching brings it, and the page is whole in about 30 ms. A request-time
read has to sit behind a Suspense boundary (a route's `loading.tsx`, or one inside the page), and React keeps a fallback
it has shown on screen for at least 300 ms (`FALLBACK_THROTTLE_MS`): measured on the template with Members read per
request, the content arrived at 325 to 329 ms on a desktop and about 490 ms on the phone profile, against 29 ms
through `read()`. So read through `read()` wherever the data allows, and keep request-time reads for what must be per
request. Where one stays, put its boundary as low as it can go, so the masthead and everything cached show at once and
only the request-time part waits. Without Cache Components, a route with no `loading.tsx` simply waits for its page,
and the rail answers the click at once: a link's icon turns into a spinner while its page is on the way
(`useLinkStatus`). `scripts/navigate.ts` times this honestly: its `data` time is when the mapping's `readySelector`
shows real, visible content, never a skeleton's rows or a page the router keeps hidden.

## The shell's assistant promise

`AppShell`'s `assistant` prop is a `Promise<boolean>`, and `useAssistantAvailable()` returns that promise. The layout
hands the shell a promise and does not await it:

```ts
const assistant = connection().then(() => assistantConfig(process.env) !== null);
```

Read the promise with `use()` inside a small `Suspense` boundary that keeps the control's space:

```tsx
function AssistantSection() {
  const available = use(useAssistantAvailable());
  if (!available) return null;
  return <AssistantSettings />;
}
```

The launcher keeps its place, inert and hidden from assistive technology, until the promise resolves `true`, so
resolving never moves the row. An unavailable assistant is never a clickable dead control.

## The clock is the data's

`formatRelative(input, now)`, `Freshness`, `ShellTools` and `AlertsPanel` take a required `now`: the data's clock, which is
the `observedAt` a `read()` returned, or `clock()` from `optional:src/data/collections.ts`. None of them reads the
browser's clock, so a prerendered page and its hydration agree. Pass `now={observedAt}` to `<Freshness>` and
`formatRelative(at, observedAt)` in a view; a view that formats times takes `now` as a prop from its page.

## Authorized, scoped reads

A page calls `read(name, query)` and never `collection.query()`. `read()` resolves the caller itself, so no caller can
choose a tenant. It refuses a collection the caller may not read before any cached code runs, and the cached function
it calls sees only the whole `AccessScope`, the collection's name and the normalized query, never a mutable collection.

The profile is `{ stale: 30, revalidate: 60, expire: 3600 }`. The tag is `collection:<sha256 of canonical [tenantId,
collectionName]>`: bounded, deterministic and free of any raw identifier. The real cache key still includes the subject
and the authorization identity, because the cached function's arguments include the whole scope. `authorizationKey`
must change whenever what the scope may see changes; derive it on the server from current permissions or a trusted
authorization revision. If an adapter cannot supply a stable, correct visibility identity, leave its read uncached
until it can.

`optional:src/data/access.ts` builds `resolveAccess`, `collectionFor` and `can` from one policy. The sample binds a
single scope. A product replaces `policy.current` with its session (null when there is none), `policy.bind` with the
collection of that tenant with its database predicate already applied, and `policy.allows` with its permission check.
A production adapter binds the predicate and the subscription filter; prepending a cache key is not isolation.

```ts
/**
 * Who the current request is and what they may do: the one place a page, a server action and the assistant ask. It also
 * answers the console's chrome (`chromeAccess`), which reads the same scope once more, for what the rail draws.
 *
 * This is the demo policy. It signs the request in as the sample member the `zz_meridian_view_as` cookie names, or as
 * Maya Chen (`members_1`) when there is no cookie, and answers `allows` from that member's record: the roster is read
 * again on every call, so a role change or a suspension takes effect at the next operation, and there is never a
 * fallback to the Owner or to anyone else. The grants come from the role table (`effective`), limited to the
 * operations each collection supports. A cookie naming an unknown or non-Active member gives no session, so
 * `resolveAccess` throws `Unauthenticated`.
 *
 * A product replaces this policy: `current` reads its own session (null when there is none), `bind` returns the
 * collection of that tenant with its database predicate already applied, and `allows` says what the scope may do with
 * each collection. `authorizationKey` must change whenever what the scope may see changes, because the cached read
 * keys on it.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { JSX } from 'react';
import { nav } from '@/app.config';
import { activity, customers, days, endpoints, incidents, keys, members, requests, responses, services, workspace } from '@/data/collections';
import { FEATURES, type FeatureId } from '@/data/features';
import { effective, roleLabel, type AddOn, type MainRole } from '@/data/roles';
import { membersFor } from '@/data/member-mutations';
import { chooseViewAs } from '@/data/view-as';
import { NoAccess } from '@/views/no-access';
import type { Member } from '@/data/sample';
import type { AnyCollection, ChromeAccess, Grant, Need } from '@/lib/collection';

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
  /** The person's name as Activity shows it ("Assistant … · for Maya Chen"); optional, and kept out of the scope, which keys the cache. */
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

/** The sample's one tenant. */
const TENANT = 'demo';
/** The member the demo is signed in as when no `zz_meridian_view_as` cookie is set. */
const DEFAULT_MEMBER = 'members_1';

/** The cookie that names who the demo is signed in as; written by the View as action. */
export const VIEW_AS_COOKIE = 'zz_meridian_view_as';

/** The five frozen personas in the spec's order: the sample people the demo signs in as. */
export const PERSONAS = ['members_1', 'members_2', 'members_4', 'members_5', 'members_12'] as const;

/** The one place the scope key is built: the tenant, the member, their role and their add-ons deduped and sorted. */
function authorizationKeyOf(member: { id: string; role: MainRole; addOns: readonly AddOn[] }): string {
  return `${TENANT}:${member.id}:${member.role}:${[...new Set(member.addOns)].sort().join('+')}`;
}

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

/** The member a scope names, re-read from the roster every call; null when there is no such record. */
async function memberById(id: string): Promise<Member | null> {
  return (await members.query({ where: [{ field: 'id', op: 'eq', value: id }] })).rows[0] ?? null;
}

/** The member the demo is signed in as: the cookie's id, or Maya Chen, and only while that record is Active. */
async function currentMember(): Promise<Member | null> {
  const id = (await cookies()).get(VIEW_AS_COOKIE)?.value ?? DEFAULT_MEMBER;
  const member = await memberById(id);
  return member && member.status === 'Active' ? member : null;
}

/** The sample's one tenant: each collection it has, and which operations it supports. */
const DEMO_COLLECTIONS: Record<string, { collection: AnyCollection; ops: readonly Operation[] }> = {
  members: { collection: members, ops: ['read', 'create', 'update', 'remove'] },
  keys: { collection: keys, ops: ['read', 'create', 'remove'] },
  requests: { collection: requests, ops: ['read', 'create'] },
  days: { collection: days, ops: ['read'] },
  endpoints: { collection: endpoints, ops: ['read'] },
  responses: { collection: responses, ops: ['read'] },
  services: { collection: services, ops: ['read'] },
  incidents: { collection: incidents, ops: ['read'] },
  activity: { collection: activity, ops: ['read', 'create'] },
  customers: { collection: customers, ops: ['read'] },
  workspace: { collection: workspace, ops: ['read', 'update', 'remove'] },
};

export const { resolveAccess, collectionFor, can, nameOf } = accessFrom({
  current: async () => {
    const member = await currentMember();
    return member ? { tenantId: TENANT, subjectId: member.id, authorizationKey: authorizationKeyOf(member) } : null;
  },
  // Members are bound through the boundary (`member-mutations.ts`), so no write reaches the raw collection.
  bind: (scope, name) => (scope.tenantId === TENANT ? (name === 'members' ? membersFor(scope) : DEMO_COLLECTIONS[name]?.collection) : undefined),
  allows: async (scope, name, op, ids) => {
    const member = await memberById(scope.subjectId);
    if (!member || member.status !== 'Active') return false;
    const grants = effective(member.role, member.addOns);
    if (!grants.has(`${name}:${op}` as Grant)) return false;
    const supported = DEMO_COLLECTIONS[name];
    if (!supported || (op !== 'read' && !supported.ops.includes(op))) return false;
    // A member who is an Owner is only changed by someone who may change the workspace.
    if (name === 'members' && (op === 'update' || op === 'remove')) {
      const targets = await Promise.all((ids ?? []).map((id) => memberById(id)));
      if (targets.some((t) => t?.role === 'Owner') && !grants.has('workspace:update')) return false;
    }
    return true;
  },
  name: async (scope) => (await memberById(scope.subjectId))?.name ?? null,
});

/**
 * Whether a member satisfies a need: `public` is any signed-in Active person, which `resolveAccess` has already
 * proved; a grant is asked of the role table (`effective`, main role and add-ons unioned), an `allOf` of every grant.
 *
 * The question is the role's, not the collection's. A grant a role carries is what that person may do, and whether a
 * collection of that name is bound — `can` — is a question about the data behind it. `customers:read` is every viewer's
 * grant and the Customers page reads a fixture rather than a collection, so the rail asks `effective` for it.
 */
function satisfies(member: Member, need: Need): boolean {
  if (member.status !== 'Active') return false;
  if (need === 'public') return true;
  const grants = effective(member.role, member.addOns);
  return typeof need === 'string' ? grants.has(need) : need.allOf.every((grant) => grants.has(grant));
}

/**
 * What the current request may do, asked the one way a page, a control or the rail asks it: `public` is satisfied by
 * any signed-in Active person, a grant by the role table, and an `allOf` by every grant of it.
 *
 * Rejects `Unauthenticated` when there is no session, which is the caller's to catch: this answers about a person, not
 * for one. A page does not catch it — it opens with `gate`, which sends the request to sign-in or renders NoAccess
 * before the page's own read.
 */
export async function may(need: Need): Promise<boolean> {
  const scope = await resolveAccess();
  const member = await memberById(scope.subjectId);
  if (!member) throw new Unauthenticated();
  return satisfies(member, need);
}

/** What a page or a view tool calls before it reads: `may` asked one way, refused as the one `AccessDenied` message. */
export async function requireNeed(need: Need): Promise<void> {
  if (!(await may(need))) throw new AccessDenied();
}

/**
 * The one page gate, called as every dashboard page's first statement so the check is what stops the read, never the
 * rail: `chromeAccess().only` hides a destination but forbids nothing, so a page that leaned on it would show a person
 * the records the rail merely left unlinked.
 *
 * It asks the same `requireNeed` a view tool asks, so a page and a tool refuse alike. A request with no session is sent
 * to sign-in. A person who may not use the feature gets the NoAccess view as a normal 200 answer — awaited, because the
 * view is an async server component and a page hands a renderer an element, not a promise. `null` means the feature is
 * held and the page may render and read.
 */
export async function gate(feature: FeatureId): Promise<JSX.Element | null> {
  try {
    await requireNeed(FEATURES[feature].needs);
  } catch (error) {
    if (error instanceof Unauthenticated) redirect('/sign-in');
    if (error instanceof AccessDenied) return await NoAccess({ feature });
    throw error;
  }
  return null;
}

/** The console's chrome reads `ChromeAccess` from `@/lib/collection`, where the access vocabulary lives. */

/**
 * Who the console is being read by, for the rail and the command palette, resolved behind the frame the layout streams.
 *
 * A product replaces this with its own session's person; the shape never changes, so the chrome never learns a product's
 * sign-in. The personas are read again on every call, so a suspension takes effect at the next request, and a persona
 * whose record is not Active is listed but not selectable — never dropped, so the list never shifts under the pointer.
 * With no session this rejects `Unauthenticated`, and the chrome keeps its placeholder rather than naming anyone.
 *
 * `only` is the nav's own destinations whose `needs` this person satisfies. It is what the rail and the palette draw,
 * and it is presentation only: hiding a destination is not the gate, which a later task puts on every page itself.
 */
export async function chromeAccess(): Promise<ChromeAccess> {
  const scope = await resolveAccess();
  const member = await memberById(scope.subjectId);
  if (!member) throw new Unauthenticated();
  const personas = new Map(
    (await members.query({ where: [{ field: 'id', op: 'in', value: [...PERSONAS] }] })).rows.map((m) => [m.id, m]),
  );
  const items = nav.flatMap((g) => g.items);
  return {
    only: items.filter((i) => satisfies(member, i.needs)).map((i) => i.href),
    user: { name: member.name, role: roleLabel(member) },
    viewAs: {
      current: member.id,
      options: PERSONAS.map((id) => ({ id, label: personas.get(id)?.name ?? id, disabled: personas.get(id)?.status !== 'Active' })),
      choose: chooseViewAs,
    },
  };
}
```

`optional:src/data/read.ts` is the cached read and the tag helper:

```ts
/**
 * The pages' read: authorized, scoped and cached. A page calls `read()`; it cannot choose a tenant, and the cached
 * helper below sees only the whole scope, the collection's name and the normalized query. A write calls
 * `updateTag(collectionTag(tenantId, name))` after it commits, which drops every user's cached variants of that
 * collection and nobody else's.
 */
import { createHash } from 'node:crypto';
import { cacheLife, cacheTag } from 'next/cache';
import { normalizeQuery, type Query } from '@/lib/collection';
import { AccessDenied, collectionFor, can, resolveAccess, type AccessScope } from '@/data/access';
import { clock } from '@/data/collections';

/** `collection:` and the SHA-256 of the tenant and the name: bounded, deterministic and free of any raw identifier. */
export const collectionTag = (tenantId: string, name: string): string =>
  `collection:${createHash('sha256').update(JSON.stringify([tenantId, name])).digest('hex')}`;

async function cachedRead(scope: AccessScope, name: string, query: Query) {
  'use cache';
  cacheTag(collectionTag(scope.tenantId, name));
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  const { rows, total } = await collectionFor(scope, name).query(query);
  return { rows, total, observedAt: clock().toISOString() };
}

/** The rows of a collection the caller may read, with the time the read actually ran. Throws before any cached code runs when it may not. */
export async function read(name: string, q: Query = {}): Promise<{ rows: Record<string, unknown>[]; total: number; observedAt: string }> {
  const scope = await resolveAccess();
  if (!(await can(scope, name, 'read'))) throw new AccessDenied();
  return cachedRead(scope, name, normalizeQuery(collectionFor(scope, name), q));
}
```

`normalizeQuery` (in `optional:src/lib/collection.ts`, Meridian's) defaults and caps the limit and offset, rejects an
unknown field or operator, and sorts by the collection's key last. A caller cannot supply or remove an authorization
predicate through `where`: the predicate belongs to the bound collection.

A page moves like this:

```tsx
// before
const { rows } = await members.query({ sort: { field: 'joined', dir: 'desc' } });
// after
const { rows, observedAt } = await read('members', { sort: { field: 'joined', dir: 'desc' } });
```

Format every freshness against `observedAt`, which is the time the read actually ran and not the render's.

## Writes authorize, then invalidate

A Server Action authorizes the operation and every record it touches, writes through the caller's own collection, and
only after the commit drops the tenant's cached reads with `updateTag`. A refused change writes nothing, emits nothing
and invalidates nothing. Never call `updateTag` before the write has committed, and never write through a collection
that is not bound to the caller's scope. A Route Handler has no `updateTag`; it calls `revalidateTag(tag, { expire: 0 })`.

```ts
'use server';

import { updateTag } from 'next/cache';
import { can, collectionFor, resolveAccess } from '@/data/access';
import { collectionTag } from '@/data/read';

export async function removeMember(id: string) {
  const scope = await resolveAccess();
  if (!(await can(scope, 'members', 'remove', [id]))) return { ok: false, error: 'You do not have permission to make this change.' };
  await collectionFor(scope, 'members').remove!([id]);
  updateTag(collectionTag(scope.tenantId, 'members'));
  return { ok: true };
}
```

Do not use the profile `'max'` on a writer path: it is the profile of a read.

## The assistant route

`optional:app/api/assistant/route.ts` resolves access before the model is reached: 401 without a session. It hands the
assistant only the caller's own collections that the caller may read. Each approved create, update or remove asks a
guard, with the records it touches, at the moment it runs, and a permission revoked since the approval refuses it with
"You no longer have permission to make this change." and changes, emits and invalidates nothing. A committed change
drops its tenant's cached reads with `revalidateTag(collectionTag(scope.tenantId, name), { expire: 0 })`.
`assistantTools(collections, writer, guard)` and `respond({ ..., guard })` take that guard.

```ts
const scope = await resolveAccess().catch((e: unknown) => { if (e instanceof Unauthenticated) return null; throw e; });
if (!scope) return new Response(null, { status: 401 });
const readable = (await Promise.all(collections.map(async (c) => ((await can(scope, c.name, 'read')) ? collectionFor(scope, c.name) : null)))).filter((c) => c !== null);
const guard = {
  authorize: async (name: string, op: 'create' | 'update' | 'remove', ids?: string[]) => {
    const now = await resolveAccess().catch(() => null);
    return now !== null && now.tenantId === scope.tenantId && now.subjectId === scope.subjectId && can(now, name, op, ids);
  },
  invalidate: (name: string) => revalidateTag(collectionTag(scope.tenantId, name), { expire: 0 }),
};
```
