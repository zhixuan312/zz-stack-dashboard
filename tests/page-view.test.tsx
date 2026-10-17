import fs from 'node:fs';
import path from 'node:path';
import { Activity, useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * One committed navigation records one page view. The recorder reads the committed pathname and the canvas the page
 * lands in: it waits out the route's loading state, stays silent when the gate's refused view is what arrived, and posts
 * `{ feature }` otherwise. The router is mocked; the canvas holds the console's own loading and refused markup.
 */
const at = vi.hoisted(() => ({ path: '/', search: '' }));
const prefetched = vi.hoisted(() => [] as string[]);
vi.mock('next/navigation', () => ({
  usePathname: () => at.path,
  useSearchParams: () => new URLSearchParams(at.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: (href: string) => prefetched.push(href) }),
}));

import { useRouter } from 'next/navigation';
import { nav } from '@/app.config';
import { Busy, LoadingPage } from '@/components/patterns/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { FEATURES } from '@/data/features';
import { PageViews } from '@/console/page-view';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

/**
 * The feature each rail address records, from the spec's destinations table, for every phase: the longest whole-segment
 * prefix wins, and `/` owns only itself. Written out here and not read from the code under test.
 */
const FEATURE_OF: [prefix: string, feature: string][] = [
  ['/platform/releases', 'releases'], ['/platform/bugs', 'bugs'], ['/platform/evaluation', 'evaluation'],
  ['/platform/teams', 'teams'], ['/platform/people', 'people'], ['/platform/usage', 'usage'],
  ['/platform/audit', 'audit'], ['/platform/knowledge', 'knowledge-health'], ['/platform', 'platform-status'],
  ['/record', 'record'], ['/initiatives', 'initiatives'], ['/approvals', 'approvals'], ['/knowledge', 'knowledge'],
  ['/activity', 'activity'], ['/runs', 'runs'], ['/plugins', 'plugins'], ['/access', 'access'],
  ['/people', 'people'], ['/settings', 'settings'], ['/teams', 'teams'], ['/', 'home'],
];

type Sent = { url: string; init: RequestInit };
let sent: Sent[];
/** The gateway's answer to a page view: 204 with no body, a refusal, or no answer at all. */
function gateway(answer: 204 | 500 | 'down' = 204) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    sent.push({ url: String(input), init });
    if (answer === 'down') throw new TypeError('fetch failed');
    if (answer === 500) return new Response(JSON.stringify({ error: 'The platform could not record that.' }), { status: 500 });
    return new Response(null, { status: 204 });
  }));
}
const features = () => sent.map((s) => (JSON.parse(String(s.init.body)) as { feature: string }).feature);

/** The console's shell as far as the recorder sees it: the recorder beside the canvas a page lands in. */
const Shell = ({ children }: { children: ReactNode }) => (
  <>
    <PageViews />
    <main>{children}</main>
  </>
);
const page = (title: string) => <h1>{title}</h1>;
/** What every route's `loading.tsx` draws while the page's gate is still asking. */
const loading = (name: string) => <LoadingPage name={name}><p>Rows</p></LoadingPage>;
/** What the gate's refused view draws: `NoAccess` is an `EmptyState` of kind `no-access`. */
const refused = (title: string) => <EmptyState kind="no-access" title={`You don't have access to ${title}`}>Superadmins can open it.</EmptyState>;

let view: ReturnType<typeof render>;
async function open(pathname: string, content: ReactNode) {
  at.path = pathname;
  await act(async () => {
    if (view) view.rerender(<Shell>{content}</Shell>);
    else view = render(<Shell>{content}</Shell>);
  });
}
/** The page streams in at the address already committed: the pathname does not change. */
async function arrive(content: ReactNode) {
  await act(async () => {
    view.rerender(<Shell>{content}</Shell>);
  });
}

beforeEach(() => {
  at.path = '/';
  at.search = '';
  prefetched.length = 0;
  sent = [];
  view = undefined as unknown as ReturnType<typeof render>;
  gateway();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a page view', () => {
  it('is posted once when a destination renders, as the feature alone, through the console transport', async () => {
    await open('/teams', page('Teams'));
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/console/page-view');
    expect(sent[0].init.method).toBe('POST');
    expect(sent[0].init.credentials).toBe('same-origin');
    expect(JSON.parse(String(sent[0].init.body))).toEqual({ feature: 'teams' });
  });

  it('names the feature that owns a nested address, and `/` owns only itself', async () => {
    await open('/initiatives/atlas/billing/spec', page('Spec'));
    await open('/knowledge/log', page('Log'));
    await open('/', page('Home'));
    await open('/plugins/sdlc/', page('sdlc'));
    expect(features()).toEqual(['initiatives', 'knowledge', 'home', 'plugins']);
  });

  it('is not posted for an address no feature owns, nor for one that only shares a prefix with it', async () => {
    await open('/nowhere', page('Nowhere'));
    await open('/initiatives-archive', page('Archive'));
    expect(sent).toHaveLength(0);
  });

  it('is not posted again on a rerender, or when the query string changes on the same destination', async () => {
    await open('/initiatives', page('Initiatives'));
    await arrive(page('Initiatives, refreshed'));
    at.search = 'period=30d&state=open';
    await arrive(page('Initiatives, filtered'));
    expect(features()).toEqual(['initiatives']);
  });

  it('is not posted for a hover prefetch of another destination', async () => {
    // What `<Link>` does on hover: asks the router to prefetch, and commits nothing.
    const Hover = () => {
      const router = useRouter();
      // A bare anchor on purpose: the hover's prefetch is the one thing under test. The rule reads `[...missing]` as a page
      // at every address, so it flags this anchor too.
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      return <a href="/runs" onMouseEnter={() => router.prefetch('/runs')}>Runs</a>;
    };
    await open('/teams', <><h1>Teams</h1><Hover /></>);
    fireEvent.mouseEnter(screen.getByText('Runs'));
    await arrive(<><h1>Teams</h1><Hover /></>);
    expect(prefetched).toEqual(['/runs']);
    expect(features()).toEqual(['teams']);
  });

  it('is posted again for a navigation to another destination, and for a later return', async () => {
    await open('/teams', page('Teams'));
    await open('/runs', page('Runs'));
    await open('/teams', page('Teams'));
    expect(features()).toEqual(['teams', 'runs', 'teams']);
  });

  it('is posted once under StrictMode, whose effects run twice', async () => {
    // At the root, as Next mounts it: a `<StrictMode>` element inside testing-library's root double-renders but does
    // not rerun effects.
    const effects = vi.fn();
    const Probe = () => {
      useEffect(effects, []);
      return null;
    };
    at.path = '/people';
    await act(async () => {
      view = render(<><Probe /><Shell>{page('People')}</Shell></>, { reactStrictMode: true });
    });
    expect(effects).toHaveBeenCalledTimes(2);
    expect(features()).toEqual(['people']);
  });
});

describe('a page that has not arrived, or was refused', () => {
  it('is not posted for the missing page a refused address answers under absent', async () => {
    await open('/teams', <div data-missing-page="">No such page</div>);
    expect(sent).toHaveLength(0);
  });

  it('waits out the loading state, then posts once the page has arrived', async () => {
    await open('/runs', loading('runs'));
    expect(sent).toHaveLength(0);
    await arrive(page('Runs'));
    expect(features()).toEqual(['runs']);
  });

  it('is not posted for a refused page, served whole', async () => {
    await open('/teams', refused('Teams'));
    expect(sent).toHaveLength(0);
  });

  it('is not posted for a refusal that streams in after the loading state', async () => {
    await open('/activity', loading('activity'));
    await arrive(refused('Activity'));
    await arrive(<>{refused('Activity')}<p>Still here</p></>);
    expect(sent).toHaveLength(0);
  });

  it('is posted for the next destination a person may open after a refusal', async () => {
    await open('/teams', refused('Teams'));
    await open('/', page('Home'));
    expect(features()).toEqual(['home']);
  });

  it('is decided after the route arrived, not held by a busy panel the page itself draws later', async () => {
    await open('/knowledge', loading('knowledge'));
    await arrive(<><h1>Knowledge</h1><Busy name="lessons"><p>Rows</p></Busy></>);
    expect(features()).toEqual(['knowledge']);
  });

  it('reads only the page in view, not a preserved page hidden beside it', async () => {
    // Cache Components keeps up to three earlier routes in the document, hidden by React's Activity.
    const behind = (shown: ReactNode) => (
      <>
        <Activity mode="hidden">{refused('Teams')}{loading('teams')}</Activity>
        {shown}
      </>
    );
    await open('/teams', refused('Teams'));
    await open('/', behind(page('Home')));
    await open('/runs', behind(loading('runs')));
    await arrive(behind(page('Runs')));
    expect(features()).toEqual(['home', 'runs']);
  });

  it('is not posted for a page the person left before it arrived', async () => {
    await open('/activity', loading('activity'));
    await open('/runs', page('Runs'));
    await arrive(page('Runs, refreshed'));
    expect(features()).toEqual(['runs']);
  });
});

describe('a post that fails', () => {
  it.each([500, 'down'] as const)('when the gateway answers %s changes nothing a person sees and is not retried', async (answer) => {
    gateway(answer);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    await open('/runs', page('Runs'));
    const before = view.container.innerHTML;
    await arrive(page('Runs'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    process.off('unhandledRejection', unhandled);
    expect(sent).toHaveLength(1);
    expect(view.container.innerHTML).toBe(before);
    expect(screen.getByRole('heading', { name: 'Runs' })).toBeInTheDocument();
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('the destinations the rail offers', () => {
  const expected = (href: string) => FEATURE_OF.find(([prefix]) => href === prefix || href.startsWith(`${prefix}/`))?.[1];

  it.each(nav.flatMap((g) => g.items).map((i) => [i.href, i.label] as const))('%s (%s) records its own feature', async (href) => {
    await open(href, page(href));
    expect(features()).toEqual([expected(href)]);
    expect(Object.keys(FEATURES)).toContain(features()[0]);
  });
});

describe('the shell', () => {
  it('mounts the recorder once, inside the shell, and the refused view carries the marker it reads', () => {
    const layout = source('app/(dash)/layout.tsx');
    expect(layout.match(/<PageViews \/>/g)).toHaveLength(1);
    expect(layout.indexOf('<PageViews />')).toBeGreaterThan(layout.indexOf('<AppShell'));
    expect(layout.indexOf('<PageViews />')).toBeLessThan(layout.indexOf('</AppShell>'));
    expect(source('src/views/no-access.tsx')).toMatch(/<EmptyState\s+kind="no-access"/);
    const recorder = source('src/console/page-view.tsx');
    expect(recorder).not.toMatch(/useSearchParams|document\.title|location/);
  });
});
