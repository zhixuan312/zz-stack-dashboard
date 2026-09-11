import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The picker writes the URL, and the URL is what every reader of the period reads.
 *
 * Worth its own test because this control has now been broken twice in two different ways,
 * both invisible to a render assertion. First it wrote a URL parameter nothing consumed.
 * Then it wrote one that `useSearchParams()` never read back on a statically prerendered
 * route, so the trigger sat on its initial label for ever while every option did nothing.
 *
 * So these drive it the way a person does — open the menu, click an option — and assert
 * BOTH halves: the state the page reads, and the label the person reads. Either one alone
 * is what let each version look fine.
 */
import { PeriodProvider, usePeriod } from '@/components/PeriodProvider';
import { PeriodSelect } from '@/components/PeriodSelect';

/** Reports what the provider currently holds, so a test can assert the state MOVED
 *  rather than only that the trigger's label did. Those are the two halves the broken
 *  version got wrong in opposite directions. */
function Readout() {
  return <output data-testid="period">{usePeriod().period}</output>;
}

function mount() {
  return render(
    <PeriodProvider>
      <PeriodSelect />
      <Readout />
    </PeriodProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('PeriodSelect', () => {
  it('shows All time when the address bar names no period', () => {
    mount();
    expect(screen.getByLabelText('Reporting period')).toHaveTextContent('All time');
  });

  it('opens on the period the address bar names', () => {
    window.history.replaceState(null, '', '/?period=1d');
    mount();
    expect(screen.getByLabelText('Reporting period')).toHaveTextContent('Last 24 hours');
  });

  it('CHANGES when an option is chosen — the whole point, and what was broken', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText('Reporting period'));
    await user.click(await screen.findByText('Last 7 days'));
    // Both halves: the state the page reads, and the label the person reads.
    expect(screen.getByTestId('period')).toHaveTextContent('7d');
    expect(screen.getByLabelText('Reporting period')).toHaveTextContent('Last 7 days');
  });

  it('writes the choice to the address bar so the view stays linkable', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText('Reporting period'));
    await user.click(await screen.findByText('Last 30 days'));
    expect(window.location.search).toBe('?period=30d');
  });

  it('spells all time as no parameter, not as period=all', async () => {
    // `?period=all` and a bare `/` must not be two URLs for one view.
    window.history.replaceState(null, '', '/?period=30d');
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText('Reporting period'));
    await user.click(await screen.findByText('All time'));
    expect(window.location.search).toBe('');
    expect(screen.getByTestId('period')).toHaveTextContent('all');
  });

  it('keeps every other parameter already in the address bar', async () => {
    // `?open=` is a real one — a knowledge citation sets it — and a picker that dropped it
    // would silently close whatever the reader had open.
    window.history.replaceState(null, '', '/?open=product-1%2Fnode-1');
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByLabelText('Reporting period'));
    await user.click(await screen.findByText('Last 30 days'));
    expect(window.location.search).toContain('open=product-1');
    expect(window.location.search).toContain('period=30d');
  });
});
