import { render } from '@testing-library/react';
import { MetricCard } from '@/components/ui/metric-card';
import { BarList } from '@/components/charts/BarList';
import { AXIS_FORMATTERS, FORMATTERS } from '@/lib/format';

/**
 * These lock the DISCIPLINE, not the pixels.
 *
 * Every rule here was broken at some point by a page that rendered fine and
 * simply looked wrong — four differently-coloured metric tiles, six accent bars,
 * a `$12.00` axis tick. A visual rule that only lives in a doc comment gets
 * re-broken by the next person who needs "just one more colour"; asserted, it
 * has to be argued with.
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
    expect(chip?.className).toMatch(/ink-faint/);
    expect(chip?.className).not.toMatch(/sage|rose/);
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

  it('draws the whole population neutral when nothing is highlighted', () => {
    const { container } = render(<BarList rows={ROWS} />);
    const fills = [...container.querySelectorAll('span[style*="width"]')].map(
      (el) => (el as HTMLElement).style.background,
    );
    expect(fills).toHaveLength(3);
    expect(fills.every((f) => f.includes('line-strong'))).toBe(true);
  });

  it('spends the accent on exactly one bar', () => {
    const { container } = render(<BarList rows={ROWS} highlight="b" />);
    const fills = [...container.querySelectorAll('span[style*="width"]')].map(
      (el) => (el as HTMLElement).style.background,
    );
    expect(fills.filter((f) => f.includes('--accent'))).toHaveLength(1);
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
