/**
 * The collection a console read belongs to: the name the gateway gives a change that moves it, and so the name its
 * revision header carries and a live hint names.
 *
 * Read by the console's live provider (`src/views/console-live.tsx`), the fake gateway's revision header
 * (`scripts/fake-gateway/live.ts`) and the stream check (`scripts/live-check.ts`). Plain TypeScript with no path alias,
 * because the last two import it with plain `node`.
 */

/**
 * The reads whose collection is another's: what changes them is a change the gateway names by that other collection.
 * Approvals is read from the documents' revisions, and an approval or a presentation is a change to a document, which
 * the gateway names `initiatives`. Access is the caller's own tokens and browsers, which the gateway names `settings`.
 */
const KEPT_UNDER: Record<string, string> = { approvals: 'initiatives', access: 'settings' };

/**
 * `path`'s collection: its first segment, past the leading slash and any query, or the one `KEPT_UNDER` names for it.
 * `/initiatives/atlas/2026-09-28-search-relevance` reads `initiatives`; `/approvals?tab=waiting` reads `initiatives` too.
 */
export function collectionOf(path: string): string {
  const head = path.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
  return KEPT_UNDER[head] ?? head;
}
