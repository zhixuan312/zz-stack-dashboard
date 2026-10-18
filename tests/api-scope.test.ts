import { render, waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Which browser reads carry `scope=platform` (reconciliation 76): every one but `/me` and the search, for everybody,
 * exactly as the console's server asks (`gatewayGet` in `src/data/gateway.ts`). The gateway answers each caller what
 * they may read, so a member's read under the platform's name is their own team's; the superadmin's is the platform's.
 * `/me` is who the caller is, and the platform runs the search as the team the caller acts for and refuses it a
 * platform scope. Nothing the browser stores decides any of it.
 *
 * The reads are made inside the console's own providers, as every page's are, so nothing above a page can change them.
 */
import { ConsoleProviders } from '@/console/providers';
import { useConsole } from '@/lib/api';

const SUPERADMIN = { email: 'owner@example.com', name: 'Owner', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
const MEMBER = { email: 'mei@example.com', name: 'Mei', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };

const asked: string[] = [];
let me: typeof SUPERADMIN;
beforeEach(() => {
  asked.length = 0;
  window.localStorage.clear();
  global.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return { ok: true, status: 200, json: async () => (String(input).endsWith('/me') ? me : {}) } as unknown as Response;
  }) as typeof fetch;
});
afterEach(() => { vi.restoreAllMocks(); });

function Read({ path }: { path: string }) {
  useConsole(path);
  return null;
}

/** Each path its own read, as a page's panels make them. */
function read(...paths: string[]) {
  render(createElement(ConsoleProviders, null, createElement(Fragment, null, ...paths.map((path) => createElement(Read, { key: path, path })))));
}

describe.each([['the superadmin', SUPERADMIN], ['a member', MEMBER]] as const)('the browser reads of %s', (_who, person) => {
  beforeEach(() => { me = person; });

  it('send the search with no platform scope', async () => {
    read('/search?q=rotate+the+signing+key&limit=10');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toBe('/api/console/search?q=rotate+the+signing+key&limit=10');
  });

  it('send `/me` with no platform scope', async () => {
    read('/me');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toBe('/api/console/me');
  });

  it('keep the platform scope on every other read, with a query string or without one', async () => {
    read('/me', '/knowledge?limit=10&offset=0', '/home', '/initiatives/atlas/2026-09-28-search-relevance', '/document/atlas/2026-09-28-search-relevance/spec.md');
    await waitFor(() => expect(asked).toHaveLength(5));
    expect([...asked].sort()).toEqual([
      '/api/console/document/atlas/2026-09-28-search-relevance/spec.md?scope=platform',
      '/api/console/home?scope=platform',
      '/api/console/initiatives/atlas/2026-09-28-search-relevance?scope=platform',
      '/api/console/knowledge?limit=10&offset=0&scope=platform',
      '/api/console/me',
    ]);
  });

  it('read no stored mode, so a value left in the browser decides nothing', async () => {
    window.localStorage.setItem('zz-stack-mode', 'team');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    read('/me', '/activity?period=90d');
    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked).toContain('/api/console/activity?period=90d&scope=platform');
    expect(getItem.mock.calls.map(([key]) => key)).not.toContain('zz-stack-mode');
  });
});
