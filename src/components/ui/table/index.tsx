'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Rows of records compared across a few columns. It fills its card edge to edge and never scrolls sideways: when it is
 * too narrow, the least important columns drop (`hideBelow` on the head and the cells alike), and on phones a
 * DataTable shows a list of cards instead. Numbers align right in tabular figures.
 *
 * `hideBelow` reads the table's own width, not the window's: the rail, a split row or an embed all narrow the table
 * without narrowing the window. sm under 512px, md under 672px, lg under 896px, xl under 1152px.
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';
/* Literal strings: Tailwind finds classes by reading the source. */
const HIDE: Record<Breakpoint, string> = { sm: '@max-[512px]:hidden', md: '@max-[672px]:hidden', lg: '@max-[896px]:hidden', xl: '@max-[1152px]:hidden' };
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function Table({ className, caption, children, ...rest }: HTMLAttributes<HTMLTableElement> & { caption?: string }) {
  return (
    <div className="@container w-full min-w-0 overflow-x-clip">
      <table
        className={cn(
          'w-full border-separate border-spacing-0 text-sm',
          '[&_tr>*:first-child]:pl-(--card-pad) [&_tr>*:last-child]:pr-(--card-pad)',
          /* A text column after a right-aligned number gets room to breathe, so "234ms" and "Parallax AI" read as two facts. */
          '[&_[data-num]+:not([data-num])]:pl-8',
          className,
        )}
        {...rest}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, sticky, ...rest }: HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return <thead className={cn(sticky && '[&_th]:sticky [&_th]:top-0 [&_th]:z-10', className)} {...rest} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, selected, interactive, ...rest }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; interactive?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        'group/row transition-colors duration-(--dur-hover) [&>td]:border-b [&>td]:border-line last:[&>td]:border-0',
        interactive && 'cursor-pointer hover:bg-fill-hover',
        selected && 'bg-accent-tint hover:bg-accent-tint',
        className,
      )}
      {...rest}
    />
  );
}

export type SortDirection = 'asc' | 'desc' | false;

export function TableHeader({
  className,
  align = 'left',
  hideBelow,
  sort,
  onSort,
  grow,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: keyof typeof ALIGN;
  hideBelow?: Breakpoint;
  sort?: SortDirection;
  onSort?: () => void;
  /** The one column that takes the remaining width: the record's name. Its truncating cells shrink last. */
  grow?: boolean;
}) {
  const sortable = onSort !== undefined;
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      data-num={align === 'right' || undefined}
      aria-sort={sortable ? (sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none') : undefined}
      className={cn(
        'h-9 border-y border-line bg-surface-sunk px-4 text-xs font-medium whitespace-nowrap text-ink-3 first:border-l-0',
        ALIGN[align],
        hideBelow && HIDE[hideBelow],
        /* The lead column takes about a third; auto layout spreads the rest across the others by their content. */
        grow && 'w-[30%] min-w-40 @min-[672px]:min-w-64',
        className,
      )}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'group/sort hit -mx-1.5 inline-flex h-7 items-center gap-1 rounded-xs px-1.5 transition-colors hover:bg-fill-hover hover:text-ink',
            sort && 'text-ink',
            align === 'right' && 'flex-row-reverse',
          )}
        >
          {children}
          <Icon className={cn('size-3 shrink-0', sort ? 'text-accent-ink' : 'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100')} strokeWidth={2.25} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({
  className,
  align,
  numeric,
  muted,
  truncate,
  hideBelow,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: keyof typeof ALIGN; numeric?: boolean; muted?: boolean; truncate?: boolean; hideBelow?: Breakpoint; children?: ReactNode }) {
  return (
    <td
      data-num={numeric || align === 'right' || undefined}
      className={cn(
        'h-(--row-height) px-4 align-middle',
        ALIGN[align ?? (numeric ? 'right' : 'left')],
        numeric && 't-num whitespace-nowrap',
        muted ? 'text-ink-2' : 'text-ink',
        truncate && 'max-w-0 truncate',
        hideBelow && HIDE[hideBelow],
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
