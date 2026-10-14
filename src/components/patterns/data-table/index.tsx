'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLeave } from '../../base/shell/index';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/button/index';
import { CardHeader } from '../../ui/card/index';
import { Checkbox } from '../../ui/checkbox/index';
import { EmptyState } from '../../ui/empty-state/index';
import { Pagination } from '../../ui/pagination/index';
import { Skeleton } from '../../ui/skeleton/index';
import { Table, TableBody, TableHead, TableHeader, type Breakpoint, type SortDirection } from '../../ui/table/index';
import { useQueryState } from './use-query-state';

export { useQueryState } from './use-query-state';
export { useSearchDraft } from './use-search-draft';

export type Column<R> = {
  key: string;
  header: ReactNode;
  cell: (row: R) => ReactNode;
  /** Makes the column sortable: the value rows are ordered by. */
  sortValue?: (row: R) => number | string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  muted?: boolean;
  truncate?: boolean;
  /**
   * The whole value, for a cell that draws *more* than it: an avatar beside a name, a method chip beside a route. A cell
   * that is a plain value needs none — the component titles it from the value itself, because a value it can see is a
   * value it can keep. A cell it cannot see (a node) it cannot keep, which is what this is for.
   */
  title?: (row: R) => string;
  /** Drop the column below this width (the least important columns go first). */
  hideBelow?: Breakpoint;
  /** The one column that takes the remaining width: the record's name. */
  grow?: boolean;
  /** A width class for a column whose content is short and fixed (an ID, a key, a date), so the spare width goes to the others: `w-28`. */
  width?: string;
  /**
   * Its place in the card a row becomes on phones: the `title` (one column, the record's name), a `status` at the end
   * of the title line, a `fact` in the line under it (two or three at most), or `hidden`. Unset means hidden.
   */
  mobile?: 'title' | 'status' | 'fact' | 'hidden';
  /** The cell as a phone card shows it, when the column's header is not there to explain it: "Used 1 min ago". */
  mobileCell?: (row: R) => ReactNode;
};

/** Sort and page, as strings so they can live in the address. `dir` is `asc` or `desc`; `page` is one-based. */
export type TableState = { sort: string; dir: string; page: string };

/**
 * The phone presentation of a row, per column role.
 *
 * When the table is under 640px wide its rows lay out as cards — the SAME cells, placed here, rather than a second copy of
 * every record. The component used to render the table and a `<ul>` of the same rows and let CSS hide one: both trees were
 * built on every render and both reached the DOM at every viewport, so every cell ran twice and each device downloaded
 * a tree it could never show.
 *
 * `check` is the select-all column; `title`, `status` and `fact` are the roles a column declares (`Column.mobile`) and
 * anything else is hidden on a phone. The card is the title and its status on the first line and up to three facts,
 * in column order, flowing on the second.
 */
type Mobile = 'check' | 'title' | 'status' | 'fact' | 'hidden';

/**
 * The rules every cell and row repeats, written once on the table and keyed on the attributes the cells already carry
 * (`data-mobile`, `data-num`, `data-sep`), so a row carries only what differs from its column: a width, a muted ink, a
 * breakpoint. Twenty rows of seven cells used to repeat these class lists 160 times. Literal strings, so Tailwind finds them.
 *
 * `data-num` is `num` for a numeric column (never wrapped; its cells add `t-num` themselves, a plain class a variant cannot apply) and `true` for one that is only right-aligned.
 */
const CELLS = [
  'text-ink',
  '[&_td]:h-(--row-height) [&_td]:px-4 [&_td]:align-middle [&_td]:text-left',
  '[&_td[data-num]]:text-right [&_td[data-num=num]]:whitespace-nowrap',
  '[&_[data-sep]]:hidden',
  '[&_tbody_tr]:transition-colors [&_tbody_tr]:duration-(--dur-hover) [&_tbody_td]:border-b [&_tbody_td]:border-line [&_tbody_tr:last-child_td]:border-0',
].join(' ');

/**
 * What a row becomes when the TABLE is under 640px wide: a card. It is a wrapping row, not a grid: the title and the
 * status share the first line, and a full-width break (the row's `::after`) sends the facts to a second line where they
 * flow as one sentence, "391ms · Orbit Retail · 6 min ago", each whole. A grid of thirds put each dot at the edge of a
 * third, or alone on a line of its own, and cut a date to fit its third.
 * The table's own width, not the window's, as `hideBelow` reads it: a table in a half-width row on a wide screen, or
 * beside the assistant's column, becomes cards instead of running past its frame (issue #9's Atlas audit).
 */
const PHONE_ROWS = [
  '@max-[640px]:[&_tbody_tr]:flex @max-[640px]:[&_tbody_tr]:flex-wrap @max-[640px]:[&_tbody_tr]:items-center @max-[640px]:[&_tbody_tr]:gap-x-1.5 @max-[640px]:[&_tbody_tr]:gap-y-1',
  '@max-[640px]:[&_tbody_tr]:after:order-2 @max-[640px]:[&_tbody_tr]:after:basis-full',
  '@max-[640px]:[&_tbody_tr]:px-(--card-pad) @max-[640px]:[&_tbody_tr]:py-3.5 @max-[640px]:[&_tbody_td]:border-0 @max-[640px]:[&_tbody_tr]:border-b @max-[640px]:[&_tbody_tr]:border-line @max-[640px]:[&_tbody_tr:last-child]:border-b-0',
].join(' ');

/** The resets a cell needs once the row is a card: not a row height, not a padding box, free to shrink and to clip. */
const PHONE_CELLS = '@max-[640px]:[&_td:not([data-mobile=hidden])]:!h-auto @max-[640px]:[&_td:not([data-mobile=hidden])]:!max-w-none @max-[640px]:[&_td:not([data-mobile=hidden])]:!p-0 @max-[640px]:[&_td:not([data-mobile=hidden])]:min-w-0 @max-[640px]:[&_td:not([data-mobile=hidden]):not([data-mobile=fact])]:!block @max-[640px]:[&_[data-sep]]:inline';

/** Where a role sits in the card, and how it reads there.
 *
 * `!block` (above) is load-bearing: `hideBelow` drops a column when the TABLE is narrow, and on a phone the table is always
 * narrow — but a card has room for three small facts, so a column the table dropped for width comes back here. The
 * card's own rule is the role, not the width. */
const PHONE_ROLES = [
  '@max-[640px]:[&_td[data-mobile=check]]:order-0 @max-[640px]:[&_td[data-mobile=check]]:mr-1.5',
  '@max-[640px]:[&_td[data-mobile=title]]:order-1 @max-[640px]:[&_td[data-mobile=title]]:flex-1 @max-[640px]:[&_td[data-mobile=title]]:font-medium @max-[640px]:[&_td[data-mobile=title]]:!text-left',
  // The badge sits beside the title, never before it: with the same `order` the column order decided which of the two took
  // the card's left edge, so a table that listed a status column before its title wrapped the title into the width the
  // badge left it. `check` stays ahead of both, and a fact follows them.
  '@max-[640px]:[&_td[data-mobile=status]]:order-2 @max-[640px]:[&_td[data-mobile=status]]:ml-auto @max-[640px]:[&_td[data-mobile=status]]:shrink-0',
  // Facts flow on the second line, left to right whatever their column's alignment, each whole; one longer than the
  // card ends in an ellipsis.
  // A fact is a flex row of its content and its dot, so the dot stays beside it whatever element the cell renders.
  '@max-[640px]:[&_td[data-mobile=fact]]:order-3 @max-[640px]:[&_td[data-mobile=fact]]:!flex @max-[640px]:[&_td[data-mobile=fact]]:items-center @max-[640px]:[&_td[data-mobile=fact]]:gap-1 @max-[640px]:[&_td[data-mobile=fact]]:max-w-full @max-[640px]:[&_td[data-mobile=fact]]:overflow-hidden @max-[640px]:[&_td[data-mobile=fact]]:whitespace-nowrap @max-[640px]:[&_td[data-mobile=fact]]:!text-left @max-[640px]:[&_td[data-mobile=fact]]:text-xs @max-[640px]:[&_td[data-mobile=fact]]:text-ink-3',
  '@max-[640px]:[&_td[data-mobile=hidden]]:hidden',
  // On the accent wash of a selected row, a fact steps up to ink-2: ink-3 on it falls under 4.5:1 in light.
  '@max-[640px]:[&_tr[aria-selected]_td[data-mobile=fact]]:text-ink-2',
].join(' ');

/* Literal strings, as in the Table: Tailwind finds classes by reading the source. */
const HIDE: Record<Breakpoint, string> = { sm: '@max-[512px]:hidden', md: '@max-[672px]:hidden', lg: '@max-[896px]:hidden', xl: '@max-[1152px]:hidden' };

/** A cell's few own classes: what its column adds to the table's rules. */
const cellClass = (c: { align?: 'left' | 'right' | 'center'; numeric?: boolean; muted?: boolean; truncate?: boolean; hideBelow?: Breakpoint }) =>
  cn(c.numeric && 't-num', c.align === 'center' && '!text-center', c.muted && 'text-ink-2', c.truncate && 'max-w-0 truncate', c.hideBelow && HIDE[c.hideBelow]);

/** The table's sort and page, kept in the URL: `?sort=latency&dir=desc&page=2`. Wrap the page in <Suspense>. */
export function useTableQuery(defaults: Partial<TableState> = {}) {
  return useQueryState<TableState>({ sort: '', dir: 'desc', page: '1', ...defaults });
}

/** Sort rows by a column's value. Stable; nulls last. */
export function sortRows<R>(rows: R[], columns: Column<R>[], sort: string, dir: string) {
  const col = columns.find((c) => c.key === sort);
  if (!col?.sortValue) return rows;
  const v = col.sortValue;
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, k: v(r) }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k > b.k ? sign : -sign))
    .map((x) => x.r);
}

export function DataTable<R>({
  rows,
  columns,
  rowKey,
  rowHref,
  caption,
  noun = 'rows',
  title,
  description,
  actions,
  toolbar,
  state: controlled,
  onStateChange,
  pageSize: initialSize = 20,
  pageSizes = [20, 50, 100],
  manual,
  total: manualTotal,
  loading,
  busy,
  error,
  onRetry,
  filtered,
  onClearFilters,
  empty,
  selectable,
  selected,
  onSelectedChange,
  className,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (row: R) => string;
  /** Each row opens a record: the title column becomes a link and the whole row takes the pointer. */
  rowHref?: (row: R) => string;
  /** For screen readers: what the table lists. */
  caption: string;
  /** What a row is, for the range line and the empty states: "requests". */
  noun?: string;
  /** The card's heading, when the table is one card among others on a page: "Claims", "Members". */
  title?: ReactNode;
  /** One line under the title: what the rows are, or how they are ordered. */
  description?: ReactNode;
  /** Beside the title: a link to the full view, an export. */
  actions?: ReactNode;
  /** A band above the table, inside the card: a Filter bar. */
  toolbar?: ReactNode;
  /** Sort and page from outside (the URL, with useTableQuery); otherwise the table keeps its own. */
  state?: TableState;
  onStateChange?: (patch: Partial<TableState>) => void;
  pageSize?: number;
  pageSizes?: number[];
  /** Rows arrive already sorted and paged by the server; pass `total`. */
  manual?: boolean;
  total?: number;
  loading?: boolean;
  /** New rows are on their way for a sort or a page already shown as chosen: the rows stay, quieter, until they land. */
  busy?: boolean;
  /** What went wrong, in one sentence. Shows the error state with Retry. */
  error?: ReactNode;
  onRetry?: () => void;
  /** The rows are empty because of filters: the empty state offers Clear filters, not Create. */
  filtered?: boolean;
  onClearFilters?: () => void;
  /** The first-run empty state: what is missing and the one action that fills it. */
  empty?: { title: ReactNode; body?: ReactNode; action?: ReactNode };
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  className?: string;
}) {
  const router = useRouter();
  const leave = useLeave();
  const [own, setOwn] = useState<TableState>({ sort: '', dir: 'desc', page: '1' });
  const [size, setSize] = useState(initialSize);
  const st = controlled ?? own;
  const set = (p: Partial<TableState>) => (onStateChange ? onStateChange(p) : setOwn((s) => ({ ...s, ...p })));

  const sorted = useMemo(() => (manual ? rows : sortRows(rows, columns, st.sort, st.dir)), [rows, columns, st.sort, st.dir, manual]);
  const total = manual ? (manualTotal ?? rows.length) : sorted.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Number(st.page) || 1));
  const shown = manual ? sorted : sorted.slice((page - 1) * size, page * size);

  const toggleSort = (c: Column<R>) => {
    if (st.sort !== c.key) return set({ sort: c.key, dir: c.numeric ? 'desc' : 'asc', page: '1' });
    set({ dir: st.dir === 'asc' ? 'desc' : 'asc', page: '1' });
  };
  const dirOf = (c: Column<R>): SortDirection => (st.sort === c.key ? (st.dir === 'asc' ? 'asc' : 'desc') : false);

  const sel = selected ?? new Set<string>();
  const pageKeys = shown.map(rowKey);
  const allOn = pageKeys.length > 0 && pageKeys.every((k) => sel.has(k));
  const someOn = pageKeys.some((k) => sel.has(k));
  const toggleAll = () => {
    const n = new Set(sel);
    pageKeys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
    onSelectedChange?.(n);
  };
  const toggle = (k: string) => {
    const n = new Set(sel);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    onSelectedChange?.(n);
  };

  const open = (e: MouseEvent, href?: string) => {
    if (!href) return;
    if ((e.target as HTMLElement).closest('a,button,input,[role="checkbox"],[role="menuitem"]')) return;
    if (window.getSelection()?.toString()) return;
    leave(() => router.push(href));
  };

  const titleColumn = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const status = columns.find((c) => c.mobile === 'status');
  const facts = columns.filter((c) => c.mobile === 'fact').slice(0, 3);

  let body: ReactNode;
  if (error) {
    body = (
      <EmptyState kind="error" title={`The ${noun} did not load`} action={onRetry ? <Button size="sm" icon={<RotateCw />} onClick={onRetry}>Retry</Button> : undefined} className="py-16">
        {error}
      </EmptyState>
    );
  } else if (!loading && total === 0) {
    body = filtered ? (
      <EmptyState kind="filtered" title={`No ${noun} match these filters`} action={onClearFilters ? <Button size="sm" onClick={onClearFilters}>Clear filters</Button> : undefined} className="py-16">
        Widen the search or clear a filter to see more.
      </EmptyState>
    ) : (
      <EmptyState kind="first-run" title={empty?.title ?? `No ${noun} yet`} action={empty?.action} className="py-16">
        {empty?.body}
      </EmptyState>
    );
  } else {
    const roleOf = (c: Column<R>): Mobile => (c === titleColumn ? 'title' : c === status ? 'status' : facts.includes(c) ? 'fact' : 'hidden');
    body = (
      <Table caption={caption} aria-busy={loading || busy || undefined} className={cn('@max-[640px]:block @max-[640px]:[&>thead]:hidden @max-[640px]:[&>tbody]:block', CELLS, PHONE_ROWS, PHONE_CELLS, PHONE_ROLES, '[&>tbody]:transition-opacity [&>tbody]:duration-(--dur-hover)', busy && '[&>tbody]:opacity-60')}>
        <TableHead>
          <tr>
            {selectable ? (
              <TableHeader className="w-10 !pr-0">
                <Checkbox aria-label={`Select every ${noun.replace(/s$/, '')} on this page`} checked={allOn ? true : someOn ? 'indeterminate' : false} onCheckedChange={toggleAll} />
              </TableHeader>
            ) : null}
            {columns.map((c) => (
              <TableHeader key={c.key} align={c.align ?? (c.numeric ? 'right' : 'left')} hideBelow={c.hideBelow} grow={c.grow} className={c.width} sort={c.sortValue ? dirOf(c) : undefined} onSort={c.sortValue ? () => toggleSort(c) : undefined}>
                {c.header}
              </TableHeader>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {loading
            ? Array.from({ length: Math.min(size, 8) }, (_, i) => (
                <tr key={i} className="group/row">
                  {selectable ? <td data-mobile="check"><Skeleton className="size-4" /></td> : null}
                  {columns.map((c, j) => (
                    <td key={c.key} data-mobile={roleOf(c)} data-num={c.numeric ? 'num' : undefined} className={cellClass({ numeric: c.numeric, hideBelow: c.hideBelow })}>
                      <Skeleton className={cn('h-3', c.numeric ? 'ml-auto w-12' : c.grow ? ['w-48', 'w-40', 'w-56'][i % 3] : ['w-20', 'w-16', 'w-24'][(i + j) % 3])} />
                    </td>
                  ))}
                </tr>
              ))
            : shown.map((r) => {
                const k = rowKey(r);
                const href = rowHref?.(r);
                return (
                  <tr key={k} aria-selected={sel.has(k) || undefined} onClick={(e) => open(e, href)} className={cn('group/row', href && 'cursor-pointer hover:bg-fill-hover', sel.has(k) && 'bg-accent-tint hover:bg-accent-tint')}>
                    {selectable ? (
                      <td data-mobile="check" className="!pr-0">
                        <Checkbox aria-label={`Select ${k}`} checked={sel.has(k)} onCheckedChange={() => toggle(k)} />
                      </td>
                    ) : null}
                    {columns.map((c) => {
                      const role = roleOf(c);
                      // The title is the row's link wherever it is shown, phone included: the whole card takes the
                      // pointer too (the row's own click), but the link is what a keyboard and a screen reader follow.
                      // The value is called once: it is both what we draw and what the title carries when the column
                      // truncates. A cut value is cut everywhere on the page — a slug's tail is the part that identifies
                      // it — and this card's own spec has said so since before the component did it.
                      const value = c.cell(r);
                      const content = c === titleColumn && href ? <Link href={href}>{value}</Link> : value;
                      return (
                        <td key={c.key} data-mobile={role} data-num={c.numeric ? 'num' : c.align === 'right' ? 'true' : undefined} title={c.title ? c.title(r) : c.truncate && (typeof value === 'string' || typeof value === 'number') ? String(value) : undefined} className={cellClass(c) || undefined}>
                          {/* A phone may want other words for the same cell — "Used 1 min ago", not "1 min ago" — so
                              both are rendered and one is hidden: a few words each, never a second copy of the row. */}
                          {c.mobileCell ? (
                            <>
                              <span className="@max-[640px]:hidden">{content}</span>
                              <span className="hidden @max-[640px]:contents">{c.mobileCell(r)}</span>
                            </>
                          ) : content}
                          {/* The dot that separates two facts, on a phone only — the table has a column for each of
                              them, where a dot would be noise. It trails the fact it follows, so the line reads
                              "391ms · Orbit Retail · 6 min ago" rather than starting every fact with a bullet. */}
                          {role === 'fact' && facts.indexOf(c) < facts.length - 1 ? <span aria-hidden data-sep>·</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
        </TableBody>
      </Table>
    );
  }

  return (
    <section aria-label={caption} className={cn('card overflow-hidden', className)}>
      {title ? <CardHeader title={title} description={description} actions={actions} divided={!toolbar} /> : null}
      {toolbar ? <div className="px-(--card-pad) py-3.5 md:border-b md:border-line">{toolbar}</div> : null}
      {body}
      {!error && total > Math.min(size, ...pageSizes) ? (
        <div className="border-t border-line px-(--card-pad) py-2.5">
          <Pagination
            page={page}
            pageSize={size}
            total={total}
            noun={noun}
            onPageChange={(p) => set({ page: String(p) })}
            pageSizes={pageSizes}
            onPageSizeChange={(s) => { setSize(s); set({ page: '1' }); }}
          />
        </div>
      ) : null}
    </section>
  );
}
