/**
 * A collection bound to the person it was handed to, for the assistant route (`app/api/assistant/route.ts`).
 *
 * The assistant reads nothing through a handed collection: it reads through the view tools and the page's prepared
 * query, which go through `read()` and `aggregate()` and ask the grant at the moment they run. What it is handed a
 * collection for is the write tools, and each of those asks the route's guard again when an approved change runs. This
 * module only decides which operations are handed at all; no collection of this console has one.
 *
 * It is its own module, not a helper in the route: a Next route handler file may export only its handlers, and only
 * `handedTo` leaves this module, so a test can drive it directly.
 */
import { can, type AccessScope } from '@/data/access';
import type { AnyCollection } from '@/lib/collection';

/**
 * The collection the assistant is handed for one of the caller's collections: a copy, with the operations this person
 * may not perform left off, so the tool builder never builds a write tool for one. The collection a page and the
 * assistant share is untouched.
 */
export async function handedTo(scope: AccessScope, collection: AnyCollection, name: string): Promise<AnyCollection> {
  const handed: AnyCollection = { ...collection };
  for (const op of ['create', 'update', 'remove'] as const) {
    if (handed[op] && !(await can(scope, name, op))) delete (handed as Record<string, unknown>)[op];
  }
  return handed;
}
