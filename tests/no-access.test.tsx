import fs from 'node:fs';
import path from 'node:path';
import type { ComponentType, ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A refused address names nobody (AC-1.6). Under `refusal: 'absent'` an address a member may not open answers what an
 * address that names nothing answers: no role, no person, no team, nothing of the page asked for, in the page, the
 * document's title or the loading state that streams before the gate has answered.
 *
 * The routes are read off `app/(dash)`: every page that opens with `gate('<feature>')` on a feature the member's role
 * does not hold, so a route added later is held here the day it lands. An address no page answers draws the same thing
 * (`app/(dash)/[...missing]/page.tsx`), and is held to it here, with the proof that it answers nothing a page does.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  redirect: (to: string) => {
    throw new Error(`redirect to ${to}`);
  },
}));

import { refusal } from '@/app.config';
import { gate, gatedMetadata } from '@/data/access';
import { FEATURES, type FeatureId } from '@/data/features';
import { gatedLoading } from '@/data/refusal';
import { MAIN_ROLES, whoCan } from '@/data/roles';
import { getSortedRoutes, isDynamicRoute } from 'next/dist/shared/lib/router/utils';
import { getRouteRegex } from 'next/dist/shared/lib/router/utils/route-regex';
import { MISSING_METADATA, NOT_FOUND } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import NotFound, * as notFoundPage from '../app/not-found';
import MissingAddressPage, * as missingAddress from '../app/(dash)/[...missing]/page';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = path.join(ROOT, 'app');
const DASH = path.join(APP, '(dash)');
/** The page that answers an address no other page does: no destination, so it is not one of the gated routes. */
const CATCH_ALL = path.join(DASH, '[...missing]');

type Body = Record<string, unknown>;
const SUPERADMIN: Body = { email: 'owner@example.com', name: 'Owner Example', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
const MEMBER: Body = { email: 'mei@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };

function gateway(answer: Body | 401) {
  global.fetch = (async () => (answer === 401
    ? { ok: false, status: 401, json: async () => ({ error: 'HTTP 401' }) }
    : { ok: true, status: 200, json: async () => answer }) as Response) as typeof fetch;
}

/** What a page answered: its element, or the address a redirect sent the request to. */
async function answerOf(page: () => Promise<unknown>): Promise<{ element: unknown } | { redirect: string }> {
  try {
    return { element: await page() };
  } catch (error) {
    const to = /^redirect to (.+)$/.exec((error as Error).message)?.[1];
    if (to === undefined) throw error;
    return { redirect: to };
  }
}

/** A route of the shell as a person types it: route groups dropped, a dynamic segment kept as written. */
type Route = { address: string; feature: FeatureId; dir: string };

/** Every page under `app/(dash)` with the feature its gate asks. */
function routes(dir = DASH): Route[] {
  const found: Route[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && path.join(dir, entry.name) !== CATCH_ALL) found.push(...routes(path.join(dir, entry.name)));
    if (entry.name !== 'page.tsx') continue;
    const asked = fs.readFileSync(path.join(dir, entry.name), 'utf8').match(/\bgate\('([a-z-]+)'\)/)?.[1];
    if (!asked) throw new Error(`${path.relative(ROOT, dir)}/page.tsx opens with no gate`);
    const segments = path.relative(DASH, dir).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
    found.push({ address: `/${segments.join('/')}`, feature: asked as FeatureId, dir });
  }
  return found;
}

const REFUSED = routes().filter((r) => !whoCan(FEATURES[r.feature].needs).includes('Member'));

/** The loading state a navigation to the route shows: the nearest `loading.tsx` at or above its directory. */
function loadingOf(dir: string): string {
  for (let d = dir; d.startsWith(DASH); d = path.dirname(d)) {
    const file = path.join(d, 'loading.tsx');
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`no loading state above ${path.relative(ROOT, dir)}`);
}

/** The words a refused answer must not hold: the roles, the person, their team, the page's name and its address. */
function forbidden(route: Route): string[] {
  const words = [...MAIN_ROLES, ...MAIN_ROLES.map((r) => `${r}s`), MEMBER.name, MEMBER.email, 'beacon', FEATURES[route.feature].title];
  return [...words, ...route.address.split('/').filter((s) => s && !s.startsWith('['))].map(String);
}

/** What leaks: each forbidden word found as a whole word, case aside, in the text or anywhere in the markup. */
function leaks(container: HTMLElement, words: readonly string[]): string[] {
  const haystack = `${container.textContent ?? ''}\n${container.innerHTML}`;
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return words.filter((w) => new RegExp(`(^|[^a-z])${escape(w)}($|[^a-z])`, 'i').test(haystack));
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'session-1';
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => {
  cleanup();
  process.env = { ...saved };
});

describe('the console\'s refusal', () => {
  it('is absent', () => {
    expect(refusal).toBe('absent');
  });

  it('is held over the routes a member is refused, read off the pages', () => {
    // Derived, never listed: a route that stops being refused leaves the cases below, one added to the set joins them.
    expect(REFUSED.length).toBeGreaterThan(0);
  });

  it('finds what a refusal would leak, so a clean answer is a real one', () => {
    const route: Route = { address: '/teams/[slug]', feature: 'teams', dir: DASH };
    const told = render(<p>You don&apos;t have access to Teams. Superadmins can open it. Signed in as mei@example.com in beacon.</p>).container;
    expect(leaks(told, forbidden(route))).toEqual(expect.arrayContaining(['Superadmins', 'mei@example.com', 'beacon', 'Teams', 'teams']));
    expect(leaks(render(<p>Nothing lives here.</p>).container, forbidden(route))).toEqual([]);
  });
});

describe.each(REFUSED.map((r) => [r.address, r] as const))('%s, refused to a member', (_address, route) => {
  it('answers the missing page, which names nothing', async () => {
    gateway(MEMBER);
    const answer = await gate(route.feature);
    expect(answer).not.toBeNull();
    const { container } = render(answer as ReactElement);
    expect(container.querySelector('[data-missing-page]')).not.toBeNull();
    expect(container.querySelector('[data-no-access]')).toBeNull();
    expect(leaks(container, forbidden(route))).toEqual([]);
  });

  it('opens for the superadmin', async () => {
    gateway(SUPERADMIN);
    expect(await gate(route.feature)).toBeNull();
  });

  it('carries the missing page\'s title in the tab, kept out of search', async () => {
    gateway(MEMBER);
    const own = { title: FEATURES[route.feature].title };
    expect(await gatedMetadata(route.feature, own)).toEqual({ title: NOT_FOUND.title, robots: { index: false } });
    gateway(SUPERADMIN);
    expect(await gatedMetadata(route.feature, own)).toEqual(own);
    // A page that titles itself does so through the gate's own title, never a static `metadata` naming the page.
    const page = fs.readFileSync(path.join(route.dir, 'page.tsx'), 'utf8');
    expect(page).not.toMatch(/export const metadata\b/);
    if (/\bgenerateMetadata\b/.test(page)) expect(page).toMatch(new RegExp(`gatedMetadata\\('${route.feature}'`));
  });

  it('streams a loading state that names no page', async () => {
    const file = loadingOf(route.dir);
    const Loading = ((await import(/* @vite-ignore */ file)) as { default: ComponentType }).default;
    const { container } = render(<Loading />);
    const busy = [...container.querySelectorAll('[aria-busy="true"]')];
    expect(busy.length, path.relative(ROOT, file)).toBeGreaterThan(0);
    for (const region of busy) expect(region.getAttribute('aria-label'), path.relative(ROOT, file)).toBe('Loading page');
    expect(container.querySelector('h1')?.textContent ?? '', path.relative(ROOT, file)).toBe('');
    expect(leaks(container, forbidden(route)), path.relative(ROOT, file)).toEqual([]);
  });
});

describe('the missing page', () => {
  it('says what an address that names nothing says, and offers the same way back', () => {
    const shell = render(<MissingPage />).container;
    const standalone = render(<NotFound />).container;
    for (const page of [shell, standalone]) {
      const text = page.textContent ?? '';
      expect(text).toContain(NOT_FOUND.kicker);
      expect(text).toContain(NOT_FOUND.sentence.replace(/\.$/, ''));
      expect(text).toContain(NOT_FOUND.lead);
      const way = [...page.querySelectorAll('a')].find((a) => a.textContent === NOT_FOUND.way.label);
      expect(way?.getAttribute('href')).toBe(NOT_FOUND.way.href);
    }
  });

  it('carries the same title in the tab as an address that names nothing', () => {
    expect((notFoundPage as { metadata?: unknown }).metadata).toEqual(MISSING_METADATA);
    expect(MISSING_METADATA).toEqual({ title: NOT_FOUND.title, robots: { index: false } });
  });

  it('leaves the loading state\'s words out under absent', () => {
    expect(gatedLoading({ name: 'teams', title: 'Teams', kicker: 'Fleet', description: 'Every team' })).toEqual({ name: 'page' });
  });
});

describe('an address no page answers', () => {
  const [refused] = REFUSED;

  it('answers exactly what a refused address answers, in the body and in the tab', async () => {
    gateway(MEMBER);
    const unknown = render((await MissingAddressPage()) as ReactElement).container.innerHTML;
    cleanup();
    const denied = render((await gate(refused.feature)) as ReactElement).container.innerHTML;
    expect(unknown).toBe(denied);
    expect(unknown).toContain('data-missing-page');
    expect(missingAddress.metadata).toEqual(await gatedMetadata(refused.feature, { title: FEATURES[refused.feature].title }));
  });

  it('answers the superadmin the same missing page', async () => {
    gateway(SUPERADMIN);
    const { container } = render((await MissingAddressPage()) as ReactElement);
    expect(container.querySelector('[data-missing-page]')).not.toBeNull();
  });

  it('sends a request with no session to sign in, as a refused address does', async () => {
    gateway(401);
    const unknown = await answerOf(() => MissingAddressPage());
    const denied = await answerOf(() => gate(refused.feature));
    expect(unknown).toEqual({ redirect: '/login' });
    expect(denied).toEqual(unknown);
  });

  it('opens with the gate and reads nothing of the address, as every page in the shell does', () => {
    const src = fs.readFileSync(path.join(CATCH_ALL, 'page.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(src).toMatch(/const denied = await gate\('home'\);\s*if \(denied\) return denied;/);
    expect(src).not.toMatch(/\bparams\b|notFound\(/);
  });
});

/**
 * Next's own order of matching (`DefaultRouteMatcherManager` in `next/dist/server/route-matcher-managers`): every static
 * route first, then the dynamic ones sorted by `getSortedRoutes`, the first whose pattern matches answering. The
 * gateway's own paths, `/api/console/*` and `/auth/*`, are `afterFiles` rewrites in `next.config.ts`, which Next tries
 * before any dynamic route (`rewrites.md` in Next's docs, "The order Next.js routes are checked"), so the catch-all never
 * reaches them either.
 */
describe('the catch-all, in the route table', () => {
  /** Every route the app serves, a page's or a handler's, as Next names it: route groups dropped. */
  function table(dir = APP, segments: string[] = []): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !/^[_@]/.test(entry.name)) {
        out.push(...table(path.join(dir, entry.name), /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name]));
      }
      if (entry.name === 'page.tsx' || entry.name === 'route.ts') out.push(`/${segments.join('/')}`);
    }
    return [...new Set(out)];
  }
  const all = table();
  const statics = all.filter((r) => !isDynamicRoute(r));
  const dynamics = getSortedRoutes(all.filter((r) => isDynamicRoute(r)));
  const answering = (address: string) => (statics.includes(address) ? address : dynamics.find((r) => getRouteRegex(r).re.test(address)));
  /** An address the route answers: each dynamic segment filled in, a catch-all with two segments. */
  const sample = (route: string) => route.replace(/\[\.\.\.[^\]]+\]/g, 'a/b').replace(/\[[^\]]+\]/g, 'x');

  it('is in the table, and is the last route Next tries', () => {
    expect(dynamics.at(-1)).toBe('/[...missing]');
  });

  it.each(all.filter((r) => r !== '/[...missing]'))('leaves %s to its own page', (route) => {
    expect(answering(sample(route))).toBe(route);
  });

  it.each(['/nothing-lives-here', '/teams/atlas/no-such-tab', '/login/extra', '/platform/teams/atlas/extra'])('answers %s, which no page does', (address) => {
    expect(answering(address)).toBe('/[...missing]');
  });
});
