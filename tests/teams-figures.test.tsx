import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '@/lib/api-shapes';
import type { TeamRow, Teams } from '@/lib/fleet-shapes';
import { formatCount } from '@/lib/format-units';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import type { TeamsRead } from '@/views/teams-context';
import { TEAMS_DEFAULTS, teamsPath } from '@/views/teams-filter';
import { TEAMS, teams } from '../scripts/fake-gateway/platform-teams.ts';

/**
 * The figures Teams draws are the read's, each in its own column for the team the row names: the fake gateway's own
 * answer, the one `pnpm verify` serves the page, is what is drawn, and a cell is read by the header it stands under,
 * so a column mapped onto another's data cannot pass. The first page the address names arrives from the console's
 * server; a filter or a later page is the browser's own read of the gateway's filtered, paged list.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/** The fake's answer to `GET /teams` for a query string, paged as its server pages it. */
function list(query: URLSearchParams): Teams {
  const page = { limit: Number(query.get('limit') ?? 10), offset: Number(query.get('offset') ?? 0) };
  return teams(SUPERADMIN, query, page)![1] as Teams;
}

const served = (filters: Partial<typeof TEAMS_DEFAULTS> = {}): TeamsRead => {
  const path = teamsPath({ ...TEAMS_DEFAULTS, ...filters });
  return { state: 'ok', path, data: list(new URLSearchParams(path.split('?')[1])) };
};

const asked: string[] = [];
beforeEach(() => {
  asked.length = 0;
  window.history.replaceState(null, '', '/platform/teams');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    asked.push(url.pathname + url.search);
    const body = url.pathname.endsWith('/me') ? SUPERADMIN : list(url.searchParams);
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mount(read: TeamsRead = served()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider><PlatformTeamsView served={read} /></Tooltip.Provider></QueryClientProvider>);
}

/** The text of `slug`'s row in the column whose header is `header`: its value, not the words a phone card adds. */
function cell(slug: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tbody tr')].find((r) => r.querySelector('td')?.textContent?.includes(slug));
  if (column < 0 || !row) return `no ${header} column or no ${slug} row`;
  const td = [...row.querySelectorAll('td')][column];
  const value = td ? [...td.children].find((e) => !e.hasAttribute('data-sep')) : undefined;
  return ((value ?? td)?.textContent ?? '').trim();
}

/** The figure of the tile labelled `label`. */
function tile(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p[data-value]')?.textContent?.trim() ?? '';
}

const team = (slug: string): TeamRow => TEAMS.find((t) => t.slug === slug)!;

describe('the figures on Teams', () => {
  it('draws the four tiles over every team, as the read counts them', () => {
    mount();
    const { tiles } = (served() as Extract<TeamsRead, { state: 'ok' }>).data;
    expect(tile('Teams')).toBe(formatCount(tiles.teams));
    expect(tile('Open work')).toBe(formatCount(tiles.openWork));
    expect(tile('Pending revisions')).toBe(formatCount(tiles.pending));
    expect(tile('Lessons adopted')).toBe(formatCount(tiles.lessons));
  });

  it('draws the spec\'s columns, in its order, and no comparison between teams', () => {
    mount();
    expect([...document.querySelectorAll('th')].map((h) => h.textContent?.trim())).toEqual([
      'Team', 'People', 'Open work', 'Waiting', 'Lessons', 'Sessions by week', 'Calls last week', 'Week before', 'Last active',
    ]);
    expect(document.body.textContent).not.toMatch(/busiest|most work|share of|rank|% of/i);
  });

  it('shows each team\'s figures in their own columns, read per row', () => {
    mount();
    for (const slug of ['atlas', 'beacon', 'cinder']) {
      const t = team(slug);
      expect(cell(slug, 'People'), slug).toBe(formatCount(t.people));
      expect(cell(slug, 'Open work'), slug).toBe(formatCount(t.openWork));
      expect(cell(slug, 'Waiting'), slug).toBe(formatCount(t.waiting));
      expect(cell(slug, 'Lessons'), slug).toBe(formatCount(t.lessons));
      expect(cell(slug, 'Calls last week'), slug).toBe(formatCount(t.calls.last.figure.value));
      expect(cell(slug, 'Week before'), slug).toBe(formatCount(t.calls.previous.figure.value));
    }
    expect(cell('atlas', 'Sessions by week')).toContain(`oldest first: ${team('atlas').sessions.map((w) => w.figure.value).join(', ')}`);
    expect(cell('dune', 'Last active')).toBe('Never');
  });

  it('names an archived team, and opens each team at its Platform address', () => {
    mount();
    const cinder = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('cinder'))!;
    expect(cinder.textContent).toContain('Archived');
    expect(screen.getByRole('link', { name: /^atlas/ })).toHaveAttribute('href', '/platform/teams/atlas');
  });

  it('draws the server\'s page before the browser has answered', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    mount();
    expect(cell('atlas', 'People')).toBe(formatCount(team('atlas').people));
  });

  it('draws a filtered address from the server\'s read of it, filtered and paged by the gateway, and reads it nowhere else', async () => {
    window.history.replaceState(null, '', '/platform/teams?status=archived');
    const read = served({ status: 'archived' });
    expect(read.path).toContain('status=archived');
    mount(read);
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(1));
    expect(cell('cinder', 'People')).toBe(formatCount(team('cinder').people));
    expect(screen.getByText('1 team')).toBeInTheDocument();
    expect(asked.filter((a) => a.startsWith('/api/console/teams'))).toEqual([]);
  });

  it('reads the second page as the gateway\'s offset of ten, on the server and not again in the browser', async () => {
    window.history.replaceState(null, '', '/platform/teams?page=2');
    const read = served({ page: '2' });
    expect(read.path).toContain('offset=10');
    mount(read);
    await new Promise((r) => setTimeout(r, 50));
    expect(asked.filter((a) => a.startsWith('/api/console/teams'))).toEqual([]);
  });
});
