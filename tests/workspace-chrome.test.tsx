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

const EVERYTHING = ['Overview', 'Teams', 'Initiatives', 'Knowledge', 'People', 'Plugins', 'Runs', 'Activity', 'Settings'];
const WORKING_SET = ['Overview', 'Initiatives', 'Knowledge', 'Settings'];
const FLEET = ['Teams', 'People', 'Plugins', 'Runs', 'Activity'];

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

async function chrome(access = layoutAccess()) {
  await act(async () => {
    render(<><WorkspaceRail access={access} /><WorkspacePalette access={access} /></>);
  });
}

/** The palette's destinations, opened after the rail is read: what is behind a modal is hidden from every reader. */
async function paletteOffers(): Promise<string[]> {
  act(() => openCommand());
  const options = within(await screen.findByRole('dialog')).getAllByRole('option').map((o) => o.textContent ?? '');
  return EVERYTHING.filter((label) => options.some((o) => o.startsWith(label)));
}

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
  it('gives a member their working set and no fleet destination', async () => {
    gateway(MEMBER);
    await chrome();
    await screen.findByText('Mei');
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(links()).toEqual(WORKING_SET);
    for (const label of FLEET) expect(links()).not.toContain(label);
    expect(await paletteOffers()).toEqual(WORKING_SET);
  });

  it('gives a superadmin every destination there is today', async () => {
    gateway(SUPERADMIN);
    await chrome();
    await screen.findByText('Owner');
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(links()).toEqual(EVERYTHING);
    expect(await paletteOffers()).toEqual(EVERYTHING);
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
    expect(links()).toEqual(['Status']);
    await menu();
    await choose('Work');
    expect(at.push).toHaveBeenCalledWith('/');
  });

  it('gives a superadmin the workspaces and, under them, the scope with the team they act for', async () => {
    gateway(SUPERADMIN);
    await chrome();
    await screen.findByText('Owner');
    expect(await menu()).toEqual(['Work', 'Platform', 'The whole platform', 'Your team · atlas']);
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
  it('is answered by the error boundary: the console cannot reach the platform, with a retry and no page', () => {
    const retry = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '2741139937' });
    render(<DashError error={error} retry={retry} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The console cannot reach the platform');
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
