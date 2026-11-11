import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePaged } from '@/components/ui/pagination';
import { PageControl } from '@/console/paged';

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

/** Access's tokens, teams and members panels page through this one control (Task I-139). */
function Roster({ list }: { list: number[] }) {
  const { rows: page, ...pager } = usePaged(list);
  return <><ul>{page.map((r) => <li key={r}>{r}</li>)}</ul><PageControl {...pager} noun="people" /></>;
}

describe('PageControl', () => {
  it('pages at ten under the total and offers no larger page', () => {
    const { container } = render(<Roster list={rows} />);
    expect(container.querySelectorAll('ul > li')).toHaveLength(10);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('1–10 of 23 people');
    // One size is not a choice: since 0.37.0 the pager draws no page-size menu rather than a menu with one entry.
    expect(screen.queryByRole('button', { name: /per page/ })).toBeNull();
  });

  it('draws nothing for a list that fits on one page', () => {
    render(<Roster list={rows.slice(0, 10)} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });
});
