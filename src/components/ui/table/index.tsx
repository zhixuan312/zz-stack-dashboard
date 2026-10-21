'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Children, isValidElement, type CSSProperties, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '../../../lib/cn';

/**
 * Rows of records compared across a few columns. It fills its card edge to edge and never scrolls sideways: when it is
 * too narrow, the least important columns drop (`hideBelow` on the head and the cells alike), and a DataTable's rows
 * become cards on phones. Numbers align right in tabular figures.
 *
 * It is laid out as a grid, not by the table algorithm: each column is as wide as its content, and the spare width sits
 * between the columns, an equal share in every gap, so the gaps read even whatever each column's alignment. The table
 * algorithm put each column's spare inside it, after a left-aligned value and before a right-aligned one, so a text
 * column beside a number held both shares in one gap and a number beside a text column none. Each row is a subgrid of
 * the table's columns, so a row's border, hover and selection run across the gaps. The columns are counted from the
 * cells of the table's first row as its own JSX writes them, the head's `TableHeader` cells when it has a head.
 *
 * `hideBelow` reads the table's own width, not the window's: the rail, a split row or an embed all narrow the table
 * without narrowing the window. sm under 512px, md under 672px, lg under 896px, xl under 1152px.
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';
/* Literal strings: Tailwind finds classes by reading the source. */
const HIDE: Record<Breakpoint, string> = { sm: '@max-[512px]:hidden', md: '@max-[672px]:hidden', lg: '@max-[896px]:hidden', xl: '@max-[1152px]:hidden' };
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;
const JUSTIFY = { left: undefined, right: 'justify-end', center: 'justify-center' } as const;

type Props = { children?: ReactNode; hideBelow?: Breakpoint };

/** Which columns the table draws: the `hideBelow` of each cell in its first row, the head's when it has one. */
function columnsOf(node: ReactNode): (Breakpoint | undefined)[] | undefined {
  const kids = Children.toArray(node).filter((c) => isValidElement<Props>(c));
  const cells = kids.filter((c) => c.type === TableHeader || c.type === TableCell);
  if (cells.length > 0) return cells.map((c) => c.props.hideBelow);
  for (const c of kids) {
    const found = columnsOf(c.props.children);
    if (found) return found;
  }
  return undefined;
}

/* Below each step a column with that `hideBelow`, or a wider one, is dropped. */
const DROPPED: Record<Breakpoint, Breakpoint[]> = { xl: ['xl'], lg: ['xl', 'lg'], md: ['xl', 'lg', 'md'], sm: ['xl', 'lg', 'md', 'sm'] };

/** One `auto` track per column the table draws at each step: as wide as its content, shrinking when there is no room. */
function columns(heads: (Breakpoint | undefined)[]) {
  const at = (drop: Breakpoint[]) => `repeat(${Math.max(1, heads.filter((h) => !h || !drop.includes(h)).length)}, auto)`;
  return { '--cols': at([]), '--cols-xl': at(DROPPED.xl), '--cols-lg': at(DROPPED.lg), '--cols-md': at(DROPPED.md), '--cols-sm': at(DROPPED.sm) } as CSSProperties;
}

export function Table({ className, caption, children, style, ...rest }: HTMLAttributes<HTMLTableElement> & { caption?: string }) {
  const heads = columnsOf(children) ?? [];
  return (
    <div className="@container w-full min-w-0 overflow-x-clip">
      <table
        role="table"
        style={{ ...columns(heads), ...style }}
        className={cn(
          'grid w-full justify-between text-sm',
          'grid-cols-(--cols) @max-[1152px]:grid-cols-(--cols-xl) @max-[896px]:grid-cols-(--cols-lg) @max-[672px]:grid-cols-(--cols-md) @max-[512px]:grid-cols-(--cols-sm)',
          '[&>thead]:contents [&>tbody]:contents [&_tr]:col-span-full [&_tr]:grid [&_tr]:grid-cols-subgrid [&_tr]:items-center',
          '[&_thead_tr]:min-h-9 [&_thead_tr]:border-y [&_thead_tr]:border-line [&_thead_tr]:bg-surface-sunk',
          '[&_tbody_tr]:min-h-(--row-height) [&_tbody_tr]:border-b [&_tbody_tr]:border-line [&_tbody_tr:last-child]:border-b-0',
          '[&_tr>*:first-child]:pl-(--card-pad) [&_tr>*:last-child]:pr-(--card-pad)',
          /* The column drawn last takes the card's padding, whichever columns the table's width hides after it (#70). */
          '@max-[1152px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]))]:pr-(--card-pad)',
          '@max-[896px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]):not([data-hide-below=lg]))]:pr-(--card-pad)',
          '@max-[672px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below=xl]):not([data-hide-below=lg]):not([data-hide-below=md]))]:pr-(--card-pad)',
          '@max-[512px]:[&_tr>:nth-last-child(1_of_:not([data-hide-below]))]:pr-(--card-pad)',
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
  return <thead role="rowgroup" className={cn(sticky && '[&_tr]:sticky [&_tr]:top-0 [&_tr]:z-10', className)} {...rest} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody role="rowgroup" {...props} />;
}

export function TableRow({ className, selected, interactive, ...rest }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; interactive?: boolean }) {
  return (
    <tr
      role="row"
      aria-selected={selected || undefined}
      className={cn(
        'group/row transition-colors duration-(--dur-hover)',
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
  /** The record's name: the one column with a floor, so it is the last to be cut. */
  grow?: boolean;
}) {
  const sortable = onSort !== undefined;
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      role="columnheader"
      data-num={align === 'right' || undefined}
      data-hide-below={hideBelow}
      aria-sort={sortable ? (sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none') : undefined}
      className={cn(
        'px-4 text-xs font-medium whitespace-nowrap text-ink-3',
        ALIGN[align],
        hideBelow && HIDE[hideBelow],
        /* No head claims the spare: every column is as wide as its content, a cut column's asked for through its cells
           (`Cut`), and the spare sits in the gaps between columns, an equal share in each. A cut column shrinks only when
           the table lacks room, and a head given a width keeps it. */
        // The floor, 160px, belongs to the lead column alone (c8eccdc): a second column with a minimum cannot shrink, and
        // the Releases table held 837px inside a 713px frame at 1024 and 768 when two had one. A floor is also a width the
        // column claims when its names are shorter, so it is no wider than a short name: 256px from a 672px table gave the
        // gap after the lead half as much again as every other gap.
        grow && 'min-w-40',
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
 * `minmax(0, max-content)` gives the cell that ask and lets it shrink to nothing. The track is as wide as the value and
 * the cell's `text-align` does not move it, so it takes the cell's alignment itself.
 */
export function Cut({ align = 'left', children }: { align?: keyof typeof ALIGN; children?: ReactNode }) {
  return (
    <span className={cn('grid min-w-0 grid-cols-[minmax(0,max-content)]', JUSTIFY[align])}>
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
      role="cell"
      data-num={numeric || align === 'right' || undefined}
      data-hide-below={hideBelow}
      // A cut value is cut everywhere on the page, and this README has always said the cell carries the whole one in its
      // title. The component does it now for a cell that is a value, rather than each page remembering; a cell that is a
      // node is its author's, and a `title` passed in wins over this one because the spread comes after.
      title={truncate && (typeof children === 'string' || typeof children === 'number') ? String(children) : undefined}
      className={cn(
        'px-4 py-2',
        ALIGN[align ?? (numeric ? 'right' : 'left')],
        numeric && 't-num whitespace-nowrap',
        muted ? 'text-ink-2' : 'text-ink',
        hideBelow && HIDE[hideBelow],
        className,
      )}
      {...rest}
    >
      {truncate ? <Cut align={align ?? (numeric ? 'right' : 'left')}>{children}</Cut> : children}
    </td>
  );
}
