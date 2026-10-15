import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * A secret shown once is never part of the page text the assistant reads (bug ee35a0d7, spec FR-22).
 *
 * The assistant sends the visible text of `[data-scroll-region]` with every message. A newly issued token and a
 * superadmin's enrolment link are each shown exactly once, and while they are on screen an Ask would have carried
 * them into the model's context. So each is drawn in a dialog, which the design system portals to the document's
 * body, outside the region: the person still reads and copies it, and the region's text never holds it.
 */
import type { PlatformPersonRow } from '@/lib/api-shapes';
import { TokensPanel } from '@/console/settings/tokens-panel';
import { PlatformPeoplePanel } from '@/console/settings/platform-people-panel';

const TOKEN = 'zz_pat_0123456789abcdefSECRET';
const LINK = 'https://example.invalid/enrol#SECRETLINK0123456789';

const PEOPLE: PlatformPersonRow[] = [
  { email: 'two@example.com', display_name: 'Two', role: 'member', status: 'active', created_at: '2026-08-02T00:00:00Z', teams: [] },
];

function mockFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const post = init?.method === 'POST';
    const body = url.includes('/settings/me/tokens') ? (post ? { token: TOKEN, label: 'laptop', email: 'a@b.example.com' } : [])
      : url.includes('/settings/platform/enrolments') ? { ok: true, url: LINK, result: 'issued' }
        : url.includes('/settings/platform/people') ? PEOPLE
          : {};
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  };
}

beforeEach(() => {
  global.fetch = mockFetch() as unknown as typeof fetch;
});

async function mount(panel: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    render(<QueryClientProvider client={client}><div data-scroll-region>{panel}</div></QueryClientProvider>);
  });
  return document.querySelector<HTMLElement>('[data-scroll-region]')!;
}

describe('a secret shown once stays out of the page text the assistant reads', () => {
  it('draws a newly issued token outside the scroll region', async () => {
    const region = await mount(<TokensPanel />);
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Issue token'));
    await act(async () => { fireEvent.click(button!); });
    await waitFor(() => expect(document.body.textContent).toContain(TOKEN));
    expect(region.textContent).not.toContain(TOKEN);
  });

  it('draws a new enrolment link outside the scroll region', async () => {
    const region = await mount(<PlatformPeoplePanel />);
    await waitFor(() => expect(region.textContent).toContain('two@example.com'));
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Enrolment link'));
    await act(async () => { fireEvent.click(button!); });
    await waitFor(() => expect(document.body.textContent).toContain(LINK));
    expect(region.textContent).not.toContain(LINK);
  });
});
