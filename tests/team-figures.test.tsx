import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '@/lib/api-shapes';
import type { TeamDetail } from '@/lib/fleet-shapes';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { PlatformTeamView } from '@/views/pages/platform-team';
import type { TeamRead } from '@/views/team-context';
import { teamDetail } from '../scripts/fake-gateway/platform-teams.ts';

/**
 * A team's page draws the team's own read: the fake gateway's answer for atlas, the one `pnpm verify` serves, as the
 * console's server hands it. Its tiles, its calls by week and its members are that read's, and each write it makes is
 * the console's existing settings route, called as Settings called it, with the gateway's refusal said beside the
 * control that made it.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};
const ATLAS = teamDetail('atlas')!;

type Sent = { method: string; path: string; body: Record<string, unknown> };
const sent: Sent[] = [];
/** What a write answers: the gateway's acceptance, or its refusal with its own sentence. */
let refusal: string | null = null;

beforeEach(() => {
  sent.length = 0;
  refusal = null;
  window.history.replaceState(null, '', '/platform/teams/atlas');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://console.test');
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      sent.push({ method, path: url.pathname.replace('/api/console', ''), body: JSON.parse(String(init?.body ?? '{}')) });
      return refusal
        ? ({ ok: false, status: 400, json: async () => ({ error: refusal }) } as unknown as Response)
        : ({ ok: true, status: 200, json: async () => ({ ok: true, result: 'done' }) } as unknown as Response);
    }
    const body = url.pathname.endsWith('/me') ? SUPERADMIN : teamDetail(url.pathname.split('/').at(-1)!);
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mount(served: TeamRead = { state: 'ok', data: ATLAS }, slug = 'atlas') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider><PlatformTeamView slug={slug} served={served} /></Tooltip.Provider></QueryClientProvider>);
}

/** The figure of the tile labelled `label`. */
function tile(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p[data-value]')?.textContent?.trim() ?? '';
}

const card = (title: string) => screen.getByText(title, { selector: 'h2, h3, [data-title]' }).closest('.card') as HTMLElement;

describe('the figures on a team\'s page', () => {
  it('draws the four tiles from the team\'s own read', () => {
    mount();
    expect(tile('People')).toBe(formatCount(ATLAS.tiles.people));
    expect(tile('Open work')).toBe(formatCount(ATLAS.tiles.openWork));
    expect(tile('Waiting')).toBe(formatCount(ATLAS.tiles.waiting));
    expect(tile('Lessons adopted')).toBe(formatCount(ATLAS.tiles.lessons));
    const admins = ATLAS.members.filter((m) => m.role === 'admin').length;
    expect(screen.getByText(`${admins} admins`)).toBeInTheDocument();
  });

  it('draws its calls by week, a column a week, the running week last', () => {
    mount();
    const figure = screen.getByRole('figure', { name: 'atlas\'s real-work calls by week' });
    const rows = [...figure.querySelectorAll('table tbody tr')].map((tr) => [tr.querySelector('th')?.textContent, tr.querySelector('td')?.textContent]);
    expect(rows.map(([, v]) => v)).toEqual(ATLAS.calls.map((w) => formatCount(w.figure.value)));
    expect(rows.at(-1)![0]).toContain('so far');
    expect(rows.slice(0, -1).some(([week]) => week?.includes('so far'))).toBe(false);
  });

  it('names the team, its status and when it was made', () => {
    mount();
    const team = card('This team');
    expect(within(team).getByText(ATLAS.team.name)).toBeInTheDocument();
    expect(within(team).getByText('Active')).toBeInTheDocument();
    expect(within(team).getByText(formatDate(ATLAS.team.created))).toBeInTheDocument();
  });

  it('lists its members, admins first, with when each joined', () => {
    mount();
    const rows = [...document.querySelectorAll('section[aria-label="atlas\'s members"] tbody tr')];
    expect(rows).toHaveLength(ATLAS.members.length);
    expect(rows[0].textContent).toContain(ATLAS.members[0].name);
    expect(rows[0].textContent).toContain('Admin');
    expect(rows[0].textContent).toContain(formatDate(ATLAS.members[0].joined));
  });
});

describe('the writes, through the routes Settings called', () => {
  const press = (name: string, within_: HTMLElement = document.body) => fireEvent.click(within(within_).getByRole('button', { name }));

  it('adds a member with their role', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new.person@example.com' } });
    press('Add member');
    await waitFor(() => expect(sent).toEqual([{ method: 'POST', path: '/settings/team/members', body: { team: 'atlas', email: 'new.person@example.com', role: 'member' } }]));
  });

  it('says a refused add beside the form, and keeps what was typed', async () => {
    refusal = 'dana@example.com is deactivated';
    mount();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dana@example.com' } });
    press('Add member');
    const form = screen.getByRole('form', { name: 'Add a member to atlas' });
    await waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent('dana@example.com is deactivated'));
    expect(screen.getByLabelText('Email')).toHaveValue('dana@example.com');
  });

  it('removes a member once the row asks again, and says a refusal in that row', async () => {
    refusal = 'nothing was removed';
    mount();
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes(ATLAS.members[2].email)) as HTMLElement;
    press('Remove', row);
    expect(sent).toEqual([]);
    press('Remove', row);
    await waitFor(() => expect(sent).toEqual([{ method: 'DELETE', path: '/settings/team/members', body: { team: 'atlas', email: ATLAS.members[2].email, confirm: 'atlas' } }]));
    await waitFor(() => expect(within(row).getByRole('alert')).toHaveTextContent('nothing was removed'));
  });

  it('archives the team once it asks again, and says a refusal under the control', async () => {
    refusal = 'archive needs the team to exist';
    mount();
    const team = card('This team');
    press('Archive', team);
    press('Archive', team);
    await waitFor(() => expect(sent).toEqual([{ method: 'DELETE', path: '/settings/platform/teams', body: { team: 'atlas', confirm: 'atlas' } }]));
    await waitFor(() => expect(within(team).getByRole('alert')).toHaveTextContent('archive needs the team to exist'));
  });

  it('offers no Archive on an archived team, and says how one is restored', () => {
    const cinder = teamDetail('cinder')!;
    mount({ state: 'ok', data: cinder }, 'cinder');
    const team = card('This team');
    expect(within(team).queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(team.textContent).toContain('Creating the same slug again restores it.');
  });
});

describe('a team the read cannot draw', () => {
  it('is the way back to Teams for a slug no team has', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => null }) as unknown as Response));
    mount({ state: 'missing' }, 'nonesuch');
    expect(screen.getByText('No team called nonesuch')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/platform/teams');
    expect(screen.queryByText('People')).toBeNull();
  });

  it('keeps the team, its tiles and its members when its calls by week could not be read', () => {
    const partial: TeamDetail = { ...ATLAS, calls: ATLAS.calls.map((w) => ({ ...w, figure: { value: null, why: 'unavailable' }, numerator: null })) };
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    mount({ state: 'ok', data: partial });
    expect(screen.getByText('The calls by week could not be read')).toBeInTheDocument();
    expect(tile('People')).toBe(formatCount(ATLAS.tiles.people));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(ATLAS.members.length);
    expect(screen.queryByRole('figure')).toBeNull();
  });
});
