import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
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
    fireEvent.keyDown(screen.getByRole('button', { name: /per page/ }), { key: 'Enter' });
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['10 per page']);
  });

  it('draws nothing for a list that fits on one page', () => {
    render(<Roster list={rows.slice(0, 10)} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });
});
