import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { Teams } from '@/lib/fleet-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { PlatformTeamView } from '@/views/pages/platform-team';
import { CreateTeam, PlatformTeamsView } from '@/views/pages/platform-teams';
import { teamContext } from '@/views/team-context';
import { TEAMS_BOUND_MS, teamsContext, type TeamsRead } from '@/views/teams-context';
import { TEAMS_DEFAULTS, filtersOfPath, teamsPath } from '@/views/teams-filter';
import { teamTool } from '@/views/tools/team';
import { teamsTool } from '@/views/tools/teams';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import PlatformTeamsLoading from '../app/(dash)/platform/teams/loading';
import PlatformTeamsPage, { generateMetadata as teamsMetadata } from '../app/(dash)/platform/teams/page';
import { readTeam, readTeams } from '../app/(dash)/platform/teams/read-teams';
import PlatformTeamLoading from '../app/(dash)/platform/teams/[slug]/loading';
import PlatformTeamPage, { generateMetadata as teamMetadata } from '../app/(dash)/platform/teams/[slug]/page';

/**
 * Teams under Platform, and the superadmin's management of teams there (Task I-99, AC-4.1): the list and a team's page
 * drawn from the fake gateway's own answers, each read first on the console's server; every state each page draws;
 * the Ask on each page's protagonist; the view tools answering the pages' own responses with the pages' own contexts;
 * the prepared queries; and a member answered, at `/platform/teams` and a team's page, by a refused page that names
 * nothing.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};
const MEMBER: Me = {
  email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false,
  via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon',
};

const PATH = teamsPath(TEAMS_DEFAULTS);
const LIST = teams(SUPERADMIN, new URLSearchParams(PATH.split('?')[1]), { limit: 10, offset: 0 })![1] as Teams;
const ok: TeamsRead = { state: 'ok', path: PATH, data: LIST };
const NONE: Teams = { ...LIST, tiles: { teams: 0, openWork: 0, pending: 0, lessons: 0 }, teams: [], total: 0 };

/** The browser's reads: answered by `answer`, or never when it is null. */
function browser(answer: ((path: string) => [number, unknown]) | null) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!answer) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, SUPERADMIN] : answer(url.pathname.replace('/api/console', '') + url.search);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}

/** `ui` in the console's providers, with an assistant listening when `ask` is given. */
function mount(ui: ReactElement, ask?: (q: string) => void, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const surface = ask ? { ask } : {};
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={surface}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/platform/teams');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('each page draws loading, empty, error and partial', () => {
  it('Teams: loading while the server\'s read of a filtered address is on its way', () => {
    window.history.replaceState(null, '', '/platform/teams?q=at');
    browser(null);
    mount(<PlatformTeamsView served={ok} />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('Teams: empty, pointing at Create a team', () => {
    browser(() => [200, NONE]);
    mount(<PlatformTeamsView served={{ state: 'ok', path: PATH, data: NONE }} />);
    expect(screen.getByText('No team yet')).toBeInTheDocument();
    expect(screen.getByText(/Create a team/)).toBeInTheDocument();
  });

  it('Teams: the error with the gateway\'s sentence and Retry, and no tile counted', async () => {
    browser(() => [500, { error: 'could not read the teams' }]);
    mount(<PlatformTeamsView served={{ state: 'failed', path: PATH, reason: 'could not read the teams' }} />);
    expect(screen.getByText('The teams did not load')).toBeInTheDocument();
    expect(screen.getByText('could not read the teams')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Teams: a server read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    mount(<PlatformTeamsView served={{ state: 'slow', path: PATH }} />);
    expect(screen.getByText(`The read did not answer within ${TEAMS_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('Teams: partial, the rows standing when the calls by week could not be read', () => {
    const lost = { window: LIST.teams[0].calls.last.window, figure: { value: null, why: 'unavailable' as const }, numerator: null, denominator: null };
    const partial: Teams = { ...LIST, teams: LIST.teams.map((t) => ({ ...t, sessions: t.sessions.map((w) => ({ ...w, ...lost, window: w.window })), calls: { last: lost, previous: lost } })) };
    browser(null);
    mount(<PlatformTeamsView served={{ state: 'ok', path: PATH, data: partial }} />);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(LIST.teams.length);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(LIST.teams.length * 3);
    expect(contextText(teamsContext(partial, { filters: TEAMS_DEFAULTS }))).toContain('could not be read');
  });

  it('a team: the error with Retry, and the way back for no such team', () => {
    browser(null);
    const { unmount } = mount(<PlatformTeamView slug="atlas" served={{ state: 'failed', reason: 'could not read a team' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The team did not load');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    unmount();
    // No such team is no failure: it says so, offers no Retry, and its way back is the list of every team there is.
    mount(<PlatformTeamView slug="nonesuch" served={{ state: 'missing' }} />);
    expect(screen.getByText('No team called nonesuch')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/platform/teams');
  });

  it('a team: slow is the bounded error; no member and no week each say so', () => {
    browser(null);
    const { unmount } = mount(<PlatformTeamView slug="atlas" served={{ state: 'slow' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The team is unavailable');
    unmount();
    const empty = { ...teamDetail('dune')!, members: [], calls: [] };
    mount(<PlatformTeamView slug="dune" served={{ state: 'ok', data: empty }} />);
    expect(screen.getByText('Nobody is in this team')).toBeInTheDocument();
    expect(screen.getByText('No week recorded yet')).toBeInTheDocument();
  });
});

describe('the first paint of a filtered address', () => {
  it('draws the status and the rows the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/platform/teams?status=archived');
    browser(null);
    const path = teamsPath({ ...TEAMS_DEFAULTS, status: 'archived' });
    const found = teams(SUPERADMIN, new URLSearchParams(path.split('?')[1]), { limit: 10, offset: 0 })![1] as Teams;
    expect(found.teams.length).toBeGreaterThan(0);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><PlatformTeamsView served={{ state: 'ok', path, data: found }} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="Teams"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(found.teams.length);
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(found.teams.length);
      await waitFor(() => expect(within(container).getByRole('combobox', { name: 'Status' }).textContent).toContain('Archived'));
      expect((fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'))).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [TEAMS_DEFAULTS, { ...TEAMS_DEFAULTS, page: '2' }, { q: 'atlas', status: 'active', page: '3' }]) expect(filtersOfPath(teamsPath(f))).toEqual(f);
  });
});

describe('the Ask on each page\'s protagonist', () => {
  it('sits in the teams table\'s filter bar with the assistant on, and is absent with it off', () => {
    browser(null);
    const ask = vi.fn();
    const { unmount } = mount(<PlatformTeamsView served={ok} />, ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    expect(button.closest('[data-protagonist="Teams"]')).not.toBeNull();
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(<PlatformTeamsView served={ok} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });

  it('sits in the head of a team\'s calls by week with the assistant on, and is absent with it off', () => {
    browser(null);
    const { unmount } = mount(<PlatformTeamView slug="atlas" served={{ state: 'ok', data: teamDetail('atlas')! }} />, vi.fn());
    const [button] = screen.getAllByRole('button', { name: /^Ask: / });
    const card = button.closest('[data-protagonist="Calls by week"]')!.querySelector('.card')!;
    expect(card.firstElementChild?.contains(button)).toBe(true);
    expect(card.textContent).toContain('Calls by week');
    unmount();
    mount(<PlatformTeamView slug="atlas" served={{ state: 'ok', data: teamDetail('atlas')! }} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the first read is the server\'s, and a change is read again in the browser', () => {
  /** What the browser has asked the gateway for, past who it is. */
  const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'));
  /** A hint that `teams` changed, as `ConsoleLive` hands it on: every console read of the collection, invalidated. */
  const hint = (client: QueryClient) => act(async () => {
    await client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'console' && String(q.queryKey[1] ?? '').split('?')[0].split('/').filter(Boolean)[0] === 'teams' });
  });

  it('Teams: no browser read on mount after the server\'s, one after a hint, and what arrived is drawn', async () => {
    const renamed = { ...LIST, teams: LIST.teams.map((t, i) => (i ? t : { ...t, name: 'Renamed in another tab' })) };
    browser(() => [200, renamed]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(<PlatformTeamsView served={ok} />, undefined, client);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    await hint(client);
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0]).toContain('/api/console/teams?limit=10&offset=0');
    await waitFor(() => expect(screen.getByText('Renamed in another tab')).toBeInTheDocument());
  });

  it('a team: no browser read on mount after the server\'s, one after a hint', async () => {
    browser(() => [200, teamDetail('atlas')]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(<PlatformTeamView slug="atlas" served={{ state: 'ok', data: teamDetail('atlas')! }} />, undefined, client);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    await hint(client);
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0]).toContain('/api/console/teams/atlas');
  });

  it('Retry after a server read that brought nothing is the browser\'s first read', async () => {
    browser(() => [200, LIST]);
    mount(<PlatformTeamsView served={{ state: 'failed', path: PATH, reason: 'could not read the teams' }} />);
    expect(reads()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(LIST.teams.length));
    expect(reads()).toHaveLength(1);
  });
});

describe('Create a team', () => {
  it('calls the platform\'s create-team route, and says a refusal under its fields', async () => {
    const sent: unknown[] = [];
    const to: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      to.push(`${init?.method} ${String(input)}`);
      sent.push(JSON.parse(String(init?.body)));
      return { ok: false, status: 400, json: async () => ({ error: 'a team named atlas already exists' }) } as unknown as Response;
    }));
    mount(<CreateTeam />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a team' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Slug'), { target: { value: 'atlas' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Atlas again' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('a team named atlas already exists'));
    expect(sent).toEqual([{ slug: 'atlas', name: 'Atlas again' }]);
    expect(to).toEqual(['POST /api/console/settings/platform/teams']);
    expect(within(dialog).getByLabelText('Slug')).toHaveValue('atlas');
  });
});

describe('the view tools answer the pages\' own responses', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      if (path.startsWith('/teams?')) return teams(SUPERADMIN, new URLSearchParams(path.split('?')[1]), { limit: 10, offset: 0 })![1];
      return teamDetail(path.split('/').at(-1)!);
    });
  });

  it('view_teams reads the page\'s address and tells the page\'s context', async () => {
    const { data, context } = await teamsTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual(LIST);
    const page = teamsContext(LIST, { filters: TEAMS_DEFAULTS });
    expect({ ...context, freshness: null }).toEqual({ ...page, freshness: null });
    expect(teamsTool.page).toBe('/platform/teams');
  });

  it('view_teams takes the route\'s own limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(teamsTool.input.shape).sort()).toEqual(['limit', 'offset']);
    const onPage = await teamsTool.read({ limit: 10, offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/teams?limit=10&offset=10');
    expect(onPage.context.address).toBe('/platform/teams?page=2');
    expect(contextText(onPage.context)).not.toContain('does not show exactly');
    const off = await teamsTool.read({ limit: 3, offset: 12 });
    expect(gateway.get).toHaveBeenLastCalledWith('/teams?limit=3&offset=12');
    expect(off.context.address).toBe('/platform/teams?page=2');
    expect(contextText(off.context)).toContain('The page lists the teams ten a page, so /platform/teams?page=2 does not show exactly these');
  });

  it('view_team reads the team\'s page and tells its context', async () => {
    const { data, context } = await teamTool.read({ slug: 'atlas' });
    expect(gateway.get).toHaveBeenCalledWith('/teams/atlas');
    expect(data).toEqual(teamDetail('atlas'));
    expect({ ...context, freshness: null }).toEqual({ ...teamContext('atlas', { team: teamDetail('atlas')! }), freshness: null });
    expect(teamTool.page).toBe('/platform/teams/[slug]');
  });

  it('explore_teams declares the teams and the platform\'s calls by team; explore_team holds the calls to its team', async () => {
    const { sources } = teamsTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ teams: 'teams', calls: 'platform_calls' });
    expect(sources.calls.facets).toContain('team');
    expect(sources.calls.filters.team).toEqual({ ops: ['eq'] });
    expect(sources.teams.drill.address({ slug: 'atlas' })).toBe('/platform/teams/atlas');
    expect(Object.keys(teamTool.explore.sources)).toEqual(['calls']);
    expect(await teamTool.explore.fixed!({ slug: 'atlas' })).toEqual({ calls: [{ field: 'team', op: 'eq', value: 'atlas' }] });
  });
});

describe('the shared contexts carry what the pages draw, and what it cannot say', () => {
  it('Teams: the four tiles, each listed team against its own past, and no ranking', () => {
    const text = contextText(teamsContext(LIST, { filters: TEAMS_DEFAULTS }));
    for (const v of [LIST.tiles.teams, LIST.tiles.openWork, LIST.tiles.pending, LIST.tiles.lessons]) expect(text).toContain(String(v));
    for (const t of LIST.teams) expect(text).toContain(`${t.slug}${t.name !== t.slug ? ` (${t.name})` : ''}`);
    expect(text).toContain(`calls ${LIST.teams[0].calls.previous.figure.value} then ${LIST.teams[0].calls.last.figure.value}`);
    expect(text).toContain('nothing here ranks one team against another');
    expect(text).not.toMatch(/busiest team is|runs the most|share of the/i);
  });

  it('hold to the budget on a full page of long names, naming as many whole as fit and counting the rest, and a team of forty', () => {
    const long = 'Regional delivery group with-a-name-nobody-planned-for-because-it-came-from-a-ticket-title';
    const rows = Array.from({ length: 10 }, (_, i) => ({ ...LIST.teams[i % LIST.teams.length], slug: `team-${i + 1}-with-a-name-nobody-planned-for`, name: `${long} ${i + 1}`, people: 300 + i, openWork: 1_000 + i, waiting: 40 + i, lessons: 9_000 + i }));
    const full: Teams = { ...LIST, teams: rows, total: 214 };
    const narrow = { q: 'with-a-name-nobody-planned-for', status: 'archived', page: '12' };
    const text = contextText(teamsContext(full, { filters: narrow }));
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    // Each team whole or not at all, the first of the page first, and the rest counted (I-167, M-3).
    const named = rows.filter((r) => text.includes(`${r.slug} (${r.name})`)).length;
    expect(named).toBeGreaterThan(0);
    for (const r of rows.slice(0, named)) expect(text).toContain(`${r.slug} (${r.name})`);
    expect(text).toContain(`and ${rows.length - named} more (see the page)`);
    expect(text).not.toMatch(/\w…/);
    const atlas = teamDetail('atlas')!;
    const weeks = Array.from({ length: 26 }, (_, i) => ({ ...atlas.calls[0], window: { ...atlas.calls[0].window, from: `2026-${String(4 + Math.floor(i / 4)).padStart(2, '0')}-0${(i % 4) + 1}T00:00:00Z` } }));
    const crowd = { ...atlas, calls: [...weeks, atlas.calls.at(-1)!], members: Array.from({ length: 40 }, (_, i) => ({ ...atlas.members[3], email: `person-${i}-${atlas.members[3].email}` })) };
    const told = contextText(teamContext('atlas', { team: crowd }));
    expect(told.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(told).toContain('in the last 12 complete weeks');
    expect(told).toContain('and 28 more');
  });

  it('a team: its tiles, its calls by week with the running week, and its members', () => {
    const atlas = teamDetail('atlas')!;
    const text = contextText(teamContext('atlas', { team: atlas }));
    expect(text).toContain(`People: ${atlas.tiles.people}`);
    expect(text).toContain(`Waiting: ${atlas.tiles.waiting}`);
    expect(text).toContain('still running');
    expect(text).toContain(atlas.members[0].name);
    expect(text).toContain('initiatives these are is the team\'s own');
  });
});

/** The text a server page's answer renders, once rendered with nothing listening. */
async function markupOf(answer: ReactNode | Promise<ReactNode>): Promise<string> {
  const node = await answer;
  let text = '';
  await act(async () => { text = mount(<>{node}</>).container.textContent ?? ''; });
  return text;
}

describe('a member asking either page', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return MEMBER;
      throw new GatewayError(403, 'not permitted');
    });
  });

  it('is titled as an address that names nothing', async () => {
    expect(await teamsMetadata()).toEqual({ title: 'Not found', robots: { index: false } });
    expect(await teamMetadata({ params: Promise.resolve({ slug: 'atlas' }) })).toEqual({ title: 'Not found', robots: { index: false } });
  });

  it('is answered by a page that names nothing and reads nothing', async () => {
    const answers = [
      PlatformTeamsPage({ searchParams: Promise.resolve({}) }),
      PlatformTeamPage({ params: Promise.resolve({ slug: 'atlas' }) }),
    ];
    for (const answer of answers) {
      const text = await markupOf(answer);
      expect(text).not.toMatch(/team|atlas/i);
      document.body.innerHTML = '';
    }
    expect(gateway.get.mock.calls.map(([p]) => p)).not.toContainEqual(expect.stringMatching(/^\/teams/));
  });

  it('waits on loading states that name nothing', () => {
    for (const Loading of [PlatformTeamsLoading, PlatformTeamLoading]) {
      const { container, unmount } = render(<Loading />);
      expect(container.textContent).not.toMatch(/team/i);
      unmount();
    }
  });
});

describe('the reads on the console\'s server', () => {
  it('read the address\'s page of teams, and a team, as the person', async () => {
    gateway.get.mockResolvedValueOnce(LIST);
    expect(await readTeams(TEAMS_DEFAULTS)).toEqual(ok);
    expect(gateway.get).toHaveBeenLastCalledWith(PATH);
    gateway.get.mockResolvedValueOnce(teamDetail('atlas'));
    expect(await readTeam('atlas')).toEqual({ state: 'ok', data: teamDetail('atlas') });
    expect(gateway.get).toHaveBeenLastCalledWith('/teams/atlas');
  });

  it('say a refusal, a slug no team has and a failure, and never reject', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read the teams'));
    expect(await readTeams(TEAMS_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'could not read the teams' });
    gateway.get.mockRejectedValueOnce(new GatewayError(404, 'HTTP 404'));
    expect(await readTeam('nonesuch')).toEqual({ state: 'missing' });
    // A refusal is the gateway's own sentence, said as a read that failed: never a team that does not exist.
    gateway.get.mockRejectedValueOnce(new GatewayError(403, 'not permitted'));
    expect(await readTeams(TEAMS_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'not permitted' });
    gateway.get.mockRejectedValueOnce(new GatewayError(403, 'not permitted'));
    expect(await readTeam('atlas')).toEqual({ state: 'failed', reason: 'not permitted' });
  });

  it('are slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const list = readTeams(TEAMS_DEFAULTS);
    const one = readTeam('atlas');
    await vi.advanceTimersByTimeAsync(TEAMS_BOUND_MS);
    expect(await list).toEqual({ state: 'slow', path: PATH });
    expect(await one).toEqual({ state: 'slow' });
  });
});
