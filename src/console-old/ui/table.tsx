import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Which columns drop when the card is narrow. Nothing in the console scrolls sideways, so a
 * table that does not fit drops its least important columns: put the same `hideBelow` on a
 * column's head and on its cells. Literal strings, because Tailwind scans source text and a
 * class built at runtime generates no CSS.
 */
const HIDE_BELOW = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const;
type HideBelow = keyof typeof HIDE_BELOW;

/** Where every column aligns, decided once for the whole console: first column left, last
 * column right, everything between centred, header and cell alike.
 *
 * DELIBERATE: child selectors on the table rather than classes passed through
 * TableHead/TableCell. A cell does not know whether it is first or last, so the alternative is
 * threading an index through every call site.
 *
 * A column hidden at narrow widths is still the DOM's last child, so where the last column is
 * hidden the right-alignment goes with it and the visible last column is centred. */
const ALIGNMENT = '[&_tr>*]:text-center [&_tr>*:first-child]:text-left [&_tr>*:last-child]:text-right';

/**
 * Table — the token-styled table primitives (shadcn pattern). Thin, semantic
 * wrappers around the native table elements, themed with our tokens. A table
 * with more than ten rows pages with `usePaged` + `PageControl`.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full caption-bottom', ALIGNMENT, className)} {...props} />;
}

/**
 * The column headers, sticky to the top of the scroll region.
 *
 * DELIBERATE: sticky inside the scroller, although shell.tsx keeps the page header outside
 * one. A `<thead>` cannot be moved out of its table, and a column header that scrolls away
 * leaves twenty rows of figures with nothing saying which column is which.
 *
 * The opaque background is not optional: a sticky row with a transparent background lets the
 * rows render underneath it. `surface` is the card's own ground, so the header looks identical
 * parked and at rest.
 *
 * `z-10` clears the composition bars and badges in the rows below, which carry their own
 * stacking contexts; popovers and tooltips are portalled above both.
 */
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-surface [&_tr]:border-b [&_tr]:border-line',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-line/70 transition-colors data-[state=selected]:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, hideBelow, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { hideBelow?: HideBelow }) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left align-middle text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint',
        hideBelow && HIDE_BELOW[hideBelow],
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, hideBelow, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { hideBelow?: HideBelow }) {
  return <td className={cn('px-4 py-2 align-middle', hideBelow && HIDE_BELOW[hideBelow], className)} {...props} />;
}
