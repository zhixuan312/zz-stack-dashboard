import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PageControl, usePaged } from '@/components/ui/pagination';

/** A table is the only honest fixture here: the hook and the control are one feature. */
function Paged({ n, resetKey }: { n: number; resetKey?: string }) {
  const rows = [...Array(n).keys()].map((i) => `row-${i + 1}`);
  const { page, controls } = usePaged(rows, resetKey);
  return (
    <div>
      <ul>{page.map((r) => <li key={r}>{r}</li>)}</ul>
      <PageControl {...controls} />
    </div>
  );
}
const draw = (n: number) => render(<Paged n={n} />);

/* DELIBERATE: the default page size is asserted once, here, and every range below is derived
 * from it. Written as literals, moving the default turns every behavioural test red, and none
 * of them is about the default. */
const SIZE = DEFAULT_PAGE_SIZE;

/** Rows that can shrink underneath a reader who is already on a later page — a refetch, a
 *  filter, a row someone else deleted. */
function Shrinking() {
  const [n, setN] = useState(54);
  return (
    <div>
      <button type="button" onClick={() => setN(25)}>shrink</button>
      <Paged n={n} />
    </div>
  );
}

describe('PageControl', () => {
  /* No pager when everything fits: a disabled pager under three rows is chrome for a problem
   * the table does not have. */
  it('is absent when everything fits on one page', () => {
    draw(10);
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument();
    expect(screen.getByText('row-10')).toBeInTheDocument();
  });

  it('opens at the default page size', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(PAGE_SIZES).toContain(DEFAULT_PAGE_SIZE);
  });

  it('states the range, so a page never reads as the whole list', () => {
    draw(54);
    expect(screen.getByText(`1–${SIZE} of 54`)).toBeInTheDocument();
  });

  it('moves to the page you click, and says where you are', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 2'));
    expect(screen.getByText(`${SIZE + 1}–${SIZE * 2} of 54`)).toBeInTheDocument();
    expect(screen.getByText(`row-${SIZE + 1}`)).toBeInTheDocument();
    expect(screen.queryByText('row-1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
  });

  /* The last page is short, and its range says so rather than claiming a full page. */
  it('reports a short final page honestly', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 3'));
    expect(screen.getByText(`${SIZE * 2 + 1}–54 of 54`)).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('cannot step past either end', async () => {
    draw(54);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByLabelText('Previous page')).toBeEnabled();
  });

  /* Changing the size returns to the first page: staying on the last page while the size
   * grows lands the reader past the end of the list. */
  it('goes back to the first page when the size changes', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 3'));
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '30');
    expect(screen.getByText('1–30 of 54')).toBeInTheDocument();
  });

  /* Clamped on read, not in an effect: a refetch that returns fewer rows leaves `at` past the
   * end, and a page rendering empty from its own stale state reads as lost data. */
  it('falls back to the last real page when the rows shrink underneath it', async () => {
    render(<Shrinking />);
    await userEvent.click(screen.getByLabelText('Page 3'));
    expect(screen.getByText(`${SIZE * 2 + 1}–54 of 54`)).toBeInTheDocument();
    await userEvent.click(screen.getByText('shrink'));
    // 25 rows is two pages, so page 3 no longer exists: show the last one that does.
    expect(screen.getByText(`${SIZE + 1}–25 of 25`)).toBeInTheDocument();
    expect(screen.getByText(`row-${SIZE + 1}`)).toBeInTheDocument();
  });

  /* A new question starts at page 1. The reset key is the filter; keeping a later page after
   * a search shows the matches from partway down, and the earlier ones look missing. */
  it('returns to the first page when the reset key changes', async () => {
    function Filtered() {
      const [q, setQ] = useState('');
      return (
        <div>
          <button type="button" onClick={() => setQ('x')}>filter</button>
          <Paged n={q ? 40 : 54} resetKey={q} />
        </div>
      );
    }
    render(<Filtered />);
    await userEvent.click(screen.getByLabelText('Page 2'));
    expect(screen.getByText(`${SIZE + 1}–${SIZE * 2} of 54`)).toBeInTheDocument();
    await userEvent.click(screen.getByText('filter'));
    expect(screen.getByText(`1–${SIZE} of 40`)).toBeInTheDocument();
  });

  /* A window, not every page — 400 buttons is a paragraph of numbers. */
  it('windows the page numbers on a long list', () => {
    draw(4000);
    const last = 4000 / SIZE;
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText(`Page ${last}`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`Page ${last / 2}`)).not.toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });
});
