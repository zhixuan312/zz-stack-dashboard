import { render, screen } from '@testing-library/react';
import { Freshness } from '@/components/ui/freshness';

/**
 * The freshness stamp exists so a stalled pipeline and a quiet Tuesday stop
 * looking identical. Both render as a flat line; only the timestamp tells them
 * apart. These lock the three states it has to get right.
 *
 * `now` is injected throughout — a test that reads the wall clock to assert
 * something about elapsed time is a test that fails at midnight.
 */
const NOW = new Date('2026-08-16T09:00:00Z');

describe('Freshness', () => {
  it('reads as recent inside the staleness window', () => {
    render(
      <Freshness
        at={new Date(NOW.getTime() - 4 * 60_000)}
        staleAfterMs={15 * 60_000}
        now={NOW}
      />,
    );
    expect(screen.getByText(/4 min ago/)).toBeInTheDocument();
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument();
  });

  it('says so once the data is older than its refresh contract', () => {
    render(
      <Freshness
        at={new Date(NOW.getTime() - 40 * 60_000)}
        staleAfterMs={15 * 60_000}
        now={NOW}
      />,
    );
    expect(screen.getByText(/stale/)).toBeInTheDocument();
  });

  it('distinguishes "never refreshed" from "refreshed a long time ago"', () => {
    render(<Freshness at={null} now={NOW} />);
    expect(screen.getByText(/never/)).toBeInTheDocument();
  });

  it('never claims staleness when no contract was given', () => {
    // Without `staleAfterMs` there is no threshold to be past. Guessing one
    // would mean the component inventing a refresh cadence it cannot know.
    render(<Freshness at={new Date(NOW.getTime() - 30 * 86_400_000)} now={NOW} />);
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument();
  });

  it('keeps the absolute timestamp reachable for anyone quoting it', () => {
    const { container } = render(
      <Freshness at={new Date(NOW.getTime() - 60_000)} now={NOW} />,
    );
    expect(container.firstElementChild).toHaveAttribute('title', expect.stringContaining('2026'));
  });
});
