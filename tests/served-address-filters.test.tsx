import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { INITIATIVES_DEFAULTS, filtersOf, filtersOfPath, listPath } from '@/logic/initiatives-filter';
import { useServedAddress } from '@/logic/use-served';

/**
 * Once the browser knows its own address, a page draws it through the same `filtersOf` its server read was made with:
 * a value the route does not know is no filter there too, so "Clear filters" and the assistant's words never name it.
 */
function Drawn({ served }: { served: { path: string } }) {
  const [f] = useServedAddress(INITIATIVES_DEFAULTS, served, filtersOfPath, filtersOf);
  return <p>{f.state}</p>;
}

afterEach(() => window.history.replaceState(null, '', '/'));

describe('the address a page draws', () => {
  it('reads a state the route does not know as no filter', () => {
    window.history.replaceState(null, '', '/initiatives?state=closed');
    const { container } = render(<Drawn served={{ path: listPath(filtersOf({ state: 'closed' })) }} />);
    expect(container.textContent).toBe('all');
  });

  it('keeps a state the route knows', () => {
    window.history.replaceState(null, '', '/initiatives?state=waiting');
    const { container } = render(<Drawn served={{ path: listPath(filtersOf({ state: 'waiting' })) }} />);
    expect(container.textContent).toBe('waiting');
  });
});
