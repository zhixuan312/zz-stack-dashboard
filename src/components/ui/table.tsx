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
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full caption-bottom', className)} {...props} />;
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
