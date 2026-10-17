import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { THREAD_KEY, loadThread, saveThread } from '@/components/patterns/assistant/thread';
import { TeamsPanel } from '@/console/settings/teams-panel';
import { ConsoleCaller, ConsoleModeProvider, useConsole } from '@/lib/api';

/**
 * A team switch keeps nothing of the old team (reconciliation 54): every read's key carries the caller, the team and
 * the role the server resolved for the page; an accepted switch clears the assistant's thread and only then replaces
 * the document with the same address; a refused one changes nothing; another tab follows.
 *
 * jsdom cannot replace a document, so `location` is stubbed and its `replace` watched. What a real replacement adds,
 * a fresh cache and a fresh panel, is the browser's; what holds when anything outlives it is the key, tested below
 * by keeping one cache across the switch.
 */
type Access = { caller: string; team: string | null; user: { role: string } };

/** A promise already settled, as the server's arrives in the browser: `use` reads it without suspending. */
const settled = (value: Access) => Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
const ONE = settled({ caller: 'noah@example.com', team: 'team-one', user: { role: 'Member' } });
const TWO = settled({ caller: 'noah@example.com', team: 'team-two', user: { role: 'Member' } });

const me = { email: 'noah@example.com', name: 'Noah', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'admin' }, { slug: 'team-two', role: 'member' }], activeTeam: 'team-one' };
/** The teams Access's read answers, handed to the section as the page hands it. */
const myTeams = { actingFor: 'team-one', teams: [{ team: 'team-one', role: 'admin', active: true }, { team: 'team-two', role: 'member', active: false }] };
/** The assistant's thread as ZZ Meridian keeps it: for one person and the team they act for (`AssistantScope`). */
const SCOPE = 'team-one/noah@example.com';
const THREAD: UIMessage[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'what waits?' }] },
  { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'two documents' }] },
];

/** The marker each team's read answers, and every one the probe drew with the team it drew it for. */
let drawn: string[];
let calls: { method: string; url: string }[];
/** A read held back until the test lets it go, by the team it was sent for. */
let held: Map<string, () => void>;
let switchAnswer: { status: number; body: unknown };
let replaced: { href: string; thread: string | null; switchKey: string | null }[];
/** The address the page is on. */
const HERE = 'http://localhost:3000/access';

function Probe({ team }: { team: string }) {
  const q = useConsole<{ marker: string }>('/overview');
  if (q.data) drawn.push(`${team}:${q.data.marker}`);
  return <span data-testid="marker">{q.data?.marker ?? 'pending'}</span>;
}

function Tree({ client, access, team, children }: { client: QueryClient; access: Promise<Access>; team: string; children?: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ConsoleModeProvider>
        <ConsoleCaller access={access}>
          <Suspense fallback={null}>
            <Probe team={team} />
            {children}
          </Suspense>
        </ConsoleCaller>
      </ConsoleModeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  drawn = []; calls = []; held = new Map(); replaced = [];
  switchAnswer = { status: 200, body: { ok: true, actingFor: 'team-two', from: 'team-one' } };
  let team = 'team-one';
  vi.stubGlobal('location', {
    href: HERE, origin: 'http://localhost:3000', pathname: '/access', search: '', hash: '',
    replace: (href: string) => { replaced.push({ href, thread: window.localStorage.getItem(THREAD_KEY), switchKey: window.localStorage.getItem('zz-stack-team-switch') }); },
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'POST' && url.endsWith('/settings/me/active-team')) {
      if (switchAnswer.status === 200) team = 'team-two';
      return json(switchAnswer.status, switchAnswer.body);
    }
    if (url.endsWith('/console/me')) return json(200, me);
    // The read answers for the team the session acts for when the gateway reads it, as the gateway does.
    const answeredFor = team;
    if (url.includes('/overview') && held.has(`hold:${answeredFor}`)) {
      await new Promise<void>((resolve) => held.set(answeredFor, resolve));
    }
    return json(200, { marker: answeredFor });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const keyOf = (client: QueryClient, path: string) => client.getQueryCache().getAll().find((q) => q.queryKey[1] === path)?.queryKey;

describe('the read key', () => {
  it('carries the caller, the active team and the role the server resolved for the page, after the path', async () => {
    const client = new QueryClient();
    render(<Tree client={client} access={ONE} team="team-one" />);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-one'));
    expect(keyOf(client, '/overview')).toEqual(['console', '/overview', 'noah@example.com', 'team-one', 'Member']);
    // `/me` answers who is calling, read above the layout that resolves the caller, so its key is the path alone.
    expect(client.getQueryCache().getAll().map((q) => q.queryKey)).toContainEqual(['console', '/me']);
  });

  it('keeps every key the same across the two scopes, so the one read a member makes is the one kept', async () => {
    const client = new QueryClient();
    render(<Tree client={client} access={ONE} team="team-one" />);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-one'));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(calls.filter((c) => c.url.includes('/overview'))).toHaveLength(1);
  });
});

describe('a switch the gateway accepts', () => {
  it('clears the assistant\'s thread, tells the other tabs, and only then replaces the document with the same address', async () => {
    saveThread(window.localStorage, SCOPE, THREAD);
    render(<Tree client={new QueryClient()} access={ONE} team="team-one"><TeamsPanel teams={myTeams} /></Tree>);
    const press = await screen.findByRole('button', { name: 'Act as this team' });
    const readsBefore = calls.filter((c) => c.method === 'GET').length;
    await act(async () => { fireEvent.click(press); });
    await waitFor(() => expect(replaced).toHaveLength(1));
    expect(replaced[0].href).toBe(HERE);
    // The thread was gone and the other tabs told before the document was replaced.
    expect(replaced[0].thread).toBeNull();
    expect(replaced[0].switchKey).not.toBeNull();
    // The next load reads an empty thread.
    expect(loadThread(window.localStorage, SCOPE)).toEqual([]);
    // Nothing was read again under the old team's keys before the document went: the switch invalidates nothing.
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(readsBefore);
    // And a second press cannot switch again while the document is on its way out.
    expect(screen.queryByRole('button', { name: 'Act as this team' })).toBeDisabled();
  });

  it('draws a response for the old team held back past the switch under the old team\'s key, never for the new one', async () => {
    held.set('hold:team-one', () => {});
    const client = new QueryClient();
    const view = render(<Tree client={client} access={ONE} team="team-one"><TeamsPanel teams={myTeams} /></Tree>);
    await waitFor(() => expect(held.has('team-one')).toBe(true));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Act as this team' })); });
    await waitFor(() => expect(replaced).toHaveLength(1));

    // The page as the server resolves it for the new team, over the same cache: what a document that outlived the
    // switch would hold.
    view.rerender(<Tree client={client} access={TWO} team="team-two" />);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-two'));
    await act(async () => { held.get('team-one')!(); await new Promise((r) => setTimeout(r, 20)); });

    const one = client.getQueryData(['console', '/overview', 'noah@example.com', 'team-one', 'Member']);
    expect(one).toEqual({ marker: 'team-one' });
    expect(screen.getByTestId('marker')).toHaveTextContent('team-two');
    expect(drawn).not.toContain('team-two:team-one');
  });
});

describe('a switch the gateway refuses', () => {
  it('clears nothing and navigates nowhere', async () => {
    switchAnswer = { status: 400, body: { error: 'not a member of team-two' } };
    saveThread(window.localStorage, SCOPE, THREAD);
    const client = new QueryClient();
    render(<Tree client={client} access={ONE} team="team-one"><TeamsPanel teams={myTeams} /></Tree>);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-one'));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Act as this team' })); });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(replaced).toEqual([]);
    expect(window.localStorage.getItem('zz-stack-team-switch')).toBeNull();
    expect(loadThread(window.localStorage, SCOPE)).toHaveLength(2);
    expect(client.getQueryData(['console', '/overview', 'noah@example.com', 'team-one', 'Member'])).toEqual({ marker: 'team-one' });
    expect(screen.getByRole('button', { name: 'Act as this team' })).toBeEnabled();
  });
});

describe('another tab of the same browser', () => {
  it('hears the switch and replaces its document too, its thread cleared first', async () => {
    saveThread(window.localStorage, SCOPE, THREAD);
    render(<Tree client={new QueryClient()} access={ONE} team="team-one" />);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-one'));
    // What the browser fires in every OTHER tab when one of them writes the key; jsdom has no other tab.
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'zz-stack-team-switch', newValue: '1' }));
    });
    expect(replaced.map((r) => [r.href, r.thread])).toEqual([[HERE, null]]);
  });

  it('does not navigate for the key being removed, or for any other key', async () => {
    render(<Tree client={new QueryClient()} access={ONE} team="team-one" />);
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team-one'));
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'zz-stack-team-switch', newValue: null }));
      window.dispatchEvent(new StorageEvent('storage', { key: THREAD_KEY, newValue: null }));
    });
    expect(replaced).toEqual([]);
  });
});
