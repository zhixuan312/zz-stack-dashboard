import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * WHICH COLUMNS GO FIRST when the card is narrow. Nothing in the console scrolls sideways,
 * so a table that does not fit drops its least important columns instead: put the same
 * `hideBelow` on a column's head and on its cells. Literal strings, because Tailwind scans
 * source text and a class built at runtime generates no CSS.
 */
const HIDE_BELOW = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const;
type HideBelow = keyof typeof HIDE_BELOW;

/**
 * Table — the token-styled table primitives (shadcn pattern). Thin, semantic
 * wrappers around the native table elements, themed with our tokens. A table
 * with more than ten rows pages with `usePaged` + `PageControl`.
 */
/** WHERE EVERY COLUMN ALIGNS, decided once for the whole console.
 *
 * First column left, last column right, everything between centred — header and cell alike,
 * because a header that does not sit over its own figures is the raggedness this rule exists
 * to remove. It is a rule of the TABLE, not of each page: alignment was a class on individual
 * cells, so every new table re-decided it and no two agreed.
 *
 * Written as child selectors rather than passed down through TableHead/TableCell: a cell does
 * not know whether it is first or last, and threading an index through every call site to tell
 * it would be the same decision made in twenty places again.
 *
 * A column hidden at narrow widths is still the DOM's last child, so at a width where the last
 * column is hidden the right-alignment goes with it and the visible last column is centred.
 * That is the one case this cannot see; it is also the width at which the column was judged not
 * worth showing. */
const ALIGNMENT = '[&_tr>*]:text-center [&_tr>*:first-child]:text-left [&_tr>*:last-child]:text-right';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full caption-bottom', ALIGNMENT, className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-line', className)} {...props} />;
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
