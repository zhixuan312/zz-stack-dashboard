import { encodePath } from './store-path';

/**
 * A knowledge node's own page, kept dependency-free (no React, no Next) so a plain Vitest test imports it.
 * The shelf is filtered and paged by the gateway (`knowledgePath` in src/views/knowledge-context.ts).
 *
 * `/knowledge/<team>/<path...>`: each path segment is encoded on its own so the slashes stay route
 * separators, and the entry page decodes them back segment by segment: `encodePath` in src/lib/store-path.ts, which
 * says why.
 */
export function knowledgeNodeHref(team: string, path: string): string {
  return `/knowledge/${encodeURIComponent(team)}/${encodePath(path)}`;
}
