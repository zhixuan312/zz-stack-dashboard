import { render } from '@testing-library/react';
import { MetricCard } from '@/components/ui/metric-card';
import { BarList } from '@/components/charts/BarList';
import { AXIS_FORMATTERS, FORMATTERS } from '@/lib/format';

/**
 * These lock the discipline, not the pixels — the visual rules a page can break while still
 * rendering fine.
 */

describe('metric tile law', () => {
  it('renders the value in the display register, not as body text', () => {
    const { container } = render(<MetricCard label="Requests" value="213,921" />);
    expect(container.querySelector('.t-stat')?.textContent).toBe('213,921');
  });

  it('gives the accent ONLY to the emphasised tile', () => {
    const { container: plain } = render(<MetricCard label="Spend" value="$660" />);
    const { container: lead } = render(<MetricCard label="Requests" value="213,921" emphasis />);
    expect(plain.querySelector('.t-stat')?.className).not.toMatch(/accent/);
    expect(lead.querySelector('.t-stat')?.className).toMatch(/accent/);
  });

  it('does not assert a sentiment the caller did not give', () => {
    // `neutral` is the default, and it renders in the ink ladder. A delta that
    // guessed "up is good" would be wrong for an error rate.
    const { container } = render(
      <MetricCard label="Spend" value="$660" delta={{ value: '$23', direction: 'up' }} />,
    );
    const chip = container.querySelector('.tabular-nums');
    // DELIBERATE: the assertion is the property, not the class name. A delta with no stated
    // sentiment must say nothing about whether the movement is good — no status hue, and any
    // rung of the ink ladder.
    expect(chip?.className).toMatch(/text-ink(-soft|-faint)?\b/);
    expect(chip?.className).not.toMatch(/sage|rose|amber/);
  });

  it('colours a delta by sentiment, not by direction', () => {
    // Down + good is the error-rate case: the arrow points down and the chip is
    // positive. Direction and sentiment are independent on purpose.
    const { container } = render(
      <MetricCard
        label="Error rate"
        value="1.26%"
        delta={{ value: '0.45%', direction: 'down', sentiment: 'good' }}
      />,
    );
    expect(container.querySelector('.tabular-nums')?.className).toMatch(/sage/);
  });

  it('dims a measured zero instead of shouting it', () => {
    const { container } = render(<MetricCard label="Down" value={0} muted />);
    expect(container.querySelector('.t-stat')?.className).toMatch(/ink-faint/);
  });
});

describe('chart palette discipline', () => {
  const ROWS = [
    { key: 'a', label: 'Alpha', value: 10 },
    { key: 'b', label: 'Beta', value: 6 },
    { key: 'c', label: 'Gamma', value: 3 },
  ];

  it('draws every row in the theme accent', () => {
    const { container } = render(<BarList rows={ROWS} />);
    const fills = [...container.querySelectorAll('span[style*="width"]')].map(
      (el) => (el as HTMLElement).style.background,
    );
    expect(fills).toHaveLength(3);
    expect(fills.every((f) => f.includes('--accent'))).toBe(true);
  });

  it("lets a row's explicit tint win, for categorical colour", () => {
    const { container } = render(
      <BarList rows={[{ key: 'a', label: 'Alpha', value: 10, tint: 'steel' }]} />,
    );
    const fill = (container.querySelector('span[style*="width"]') as HTMLElement).style.background;
    expect(fill).toContain('--steel');
  });
});

describe('axis formatters', () => {
  it('drops the cents an axis tick does not need', () => {
    expect(AXIS_FORMATTERS.cost(12)).toBe('$12');
    expect(FORMATTERS.cost(12)).toBe('$12.00');
  });

  it('keeps sub-dollar precision, where rounding would show every tick as $0', () => {
    expect(AXIS_FORMATTERS.cost(0.25)).toBe('$0.25');
  });

  it('abbreviates large counts', () => {
    expect(AXIS_FORMATTERS.count(1_200_000)).toBe('1.2M');
  });

  it('covers every format name, so a series can never name one that is missing', () => {
    for (const name of Object.keys(FORMATTERS)) {
      expect(Object.keys(AXIS_FORMATTERS)).toContain(name);
    }
  });
});
