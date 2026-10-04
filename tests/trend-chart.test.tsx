import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChart } from '@/components/charts/trend-chart';

describe('a stacked trend chart', () => {
  it('reads out each part and the total, for screen readers too', () => {
    render(
      <TrendChart
        label="Calls by attribution"
        stacked
        dates={['2026-10-01', '2026-10-02']}
        series={[
          { key: 'a', label: 'Attributed', values: [80, 90] },
          { key: 'u', label: 'Unattributed', values: [15, null] },
          { key: 'r', label: 'Refused', values: [5, 10] },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Calls by attribution' });
    expect(table).toHaveTextContent('Total');
    // A missing part is no contribution: 90 + 0 + 10.
    const rows = table.querySelectorAll('tbody tr');
    expect(rows[0].lastElementChild).toHaveTextContent('100');
    expect(rows[1].lastElementChild).toHaveTextContent('100');
  });
});
