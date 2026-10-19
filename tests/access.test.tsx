import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace() {} }),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));
const toasts = vi.hoisted(() => ({ said: [] as { tone?: string; title: string }[] }));
/** Whether the console has an assistant, as the layout promises it: one settled promise each way, kept across renders. */
const assistant = vi.hoisted(() => ({ ON: Promise.resolve(true), OFF: Promise.resolve(false), on: false }));
vi.mock('@/components/base/shell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/base/shell')>()),
  useAssistantAvailable: () => (assistant.on ? assistant.ON : assistant.OFF),
}));
vi.mock('@/components/ui/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/toast')>()),
  toast: (t: { tone?: string; title: string }) => { toasts.said.push(t); },
}));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { GatewayError } from '@/data/gateway';
import { MAIN_ROLES, effective } from '@/data/roles';
import type { Me } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import { ACCESS_BOUND_MS, browserOf, type AccessRead } from '@/views/access-context';
import { AccessView } from '@/views/pages/access';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import AccessLoading from '../app/(dash)/access/loading';
import AccessPage, { generateMetadata as accessMetadata } from '../app/(dash)/access/page';
import { readAccess } from '../app/(dash)/access/read-access';

/**
 * Access (Task I-112), which replaces Settings: the page drawn from the fake gateway's own answer as the superadmin and
 * as a member, read first on the console's server; its sections (tokens with Issue and Revoke, setup, the connected
 * applications with Revoke, the signed-in browsers with the current one marked and Sign out on the others, passkeys,
 * the team acted for with its switch, and the team's members for its admin); every state; each write and its refusal,
 * which keeps what was typed and says the gateway's sentence; and the first paint. No section offers a console scope
 * (reconciliation 76).
 */
const answer = (who: Me): Access => accessOf(who)[1] as Access;
const ADMIN = answer(ME);
const NOAH = answer(MEMBER);
/** The member as most are: a member, not the admin, of the one team they act for. */
const PLAIN: Me = { ...MEMBER, teams: [{ slug: 'atlas', role: 'member' }] };
const PLAIN_ACCESS: Access = { ...NOAH, teams: { actingFor: 'atlas', teams: [{ team: 'atlas', role: 'member', active: true }] } };
/** A person with nothing yet: no token, no application, no passkey and no team, signed in on this browser alone. */
const NOTHING: Access = { ...NOAH, issued: [], applications: [], authenticators: [], browsers: NOAH.browsers.filter((b) => b.current), teams: { actingFor: null, teams: [] } };
const ok = (access: Access): AccessRead => ({ state: 'ok', access });

type Answered = [status: number, body: unknown];
/** The browser's reads and writes, answered by `respond`; the person's own `/me` and their team's members as the fake has them. */
function browser(respond: (path: string, init?: RequestInit) => Answered | null = () => null, me: Me = ME) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://console.test');
    const p = url.pathname.replace('/api/console', '');
    const [status, body]: Answered = p === '/me' ? [200, me]
      : respond(p, init) ?? (p === '/settings/team/members' ? [200, teamMembers(url.searchParams.get('team') ?? '')] : p === '/access' ? [200, answer(me)] : [404, { error: 'no such route' }]);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
type Call = [RequestInfo | URL, RequestInit | undefined];
const calls = () => (fetch as unknown as { mock: { calls: Call[] } }).mock.calls.map(([u, init]) => ({ method: init?.method ?? 'GET', path: String(u).split('?')[0].replace('/api/console', ''), body: init?.body ? JSON.parse(String(init.body)) : undefined }));
const reads = (p: string) => calls().filter((c) => c.method === 'GET' && c.path === p);
const writes = () => calls().filter((c) => c.method !== 'GET');

const tree = (ui: ReactElement, ask?: (q: string) => void) => <SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>;
function mount(ui: ReactElement, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{tree(ui, ask)}</QueryClientProvider>);
}
const draw = (access: Access | AccessRead, { ask }: { ask?: (q: string) => void } = {}) =>
  mount(<AccessView served={'state' in access ? access : ok(access)} />, ask);
/** A section by its title: the FormSection's `section`, found while a dialog hides the page from assistive technology too. */
const section = (title: string) => screen.getByRole('heading', { level: 2, name: title, hidden: true }).closest('section') as HTMLElement;
const rowsOf = (title: string) => within(section(title)).queryAllByRole('row', { hidden: true }).slice(1);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const button = (scope: HTMLElement, name: string | RegExp) => within(scope).getByRole('button', { name });

beforeEach(() => {
  toasts.said = [];
  assistant.on = false;
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/access');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('who opens Access', () => {
  it('needs work:read, which both roles hold', () => {
    expect(FEATURES.access).toEqual({ title: 'Access', needs: 'work:read' });
    for (const role of MAIN_ROLES) expect(effective(role).has('work:read'), role).toBe(true);
  });
});

describe('Access, as the fake gateway answers the superadmin', () => {
  it('stacks its sections in order, each a ZZ Meridian FormSection, and no console scope', () => {
    browser();
    draw(ADMIN);
    const titles = [...document.querySelectorAll('section h2')].map((h) => h.textContent);
    expect(titles).toEqual(['Tokens', 'Client setup', 'Connected applications', 'Signed-in browsers', 'Passkeys', 'The team you act for', 'atlas\'s members']);
  });

  it('lists every token with its label, application, dates and state, and Revoke on the live ones alone', () => {
    browser();
    draw(ADMIN);
    const rows = rowsOf('Tokens');
    expect(rows).toHaveLength(ADMIN.issued.length);
    ADMIN.issued.forEach((t, i) => {
      expect(rows[i].textContent).toContain(t.label);
      expect(rows[i].textContent).toContain(t.revokedAt ? 'Revoked' : 'Live');
      expect(within(rows[i]).queryByRole('button', { name: 'Revoke' }) !== null).toBe(!t.revokedAt);
    });
    expect(rows[0].textContent).toContain('Claude Code');
    expect(rows[1].textContent).toContain('Issued directly');
    // A token never used says so, in words.
    expect(rows[2].textContent).toContain('Never');
  });

  it('draws the setup commands, the applications with their live tokens, and the passkeys', () => {
    browser();
    draw(ADMIN);
    // The setup's blocks of commands as the gateway wrote them, each in its own block.
    const blocks = [...ADMIN.setup.config.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThan(0);
    expect([...section('Client setup').querySelectorAll('[data-setup] pre')].map((p) => p.textContent).filter((t) => blocks.includes(t!))).toEqual(blocks);
    const [claude] = rowsOf('Connected applications');
    expect(claude.textContent).toContain('Claude Code');
    expect(claude.textContent).toContain('2 live');
    expect(rowsOf('Passkeys')[0].textContent).toContain('MacBook Touch ID');
    expect(rowsOf('Passkeys')[0].textContent).toContain('this device, a phone nearby');
  });

  it('marks the browser asking and offers Sign out on every other, naming none by its session id', () => {
    browser();
    const { container } = draw(ADMIN);
    const rows = rowsOf('Signed-in browsers');
    expect(rows).toHaveLength(ADMIN.browsers.length);
    expect(rows[0].textContent).toContain('This browser');
    expect(rows[0].textContent).toContain('Safari on macOS');
    expect(within(rows[0]).queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(button(rows[1], 'Sign out')).toBeInTheDocument();
    expect(rows[1].textContent).toContain('Safari on iPhone');
    for (const b of ADMIN.browsers) expect(container.innerHTML).not.toContain(b.id);
  });

  it('marks the team acted for, offers the others, and draws its members for its admin', async () => {
    browser();
    draw(ADMIN);
    const [atlas, beacon] = rowsOf('The team you act for');
    expect(atlas.textContent).toContain('Acting for');
    expect(within(atlas).queryByRole('button', { name: 'Act as this team' })).toBeNull();
    expect(button(beacon, 'Act as this team')).toBeEnabled();
    await waitFor(() => expect(rowsOf('atlas\'s members').length).toBe(teamMembers('atlas').length));
    expect(reads('/settings/team/members')).toHaveLength(1);
  });

  it('draws the person\'s own switch for the assistant last, and only where the console has an assistant', async () => {
    browser();
    assistant.on = true;
    const { unmount } = draw(ADMIN);
    expect(await screen.findByRole('heading', { level: 2, name: 'Assistant' })).toBeInTheDocument();
    expect([...document.querySelectorAll('section h2')].at(-1)!.textContent).toBe('Assistant');
    expect(within(section('Assistant')).getByRole('switch', { name: /Show the assistant/ })).toBeInTheDocument();
    unmount();
    assistant.on = false;
    draw(ADMIN);
    await settle();
    expect(screen.queryByRole('heading', { name: 'Assistant' })).toBeNull();
  });

  it('reads nothing in the browser while the server\'s answer is the latest', async () => {
    browser();
    draw(ADMIN);
    await settle();
    expect(reads('/access')).toEqual([]);
  });
});

describe('Access, as a member', () => {
  it('draws the members only for the admin of the team acted for', async () => {
    browser(undefined, MEMBER);
    const { unmount } = draw(NOAH);
    expect(screen.queryByRole('heading', { name: 'Console scope' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'atlas\'s members' })).toBeInTheDocument();
    unmount();
    browser(undefined, PLAIN);
    draw(PLAIN_ACCESS);
    expect(screen.queryByRole('heading', { name: /members$/ })).toBeNull();
    await settle();
    expect(reads('/settings/team/members')).toEqual([]);
  });

  it('lists the member\'s own tokens and application, and nothing of the superadmin\'s', () => {
    browser(undefined, MEMBER);
    const { container } = draw(NOAH);
    expect(rowsOf('Tokens')).toHaveLength(NOAH.issued.length);
    expect(rowsOf('Connected applications')[0].textContent).toContain('ChatGPT');
    for (const t of ADMIN.issued) expect(container.textContent).not.toContain(t.label);
  });
});

describe('every state Access draws', () => {
  it('says what each section has none of, and every other section stands', () => {
    browser();
    draw(NOTHING);
    expect(section('Tokens').textContent).toContain('No token issued yet');
    expect(section('Connected applications').textContent).toContain('No application connected');
    expect(section('Passkeys').textContent).toContain('No passkey recorded');
    expect(section('The team you act for').textContent).toContain('You are not a member of any team yet');
    expect(rowsOf('Signed-in browsers')).toHaveLength(1);
    // Issuing is still offered to a person with no token.
    expect(button(section('Tokens'), 'Issue token')).toBeEnabled();
  });

  it('says no browser is signed in for a page opened with a token', () => {
    browser();
    draw({ ...NOTHING, browsers: [] });
    expect(section('Signed-in browsers').textContent).toContain('No browser signed in');
  });

  it('draws the gateway\'s sentence with Retry when the read failed, and the page once Retry reads it', async () => {
    browser();
    draw({ state: 'failed', reason: 'the platform database is unavailable' });
    expect(screen.getByText('Access did not load')).toBeInTheDocument();
    expect(screen.getByText(/the platform database is unavailable\. Nothing on this page was read\./)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Tokens' })).toBeInTheDocument());
    expect(reads('/access')).toHaveLength(1);
  });

  it('says the read was slow rather than drawing an endless skeleton', () => {
    browser();
    draw({ state: 'slow' });
    expect(screen.getByText('Access is unavailable')).toBeInTheDocument();
    expect(screen.getByText(`The read did not answer within ${ACCESS_BOUND_MS / 1000} seconds. Nothing on this page was read.`)).toBeInTheDocument();
  });

  it('loads as the tallest page, naming nothing under the absent refusal', () => {
    const { container } = render(<AccessLoading />);
    expect(container.textContent).not.toContain('Access');
    expect(container.querySelectorAll('.flex.flex-col.gap-14 > .\\@container')).toHaveLength(8);
  });
});

describe('the writes Access makes, each the person\'s', () => {
  it('issues a token, shows its value once outside the page text, and reads the page again', async () => {
    const TOKEN = 'zz_pat_issued_0123456789abcdef';
    let issued = false;
    browser((p, init) => {
      if (p === '/settings/me/tokens' && init?.method === 'POST') { issued = true; return [200, { token: TOKEN, label: 'laptop', email: ME.email }]; }
      if (p === '/access' && issued) return [200, { ...ADMIN, issued: [{ id: 'tok_new', label: 'laptop', createdAt: ADMIN.meta.asOf, lastUsedAt: null, revokedAt: null, application: null }, ...ADMIN.issued] }];
      return null;
    });
    const { container } = draw(ADMIN);
    fireEvent.change(within(section('Tokens')).getByRole('textbox'), { target: { value: 'laptop' } });
    await act(async () => { fireEvent.click(button(section('Tokens'), 'Issue token')); });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(TOKEN);
    expect(dialog.querySelector('[data-assistant="omit"]')!.textContent).toContain(TOKEN);
    expect(container.textContent).not.toContain(TOKEN);
    expect(writes()).toEqual([{ method: 'POST', path: '/settings/me/tokens', body: { label: 'laptop' } }]);
    await waitFor(() => expect(rowsOf('Tokens')).toHaveLength(ADMIN.issued.length + 1));
    expect(within(section('Tokens')).getByRole('textbox', { hidden: true })).toHaveValue('');
    // Dismissed, the value is gone from the document, not hidden in it.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'I\'ve stored it' })); });
    await waitFor(() => expect(document.body.textContent).not.toContain(TOKEN));
  });

  it('keeps the label typed and says the gateway\'s sentence when an issue is refused', async () => {
    const REFUSED = 'your token is bound to team \'atlas\', so it cannot issue a token that reaches further than it does.';
    browser((p, init) => (p === '/settings/me/tokens' && init?.method === 'POST' ? [403, { error: REFUSED }] : null));
    draw(ADMIN);
    const field = within(section('Tokens')).getByRole('textbox');
    fireEvent.change(field, { target: { value: 'ci runner' } });
    await act(async () => { fireEvent.click(button(section('Tokens'), 'Issue token')); });
    expect(await within(section('Tokens')).findByRole('alert')).toHaveTextContent(REFUSED);
    expect(field).toHaveValue('ci runner');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('revokes one live token after the person confirms, and says a refusal', async () => {
    browser((p, init) => (init?.method === 'DELETE' && p === `/settings/me/tokens/${ADMIN.issued[1].id}` ? [400, { error: 'no such active token of yours' }] : init?.method === 'DELETE' ? [200, { ok: true, revoked: p.split('/').at(-1) }] : null));
    draw(ADMIN);
    const [first, second] = rowsOf('Tokens');
    fireEvent.click(button(first, 'Revoke'));
    await act(async () => { fireEvent.click(button(first, 'Revoke')); });
    expect(writes()).toEqual([{ method: 'DELETE', path: `/settings/me/tokens/${ADMIN.issued[0].id}`, body: undefined }]);
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'positive', title: `Revoked ${ADMIN.issued[0].label}` }));
    fireEvent.click(button(second, 'Revoke'));
    await act(async () => { fireEvent.click(button(second, 'Revoke')); });
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'critical', title: 'no such active token of yours' }));
  });

  it('revokes the caller\'s tokens for an application, and signs out another browser but never this one', async () => {
    browser((p, init) => {
      if (init?.method !== 'DELETE') return null;
      return p.startsWith('/settings/me/applications/') ? [200, { ok: true, revoked: 2 }] : [400, { error: 'revoke this from the console, signed in: a token cannot revoke what signs you in' }];
    });
    draw(ADMIN);
    const [claude] = rowsOf('Connected applications');
    fireEvent.click(button(claude, 'Revoke'));
    expect(claude.textContent).toContain('End your 2 live tokens for Claude Code?');
    await act(async () => { fireEvent.click(button(claude, 'Revoke')); });
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'positive', title: 'Revoked 2 tokens for Claude Code' }));
    const [, other] = rowsOf('Signed-in browsers');
    fireEvent.click(button(other, 'Sign out'));
    await act(async () => { fireEvent.click(button(other, 'Sign out')); });
    expect(writes().map((w) => [w.method, w.path])).toEqual([
      ['DELETE', '/settings/me/applications/mcp-client-claude-code'],
      ['DELETE', `/settings/me/browsers/${ADMIN.browsers[1].id}`],
    ]);
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'critical', title: 'revoke this from the console, signed in: a token cannot revoke what signs you in' }));
  });

  it('switches the team acted for through the gateway, and says a refused switch', async () => {
    browser((p, init) => (p === '/settings/me/active-team' && init?.method === 'POST' ? [400, { error: 'not a member of beacon' }] : null));
    draw(ADMIN);
    const [, beacon] = rowsOf('The team you act for');
    await act(async () => { fireEvent.click(button(beacon, 'Act as this team')); });
    expect(writes()).toEqual([{ method: 'POST', path: '/settings/me/active-team', body: { team: 'beacon' } }]);
    await waitFor(() => expect(toasts.said).toContainEqual({ tone: 'critical', title: 'not a member of beacon' }));
    expect(button(beacon, 'Act as this team')).toBeEnabled();
  });

  it('keeps the address typed and says the gateway\'s sentence when a member is refused', async () => {
    browser((p, init) => (p === '/settings/team/members' && init?.method === 'POST' ? [400, { error: 'no principal with that email' }] : null));
    draw(ADMIN);
    const members = section('atlas\'s members');
    await waitFor(() => expect(rowsOf('atlas\'s members').length).toBeGreaterThan(0));
    const email = within(members).getByRole('textbox');
    fireEvent.change(email, { target: { value: 'new.person@example.com' } });
    await act(async () => { fireEvent.click(button(members, 'Add member')); });
    expect(await within(members).findByRole('alert')).toHaveTextContent('no principal with that email');
    expect(email).toHaveValue('new.person@example.com');
  });
});

describe('the agent side on the page', () => {
  it('asks about Tokens from the first section\'s head, and renders no Ask without an assistant', () => {
    browser();
    const ask = vi.fn();
    const { unmount } = draw(ADMIN, { ask });
    const tokens = section('Tokens');
    expect(tokens.closest('[data-protagonist]')).toHaveAttribute('data-protagonist', 'Tokens');
    const [first] = screen.getAllByRole('button', { name: /^Ask: / });
    expect(tokens.querySelector('header')!.contains(first)).toBe(true);
    fireEvent.click(first);
    expect(ask).toHaveBeenCalledWith('Which of my tokens are live, which application is each for, and which have never been used?');
    unmount();
    draw(ADMIN);
    expect(screen.queryAllByRole('button', { name: /^Ask: / })).toEqual([]);
  });

  it('names a browser by what it said it was', () => {
    expect(browserOf({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0 Safari/537.36' })).toBe('Chrome on Linux');
    expect(browserOf({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0 Safari/537.36 Edg/141.0' })).toBe('Edge on Windows');
    expect(browserOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0' })).toBe('Firefox on macOS');
    expect(browserOf({ userAgent: null })).toBe('A browser that sent no name');
  });
});

describe('the first paint', () => {
  it('carries every section the server read, and hydrates onto the same markup with no browser read', async () => {
    browser();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <AccessView served={ok(ADMIN)} />;
    const html = renderToString(<QueryClientProvider client={client}>{tree(view)}</QueryClientProvider>);
    // A label's address breaks only between its parts, so its text is read past the marks that allow it.
    for (const t of ADMIN.issued) expect(html.replace(/<[^>]+>/g, '')).toContain(t.label);
    expect(html).not.toContain('Console scope');
    for (const b of ADMIN.browsers) expect(html).not.toContain(b.id);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const mismatches: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <QueryClientProvider client={client}>{tree(view)}</QueryClientProvider>, { onRecoverableError: (e) => mismatches.push(e) });
    });
    expect(mismatches).toEqual([]);
    await settle();
    expect(reads('/access')).toEqual([]);
    container.remove();
  });
});

describe('the page on the console\'s server', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (p: string) => (p === '/me' ? ME : p === '/access' ? ADMIN : Promise.reject(new GatewayError(404, 'HTTP 404'))));
  });

  it('is titled Access', async () => {
    expect(await accessMetadata()).toEqual({ title: 'Access' });
  });

  it('reads Access once, as the person, and hands the one read to the as-of line and the sections', async () => {
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props.read) found.push(props.read);
      Object.values(props).forEach(walk);
    };
    walk(await AccessPage());
    expect(found).toHaveLength(2);
    expect(found[0]).toBe(found[1]);
    expect(await found[0]).toEqual(ok(ADMIN));
    expect(gateway.get.mock.calls.filter(([p]) => p === '/access')).toHaveLength(1);
  });

  it('says the gateway\'s sentence, or that the read was slow, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(503, 'platform database unavailable'));
    expect(await readAccess()).toEqual({ state: 'failed', reason: 'platform database unavailable' });
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const slow = readAccess();
    await vi.advanceTimersByTimeAsync(ACCESS_BOUND_MS);
    expect(await slow).toEqual({ state: 'slow' });
  });
});
