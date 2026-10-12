/**
 * A collection bound to the person it was handed to, for the assistant route (`app/api/assistant/route.ts`).
 *
 * Listing a tool is not enforcement. A route hands the assistant the collections this caller may read, and the model
 * may hold a `query_<name>` tool across several turns; by the time that tool runs, the person may have been suspended,
 * demoted or signed out. `scopedQuery` wraps the collection's `query` so it re-checks, at the moment it runs, that the
 * request still resolves to the same person of the same tenant and that they may still read the collection — refusing
 * with the one `AccessDenied` message otherwise, and reading through the collection it was given.
 *
 * It is its own module, not a helper in the route: a Next route handler file may export only its handlers, and only
 * `handedTo` leaves this module, so the re-check has one caller and a test can drive it directly.
 */
import { AccessDenied, can, resolveAccess, type AccessScope } from '@/data/access';
import type { AnyCollection, Query } from '@/lib/collection';

/** `collection` with its `query` re-checked against `scope` whenever it runs; `name` is the collection the read asks. */
function scopedQuery(collection: AnyCollection, scope: AccessScope, name: string): AnyCollection {
  return {
    ...collection,
    query: async (q: Query) => {
      const now = await resolveAccess().catch(() => null);
      // The same person of the same tenant, still permitted to read: a session that changed hands, ended, or lost the
      // grant since the tool was listed reads nothing.
      if (!now || now.tenantId !== scope.tenantId || now.subjectId !== scope.subjectId || !(await can(now, name, 'read'))) throw new AccessDenied();
      return collection.query(q);
    },
  };
}

/**
 * `collection` with the operations this person may not perform left off, so the tool builder never builds a write tool
 * for one. It returns a copy, so the collection a page and the assistant share is untouched, and it is beside
 * `scopedQuery` for the same reason: a route handler file may export only its handlers, and this needs driving.
 */
async function scopedOps(collection: AnyCollection, scope: AccessScope, name: string): Promise<AnyCollection> {
  const handed: AnyCollection = { ...collection };
  for (const op of ['create', 'update', 'remove'] as const) {
    if (handed[op] && !(await can(scope, name, op))) delete (handed as Record<string, unknown>)[op];
  }
  return handed;
}

/**
 * The collection the assistant is handed for one of the caller's collections: its `query` re-checked (`scopedQuery`),
 * then the operations this person may not perform left off (`scopedOps`).
 */
export async function handedTo(scope: AccessScope, collection: AnyCollection, name: string): Promise<AnyCollection> {
  return scopedOps(scopedQuery(collection, scope, name), scope, name);
}
