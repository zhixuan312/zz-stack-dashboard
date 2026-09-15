import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TrendChart, niceScale } from '@/components/charts/TrendChart';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';
import { DotStrip } from '@/components/charts/DotStrip';

/**
 * These assert the contracts that are easy to break and hard to see: the
 * accessible twin of each chart, and the axis-scale arithmetic. Rendering
 * without throwing is table stakes; the point is that the numbers are still
 * reachable when the mouse is not.
 *
 * Every render goes through a `TooltipProvider` because the app mounts one once, in
 * `Providers`, and the charts' readouts are Radix tooltips — a bare `render()` of a
 * chart throws `must be used within TooltipProvider`. This mirrors the app rather
 * than working around it: the same rule holds for any future chart with a readout.
 */
const render = (ui: ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

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

  /* THE BOUNDARY, not the fill.
   *
   * A volume bar is painted faint on purpose — it must not compete with the area series
   * above it. That was survivable while the categorical cycle handed out status hues; it
   * stopped being survivable when the cycle moved to the kit pastels, where a 20% fill on
   * cream is simply absent. The fix is a full-strength stroke in the same hue, which is the
   * SVG spelling of `--chart-edge` (`box-shadow: inset` does nothing to an SVG rect).
   *
   * This is asserted here rather than in a screenshot because NO PAGE CURRENTLY PASSES
   * `shape: 'bar'` — the path is real, reachable and unrendered, so a visual harness proves
   * nothing about it and the next caller would have inherited the bug silently.
   *
   * `fillOpacity` rather than `opacity` is the load-bearing half: a bare `opacity` fades the
   * stroke along with the fill and puts the boundary right back where it was.
   */
  it('gives volume bars a full-strength boundary, not just a faint fill', () => {
    const { container } = render(<TrendChart points={POINTS} series={SERIES} />);
    const bars = [...container.querySelectorAll('[data-role="volume-bar"]')];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.getAttribute('stroke')).toBeTruthy();
      expect(bar.getAttribute('fill')).toBe(bar.getAttribute('stroke'));
      expect(bar.getAttribute('fill-opacity')).toBeTruthy();
      // A bare `opacity` would fade the stroke with the fill.
      expect(bar.getAttribute('opacity')).toBeNull();
    }
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

describe('DotStrip', () => {
  /* A CHART MAY NOT DECIDE THE PAGE HEIGHT.
   *
   * The strip stacked a dot upward on every collision, with no cap, on a LINEAR axis — and the
   * distribution it exists for spans orders of magnitude, so nearly every observation landed
   * inside the first two percent and collided with the rest. Measured on production: 130 runs,
   * median 1 KB, max 95 KB, and the strip rendered 113 rows — about 800 pixels tall, as one
   * vertical column of dots. Every card in the overview stretched to match, because they share
   * a grid row, and the page became four mostly-empty columns.
   *
   * The numbers below are that shape: one value two orders of magnitude above a hundred tightly
   * clustered ones. Asserted on the inline height, because that is the thing that got away. */
  const heavyTail = [
    ...Array.from({ length: 100 }, (_, i) => ({ key: `small-${i}`, value: 1 + (i % 3) * 0.4, label: `run ${i}` })),
    { key: 'tail', value: 800, label: 'the one that pulled a book' },
  ];

  it('stays a strip when a hundred observations share the low end', () => {
    const { container } = render(
      <DotStrip dots={heavyTail} format={(v) => `${v.toFixed(0)} KB`} />,
    );
    const plot = container.querySelector('[style*="height"]') as HTMLElement;
    const px = Number.parseInt(plot.style.height, 10);
    expect(px).toBeGreaterThan(0);
    // Six rows is the cap; anything near the old 800 means the bound is gone.
    expect(px).toBeLessThanOrEqual(10 + 6 * 7);
  });

  it('spreads a heavy tail instead of crushing it against zero', () => {
    const { container } = render(
      <DotStrip dots={heavyTail} format={(v) => `${v.toFixed(0)} KB`} />,
    );
    const lefts = [...container.querySelectorAll('span[data-dot^="run "]')]
      .map((el) => Number.parseFloat((el as HTMLElement).style.left));
    // On a linear axis every one of the hundred sits below 0.5%. A log axis has to do better
    // than that, or the dots are still one column and the cap is only hiding it.
    expect(Math.max(...lefts)).toBeGreaterThan(5);
  });
});
