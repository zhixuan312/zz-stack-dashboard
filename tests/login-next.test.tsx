import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the sign-in page sends a person who is already signed in: back to `?next=` when it is a path on this site, and
 * home otherwise. `//host` and `/\host` read as paths to a naive check and as another site to a browser.
 */
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/login',
}));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useConsole: () => ({ data: { mayRead: true, email: 'mei@example.com' }, isPending: false, error: null }),
}));

import LoginPage from '../app/login/page';

const saved = global.fetch;
beforeEach(() => {
  nav.replace.mockReset();
  global.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ configured: true }) }) as Response) as typeof fetch;
});
afterEach(() => {
  global.fetch = saved;
});

async function sentTo(search: string): Promise<string> {
  nav.search = search;
  render(<LoginPage />);
  await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  return nav.replace.mock.calls[0][0] as string;
}

describe('the sign-in page, for a person already signed in', () => {
  it('returns them to the page they asked for', async () => {
    expect(await sentTo('next=%2Finitiatives%2Fatlas%2F2026-09-28-search-relevance%3Ftab%3Dsources')).toBe('/initiatives/atlas/2026-09-28-search-relevance?tab=sources');
  });

  it('sends them home when nothing was asked for', async () => {
    expect(await sentTo('')).toBe('/');
  });

  it.each(['//evil.example/teams', '/\\evil.example/teams', 'https://evil.example/', 'javascript:alert(1)', 'evil.example', ''])(
    'never sends them to %j, which is not a path on this site',
    async (asked) => {
      expect(await sentTo(`next=${encodeURIComponent(asked)}`)).toBe('/');
    },
  );
});
