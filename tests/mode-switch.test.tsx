import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModeSwitch } from '@/console/settings/console-scope-panel';
import { ConsoleModeProvider, useConsole } from '@/lib/api';
import type { ChromeAccess } from '@/lib/collection';
import { WorkspaceRail } from '@/views/workspace-chrome';

// Rendering is not enforcement — the server decides scope — but the render rule is asserted
// on its own so a control never shows to someone who cannot use it. `Segmented` renders
// role="radiogroup", not "group". DELIBERATE: no provider is mounted. `useConsoleMode` falls
// back to an inert default outside `ConsoleModeProvider`, so a component that only reads it
// renders standalone without `QueryClientProvider` and a real `/me` fetch.
const base = {
  email: 'a@b.example.com', name: 'A', role: 'member' as const, mayRead: true,
  via: 'session', teams: [{ slug: 'team-one', role: 'member' as const }],
  activeTeam: 'team-one',
};

describe('ModeSwitch', () => {
  it('renders no control for a member', () => {
    render(<ModeSwitch me={{ ...base, superadmin: false }} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('holds the space the switch would take, for a member and before `/me` answers', () => {
    // COUPLED: the row's height may not depend on what the read says. This section is the first
    // on `/settings`, so a control that appears for a superadmin and not for a member — or one
    // that appears only once `/me` lands — moves every section below it, which is the layout
    // shift this section has caused in both directions. The slot is held for all three cases;
    // only its contents differ. `aria-hidden` because a gap is not a control.
    for (const me of [{ ...base, superadmin: false }, undefined]) {
      const { container, unmount } = render(<ModeSwitch me={me} />);
      const slot = container.firstElementChild;
      expect(slot).not.toBeNull();
      expect(slot).toHaveAttribute('aria-hidden');
      expect(container.querySelector('[role="radiogroup"]')).toBeNull();
      unmount();
    }
  });

  it('renders a labelled radiogroup for a superadmin', () => {
    render(<ModeSwitch me={{ ...base, role: 'superadmin', superadmin: true }} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});

/**
 * The same choice, drawn by the console's workspace chrome: the rail's workspace menu offers a superadmin `The whole
 * platform` and `Your team`. Choosing one changes the scope every browser read sends, and `Your team` narrows the rail to
 * what a member is shown, over what the server answered (`src/nav.ts`; `tests/nav-scope.test.tsx` holds the rule).
 */
describe('the scope in the rail\'s workspace menu', () => {
  const EVERY = ['/', '/teams', '/initiatives', '/knowledge', '/people', '/plugins', '/runs', '/activity', '/settings'];
  const MEMBER = ['/', '/initiatives', '/knowledge', '/people', '/settings'];
  let calls: string[];

  /** A page's read beside the rail, so the scope it sends can be read off the request. */
  function Probe() {
    useConsole('/overview');
    return null;
  }

  async function mount(access: ChromeAccess, superadmin: boolean) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const body = url.endsWith('/me') ? { ...base, role: superadmin ? 'superadmin' : 'member', superadmin } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <ConsoleModeProvider><WorkspaceRail access={Promise.resolve(access)} /><Probe /></ConsoleModeProvider>
        </QueryClientProvider>,
      );
    });
    await screen.findByText(access.user.name);
  }
  const hrefs = () => within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole('link').map((l) => l.getAttribute('href'));
  const choose = async (label: string) => {
    fireEvent.keyDown(screen.getByRole('button', { name: /: workspace menu$/ }), { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    await act(async () => { fireEvent.click(within(menu).getByRole('menuitemradio', { name: label })); });
  };
  const overviews = () => calls.filter((u) => u.startsWith('/api/console/overview'));

  beforeEach(() => {
    window.localStorage.clear();
    calls = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers a superadmin both scopes, and in Your team draws only what a member is shown', async () => {
    await mount({ only: EVERY, user: { name: 'Owner', role: 'Superadmin' } }, true);
    expect(hrefs()).toEqual(EVERY);
    await choose('Your team');
    await waitFor(() => expect(hrefs()).toEqual(MEMBER));
    await choose('The whole platform');
    await waitFor(() => expect(hrefs()).toEqual(EVERY));
  });

  it('sends the scope it sends today: `scope=platform` for the whole platform, nothing for the team', async () => {
    await mount({ only: EVERY, user: { name: 'Owner', role: 'Superadmin' } }, true);
    await choose('Your team');
    await waitFor(() => expect(overviews().at(-1)).toBe('/api/console/overview'));
    expect(window.localStorage.getItem('zz-stack-mode')).toBe('team');
    await choose('The whole platform');
    await waitFor(() => expect(overviews().at(-1)).toBe('/api/console/overview?scope=platform'));
    expect(window.localStorage.getItem('zz-stack-mode')).toBe('platform');
  });

  it('offers a member no scope, and never adds a destination the server did not answer', async () => {
    // A stored `platform` left behind on a shared machine: the view may not widen what the server answered.
    window.localStorage.setItem('zz-stack-mode', 'platform');
    await mount({ only: MEMBER, user: { name: 'Mei', role: 'Member' } }, false);
    expect(hrefs()).toEqual(MEMBER);
    expect(screen.queryByRole('button', { name: /: workspace menu$/ })).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: /: account menu$/ }), { key: 'Enter' });
    expect(within(await screen.findByRole('menu')).queryAllByRole('menuitemradio')).toEqual([]);
  });
});
