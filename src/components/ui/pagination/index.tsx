'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

/** Page numbers with gaps: 1 … 4 5 6 … 12. Always the first, the last, and one either side of the current page. */
export function pageList(page: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

/**
 * Moves through a long list a page at a time, and says where you are: "21–40 of 240". Every list that can pass ten
 * rows pages, which is what lets a card stay its content's height. Where the pager is narrow (a phone, a card in a column) only the arrows and "Page 2 of 12" remain.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizes,
  onPageSizeChange,
  noun = 'rows',
  className,
}: {
  /** One-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Offer a rows-per-page choice: [10, 20, 50]. */
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
  /** What a row is, for the range line: "requests". */
  noun?: string;
  className?: string;
}) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={cn('@container/pager flex min-w-0 items-center gap-3 text-sm', className)}>
      <p className="t-num min-w-0 truncate text-ink-2">
        <span className="@max-[32rem]/pager:hidden">
          <span className="font-medium text-ink">{from.toLocaleString('en-US')}–{to.toLocaleString('en-US')}</span> of {total.toLocaleString('en-US')} {noun}
        </span>
        <span className="@min-[32rem]/pager:hidden">Page <span className="font-medium text-ink">{page}</span> of {count}</span>
      </p>
      {pageSizes && onPageSizeChange ? (
        <Menu>
          <MenuTrigger className="press inline-flex h-(--control-sm) items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:bg-fill-hover hover:text-ink @max-[44rem]/pager:hidden">
            <span><span className="t-num">{pageSize}</span> per page</span><ChevronDown className="size-3.5" />
          </MenuTrigger>
          <MenuContent align="end" className="min-w-36">
            {pageSizes.map((s) => (
              <MenuItem key={s} onSelect={() => onPageSizeChange(s)} className="t-num">
                {s} per page
                {s === pageSize ? <Check className="ml-auto !text-accent" strokeWidth={2.25} /> : null}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <IconButton size="sm" variant="ghost" label="Previous page" icon={<ChevronLeft />} disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        <ol className="flex items-center gap-0.5 @max-[32rem]/pager:hidden">
          {pageList(page, count).map((p, i) => (
            <li key={p === 'gap' ? `gap-${i}` : p}>
              {p === 'gap' ? (
                <span aria-hidden className="grid h-(--control-sm) w-6 place-items-center text-ink-3">…</span>
              ) : (
                <button
                  type="button"
                  aria-current={p === page ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    't-num press hit grid h-(--control-sm) min-w-(--control-sm) place-items-center rounded-md px-1.5 text-sm transition-[color,background-color,border-color,transform] duration-(--dur-hover)',
                    p === page ? 'bg-surface font-semibold text-ink shadow-control ring-1 ring-line-strong' : 'text-ink-2 hover:bg-fill-hover hover:text-ink',
                  )}
                >
                  {p}
                </button>
              )}
            </li>
          ))}
        </ol>
        <IconButton size="sm" variant="ghost" label="Next page" icon={<ChevronRight />} disabled={page >= count} onClick={() => onPageChange(page + 1)} />
      </div>
    </nav>
  );
}

/**
 * A list that is not a data table, paged: a roster in a settings card, a short list inside a card. `resetKey` is
 * whatever narrows the rows (a search, a filter): the page is remembered against it, so narrowing lands on the first
 * page without an effect. The page is clamped on read, so a refetch that returns fewer rows never leaves an empty page.
 * Spread `pagination` onto <Pagination> when `paged` is true; a list that fits on one page shows no pager.
 */
export function usePaged<T>(rows: readonly T[], { pageSize = 10, resetKey = '' }: { pageSize?: number; resetKey?: string } = {}) {
  const [size, setSize] = useState(pageSize);
  const [at, setAt] = useState({ key: resetKey, page: 1 });
  const count = Math.max(1, Math.ceil(rows.length / size));
  const page = at.key === resetKey ? Math.min(at.page, count) : 1;
  return {
    rows: rows.slice((page - 1) * size, page * size),
    paged: rows.length > pageSize,
    pagination: {
      page,
      pageSize: size,
      total: rows.length,
      onPageChange: (p: number) => setAt({ key: resetKey, page: p }),
      onPageSizeChange: (n: number) => {
        setSize(n);
        setAt({ key: resetKey, page: 1 });
      },
    },
  };
}
