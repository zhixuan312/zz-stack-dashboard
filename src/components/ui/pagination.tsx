'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A table's page control: how many rows at a time, and which page of them.
 *
 * WHY A CONTROL AND NOT A CAP. A cap ("show 44 more") answers "this list is long" and
 * nothing else — it can only ever go one way, it forgets on every render, and a reader who
 * wants the fortieth row has to expand all of them to reach it. Paging is the control a
 * reader already knows: pick a size, land on a page, come back to the same place. The cap
 * this replaced was the cheaper thing to build, not the better thing to use.
 *
 * IT DISAPPEARS WHEN IT HAS NOTHING TO SAY. Below the smallest page size there is exactly
 * one page and no choice to make, so the whole strip is absent rather than present-and-inert
 * — a disabled control on a three-row table is chrome describing a problem the table does
 * not have. This is the same rule the Runs banner and the refusal callout already follow.
 *
 * THE RANGE IS ALWAYS STATED. "1–10 of 54" is the part that stops a page of rows reading as
 * the whole list, which is the one thing a paged table must never do.
 */
export const PAGE_SIZES = [10, 20, 30] as const;

/** How many rows a table opens with.
 *
 *  NAMED, NOT `PAGE_SIZES[0]`. The default was the first offered size by accident of
 *  indexing, so "what a table opens with" and "the smallest size a reader may pick" were
 *  the same number for no reason anyone had decided. They answer different questions: the
 *  floor exists so a reader can make a long table short, and the default exists so the
 *  first screen shows enough to be worth reading. Ten filled about a third of a 1440px
 *  window and sent a reader to the pager to see a list of twenty-nine.
 *
 *  It is still one of PAGE_SIZES, because the select has no option for a size it is not
 *  offering — a table opening at a size its own control cannot return to is a state a
 *  reader gets out of once and cannot get back into. */
export const DEFAULT_PAGE_SIZE: (typeof PAGE_SIZES)[number] = 20;

export function usePaged<T>(rows: T[], resetKey: string = ''): {
  page: T[]; controls: PageControlProps;
} {
  const [size, setSize] = useState<number>(DEFAULT_PAGE_SIZE);
  /* THE PAGE IS REMEMBERED AGAINST THE QUESTION IT ANSWERED. `resetKey` is whatever narrows
     the rows — a search, a facet. Reading page 4 of every initiative and then typing a search
     must land on page 1 of the matches, not on page 4 of a list that no longer has one. */
  const [at, setAt] = useState<{ key: string; i: number }>({ key: resetKey, i: 0 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  /* CLAMPED ON READ, not in an effect. Shrinking the page size, or a refetch that returns
     fewer rows, can leave `at` past the end — and a page that renders empty because of its
     own stale state looks exactly like a list that lost its data. */
  const current = at.key === resetKey ? Math.min(at.i, pages - 1) : 0;
  const start = current * size;
  return {
    page: rows.slice(start, start + size),
    controls: {
      total: rows.length, size, at: current, pages,
      from: rows.length === 0 ? 0 : start + 1,
      to: Math.min(start + size, rows.length),
      onSize: (n) => { setSize(n); setAt({ key: resetKey, i: 0 }); },
      onPage: (i) => setAt({ key: resetKey, i }),
    },
  };
}

export interface PageControlProps {
  total: number; size: number; at: number; pages: number; from: number; to: number;
  onSize: (n: number) => void;
  onPage: (i: number) => void;
}

export function PageControl({ total, size, at, pages, from, to, onSize, onPage }: PageControlProps) {
  if (total <= PAGE_SIZES[0]) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-2.5">
      <span className="t-micro tabular-nums text-ink-faint">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 t-micro text-ink-faint">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            aria-label="Rows per page"
            className="focus-ring cursor-pointer rounded-[var(--r-sm)] border border-line bg-surface px-1.5 py-0.5 tabular-nums text-ink-soft"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <nav className="flex items-center gap-0.5" aria-label="Pages">
          <Step label="Previous page" disabled={at === 0} onClick={() => onPage(at - 1)}>
            <ChevronLeft className="size-3.5" />
          </Step>
          {pageList(at, pages).map((p, i) => (p === GAP ? (
            <span key={`gap${i}`} className="px-1 t-micro text-ink-faint">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-label={`Page ${p + 1}`}
              aria-current={p === at ? 'page' : undefined}
              className={cn(
                'focus-ring min-w-6 rounded-[var(--r-sm)] px-1.5 py-0.5 tabular-nums text-xs transition-colors',
                p === at ? 'bg-accent-tint font-medium text-accent-deep' : 'text-ink-soft hover:text-ink',
              )}
            >
              {p + 1}
            </button>
          )))}
          <Step label="Next page" disabled={at >= pages - 1} onClick={() => onPage(at + 1)}>
            <ChevronRight className="size-3.5" />
          </Step>
        </nav>
      </div>
    </div>
  );
}

function Step({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="focus-ring rounded-[var(--r-sm)] p-1 text-ink-soft transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const GAP = -1;

/**
 * Which page numbers to draw: always the first and last, always the current and its
 * neighbours, an ellipsis for whatever that skips.
 *
 * A WINDOW, NOT EVERY PAGE. 100 initiatives at ten a page is ten buttons and fits; 4,000
 * documents is four hundred, which wraps to a paragraph of numbers and makes the control
 * taller than the rows it pages. The window is a fixed width at any length.
 */
function pageList(at: number, pages: number): number[] {
  if (pages <= 7) return [...Array(pages).keys()];
  const near = [0, 1, at - 1, at, at + 1, pages - 2, pages - 1]
    .filter((p) => p >= 0 && p < pages);
  const keep = [...new Set(near)].sort((a, b) => a - b);
  const out: number[] = [];
  for (const [i, p] of keep.entries()) {
    if (i > 0 && p - keep[i - 1] > 1) out.push(GAP);
    out.push(p);
  }
  return out;
}
