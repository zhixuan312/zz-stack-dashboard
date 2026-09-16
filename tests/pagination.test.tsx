import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { PageControl, usePaged } from '@/components/ui/pagination';

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

/** Rows that can shrink underneath a reader who is already on a later page — a refetch, a
 *  filter, a row someone else deleted. */
function Shrinking() {
  const [n, setN] = useState(54);
  return (
    <div>
      <button type="button" onClick={() => setN(12)}>shrink</button>
      <Paged n={n} />
    </div>
  );
}

describe('PageControl', () => {
  /* CHROME FOR A PROBLEM THE TABLE DOES NOT HAVE. A disabled pager under three rows is the
   * same mistake as the Runs banner firing on an empty table. */
  it('is absent when everything fits on one page', () => {
    draw(10);
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument();
    expect(screen.getByText('row-10')).toBeInTheDocument();
  });

  it('states the range, so a page never reads as the whole list', () => {
    draw(54);
    expect(screen.getByText('1–10 of 54')).toBeInTheDocument();
  });

  it('moves to the page you click, and says where you are', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 3'));
    expect(screen.getByText('21–30 of 54')).toBeInTheDocument();
    expect(screen.getByText('row-21')).toBeInTheDocument();
    expect(screen.queryByText('row-11')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
  });

  /* THE LAST PAGE IS SHORT, and its range has to say so rather than claiming a full page. */
  it('reports a short final page honestly', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 6'));
    expect(screen.getByText('51–54 of 54')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('cannot step past either end', async () => {
    draw(54);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByLabelText('Previous page')).toBeEnabled();
  });

  /* CHANGING SIZE RETURNS TO THE FIRST PAGE. Staying on page 6 of 6 while the size grows
   * lands the reader past the end of the list they just asked to see more of. */
  it('goes back to the first page when the size changes', async () => {
    draw(54);
    await userEvent.click(screen.getByLabelText('Page 6'));
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '30');
    expect(screen.getByText('1–30 of 54')).toBeInTheDocument();
  });

  /* CLAMPED ON READ, not in an effect. A refetch that returns fewer rows leaves `at` past
   * the end, and a page that renders empty because of its own stale state looks exactly
   * like a list that lost its data — the worst possible reading of a working table. */
  it('falls back to the last real page when the rows shrink underneath it', async () => {
    render(<Shrinking />);
    await userEvent.click(screen.getByLabelText('Page 6'));
    expect(screen.getByText('51–54 of 54')).toBeInTheDocument();
    await userEvent.click(screen.getByText('shrink'));
    // 12 rows is two pages, so page 6 no longer exists: show the last one that does.
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    expect(screen.getByText('row-11')).toBeInTheDocument();
  });

  /* A NEW QUESTION STARTS AT PAGE 1. The reset key is the filter; keeping page 4 after a
   * search was typed shows the matches from row 31 on, and the first thirty look missing. */
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
    await userEvent.click(screen.getByLabelText('Page 4'));
    expect(screen.getByText('31–40 of 54')).toBeInTheDocument();
    await userEvent.click(screen.getByText('filter'));
    expect(screen.getByText('1–10 of 40')).toBeInTheDocument();
  });

  /* A WINDOW, NOT EVERY PAGE — 400 buttons is a paragraph of numbers. */
  it('windows the page numbers on a long list', () => {
    draw(4000);
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 400')).toBeInTheDocument();
    expect(screen.queryByLabelText('Page 200')).not.toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });
});
