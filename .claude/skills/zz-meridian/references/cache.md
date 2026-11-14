# Cache Components, scoped reads and writes

This is the route a product takes from a console that renders every request to one whose shell prerenders, whose pages
read through an authorized and cached `read()`, and whose writes drop exactly their tenant's collection. Every
migration `update` reports for 0.5.0 names a section below, but `verify-modes`, which names `validation.md`, and
`live-provider`: `live.md` says what the live stream and its refresh must do.

The starters are the template's own files, and each section names its starter by path: a created project already holds
it, and an adopted one writes it from the contract the section states. A product keeps the starter's shape and replaces
the policy, the session and the database predicates with its own; change only what the section says is yours to change.

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
reason. It also fails a partial route whose shell for a parameter the build did not know is an empty file (`empty shell
/requests/[id]`): such a route prerenders nothing, so every record's page waits whole. The usual cause is a read of the
address above the page with no boundary around it — `usePathname()` or `useSearchParams()` in a layout's client
component, or `await params` in a page with no `loading.tsx`: put what reads it behind its own `Suspense`.

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
browser's clock, so a prerendered page and its hydration agree. Pass `now={new Date(observedAt)}` to `<Freshness>` (`observedAt` is an ISO string, `Freshness` takes a `Date`) and
`formatRelative(at, new Date(observedAt))` in a view; a view that formats times takes `now` as a prop from its page.

## Authorized, scoped reads

A page calls `read(name, query)` and never `collection.query()`. `read()` resolves the caller itself, so no caller can
choose a tenant. It refuses a collection the caller may not read before any cached code runs, and the cached function
it calls sees only the whole `AccessScope`, the collection's name and the normalized query, never a mutable collection.
A figure over every row (a count, a sum, a p95, a group by a field or a time bucket) is `aggregate(name, query)` beside
it: the same grant asked the same way, the same tag and profile, and the collection's own `aggregate` answering it in
one call, so nothing reads a collection page by page to count it.

The profile is `{ stale: 30, revalidate: 60, expire: 3600 }`. The tag is `collection:<sha256 of canonical [tenantId,
collectionName]>`: bounded, deterministic and free of any raw identifier. This tenant-and-collection tag is only for
invalidation. Cache identity includes the whole scope (tenant, subject and authorization identity), collection name and
normalized query, because these are the cached function's arguments. `authorizationKey`
must change whenever what the scope may see changes; derive it on the server from current permissions or a trusted
authorization revision. If an adapter cannot supply a stable, correct visibility identity, leave its read uncached
until it can.

`optional:src/data/access.ts` is the policy file: an `AccessScope` of `{ tenantId, subjectId, authorizationKey }`, and
`resolveAccess`, `collectionFor`, `can`, `may` and `mayEach`, `gate`, `gatedMetadata` and `chromeAccess` built from one
policy's `current`, `bind` and `allows`. The sample binds one tenant and resolves the person asking, one of its five, on
every request. A product replaces `policy.current` with its session (null when there is none), `policy.bind` with the
collection of that tenant with its database predicate already applied, and `policy.allows` with its permission check;
a production adapter binds the predicate and the subscription filter, because prepending a cache key is not isolation.

The policy re-reads the person on every call, so a suspension or a role change takes effect at the next operation, and a
policy that falls back to an Owner, or to anyone else, when it finds no session is not a policy. A refused collection
and one that does not exist answer the same message, so neither is disclosed. `customize.md`, "The access seam", says
what each entry point is for: `gate` at the top of every page, `requireNeed` in a view tool, and `chromeAccess` for the
rail and the palette only, where hiding a destination is not the gate.

`optional:src/data/read.ts` is the cached read, the cached aggregate and the tag helper: `read` and `readInScope`,
`readAll` and `readAllInScope`, `aggregate` and `aggregateInScope`, `collectionTag` and `memberNamesFor`. Each asks the
read grant before any cached code runs and refuses with the one `AccessDenied` when the scope may not; each takes its
scope from the request or from a module that already resolved one, never from its caller, so no caller chooses a tenant.
The cached function sees the whole scope, the collection's name and the normalized query, and nothing else; the stamp is
taken before the query, so a write in between makes `observedAt` older than the rows and never newer. `collectionTag` is
the invalidation tag, and `memberNamesFor` is the one join, for a module that has already authorized its own records, so
only names leave this file.

`normalizeQuery` (in `optional:src/lib/collection.ts`, Meridian's) defaults and caps the limit, bounds public offsets
from 0 to 100000, rejects an unknown field or operator, and defaults the order to the collection's key. The backend
uses the key as the final sort tiebreaker. `readAll()` normalizes the question once and ignores caller pagination;
only its internally generated offsets bypass the public ceiling, so every matching row can be read in 500-row pages.
A caller cannot supply or remove an authorization predicate through `where`: the predicate belongs to the bound
collection. `normalizeAggregate` does the same for an aggregate query, and holds its `top` at 8 groups when none is asked
and 50 at most.

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
`assistantTools(collections, writer, guard, views?, explore?)` and `respond({ ..., guard })` take that guard; `views` adds one read-only `view_<name>` tool per view and `explore` the page's own prepared query, and both are read-only.

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
