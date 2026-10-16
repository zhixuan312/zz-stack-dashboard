/**
 * A knowledge node's own page, kept dependency-free (no React, no Next) so a plain Vitest test imports it.
 * The shelf is filtered and paged by the gateway (`knowledgePath` in src/views/knowledge-context.ts).
 *
 * `/knowledge/<team>/<path...>`: each path segment is encoded on its own so the slashes stay route
 * separators, and the entry page decodes them back segment by segment.
 *
 * DELIBERATE: a second copy of `src/lib/address.ts`'s `encodePath`, which is where that rule lives and where it says
 * why it is a pair. This module imports it nowhere because that one is a `'use client'` one, and reaching it would
 * bring React into every reader of this file — the plain test above included.
 */
export function knowledgeNodeHref(team: string, path: string): string {
  return `/knowledge/${encodeURIComponent(team)}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
}
