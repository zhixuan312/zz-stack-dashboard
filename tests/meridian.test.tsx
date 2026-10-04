import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meridian, useMeridian, useMeridianIndex } from '@/components/charts/meridian';

const dates = ['2026-10-01', '2026-10-02', '2026-10-03'];
function Pointer() {
  const { setIndex } = useMeridian(dates);
  return <button onClick={() => setIndex(1)}>point</button>;
}
function Readout({ name }: { name: string }) {
  const { index } = useMeridianIndex();
  return <p data-testid={name}>{index === null ? 'none' : dates[index]}</p>;
}

describe('the Meridian', () => {
  it('shares one cursor between every reader on a page', () => {
    render(<Meridian dates={dates}><Pointer /><Readout name="a" /><Readout name="b" /></Meridian>);
    expect(screen.getByTestId('a').textContent).toBe('none');
    act(() => screen.getByText('point').click());
    expect(screen.getByTestId('a').textContent).toBe('2026-10-02');
    expect(screen.getByTestId('b').textContent).toBe('2026-10-02');
  });
  it('gives a chart outside a provider its own cursor', () => {
    render(<><Pointer /><Readout name="c" /></>);
    act(() => screen.getByText('point').click());
    expect(screen.getByTestId('c').textContent).toBe('none');
  });
});
