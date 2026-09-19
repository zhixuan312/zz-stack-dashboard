import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * THE LAYOUT CONTRACT, in one file. Every number that decides where a page's content sits
 * lives here, and `docs/DESIGN-SYSTEM.md` §3 is the prose for the same rules.
 *
 *   1. ONE SCROLLER. `ShellBody` is the only thing on a page that scrolls, and it only ever
 *      scrolls vertically. No card, table, list or code block scrolls on its own, in either
 *      direction. `checks/one-scroller.ts` enforces it.
 *   2. CARDS ARE THEIR CONTENT'S HEIGHT, and a list never outgrows a card because every list
 *      pages (`usePaged`). That is what makes rule 1 possible.
 *   3. FOUR SPLITS. A page is a stack of rows; a row is one full-width card, or cards split
 *      `1/2`, `1/3`, `2/3` or `1/4`. Cards in one row are the same height.
 *   4. TWO WIDTHS. `data` for dashboards, lists and detail pages, and it FILLS the window;
 *      `reading` for a document, a form, a single column of prose, and it centres.
 *
 * THE NUMBERS ARE BORROWED, NOT INVENTED.
 *   gutter   16 → 24 → 32px at <768 / 768 / 1280. Atlassian's grid is 16px margins to 1024 and
 *            32px from there; Material 3 is 16px compact and 24px from 600. This takes both
 *            steps. The same value runs down all four sides, so a page opens and ends the
 *            same distance from its frame as it sits from the sides.
 *   gap      16 → 24px at 1280. Atlassian's desktop gutter is 16px, Material's pane spacing
 *            24px; the wider gap arrives with the wider margin so the two stay in proportion.
 *   data     THE WINDOW, less the rail and the gutter. No cap.
 *
 *            This was 1536px, taken from the widest fixed container the reference systems
 *            use — Carbon's 1584px including margins, against GitLab's 1280 and Atlassian's
 *            1296. The reasoning was sound for those products and wrong for this one, and a
 *            screenshot settled it: on an ultrawide the console drew a 1536px column with
 *            about 300px of dead surface down each side, while the table inside it was
 *            truncating cells to `max-w-[36ch]`. Content was being cropped and the window
 *            was being left empty at the same time.
 *
 *            A fixed container answers "how wide should a column of prose be". A console
 *            table answers a different question — it has seven columns, several of them
 *            paths and slugs that elide — and for that one the honest answer is: as wide as
 *            the person made their window. Whoever opens a 2500px window is asking to see
 *            more, and every pixel past 1536 was being refused.
 *
 *            The gutter still holds the content off the frame, so this is edge-to-edge and
 *            not flush. `reading` is unchanged and still centres, because the argument above
 *            is about tables and says nothing about prose.
 *   reading  832px of content — about 90 characters of body text, the upper end of a
 *            comfortable line. Atlassian's fixed-narrow is 864px with its margins.
 */

/** Padding between the scroll region's edge and the content, on all four sides. */
export const GUTTER = 'p-4 md:p-6 xl:p-8';
/** The same gutter, horizontal only — the header band shares the content's left edge. */
export const GUTTER_X = 'px-4 md:px-6 xl:px-8';
/** The space between rows, and between cards in a row. */
export const GAP = 'gap-4 xl:gap-6';

// `max-w-none` rather than an empty string: the header, the sub-nav and the body each compose
// this into a class list, and every one of them is asserted on by tests/page-layout.test.tsx.
// An empty string satisfies `toContain('')` on any element at all, so the three assertions that
// keep the header aligned with the body would pass while checking nothing.
export const WIDTH = {
  data: 'max-w-none',
  reading: 'max-w-[832px]',
} as const;
export type PageWidth = keyof typeof WIDTH;

/** A page body: rows, top to bottom, one gap apart. */
export function Stack({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex min-w-0 flex-col', GAP, className)} {...rest} />;
}

/**
 * THE SPLITS, and nothing else. Named by the share of the FIRST card: `2/3` is a wide card
 * then a narrow one, `1/3` the reverse. Spelled as literal class strings because Tailwind
 * scans source text — a class built at runtime generates no CSS.
 *
 * Below `lg` every split stacks to one column (the main column is ~790px at 1024 with the
 * rail open, which is no room for two tables); `1/4` counts from its own width instead.
 */
const SPLIT = {
  full: '',
  '1/2': 'lg:grid-cols-2',
  '2/3': 'lg:grid-cols-3 lg:[&>*:first-child]:col-span-2',
  '1/3': 'lg:grid-cols-3 lg:[&>*:last-child]:col-span-2',
  // Four columns only when each tile is at least 20rem wide — the width the tile's one-line
  // slots were measured against (the longest description needs ~305px of tile). Below
  // that, two.
  '1/4': '@min-[34rem]:grid-cols-2 @min-[85rem]:grid-cols-4',
} as const;
export type Split = keyof typeof SPLIT;

/**
 * One row of cards.
 *
 * SAME HEIGHT is the grid's own `align-items: stretch`: every direct child is as tall as the
 * tallest. It only holds for DIRECT children, so a card must be a child of the row, not
 * wrapped in a div — a wrapper stretches and the card inside it does not.
 *
 * `min-w-0` on each child, or a long unbroken slug in one card sets the track's minimum
 * width and pushes the whole row wider than the page.
 */
export function Row({ split = 'full', className, ...rest }: HTMLAttributes<HTMLDivElement> & { split?: Split }) {
  const row = (
    <div
      data-split={split}
      className={cn('grid min-w-0 grid-cols-1 [&>*]:min-w-0', GAP, SPLIT[split], className)}
      {...rest}
    />
  );
  // A row of tiles counts its columns from ITS OWN width, not the viewport's. A tile has
  // fixed text slots, and what decides whether its title fits one line is how wide the
  // tile is — which the viewport says nothing about once the rail is open.
  return split === '1/4' ? <div className="@container min-w-0">{row}</div> : row;
}
