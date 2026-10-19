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

import { nav } from '@/app.config';
import { ConsoleCaller } from '@/lib/api';
import HomeLoading from '../app/(dash)/(home)/loading';
import AccessLoading from '../app/(dash)/access/loading';
import ActivityLoading from '../app/(dash)/activity/loading';
import ApprovalsLoading from '../app/(dash)/approvals/loading';
import InitiativesLoading from '../app/(dash)/initiatives/loading';
import KnowledgeLoading from '../app/(dash)/knowledge/loading';
import PlatformAuditLoading from '../app/(dash)/platform/audit/loading';
import PlatformBugsLoading from '../app/(dash)/platform/bugs/loading';
import PlatformEvaluationLoading from '../app/(dash)/platform/evaluation/loading';
import PlatformKnowledgeLoading from '../app/(dash)/platform/knowledge/loading';
import PlatformStatusLoading from '../app/(dash)/platform/loading';
import PlatformPeopleLoading from '../app/(dash)/platform/people/loading';
import PlatformReleasesLoading from '../app/(dash)/platform/releases/loading';
import PlatformTeamsLoading from '../app/(dash)/platform/teams/loading';
import PlatformUsageLoading from '../app/(dash)/platform/usage/loading';
import PluginsLoading from '../app/(dash)/plugins/loading';
import RecordLoading from '../app/(dash)/record/loading';
import RunsLoading from '../app/(dash)/runs/loading';

/**
 * Every rail route draws its shell within the navigation budget: Knowledge, Status and Audit since Task I-147, the
 * other fifteen since Task I-149 (AC-8.7).
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
 *
 * The fifteen others passed only by that byte layout, 25 to 63 ms inside the phone's budget (Harbormaster #3753: 187 to
 * 225 ms, against 24 to 40 ms for the three named in their loading state), so a route whose root row grew by a read
 * would cross it as the three did. Each is now named the same way, and keeps every other word and block it drew.
 */

type Access = { only: string[]; user: { name: string; role: string }; team: string | null; caller: string };

/** The rails `pnpm verify --as` expects of the fake's two people (`expectedRoutes`). */
const MEMBER_RAIL = ['/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access', '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge'];
const SUPERADMIN: Access = { only: [...MEMBER_RAIL, '/platform/teams', '/platform/people', '/platform/audit'], user: { name: 'Ava', role: 'atlas' }, team: 'atlas', caller: 'ava@example.com' };
const MEMBER: Access = { only: MEMBER_RAIL, user: { name: 'Maya', role: 'atlas' }, team: 'atlas', caller: 'maya@example.com' };

/**
 * Every destination in the rail, with its page's own title (each page's masthead, which is the rail's label for every
 * one of them) and another address its loading state's boundary stands in for: a detail route below it where there is
 * one. Home is headed by a sentence, so its named loading state keeps the name in the heading beside the sentence's
 * block, as the page does.
 */
const ROUTES: { href: string; title: string; elsewhere: string; Loading: () => ReactElement }[] = [
  { href: '/', title: 'Home', elsewhere: '/elsewhere', Loading: HomeLoading },
  { href: '/record', title: 'Record', elsewhere: '/record/elsewhere', Loading: RecordLoading },
  { href: '/initiatives', title: 'Initiatives', elsewhere: '/initiatives/atlas/2026-09-28-search-relevance', Loading: InitiativesLoading },
  { href: '/approvals', title: 'Approvals', elsewhere: '/approvals/elsewhere', Loading: ApprovalsLoading },
  { href: '/knowledge', title: 'Knowledge', elsewhere: '/knowledge/log', Loading: KnowledgeLoading },
  { href: '/activity', title: 'Activity', elsewhere: '/activity/elsewhere', Loading: ActivityLoading },
  { href: '/runs', title: 'Runs', elsewhere: '/runs/elsewhere', Loading: RunsLoading },
  { href: '/plugins', title: 'Plugins', elsewhere: '/plugins/zz-core', Loading: PluginsLoading },
  { href: '/access', title: 'Access', elsewhere: '/access/elsewhere', Loading: AccessLoading },
  { href: '/platform', title: 'Status', elsewhere: '/platform/teams/atlas', Loading: PlatformStatusLoading },
  { href: '/platform/releases', title: 'Releases', elsewhere: '/platform/releases/0.97.0', Loading: PlatformReleasesLoading },
  { href: '/platform/bugs', title: 'Bugs', elsewhere: '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01', Loading: PlatformBugsLoading },
  { href: '/platform/evaluation', title: 'Evaluation', elsewhere: '/platform/evaluation/elsewhere', Loading: PlatformEvaluationLoading },
  { href: '/platform/teams', title: 'Teams', elsewhere: '/platform/teams/dune', Loading: PlatformTeamsLoading },
  { href: '/platform/people', title: 'People', elsewhere: '/platform/people/elsewhere', Loading: PlatformPeopleLoading },
  { href: '/platform/usage', title: 'Usage', elsewhere: '/platform/usage/elsewhere', Loading: PlatformUsageLoading },
  { href: '/platform/audit', title: 'Audit', elsewhere: '/platform/audit/elsewhere', Loading: PlatformAuditLoading },
  { href: '/platform/knowledge', title: 'Knowledge health', elsewhere: '/platform/knowledge/elsewhere', Loading: PlatformKnowledgeLoading },
];

/** Every page's name, as a word: what no loading state may be handed. */
const EVERY_NAME = new RegExp(`\\b(${ROUTES.map((r) => r.title).join('|')})\\b`);

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
    // As the navigation suite reads the shell (`scripts/lib/journey.ts`): the heading holds the page's title.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(title);
    expect(screen.getByRole('status', { name: `Loading ${title.toLowerCase()}` })).toBeTruthy();
  });

  it('keeps its body and its width for everyone: only the masthead\'s words are the person\'s', async () => {
    at(href);
    const shape = (c: HTMLElement) => ({ width: c.querySelector('#content')?.className, body: c.querySelector('[role="status"]')?.innerHTML });
    const named = shape((await drawn(Loading, Promise.resolve(SUPERADMIN))).container);
    const unnamed = shape((await drawn(Loading, Promise.resolve({ ...SUPERADMIN, only: [] }))).container);
    expect(named).toEqual(unnamed);
    expect(named.body).toBeTruthy();
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
  it.each(ROUTES.filter((r) => !MEMBER.only.includes(r.href)))('is never told the name of $title while it loads', async ({ href, title, Loading }) => {
    at(href);
    const { container } = await drawn(Loading, Promise.resolve(MEMBER));
    expect(container.textContent).not.toMatch(new RegExp(title, 'i'));
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeTruthy();
  });

  it.each(ROUTES.filter((r) => MEMBER.only.includes(r.href)))('is told the name of $title, which the member\'s rail offers', async ({ href, title, Loading }) => {
    at(href);
    await drawn(Loading, Promise.resolve(MEMBER));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(title);
    expect(screen.getByRole('status', { name: `Loading ${title.toLowerCase()}` })).toBeTruthy();
  });

  it('is handed no page\'s name by any loading state: the name is looked up in the browser', () => {
    for (const { Loading } of ROUTES) {
      const handed = JSON.stringify(Loading(), (_, v: unknown) => (typeof v === 'function' || typeof v === 'symbol' ? undefined : v));
      expect(handed).not.toMatch(EVERY_NAME);
    }
  });
});

describe('the table', () => {
  it('holds every destination in the rail, each with its page\'s own title, which is the rail\'s label', () => {
    const rail = nav.flatMap((g) => g.items).map((i) => ({ href: i.href, title: i.label }));
    expect(ROUTES.map(({ href, title }) => ({ href, title }))).toEqual(rail);
    expect([...SUPERADMIN.only].sort()).toEqual(rail.map((r) => r.href).sort());
  });
});
