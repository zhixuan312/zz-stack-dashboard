import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The shell drawn from the server's answer: the layout hands the release's rail and palette one `chromeAccess()`
 * promise, and they draw exactly the destinations it answers for the person signed in. `chromeAccess` runs here as the
 * server runs it, against a gateway stood up as `fetch` at an absolute address; a read the browser made would be the
 * relative `/api/console/...`, and none is made.
 */
const at = vi.hoisted(() => ({ path: '/', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => at.path,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: at.push, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  redirect: (to: string) => {
    throw new Error(`redirect to ${to}`);
  },
}));
const jar = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
/** The refused view is an async Server Component, and the chrome never draws it. */
vi.mock('@/views/no-access', () => ({ NoAccess: async () => null }));

import { openCommand } from '@/components/patterns/command-palette';
import { chromeAccess } from '@/data/access';
import type { ChromeAccess } from '@/lib/collection';
import { WorkspacePalette, WorkspaceRail } from '@/views/workspace-chrome';
import DashError from '../app/(dash)/error';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

type Body = Record<string, unknown>;
const SUPERADMIN: Body = { email: 'owner@example.com', name: 'Owner', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
const MEMBER: Body = { email: 'mei@example.com', name: 'Mei', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };

/** The two rails, from the spec's destinations table, written out here and not read from `nav`. */
const WORK = ['Home', 'Record', 'Initiatives', 'Approvals', 'Knowledge', 'Activity', 'Runs', 'Plugins', 'Access'];
const PLATFORM = ['Status', 'Releases', 'Bugs', 'Evaluation', 'Teams', 'People', 'Usage', 'Audit', 'Knowledge health'];
/** Platform's six public destinations, a member's. */
const PUBLIC = ['Status', 'Releases', 'Bugs', 'Evaluation', 'Usage', 'Knowledge health'];
/** The superadmin's alone. */
const FLEET = ['Teams', 'People', 'Audit'];
const EVERYTHING = [...WORK, ...PLATFORM];

let calls: string[];
/** The gateway answers `/me` with a body, with a bare status, or not at all. */
function gateway(answer: Body | number | 'down') {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (answer === 'down') throw new TypeError('fetch failed');
    if (typeof answer === 'number') return { ok: false, status: answer, json: async () => ({ error: `HTTP ${answer}` }) } as Response;
    return { ok: true, status: 200, json: async () => answer } as Response;
  }));
}

/** What the layout does: one promise, not awaited, that settles on null when nobody can be named. */
const layoutAccess = (): Promise<ChromeAccess | null> => chromeAccess().catch(() => null);
const links = () => within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole('link').map((l) => l.textContent);

async function chromeFor(access = layoutAccess()) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<><WorkspaceRail access={access} /><WorkspacePalette access={access} /></>);
  });
  return view;
}
async function chrome(access = layoutAccess()) {
  await chromeFor(access);
}

/**
 * The palette's destinations, opened after the rail is read: what is behind a modal is hidden from every reader. An
 * option is its label and then its group, so the label is read on its own: `Knowledge` is not `Knowledge health`.
 */
async function paletteOffers(): Promise<string[]> {
  act(() => openCommand());
  const options = within(await screen.findByRole('dialog')).getAllByRole('option').map((o) => o.querySelector('span')?.textContent ?? '');
  return options.filter((label) => EVERYTHING.includes(label));
}
/** The rail's group headings, in order. */
const headings = () => [...screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('.t-eyebrow')].map((h) => h.textContent);

const saved = { ...process.env };
beforeEach(() => {
  at.path = '/';
  at.push.mockReset();
  calls = [];
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'session-1';
  process.env.ZZ_GATEWAY = 'http://gateway.test';
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the rail and the palette draw what the server answered for the person signed in', () => {
  it('gives a member every Work destination, in the destinations table\'s groups and order', async () => {
    gateway(MEMBER);
    await chrome();
    await screen.findByText('Mei');
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(links()).toEqual(WORK);
    expect(headings()).toEqual(['Work', 'Agents', 'Catalog', 'Account']);
    expect(await paletteOffers()).toEqual(WORK);
  });

  it('gives a member Platform\'s six public destinations and none of the superadmin\'s', async () => {
    gateway(MEMBER);
    at.path = '/platform';
    await chrome();
    await screen.findByText('Mei');
    expect(links()).toEqual(PUBLIC);
    for (const label of FLEET) expect(links()).not.toContain(label);
    expect(headings()).toEqual(['Health', 'Fleet']);
    expect(await paletteOffers()).toEqual(PUBLIC);
  });

  it('gives a superadmin Work\'s nine', async () => {
    gateway(SUPERADMIN);
    await chrome();
    await screen.findByText('Owner');
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(links()).toEqual(WORK);
    expect(await paletteOffers()).toEqual(WORK);
  });

  it('gives a superadmin Platform\'s nine at its address, Fleet with Teams, People, Usage, Audit and Knowledge health', async () => {
    gateway(SUPERADMIN);
    at.path = '/platform/teams/atlas';
    await chrome();
    await screen.findByText('Owner');
    expect(links()).toEqual(PLATFORM);
    expect(headings()).toEqual(['Health', 'Fleet']);
    expect(screen.getByRole('link', { name: 'Teams' }).getAttribute('aria-current')).toBe('page');
    expect(await paletteOffers()).toEqual(PLATFORM);
  });

  it('puts Settings on no rail, in either workspace, for either person', async () => {
    for (const [who, body, name] of [['member', MEMBER, 'Mei'], ['superadmin', SUPERADMIN, 'Owner']] as const) {
      for (const where of ['/', '/platform', '/settings']) {
        gateway(body);
        at.path = where;
        const view = await chromeFor();
        await screen.findByText(name);
        expect(links(), `${who} at ${where}`).not.toContain('Settings');
        view.unmount();
      }
    }
  });

  it('asks the gateway as the caller, and the browser asks nothing', async () => {
    gateway(MEMBER);
    await chrome();
    await screen.findByText('Mei');
    expect(calls).toEqual(['http://gateway.test/api/console/me']);
  });

  it('marks the destination the address is under, on a nested address', async () => {
    gateway(MEMBER);
    at.path = '/initiatives/beacon/2026-09-28-search-relevance';
    await chrome();
    await screen.findByText('Mei');
    expect(screen.getByRole('link', { name: 'Initiatives' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('the workspace menu', () => {
  /** The rail's menu, opened as a keyboard opens it, and its rows by name. */
  async function menu(): Promise<string[]> {
    fireEvent.keyDown(screen.getByRole('button', { name: /: workspace menu$/ }), { key: 'Enter' });
    return within(await screen.findByRole('menu')).getAllByRole('menuitemradio').map((r) => r.textContent ?? '');
  }
  const choose = async (name: string) => {
    await act(async () => { fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name })); });
  };

  it('offers a member Work and Platform, names the workspace in view, and opens Platform at its home', async () => {
    gateway(MEMBER);
    await chrome();
    await screen.findByText('Mei');
    expect(screen.getByRole('button', { name: 'ZZ Stack, Work: workspace menu' })).toBeInTheDocument();
    expect(await menu()).toEqual(['Work', 'Platform']);
    await choose('Platform');
    expect(at.push).toHaveBeenCalledWith('/platform');
  });

  it('draws Platform\'s rail at its address, and Work opens the home', async () => {
    gateway(MEMBER);
    at.path = '/platform';
    await chrome();
    await screen.findByText('Mei');
    expect(screen.getByRole('button', { name: 'ZZ Stack, Platform: workspace menu' })).toBeInTheDocument();
    expect(links()).toEqual(PUBLIC);
    await menu();
    await choose('Work');
    expect(at.push).toHaveBeenCalledWith('/');
  });

  // No console scope (reconciliation 76): a superadmin's console is the whole platform, always, and acting for a team is
  // Access's team switch, as it is for everybody.
  it.each([['a superadmin', SUPERADMIN, 'Owner'], ['a member', MEMBER, 'Mei']] as const)('offers %s the two workspaces and no console scope', async (_who, body, name) => {
    gateway(body);
    await chrome();
    await screen.findByText(name);
    expect(await menu()).toEqual(['Work', 'Platform']);
    expect(screen.queryByRole('menuitemradio', { name: /whole platform|your team/i })).toBeNull();
  });

  it.each([['a superadmin', SUPERADMIN, 'Owner', 18], ['a member', MEMBER, 'Mei', 15]] as const)('draws %s the same destinations in the rail and the palette across both workspaces', async (_who, body, name, count) => {
    const drawn: string[] = [];
    for (const where of ['/', '/platform']) {
      gateway(body);
      at.path = where;
      const view = await chromeFor();
      await screen.findByText(name);
      const rail = links();
      expect(await paletteOffers()).toEqual(rail);
      drawn.push(...(rail as string[]));
      view.unmount();
    }
    expect(drawn).toHaveLength(count);
    expect(drawn).toEqual(count === 18 ? EVERYTHING : [...WORK, ...PUBLIC]);
  });

  it('does nothing when the workspace in view is chosen', async () => {
    gateway(MEMBER);
    await chrome();
    await screen.findByText('Mei');
    await menu();
    await choose('Work');
    expect(at.push).not.toHaveBeenCalled();
  });
});

describe('an identity that cannot be resolved names nobody', () => {
  for (const [what, answer] of [['no session', 401], ['a refused session', 403], ['a gateway that is down', 'down'], ['a body the role table cannot place', { ...MEMBER, role: 'owner' }]] as const) {
    it(`keeps the placeholder and draws no destination for ${what}`, async () => {
      gateway(answer);
      await chrome();
      expect(screen.queryAllByRole('link')).toEqual([]);
      for (const name of ['Mei', 'Owner', 'Member', 'Superadmin', 'Signing in']) expect(screen.queryByText(name)).not.toBeInTheDocument();
      act(() => openCommand());
      const dialog = await screen.findByRole('dialog');
      for (const label of EVERYTHING) expect(within(dialog).queryByRole('option', { name: new RegExp(`^${label}`) })).toBeNull();
    });
  }

  it('draws no destination while who they are is still being found out', async () => {
    let settle!: (access: ChromeAccess | null) => void;
    await chrome(new Promise<ChromeAccess | null>((resolve) => { settle = resolve; }));
    expect(screen.queryAllByRole('link')).toEqual([]);
    await act(async () => settle(null));
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});

describe('the shell decides nothing in the browser', () => {
  it('hands the rail and the palette one access promise, made once and not awaited', () => {
    const layout = source('app/(dash)/layout.tsx');
    expect(layout.match(/chromeAccess\(\)/g)).toHaveLength(1);
    expect(layout).toMatch(/const access = chromeAccess\(\)\.catch\(\(\) => null\);/);
    expect(layout).not.toMatch(/await\s+(access|chromeAccess)/);
    expect(layout).toMatch(/<WorkspaceRail access=\{access\} \/>/);
    expect(layout).toMatch(/<WorkspacePalette access=\{access\} \/>/);
  });

  it('has no browser gate and no rail built from `/me`', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/console/gate.tsx'))).toBe(false);
    const layout = source('app/(dash)/layout.tsx');
    expect(layout).not.toMatch(/ConsoleGate|useConsole|'\/me'/);
    const frame = source('src/console/frame.tsx');
    expect(frame).not.toMatch(/ConsoleRail|ConsolePalette|ChromeAccess|shownIn|@\/nav/);
    const adapter = source('src/views/workspace-chrome.tsx');
    expect(adapter).not.toMatch(/useConsole\b|'\/me'|fetch\(/);
    expect(adapter).toMatch(/usePathname\(\)/);
  });
});

describe('a gate that throws', () => {
  it('is answered by the error boundary: what the server could not draw, with a retry and no page', () => {
    const retry = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '2741139937' });
    render(<DashError error={error} retry={retry} />);
    // The wording says what a digest proves — that the SERVER threw — and not which throw it was: any Server Component
    // carries one, so blaming the platform for a page that threw on its own account would be a claim nobody made.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The server could not draw this page');
    expect(screen.getByText(/2741139937/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('says a page failed to draw when the error was thrown in the browser', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<DashError error={new Error('boom')} retry={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This page failed to render');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
