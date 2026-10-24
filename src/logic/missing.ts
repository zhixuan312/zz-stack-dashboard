import type { Metadata } from 'next';

/**
 * What an address that leads nowhere says, outside the shell (`app/not-found.tsx`) and inside it alike, and what a
 * refused address says under `refusal: 'absent'`. Nothing here is read from the address or the person, so nothing on
 * it can name the page, a role, a team or who is asking.
 */
export const NOT_FOUND = {
  /** The tab's title, which a refused address carries too (`gatedMetadata`). */
  title: 'Not found',
  kicker: '404',
  sentence: 'No such page.',
  lead: 'Nothing lives at this address. The link may be out of date, or the record it pointed at may have been removed.',
  /**
   * The one way on: the console's front door, which every person the console lets in may open. COUPLED:
   * `workspaces.main.homeHref` in src/app.config.ts, written out because this module is imported by the root
   * `app/not-found.tsx`, which every route's first load carries, and the config brings the rail's icons with it.
   */
  way: { href: '/', label: 'Back to the console' },
} as const;

/**
 * The document's metadata wherever the missing page is the answer: a refused address (`gatedMetadata`), an address
 * under the shell that no page answers (`app/(dash)/[...missing]/page.tsx`) and the standalone screen
 * (`app/not-found.tsx`). One object, so the three tabs cannot drift apart.
 */
export const MISSING_METADATA = { title: NOT_FOUND.title, robots: { index: false } } satisfies Metadata;
