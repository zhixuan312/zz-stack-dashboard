import { render, screen } from '@testing-library/react';
import { TrendChart, niceScale } from '@/components/charts/TrendChart';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';

/**
 * These assert the contracts that are easy to break and hard to see: the
 * accessible twin of each chart, and the axis-scale arithmetic. Rendering
 * without throwing is table stakes; the point is that the numbers are still
 * reachable when the mouse is not.
 */

const POINTS = [
  { date: '2026-08-01', spend: 10, budget: 12, hits: 400 },
  { date: '2026-08-02', spend: 14, budget: 12, hits: 620 },
  { date: '2026-08-03', spend: 9, budget: 12, hits: 310 },
];

const SERIES = [
  { key: 'spend', label: 'Spend', shape: 'area' as const, format: 'cost' as const },
  { key: 'budget', label: 'Budget', shape: 'line' as const, format: 'cost' as const },
  { key: 'hits', label: 'Hits', shape: 'bar' as const },
];

describe('niceScale', () => {
  it('rounds the maximum up to a clean multiple of the step', () => {
    const { max, step } = niceScale(37);
    expect(step).toBeGreaterThan(0);
    expect(max).toBeGreaterThanOrEqual(37);
    expect(max % step).toBeCloseTo(0, 6);
  });

  it('never divides by zero on an all-zero series', () => {
    expect(niceScale(0)).toEqual({ max: 1, step: 1 });
  });
});

describe('TrendChart', () => {
  it('emits every series and every point in the accessible table', () => {
    render(<TrendChart points={POINTS} series={SERIES} />);
    const table = screen.getByRole('table', { hidden: true });
    // One header row + one row per point.
    expect(table.querySelectorAll('tbody tr')).toHaveLength(POINTS.length);
    for (const s of SERIES) {
      expect(screen.getAllByText(s.label).length).toBeGreaterThan(0);
    }
  });

  it('renders the empty state rather than a broken axis below two points', () => {
    render(<TrendChart points={POINTS.slice(0, 1)} series={SERIES} emptyLabel="Not enough data" />);
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
  });

  it('formats the axis with the first non-bar series formatter', () => {
    const { container } = render(<TrendChart points={POINTS} series={SERIES} />);
    // `cost` formatting means the ticks carry a currency prefix, not bare counts.
    const ticks = [...container.querySelectorAll('svg text')].map((t) => t.textContent ?? '');
    expect(ticks.some((t) => t.startsWith('$'))).toBe(true);
  });
});

describe('ActivityHeatmap', () => {
  it('uses the caller unit noun rather than a hardcoded one', () => {
    render(
      <ActivityHeatmap cells={[{ weekday: 1, hour: 9, value: 5 }]} unitLabel="orders" />,
    );
    expect(screen.getByText(/orders/)).toBeInTheDocument();
  });

  it('shows an empty message when every bucket is zero', () => {
    render(<ActivityHeatmap cells={[{ weekday: 0, hour: 0, value: 0 }]} />);
    expect(screen.getByText(/no activity/i)).toBeInTheDocument();
  });
});

describe('BarList', () => {
  it('collapses rows past the limit into a single "more" row', () => {
    render(
      <BarList
        rows={[
          { key: 'a', label: 'Alpha', value: 10 },
          { key: 'b', label: 'Beta', value: 5 },
          { key: 'c', label: 'Gamma', value: 2 },
        ]}
        limit={2}
        moreLabel="others"
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
    expect(screen.getByText(/others/)).toBeInTheDocument();
  });
});

describe('CompositionBar', () => {
  it('renders one labelled slice per entry', () => {
    render(
      <CompositionBar
        slices={[
          { key: 'x', label: 'Database', value: 60 },
          { key: 'y', label: 'Network', value: 40 },
        ]}
      />,
    );
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });
});
