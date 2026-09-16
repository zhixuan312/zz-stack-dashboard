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
 *   4. TWO WIDTHS. `data` for dashboards, lists and detail pages; `reading` for a document, a
 *      form, a single column of prose. Both centre in the window.
 *
 * THE NUMBERS ARE BORROWED, NOT INVENTED.
 *   gutter   16 → 24 → 32px at <768 / 768 / 1280. Atlassian's grid is 16px margins to 1024 and
 *            32px from there; Material 3 is 16px compact and 24px from 600. This takes both
 *            steps. The same value runs down all four sides, so a page opens and ends the
 *            same distance from its frame as it sits from the sides.
 *   gap      16 → 24px at 1280. Atlassian's desktop gutter is 16px, Material's pane spacing
 *            24px; the wider gap arrives with the wider margin so the two stay in proportion.
 *   data     1536px of content. Carbon's largest breakpoint is 1584px including its margins,
 *            GitLab settled on one fixed 1280px, Atlassian's fixed-wide is 1296px. A console
 *            table has seven columns, so this takes the widest of those: every laptop and a
 *            1920px monitor run edge to edge, and past that the content stops growing and the
 *            window grows margins, equally on both sides.
 *   reading  832px of content — about 90 characters of body text, the upper end of a
 *            comfortable line. Atlassian's fixed-narrow is 864px with its margins.
 */

/** Padding between the scroll region's edge and the content, on all four sides. */
export const GUTTER = 'p-4 md:p-6 xl:p-8';
/** The same gutter, horizontal only — the header band shares the content's left edge. */
export const GUTTER_X = 'px-4 md:px-6 xl:px-8';
/** The space between rows, and between cards in a row. */
export const GAP = 'gap-4 xl:gap-6';

export const WIDTH = {
  data: 'max-w-[1536px]',
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
 * rail open, which is no room for two tables); `1/4` goes to two columns first.
 */
const SPLIT = {
  full: '',
  '1/2': 'lg:grid-cols-2',
  '2/3': 'lg:grid-cols-3 lg:[&>*:first-child]:col-span-2',
  '1/3': 'lg:grid-cols-3 lg:[&>*:last-child]:col-span-2',
  '1/4': 'md:grid-cols-2 lg:grid-cols-4',
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
  return (
    <div
      data-split={split}
      className={cn('grid min-w-0 grid-cols-1 [&>*]:min-w-0', GAP, SPLIT[split], className)}
      {...rest}
    />
  );
}
