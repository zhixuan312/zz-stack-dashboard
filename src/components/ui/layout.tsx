import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * The layout contract, in one file. Every number that decides where a page's content sits
 * lives here, and `docs/DESIGN-SYSTEM.md` §3 is the prose for the same rules.
 *
 *   1. One scroller. `ShellBody` is the only thing on a page that scrolls, and only
 *      vertically. No card, table, list or code block scrolls on its own, in either
 *      direction.
 *   2. Cards are their content's height, and a list never outgrows a card because every list
 *      pages (`usePaged`). That is what makes rule 1 possible.
 *   3. Four splits. A page is a stack of rows; a row is one full-width card, or cards split
 *      `1/2`, `1/3`, `2/3` or `1/4`. Cards in one row are the same height.
 *   4. Two widths. `data` for dashboards, lists and detail pages, which fills the window;
 *      `reading` for a document, a form or a column of prose, which centres.
 *
 * COUPLED: `checks/one-scroller.ts` enforces rule 1.
 *
 * The numbers:
 *   gutter   16 → 24 → 32px at <768 / 768 / 1280, the same value on all four sides.
 *   gap      16 → 24px at 1280, so it stays in proportion to the margin.
 *   data     the window, less the rail and the gutter. No cap.
 *
 *            DELIBERATE: uncapped. A console table has seven columns, several of them paths
 *            and slugs that elide to `max-w-[36ch]`, so a fixed container crops content and
 *            leaves the window empty at the same time. The gutter still holds content off
 *            the frame, so this is edge-to-edge and not flush.
 *   reading  832px of content — about 90 characters of body text. Still centres.
 */

/** Padding between the scroll region's edge and the content, on all four sides. */
export const GUTTER = 'p-4 md:p-6 xl:p-8';
/** The same gutter, horizontal only — the header band shares the content's left edge. */
export const GUTTER_X = 'px-4 md:px-6 xl:px-8';
/** The space between rows, and between cards in a row. */
export const GAP = 'gap-4 xl:gap-6';

// COUPLED: `max-w-none` rather than an empty string, because tests/page-layout.test.tsx
// asserts this class on the header, the sub-nav and the body. `toContain('')` is true of any
// element, so an empty string makes all three assertions pass while checking nothing.
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
 * The splits, named by the share of the first card: `2/3` is a wide card then a narrow one,
 * `1/3` the reverse.
 *
 * DELIBERATE: literal class strings. Tailwind scans source text, so a class built at runtime
 * generates no CSS.
 *
 * Below `lg` every split stacks to one column — the main column is ~790px at 1024 with the
 * rail open. `1/4` counts from its own width instead.
 */
const SPLIT = {
  full: '',
  '1/2': 'lg:grid-cols-2',
  '2/3': 'lg:grid-cols-3 lg:[&>*:first-child]:col-span-2',
  '1/3': 'lg:grid-cols-3 lg:[&>*:last-child]:col-span-2',
  // Four columns only when each tile is at least 20rem wide, which is what the tile's
  // one-line slots need. Below that, two.
  '1/4': '@min-[34rem]:grid-cols-2 @min-[85rem]:grid-cols-4',
} as const;
export type Split = keyof typeof SPLIT;

/**
 * One row of cards.
 *
 * Same height is the grid's own `align-items: stretch`, which holds for direct children
 * only: a card wrapped in a div does not stretch, the wrapper does.
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
  // A row of tiles counts its columns from its own width, not the viewport's: what decides
  // whether a tile's title fits one line is the tile's width, which the viewport does not
  // give once the rail is open.
  return split === '1/4' ? <div className="@container min-w-0">{row}</div> : row;
}
