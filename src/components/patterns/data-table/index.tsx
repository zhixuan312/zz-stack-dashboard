'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type Breakpoint, type SortDirection } from '@/components/ui/table';
import { useQueryState } from './use-query-state';

export { useQueryState } from './use-query-state';

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
  /** Drop the column below this width (the least important columns go first). */
  hideBelow?: Breakpoint;
  /** The one column that takes the remaining width: the record's name. */
  grow?: boolean;
  /** A width class for a column whose content is short and fixed (an ID, a key), so the spare width goes elsewhere. */
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
  toolbar,
  state: controlled,
  onStateChange,
  pageSize: initialSize = 20,
  pageSizes = [20, 50, 100],
  manual,
  total: manualTotal,
  loading,
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
    router.push(href);
  };

  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
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
    body = (
      <>
        <div className="max-md:hidden">
          <Table caption={caption} aria-busy={loading || undefined}>
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
                    <TableRow key={i}>
                      {selectable ? <TableCell className="!pr-0"><Skeleton className="size-4" /></TableCell> : null}
                      {columns.map((c, j) => (
                        <TableCell key={c.key} hideBelow={c.hideBelow} numeric={c.numeric}>
                          <Skeleton className={cn('h-3', c.numeric ? 'ml-auto w-12' : c.grow ? ['w-48', 'w-40', 'w-56'][i % 3] : ['w-20', 'w-16', 'w-24'][(i + j) % 3])} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : shown.map((r) => {
                    const k = rowKey(r);
                    const href = rowHref?.(r);
                    return (
                      <TableRow key={k} interactive={Boolean(href)} selected={sel.has(k)} onClick={(e) => open(e, href)}>
                        {selectable ? (
                          <TableCell className="!pr-0">
                            <Checkbox aria-label={`Select ${k}`} checked={sel.has(k)} onCheckedChange={() => toggle(k)} />
                          </TableCell>
                        ) : null}
                        {columns.map((c) => (
                          <TableCell key={c.key} align={c.align} numeric={c.numeric} muted={c.muted} truncate={c.truncate} hideBelow={c.hideBelow}>
                            {c === title && href ? <Link href={href} className="row-link">{c.cell(r)}</Link> : c.cell(r)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
        <ul aria-label={caption} aria-busy={loading || undefined} className="divide-y divide-line border-t border-line md:hidden">
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex flex-col gap-2.5 px-(--card-pad) py-4">
                  <span className="flex items-center gap-3"><Skeleton className="h-3.5 w-44" /><Skeleton className="ml-auto h-5 w-14 rounded-full" /></span>
                  <Skeleton className="h-3 w-56" />
                </li>
              ))
            : shown.map((r) => {
                const k = rowKey(r);
                const href = rowHref?.(r);
                const inner = (
                  <>
                    <span className="flex min-w-0 items-center gap-3">
                      {selectable ? <Checkbox aria-label={`Select ${k}`} checked={sel.has(k)} onCheckedChange={() => toggle(k)} /> : null}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{(title.mobileCell ?? title.cell)(r)}</span>
                      {status ? <span className="shrink-0">{(status.mobileCell ?? status.cell)(r)}</span> : null}
                    </span>
                    {facts.length ? (
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                        {facts.map((f, i) => (
                          <span key={f.key} className="t-num inline-flex min-w-0 items-center gap-2">
                            {i > 0 ? <span aria-hidden className="size-0.5 rounded-full bg-ink-3" /> : null}
                            {(f.mobileCell ?? f.cell)(r)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={k} className={cn(sel.has(k) && 'bg-accent-tint')}>
                    {href ? (
                      <Link href={href} className="flex min-w-0 flex-col gap-1.5 px-(--card-pad) py-3.5 transition-colors hover:bg-fill-hover">{inner}</Link>
                    ) : (
                      <div className="flex min-w-0 flex-col gap-1.5 px-(--card-pad) py-3.5">{inner}</div>
                    )}
                  </li>
                );
              })}
        </ul>
      </>
    );
  }

  return (
    <section aria-label={caption} className={cn('relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card', className)}>
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
