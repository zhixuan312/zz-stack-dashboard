import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Review round 1's console findings (Task I-172), each found at the layer it lives in:
 *
 * - R1-C9: a member whose active team is not one of their teams is refused; a superadmin acting for a team they are not
 *   in is placed (FR-2).
 * - R1-C10: one assistant POST reads `/me` once, its collection checks and the tools the model calls included.
 * - R1-C11: a report's own page is recorded as `bug`, the feature its gate asks, never as the Bugs destination.
 * - R1-C12: the sign-in page's refused banner says only a fixed sentence chosen by a code, never text from the address.
 * - R1-C21: a member's loading state at Teams, a team, People, Audit or a report is the body an unknown address draws.
 * - R1-C22: an issued enrolment link is held in plain state, never in the mutation cache.
 */
const at = vi.hoisted(() => ({ path: '/', search: '' }));
const jar = vi.hoisted(() => ({}) as Record<string, string>);
const { Redirected } = vi.hoisted(() => {
  class Redirected extends Error {
    readonly to: string;
    constructor(to: string) {
      super(`redirect to ${to}`);
      this.to = to;
    }
  }
  return { Redirected };
});
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  redirect: (to: string) => { throw new Redirected(to); },
  usePathname: () => at.path,
  useSearchParams: () => new URLSearchParams(at.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { PageViews } from '@/console/page-view';
import { Unauthenticated, gate, resolveAccess } from '@/data/access';
import { ConsoleCaller } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import type { PeopleRead } from '@/views/people-context';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { startFakeLlm } from '../scripts/fake-llm.ts';
import { POST } from '../app/api/assistant/route';
import LoginPage from '../app/login/page';
import DashLoading from '../app/(dash)/loading';
import PlatformAuditLoading from '../app/(dash)/platform/audit/loading';
import PlatformBugLoading from '../app/(dash)/platform/bugs/[id]/loading';
import PlatformPeopleLoading from '../app/(dash)/platform/people/loading';
import PlatformTeamsLoading from '../app/(dash)/platform/teams/loading';
import PlatformTeamLoading from '../app/(dash)/platform/teams/[slug]/loading';

/** The fetch a real server is reached with, kept before any test replaces it. */
const fetch$ = global.fetch;

const MEMBER: Me = { email: 'mei@example.com', name: 'Mei', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'member' }], activeTeam: 'beacon' };
const SUPERADMIN: Me = { email: 'owner@example.com', name: 'Owner', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };

/** Every gateway address the console's server asked, answered as `who`: `/me` with `who` and Status with its page's answer. */
let asked: string[] = [];
function gateway(who: Me) {
  asked = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('http://gateway.test/')) return fetch$(input, init);
    const path = new URL(url).pathname.replace('/api/console', '');
    asked.push(path);
    const body = path === '/me' ? who : path === '/platform/status' ? (who.superadmin ? PLATFORM_STATUS : MEMBER_STATUS) : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

/** Where a call was redirected to, or null when it was not. */
async function redirectOf(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return null;
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'session-1';
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
  at.path = '/';
  at.search = '';
});
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

describe('R1-C9: who is asking is placed only on a team they act for', () => {
  it('refuses a member whose active team is not one of their teams', async () => {
    gateway({ ...MEMBER, activeTeam: 'atlas' });
    expect(await redirectOf(() => gate('home'))).toMatch(/^\/login\?denied=1&reason=/);
    await expect(resolveAccess()).rejects.toBeInstanceOf(Unauthenticated);
  });

  it('places a superadmin acting for a team they are not a member of', async () => {
    gateway({ ...SUPERADMIN, activeTeam: 'dune' });
    expect(await gate('teams')).toBeNull();
    expect((await resolveAccess()).tenantId).toBe('dune');
  });

  it('places a member who acts for no team, and one who acts for their own', async () => {
    gateway({ ...MEMBER, activeTeam: null });
    expect(await gate('home')).toBeNull();
    gateway(MEMBER);
    expect((await resolveAccess()).tenantId).toBe('beacon');
  });
});

describe('R1-C10: one assistant POST reads who is asking once', () => {
  let llm: Awaited<ReturnType<typeof startFakeLlm>>;
  beforeAll(async () => {
    llm = await startFakeLlm({
      port: 0,
      steps: [
        { when: '^what needs attention\\?$', tool: 'view_platform_status', input: {} },
        { when: '^who refuses most\\?$', tool: 'explore_platform_status', input: { source: 'refusals', measures: ['refusals'], by: 'owner' } },
      ],
    });
  });
  afterAll(async () => { await llm.close(); });

  /** One question asked on Status, as `who`, read to the end of its answer; the tools the model was handed. */
  async function ask(who: Me, question: string): Promise<string[]> {
    gateway(who);
    Object.assign(process.env, { ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_API_KEY: 'k', ASSISTANT_MODEL: 'm', ASSISTANT_BASE_URL: llm.url });
    llm.requests.length = 0;
    const res = await POST(new Request('http://localhost/api/assistant', { method: 'POST', body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: question }] }], page: { path: '/platform', title: 'Status', text: '' } }) }));
    expect(res.status).toBe(200);
    await res.text();
    return llm.requests.flatMap((r) => ((r as { tools?: { function: { name: string } }[] }).tools ?? []).map((t) => t.function.name));
  }

  it.each([['a superadmin', SUPERADMIN], ['a member', MEMBER]])('for %s, every collection and view checked against one read', async (_, who) => {
    const tools = await ask(who, 'what stands out?');
    expect(tools).toContain('explore_platform_status');
    expect(asked.filter((p) => p === '/me')).toHaveLength(1);
  });

  it('and a view tool the model calls shares that read', async () => {
    await ask(SUPERADMIN, 'what needs attention?');
    expect(asked).toContain('/platform/status');
    expect(asked.filter((p) => p === '/me')).toHaveLength(1);
  });

  it('and so does a prepared query the model runs', async () => {
    await ask(MEMBER, 'who refuses most?');
    expect(llm.requests.length).toBeGreaterThan(1);
    expect(asked.filter((p) => p === '/me')).toHaveLength(1);
  });
});

describe('R1-C11: a report\'s page view is recorded as the report\'s', () => {
  it('records `bug` for a report\'s own page, and `bugs` for the list', async () => {
    const posted: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
      posted.push((JSON.parse(String(init.body)) as { feature: string }).feature);
      return new Response(null, { status: 204 });
    }));
    at.path = '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01';
    const view = render(<><PageViews /><main><h1>Bug report</h1></main></>);
    await waitFor(() => expect(posted).toHaveLength(1));
    at.path = '/platform/bugs';
    view.rerender(<><PageViews /><main><h1>Bugs</h1></main></>);
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted).toEqual(['bug', 'bugs']);
  });
});

describe('R1-C12: the sign-in page says only what the platform wrote', () => {
  const PLANTED = 'Your passkey expired. Call +1 555 0100 and read out the code on your screen.';

  function signIn(search: string) {
    at.path = '/login';
    at.search = search;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/auth/status')
      ? new Response(JSON.stringify({ configured: true, rpId: 'console.test' }), { status: 200 })
      : new Response(JSON.stringify({ error: 'authentication required' }), { status: 401 }))));
    return render(<LoginPage />);
  }

  /** The refused banner's words, under its title. */
  async function banner(search: string): Promise<string> {
    const { container, unmount } = signIn(search);
    const title = await screen.findByText('This view is not open to you');
    const said = title.closest('[role="status"]')?.textContent ?? '';
    expect(container.textContent).toContain(said);
    unmount();
    return said.replace('This view is not open to you', '');
  }

  it('shows none of a reason the address carries, and says what it says with none', async () => {
    const planted = await banner(`denied=1&reason=${encodeURIComponent(PLANTED)}`);
    expect(planted).not.toContain('passkey expired');
    expect(planted).not.toContain('555');
    expect(planted).toBe(await banner('denied=1'));
  });

  it('says a sentence of its own for each code the gate sends, never the code', async () => {
    const said: [string, string][] = [];
    for (const code of ['unplaced', 'door', 'refused']) said.push([code, await banner(`denied=1&reason=${code}`)]);
    for (const [code, sentence] of said) {
      expect(sentence.length, code).toBeGreaterThan(20);
      expect(sentence, code).not.toMatch(new RegExp(`\\b${code}\\b`));
    }
    expect(new Set(said.map(([, s]) => s)).size).toBe(3);
  });
});

describe('R1-C21: a member\'s loading state at a restricted address is an unknown address\'s', () => {
  type Access = { only: string[]; user: { name: string; role: string }; team: string | null; caller: string };
  const RAIL = ['/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access', '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge'];
  const AS_MEMBER: Access = { only: RAIL, user: { name: 'Mei', role: 'beacon' }, team: 'beacon', caller: 'mei@example.com' };
  const RESTRICTED: [string, () => ReactElement][] = [
    ['/platform/teams', PlatformTeamsLoading], ['/platform/teams/atlas', PlatformTeamLoading], ['/platform/people', PlatformPeopleLoading],
    ['/platform/audit', PlatformAuditLoading], ['/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01', PlatformBugLoading],
  ];
  const UNKNOWN = '/platform/nothing-here';
  const caller = (ui: ReactNode, access: Promise<Access>) => <ConsoleCaller access={access}>{ui}</ConsoleCaller>;

  /** What the console's server streams at an address: the prerendered loading state, before anybody is known. */
  function served(path: string, Loading: () => ReactElement): string {
    at.path = path;
    return renderToString(caller(<Loading />, new Promise<Access>(() => {})));
  }
  /** What the member's browser draws there once the layout's read of them has settled. */
  async function drawn(path: string, Loading: () => ReactElement): Promise<string> {
    at.path = path;
    const access = Promise.resolve(AS_MEMBER);
    const view = render(caller(<Loading />, access));
    await act(async () => { await access; });
    await waitFor(() => expect(view.container.firstChild).not.toBeNull());
    const html = view.container.innerHTML;
    view.unmount();
    return html;
  }

  it.each(RESTRICTED)('%s streams the unknown address\'s body', (path, Loading) => {
    expect(served(path, Loading)).toBe(served(UNKNOWN, DashLoading));
  });

  it.each(RESTRICTED)('%s draws the unknown address\'s body for a member', async (path, Loading) => {
    expect(await drawn(path, Loading)).toBe(await drawn(UNKNOWN, DashLoading));
  });
});

describe('R1-C22: an issued enrolment link is kept out of the mutation cache', () => {
  const LINK = 'https://console.example.com/enrol#t=zze_SECRETLINK0123456789';
  const PATH = peoplePath(PEOPLE_DEFAULTS);
  const q = new URLSearchParams(PATH.split('?')[1]);
  const LIST = people(ME, q, { limit: 10, offset: 0 })![1] as Extract<PeopleRead, { state: 'ok' }>['data'];

  it('shows the link once, and no cache of the page holds it', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://console.test');
      if (init?.method === 'POST') return new Response(JSON.stringify({ ok: true, url: LINK, result: 'issued' }), { status: 200 });
      return new Response(JSON.stringify(url.pathname.endsWith('/me') ? ME : LIST), { status: 200 });
    }));
    window.history.replaceState(null, '', '/platform/people');
    at.path = '/platform/people';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider><PlatformPeopleView served={{ state: 'ok', path: PATH, data: LIST }} /></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
    const on = LIST.people.find((p) => p.state === 'active')!;
    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes(on.email))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Enrolment link' }));
    await waitFor(() => expect(document.body.textContent).toContain(LINK));
    const held = () => JSON.stringify([client.getMutationCache().getAll().map((m) => m.state), client.getQueryCache().getAll().map((c) => c.state.data)]);
    expect(held()).not.toContain('SECRETLINK');
    fireEvent.click(screen.getByRole('button', { name: /sent it/ }));
    await waitFor(() => expect(document.body.textContent).not.toContain(LINK));
    expect(held()).not.toContain('SECRETLINK');
  });
});
