'use client';

import { useState } from 'react';
import { Pagination } from '@/components/ui/pagination';

type Controls = { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange: (n: number) => void };

/**
 * Ten rows at a time for a list that is not a data table (a roster inside a settings card). The page is remembered
 * against the question it answered: `resetKey` is whatever narrows the rows, so narrowing lands on the first page.
 * Clamped on read, so a refetch returning fewer rows never leaves an empty page behind.
 */
export function usePaged<T>(rows: T[], resetKey = ''): { page: T[]; controls: Controls } {
  const [size, setSize] = useState(10);
  const [at, setAt] = useState({ key: resetKey, i: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = at.key === resetKey ? Math.min(at.i, pages) : 1;
  return {
    page: rows.slice((current - 1) * size, current * size),
    controls: { page: current, pageSize: size, total: rows.length, onPageChange: (i) => setAt({ key: resetKey, i }), onPageSizeChange: (n) => { setSize(n); setAt({ key: resetKey, i: 1 }); } },
  };
}

/** The pager under such a list, shown only when there is more than one page. */
export function PageControl({ noun = 'rows', ...c }: Controls & { noun?: string }) {
  if (c.total <= 10) return null;
  return (
    <div className="border-t border-line px-(--card-pad) py-2.5">
      <Pagination page={c.page} pageSize={c.pageSize} total={c.total} noun={noun} onPageChange={c.onPageChange} pageSizes={[10, 20, 50]} onPageSizeChange={c.onPageSizeChange} />
    </div>
  );
}
