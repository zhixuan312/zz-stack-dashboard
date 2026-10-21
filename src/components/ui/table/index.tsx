'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../../lib/cn';

/**
 * Rows of records compared across a few columns. It fills its card edge to edge and never scrolls sideways: when it is
 * too narrow, the least important columns drop (`hideBelow` on the head and the cells alike), and a DataTable's rows
 * become cards on phones. Numbers align right in tabular figures.
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
          /* The column drawn last takes the card's padding, whichever columns the table's width hides after it (#70). */
          '@max-[1152px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]))]:pr-(--card-pad)',
          '@max-[896px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]):not([data-hide-below=lg]))]:pr-(--card-pad)',
          '@max-[672px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]):not([data-hide-below=lg]):not([data-hide-below=md]))]:pr-(--card-pad)',
          '@max-[512px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below]))]:pr-(--card-pad)',
          /* A text column after a right-aligned number gets room to breathe, so "234ms" and "Example Co" read as two facts. */
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
  /** The record's name: the one column with a floor, so it is the last to be cut. It claims no spare width. */
  grow?: boolean;
}) {
  const sortable = onSort !== undefined;
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      data-num={align === 'right' || undefined}
      data-hide-below={hideBelow}
      aria-sort={sortable ? (sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none') : undefined}
      className={cn(
        'h-9 border-y border-line bg-surface-sunk px-4 text-xs font-medium whitespace-nowrap text-ink-3 first:border-l-0',
        ALIGN[align],
        hideBelow && HIDE[hideBelow],
        /* No head claims the spare. A cut column asks for its content's width through its cells (`Cut`), so auto layout
           shares the spare across every column in proportion to that ask; a head with `w-full` took all of it for the
           lead and left the rest at their minimum, the uneven spacing this replaced. */
        // The floor belongs to the lead column alone (c8eccdc): a second column with a minimum cannot shrink, and the
        // Releases table held 837px inside a 713px frame at 1024 and 768 when two columns had one.
        grow && 'min-w-40 @min-[672px]:min-w-64',
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
            align === 'center' && 'relative',
          )}
        >
          {children}
          {/* Centred, the arrow hangs outside the label so the label centres over its cells. */}
          <Icon className={cn('size-3 shrink-0', align === 'center' && 'absolute -right-3', sort ? 'text-accent-ink' : 'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100')} strokeWidth={2.25} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * A cut value: it asks for its whole content's width and shrinks only when the table has no room. One grid track of
 * `minmax(0, max-content)` gives the cell that ask, where `max-w-0` on the cell zeroed it and sent every spare pixel to
 * the lead column.
 */
export function Cut({ children }: { children?: ReactNode }) {
  return (
    <span className="grid min-w-0 grid-cols-[minmax(0,max-content)]">
      <span className="truncate">{children}</span>
    </span>
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
      data-hide-below={hideBelow}
      // A cut value is cut everywhere on the page, and this README has always said the cell carries the whole one in its
      // title. The component does it now for a cell that is a value, rather than each page remembering; a cell that is a
      // node is its author's, and a `title` passed in wins over this one because the spread comes after.
      title={truncate && (typeof children === 'string' || typeof children === 'number') ? String(children) : undefined}
      className={cn(
        'h-(--row-height) px-4 align-middle',
        ALIGN[align ?? (numeric ? 'right' : 'left')],
        numeric && 't-num whitespace-nowrap',
        muted ? 'text-ink-2' : 'text-ink',
        hideBelow && HIDE[hideBelow],
        className,
      )}
      {...rest}
    >
      {truncate ? <Cut>{children}</Cut> : children}
    </td>
  );
}
