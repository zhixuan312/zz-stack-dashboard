import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePaged } from '@/components/ui/pagination';

const rows = Array.from({ length: 23 }, (_, i) => i + 1);

describe('usePaged', () => {
  it('pages the rows and says when a pager is needed', () => {
    const { result } = renderHook(() => usePaged(rows, { pageSize: 10 }));
    expect(result.current.rows).toEqual(rows.slice(0, 10));
    expect(result.current.paged).toBe(true);
    act(() => result.current.pagination.onPageChange(3));
    expect(result.current.rows).toEqual([21, 22, 23]);
    expect(renderHook(() => usePaged(rows.slice(0, 4), { pageSize: 10 })).result.current.paged).toBe(false);
  });

  it('lands on the first page when what narrows the rows changes', () => {
    const { result, rerender } = renderHook(({ key }) => usePaged(rows, { pageSize: 10, resetKey: key }), { initialProps: { key: '' } });
    act(() => result.current.pagination.onPageChange(2));
    expect(result.current.pagination.page).toBe(2);
    rerender({ key: 'ada' });
    expect(result.current.pagination.page).toBe(1);
  });

  it('clamps to the last page when the rows shrink under it', () => {
    const { result, rerender } = renderHook(({ list }) => usePaged(list, { pageSize: 10 }), { initialProps: { list: rows } });
    act(() => result.current.pagination.onPageChange(3));
    rerender({ list: rows.slice(0, 12) });
    expect(result.current.pagination.page).toBe(2);
    expect(result.current.rows).toEqual([11, 12]);
  });

  it('returns to the first page when the page size changes', () => {
    const { result } = renderHook(() => usePaged(rows, { pageSize: 10 }));
    act(() => result.current.pagination.onPageChange(3));
    act(() => result.current.pagination.onPageSizeChange(20));
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.rows).toHaveLength(20);
  });
});
