import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The address a loading state is drawn at, as the router reports it. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace() {} }),
}));
// The refusal the console declares (Task I-94): a refused address names nothing, its loading state included.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { ConsoleCaller } from '@/lib/api';
import KnowledgeLoading from '../app/(dash)/knowledge/loading';
import PlatformAuditLoading from '../app/(dash)/platform/audit/loading';
import PlatformStatusLoading from '../app/(dash)/platform/loading';

/**
 * Knowledge, Status and Audit draw their shell within the navigation budget (Task I-147, AC-8.7).
 *
 * Measured on a scratch build against the fake gateway (Wave 5's timed run #3676 reproduced: `/knowledge` phone 324 ms,
 * `/platform` desktop 331 ms and phone 490 ms, `/platform/audit` phone 496 ms): from a press in the rail the route's
 * prefetched loading state commits within about 30 ms on a desktop and 55 ms on the phone, and named nothing, so the
 * heading could only arrive behind it as a Suspense retry, which React holds until 300 ms after the last fallback it
 * committed. A route passed only when the router's own render after the response's root row already held the page's
 * heading, which is the byte layout of the stream (Releases' root row missed the first read and landed beside its
 * heading; Audit's fitted it, and its heading came a read later). `/platform` had a second cause on a desktop: its
 * loading state is the platform layout's, already mounted when the journey starts on `/platform/releases`, so its
 * prefetch carried none of the page's client chunks and the heading waited for them as well.
 *
 * The cause removed: each of the three loading states names its page for the person whose own rail offers it, at its
 * own address, so the heading lands with the loading state, before the gate has answered. Nobody else is told
 * anything: a person whose rail leaves the page out, another address the boundary stands in for, nobody resolved and
 * the prerendered shell all keep the words that name nothing, and the name is the rail's own label, looked up in the
 * browser, so no response carries it to a person who may not open the page.
 */

type Access = { only: string[]; user: { name: string; role: string }; team: string | null; caller: string };

/** The rails `pnpm verify --as` expects of the fake's two people (`expectedRoutes`). */
const MEMBER_RAIL = ['/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access', '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge'];
const SUPERADMIN: Access = { only: [...MEMBER_RAIL, '/platform/teams', '/platform/people', '/platform/audit'], user: { name: 'Ava', role: 'atlas' }, team: 'atlas', caller: 'ava@example.com' };
const MEMBER: Access = { only: MEMBER_RAIL, user: { name: 'Maya', role: 'atlas' }, team: 'atlas', caller: 'maya@example.com' };

const ROUTES: { href: string; title: string; elsewhere: string; Loading: () => ReactElement }[] = [
  { href: '/knowledge', title: 'Knowledge', elsewhere: '/knowledge/log', Loading: KnowledgeLoading },
  { href: '/platform', title: 'Status', elsewhere: '/platform/teams/atlas', Loading: PlatformStatusLoading },
  { href: '/platform/audit', title: 'Audit', elsewhere: '/platform/audit/elsewhere', Loading: PlatformAuditLoading },
];

function at(path: string) {
  window.history.replaceState(null, '', path);
}

function Caller({ access, children }: { access: Promise<Access | null>; children: ReactNode }) {
  return <ConsoleCaller access={access}>{children}</ConsoleCaller>;
}

/**
 * Draws a loading state as the router draws it in the browser, inside the console's caller when there is one, once the
 * layout's read of the person has settled. The caller suspends on that read, and React retries it on a later turn than
 * the one the promise settles in, so the draw is awaited until something is on the page: under a loaded gate the
 * awaited promise alone left the container empty (Harbormaster #3748, 8 cases).
 */
async function drawn(Loading: () => ReactElement, access?: Promise<Access | null>) {
  const view = render(access ? <Caller access={access}><Loading /></Caller> : <Loading />);
  await act(async () => { await access; });
  await waitFor(() => expect(view.container.firstChild).not.toBeNull());
  return view;
}

afterEach(() => at('/'));

describe.each(ROUTES)('$href, pressed in the rail', ({ href, title, elsewhere, Loading }) => {
  const names = new RegExp(title, 'i');

  it('draws the page\'s heading with its loading state, for a person whose rail offers it', async () => {
    at(href);
    await drawn(Loading, Promise.resolve(SUPERADMIN));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(screen.getByRole('status', { name: `Loading ${title.toLowerCase()}` })).toBeTruthy();
  });

  it('names nothing for a person whose rail does not offer it', async () => {
    at(href);
    const { container } = await drawn(Loading, Promise.resolve({ ...SUPERADMIN, only: SUPERADMIN.only.filter((h) => h !== href) }));
    expect(container.textContent).not.toMatch(names);
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeTruthy();
  });

  it('names nothing at another address it stands in for', async () => {
    at(elsewhere);
    const { container } = await drawn(Loading, Promise.resolve(SUPERADMIN));
    expect(container.textContent).not.toMatch(names);
  });

  it('names nothing with nobody resolved, or outside the console\'s caller', async () => {
    at(href);
    expect((await drawn(Loading, Promise.resolve(null))).container.textContent).not.toMatch(names);
    expect((await drawn(Loading)).container.textContent).not.toMatch(names);
  });

  it('names nothing on a direct load: on the server, and in the browser until the layout\'s read has settled', async () => {
    at(href);
    const served = document.createElement('div');
    served.innerHTML = renderToString(<Caller access={Promise.resolve(SUPERADMIN)}><Loading /></Caller>);
    expect(served.textContent).not.toMatch(names);
    const { container } = render(<Caller access={new Promise<Access>(() => {})}><Loading /></Caller>);
    await act(async () => {});
    expect(container.textContent).not.toMatch(names);
  });

  it('names nothing in the prerendered shell, where nobody is known yet', () => {
    at(href);
    const shell = document.createElement('div');
    shell.innerHTML = renderToString(<Caller access={new Promise<Access>(() => {})}><Loading /></Caller>);
    expect(shell.textContent).not.toMatch(names);
    expect(shell.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading page');
  });
});

describe('a member', () => {
  it('is never told Audit\'s name while it loads', async () => {
    at('/platform/audit');
    const { container } = await drawn(PlatformAuditLoading, Promise.resolve(MEMBER));
    expect(container.textContent).not.toMatch(/audit/i);
  });

  it('is told Status\'s and Knowledge\'s, which the member\'s rail offers', async () => {
    at('/platform');
    await drawn(PlatformStatusLoading, Promise.resolve(MEMBER));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Status');
    at('/knowledge');
    await drawn(KnowledgeLoading, Promise.resolve(MEMBER));
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toContain('Knowledge');
  });

  it('is handed no page\'s name by any loading state: the name is looked up in the browser', () => {
    for (const { Loading } of ROUTES) {
      const handed = JSON.stringify(Loading(), (_, v: unknown) => (typeof v === 'function' || typeof v === 'symbol' ? undefined : v));
      expect(handed).not.toMatch(/Knowledge|Status|Audit/);
    }
  });
});
