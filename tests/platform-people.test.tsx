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
import { OMIT, pageText } from '@/components/patterns/assistant/page-text';
import { GatewayError } from '@/data/gateway';
import type { Me } from '@/lib/api-shapes';
import type { People } from '@/lib/fleet-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { AddPerson, PlatformPeopleView } from '@/views/pages/platform-people';
import { NO_SIGN_IN, PEOPLE_BOUND_MS, peopleContext, type PeopleRead } from '@/views/people-context';
import { PEOPLE_DEFAULTS, filtersOfPath, peoplePath } from '@/views/people-filter';
import { peopleTool } from '@/views/tools/people';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import PlatformPeopleLoading from '../app/(dash)/platform/people/loading';
import PlatformPeoplePage, { generateMetadata as peopleMetadata } from '../app/(dash)/platform/people/page';
import { readPeople } from '../app/(dash)/platform/people/read-people';
import TodaysPeopleLoading from '../app/(dash)/people/loading';
import TodaysPeoplePage, { generateMetadata as todaysMetadata } from '../app/(dash)/people/page';

/**
 * People under Platform, and the superadmin's management of people there (Task I-100, AC-4.2): the list drawn from the
 * fake gateway's own answer, read first on the console's server; every state it draws; the Ask on its protagonist; the
 * three acts, with an enrolment link kept out of the page's text; the view tool answering names and states; the
 * prepared query; and a member answered, at the new address and today's, by a refused page that names nothing.
 */
const MEMBER: Me = {
  email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false,
  via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon',
};

const PATH = peoplePath(PEOPLE_DEFAULTS);
/** The fake's answer to a gateway address, paged as the address asks. */
function answer(path: string): People {
  const q = new URLSearchParams(path.split('?')[1]);
  return people(ME, q, { limit: Number(q.get('limit') ?? 10), offset: Number(q.get('offset') ?? 0) })![1] as People;
}
const LIST = answer(PATH);
const ok: PeopleRead = { state: 'ok', path: PATH, data: LIST };
const NONE: People = { ...LIST, tiles: { ...LIST.tiles, people: 0, withPasskey: 0, neverSignedIn: 0 }, people: [], total: 0 };
const LINK = 'https://console.example.com/enrol#t=zze_SECRETLINK0123456789';

/** The browser's reads and writes: answered by `answer`, or never when it is null. */
function browser(reply: ((path: string, init?: RequestInit) => [number, unknown]) | null) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (!reply) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, ME] : reply(url.pathname.replace('/api/console', '') + url.search, init);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}

/** `ui` in the console's providers and inside the scroll region the assistant reads, with an assistant listening when `ask` is given. */
function mount(ui: ReactElement, ask?: (q: string) => void, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const surface = ask ? { ask } : {};
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={surface}><Tooltip.Provider><div data-scroll-region>{ui}</div></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
const region = () => document.querySelector<HTMLElement>('[data-scroll-region]')!;
const row = (name: string) => screen.getAllByRole('row').find((r) => r.textContent?.includes(name))!;

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/platform/people');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('People draws the spec\'s destination row from the fake\'s answer', () => {
  it('the four tiles, then a table of person, role, teams, passkey, last sign-in and state', () => {
    browser(null);
    mount(<PlatformPeopleView served={ok} />);
    for (const label of ['People', 'With a passkey', 'Never signed in', 'Sign-ins last week']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    const values = [...document.querySelectorAll('[data-value]')].map((v) => v.textContent);
    expect(values).toEqual([LIST.tiles.people, LIST.tiles.withPasskey, LIST.tiles.neverSignedIn, LIST.tiles.signInsLastWeek.figure.value].map(String));
    const headers = [...document.querySelectorAll('thead th')].map((h) => h.textContent);
    expect(headers.slice(0, 6)).toEqual(['Person', 'Role', 'Teams', 'Passkey', 'Last sign-in', 'State']);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(LIST.people.length);
    for (const p of LIST.people) expect(row(p.email)).toBeTruthy();
    const both = LIST.people.find((p) => p.teams.length > 1)!;
    expect(row(both.email).textContent).toContain(both.teams.join(', '));
  });

  it('a person with no sign-in recorded reads so, and every state draws', () => {
    browser(null);
    mount(<PlatformPeopleView served={ok} />);
    const never = LIST.people.find((p) => p.lastSignIn === null)!;
    expect(row(never.email).textContent).toContain(NO_SIGN_IN);
    const off = LIST.people.find((p) => p.state === 'deactivated')!;
    expect(within(row(off.email)).getAllByText('Deactivated').length).toBeGreaterThan(0);
    expect(within(row(off.email)).queryByRole('button', { name: 'Enrolment link' })).toBeNull();
    const on = LIST.people.find((p) => p.state === 'active')!;
    expect(within(row(on.email)).getAllByText('Active').length).toBeGreaterThan(0);
    expect(within(row(on.email)).getByRole('button', { name: 'Enrolment link' })).toBeInTheDocument();
    expect(within(row(on.email)).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    const supers = [...document.querySelectorAll('tbody tr')].filter((r) => r.textContent?.includes('Superadmin'));
    expect(supers).toHaveLength(LIST.people.filter((p) => p.role === 'superadmin').length);
  });
});

describe('each state the page draws', () => {
  it('loading while a filtered address is read in the browser', () => {
    window.history.replaceState(null, '', '/platform/people?q=ava');
    browser(null);
    mount(<PlatformPeopleView served={ok} />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('nobody yet, pointing at Add a person', () => {
    browser(null);
    mount(<PlatformPeopleView served={{ state: 'ok', path: PATH, data: NONE }} />);
    expect(screen.getByText('Nobody yet')).toBeInTheDocument();
    expect(screen.getByText(/Add a person/)).toBeInTheDocument();
  });

  it('the error with the gateway\'s sentence and Retry, and no tile counted', () => {
    browser(null);
    mount(<PlatformPeopleView served={{ state: 'failed', path: PATH, reason: 'could not read people' }} />);
    expect(screen.getByText('The people did not load')).toBeInTheDocument();
    expect(screen.getByText('could not read people')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('a server read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    mount(<PlatformPeopleView served={{ state: 'slow', path: PATH }} />);
    expect(screen.getByText(`The read did not answer within ${PEOPLE_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('partial: the sign-ins unavailable, never zero, with every row standing', () => {
    const lost = { ...LIST.tiles.signInsLastWeek, figure: { value: null, why: 'unavailable' as const }, numerator: null };
    const partial: People = { ...LIST, tiles: { ...LIST.tiles, signInsLastWeek: lost } };
    browser(null);
    mount(<PlatformPeopleView served={{ state: 'ok', path: PATH, data: partial }} />);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(LIST.people.length);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(contextText(peopleContext(partial, { filters: PEOPLE_DEFAULTS, updatedAt: null, now: new Date() }))).toContain('could not be counted');
  });

  it('a week before the record began is no data, never zero', () => {
    const before = { ...LIST.tiles.signInsLastWeek, figure: { value: null, why: 'no_data' as const }, numerator: null };
    browser(null);
    mount(<PlatformPeopleView served={{ state: 'ok', path: PATH, data: { ...LIST, tiles: { ...LIST.tiles, signInsLastWeek: before } } }} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});

describe('the first paint of a filtered address', () => {
  it('draws the state and the rows the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/platform/people?state=deactivated');
    browser(null);
    const path = peoplePath({ ...PEOPLE_DEFAULTS, state: 'deactivated' });
    const found = answer(path);
    expect(found.people.length).toBeGreaterThan(0);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><PlatformPeopleView served={{ state: 'ok', path, data: found }} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="People"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(found.people.length);
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(found.people.length);
      await waitFor(() => expect(within(container).getByRole('combobox', { name: 'State' }).textContent).toContain('Deactivated'));
      expect((fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'))).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [PEOPLE_DEFAULTS, { ...PEOPLE_DEFAULTS, page: '2' }, { q: 'mei', state: 'active', page: '3' }]) expect(filtersOfPath(peoplePath(f))).toEqual(f);
  });
});

describe('the Ask on the page\'s protagonist', () => {
  it('sits in the people table\'s filter bar with the assistant on, and is absent with it off', () => {
    browser(null);
    const ask = vi.fn();
    const { unmount } = mount(<PlatformPeopleView served={ok} />, ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    expect(button.closest('[data-protagonist="People"]')).not.toBeNull();
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(<PlatformPeopleView served={ok} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the three acts, as Settings called them', () => {
  const on = LIST.people.find((p) => p.state === 'active' && p.name)!;

  it('an enrolment link is shown once, outside the page text the assistant reads', async () => {
    const sent: [string, unknown][] = [];
    browser((path, init) => {
      if (init?.method === 'POST') { sent.push([path, JSON.parse(String(init.body))]); return [200, { ok: true, url: LINK, result: 'issued' }]; }
      return [200, LIST];
    });
    mount(<PlatformPeopleView served={ok} />);
    fireEvent.click(within(row(on.email)).getByRole('button', { name: 'Enrolment link' }));
    await waitFor(() => expect(document.body.textContent).toContain(LINK));
    expect(sent).toEqual([['/settings/platform/enrolments', { email: on.email }]]);
    const code = [...document.querySelectorAll('code')].find((c) => c.textContent === LINK)!;
    expect(code.closest(OMIT)).not.toBeNull();
    expect(region().textContent).not.toContain(LINK);
    expect(pageText(document.body)).not.toContain(LINK);
  });

  it('deactivate asks first, sends the address it shows, and says a refusal in its row', async () => {
    const sent: unknown[] = [];
    browser((_path, init) => {
      if (init?.method === 'DELETE') { sent.push(JSON.parse(String(init.body))); return [400, { error: 'the last superadmin cannot be deactivated' }]; }
      return [200, LIST];
    });
    mount(<PlatformPeopleView served={ok} />);
    fireEvent.click(within(row(on.email)).getByRole('button', { name: 'Deactivate' }));
    fireEvent.click(within(row(on.email)).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(within(row(on.email)).getByRole('alert')).toHaveTextContent('the last superadmin cannot be deactivated'));
    expect(sent).toEqual([{ email: on.email, confirm: on.email }]);
  });

  it('add a person calls the platform route Settings called, and says a refusal under its fields', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return { ok: false, status: 400, json: async () => ({ error: 'that is not an email address' }) } as unknown as Response;
    }));
    mount(<AddPerson />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a person' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(within(dialog).getByLabelText(/Display name/), { target: { value: 'Somebody' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add person' }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('that is not an email address'));
    expect(sent).toEqual([{ email: 'not-an-email', display_name: 'Somebody' }]);
    expect(within(dialog).getByLabelText('Email')).toHaveValue('not-an-email');
  });
});

describe('the first read is the server\'s, and a change is read again in the browser', () => {
  const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'));
  const hint = (client: QueryClient) => act(async () => {
    await client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'console' && String(q.queryKey[1] ?? '').split('?')[0].split('/').filter(Boolean)[0] === 'people' });
  });

  it('no browser read on mount after the server\'s, one after a hint, and what arrived is drawn', async () => {
    const renamed = { ...LIST, people: LIST.people.map((p, i) => (i ? p : { ...p, name: 'Renamed in another tab' })) };
    browser(() => [200, renamed]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(<PlatformPeopleView served={ok} />, undefined, client);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    await hint(client);
    await waitFor(() => expect(reads()).toHaveLength(1));
    expect(reads()[0]).toContain('/api/console/people?limit=10&offset=0');
    await waitFor(() => expect(screen.getAllByText('Renamed in another tab').length).toBeGreaterThan(0));
  });

  it('Retry after a server read that brought nothing is the browser\'s first read', async () => {
    browser(() => [200, LIST]);
    mount(<PlatformPeopleView served={{ state: 'failed', path: PATH, reason: 'could not read people' }} />);
    expect(reads()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(LIST.people.length));
    expect(reads()).toHaveLength(1);
  });
});

describe('view_people answers the names and states of the read', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => (path === '/me' ? ME : answer(path)));
  });

  it('reads the page\'s address, tells the page\'s context, and holds its data to a name and a state', async () => {
    const { data, context } = await peopleTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual({ people: LIST.people.map((p) => ({ name: p.name, state: p.state })) });
    const page = peopleContext(LIST, { filters: PEOPLE_DEFAULTS, updatedAt: null, now: new Date() });
    expect({ ...context, freshness: null }).toEqual({ ...page, freshness: null });
    expect(peopleTool.page).toBe('/platform/people');
    for (const p of LIST.people) expect(contextText(context)).toContain(`${p.name} (${p.state})`);
  });

  it('puts no address and no enrolment link in any answer', async () => {
    const { data, context } = await peopleTool.read({});
    for (const told of [JSON.stringify(data), contextText(context)]) {
      expect(told).not.toMatch(/@|enrol#|https?:/);
      for (const p of LIST.people) expect(told).not.toContain(p.email);
    }
  });

  it('takes the route\'s own limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(peopleTool.input.shape).sort()).toEqual(['limit', 'offset']);
    const onPage = await peopleTool.read({ limit: 10, offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/people?limit=10&offset=10');
    expect(onPage.context.address).toBe('/platform/people?page=2');
    const off = await peopleTool.read({ limit: 3, offset: 2 });
    expect(gateway.get).toHaveBeenLastCalledWith('/people?limit=3&offset=2');
    expect(contextText(off.context)).toContain('The page lists the people ten a page, so /platform/people does not show exactly these 3 rows');
  });

  it('explore_people declares the people and the sign-ins, each drilled row opening People and naming no link', () => {
    const { sources } = peopleTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ people: 'people', signIns: 'sign_ins' });
    expect(sources.people.facets).toEqual(['role', 'state']);
    expect(sources.signIns.buckets).toContain('week');
    for (const s of Object.values(sources)) {
      expect(s.drill.address({ email: 'a@example.com' })).toBe('/platform/people');
      expect(s.drill.columns.join()).not.toMatch(/token|enrol|link|url/i);
    }
  });

  it('holds to the budget on a full page of long names', () => {
    const long = 'Maximiliana Fitzgerald-Oyelaran Kowalczyk with-a-name-nobody-planned-for';
    const full: People = { ...LIST, people: Array.from({ length: 10 }, (_, i) => ({ ...LIST.people[0], email: `p${i}@example.com`, name: `${long} ${i}` })), total: 480 };
    const text = contextText(peopleContext(full, { filters: { q: 'with-a-name-nobody-planned-for', state: 'deactivated', page: '7' }, updatedAt: null, now: new Date() }));
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(text).toContain('more people match on later pages');
  });
});

/** The text a server page's answer renders, once rendered with nothing listening. */
async function markupOf(page: ReactNode | Promise<ReactNode>): Promise<string> {
  const node = await page;
  let text = '';
  await act(async () => { text = render(<>{node}</>).container.textContent ?? ''; });
  return text;
}

describe('a member asking either address', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return MEMBER;
      throw new GatewayError(403, 'not permitted');
    });
  });

  it('is titled as an address that names nothing', async () => {
    expect(await peopleMetadata()).toEqual({ title: 'Not found', robots: { index: false } });
    expect(await todaysMetadata()).toEqual({ title: 'Not found', robots: { index: false } });
  });

  it('is answered, at the new address and at today\'s, by a page that names nothing and reads nothing', async () => {
    for (const page of [PlatformPeoplePage({ searchParams: Promise.resolve({}) }), TodaysPeoplePage({ searchParams: Promise.resolve({}) })]) {
      expect(await markupOf(page)).not.toMatch(/people|person|passkey|sign-in/i);
      document.body.innerHTML = '';
    }
    expect(gateway.get.mock.calls.map(([p]) => p)).not.toContainEqual(expect.stringMatching(/^\/people/));
  });

  it('waits on loading states that name nothing', () => {
    for (const Loading of [PlatformPeopleLoading, TodaysPeopleLoading]) {
      const { container, unmount } = render(<Loading />);
      expect(container.textContent).not.toMatch(/people|person/i);
      unmount();
    }
  });
});

describe('the read on the console\'s server', () => {
  it('reads the address\'s page of people as the person', async () => {
    gateway.get.mockResolvedValueOnce(LIST);
    expect(await readPeople(PEOPLE_DEFAULTS)).toEqual(ok);
    expect(gateway.get).toHaveBeenLastCalledWith(PATH);
    gateway.get.mockResolvedValueOnce(LIST);
    await readPeople({ q: ' ada ', state: 'deactivated', page: '3' });
    expect(gateway.get).toHaveBeenLastCalledWith('/people?q=ada&state=deactivated&limit=10&offset=20');
  });

  it('says a failure and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read people'));
    expect(await readPeople(PEOPLE_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'could not read people' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const read = readPeople(PEOPLE_DEFAULTS);
    await vi.advanceTimersByTimeAsync(PEOPLE_BOUND_MS);
    expect(await read).toEqual({ state: 'slow', path: PATH });
  });
});
