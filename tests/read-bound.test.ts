import { QueryClient, QueryClientProvider, defaultScheduler, notifyManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Query } from '@/console/query';
import { useConsole } from '@/lib/api';

/**
 * A page read the gateway never answers ends in a stated failure, never an endless skeleton (spec AC-8.7): loading at
 * once, and four and a half seconds after the read was sent the read's error state, with the sentence that says why and
 * a Retry that reads again: half a second under five, for the phone to draw it. A late answer to the read that was given up on is never shown over the one Retry fetched.
 *
 * `fetch` here ignores the abort, as a slow network can: the bound must hold whether or not the request honours it. The
 * clock is fake and the cache tells its readers on a microtask rather than its own zero-delay timer, so the read's bound
 * is the only thing the clock moves.
 */
type Answer = { n: number };
const late: { answer: (body: Answer) => void }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  notifyManager.setScheduler(queueMicrotask);
  late.length = 0;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
    late.push({ answer: (body) => resolve({ ok: true, status: 200, json: async () => body } as unknown as Response) });
  })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); notifyManager.setScheduler(defaultScheduler); });

function Teams() {
  const q = useConsole<Answer>('/teams');
  // `Query`'s child is a function of the data, which createElement's children argument is not typed to carry.
  // eslint-disable-next-line react/no-children-prop
  return createElement(Query<Answer>, { query: q, what: 'Teams', children: (d: Answer) => createElement('p', null, `rows ${d.n}`) });
}

const page = () => render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Teams)));
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('a page read the gateway does not answer', () => {
  it('shows loading at once and the read failed, with Retry, four and a half seconds after it was sent', async () => {
    page();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    await pass(4_499);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    await pass(1);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Teams did not load');
    expect(alert.textContent).toContain('The platform did not answer in time. Nothing in this part of the page was read.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('reads again on Retry, and a late answer to the read it gave up on never replaces the new one', async () => {
    page();
    await pass(4_500);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await pass(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { late[1].answer({ n: 2 }); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('rows 2')).toBeTruthy();
    await act(async () => { late[0].answer({ n: 1 }); await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByText('rows 2')).toBeTruthy();
    expect(screen.queryByText('rows 1')).toBeNull();
  });
});
