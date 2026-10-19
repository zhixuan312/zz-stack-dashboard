import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { GatewayError } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import type { Me } from '@/lib/api-shapes';
import type { ReleaseDetail, Releases } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import {
  RELEASES_BOUND_MS, RELEASES_DEFAULTS, filtersOfPath, releaseContext, releasesContext, releasesPath, type ReleasesRead,
} from '@/views/platform-releases-context';
import { releaseTool, releasesTool } from '@/views/tools/releases';
import { RELEASES, releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import PlatformReleasesLoading from '../app/(dash)/platform/releases/loading';
import PlatformReleasesPage, { generateMetadata as releasesMetadata } from '../app/(dash)/platform/releases/page';
import { readRelease, readReleases } from '../app/(dash)/platform/releases/read-releases';
import PlatformReleaseLoading from '../app/(dash)/platform/releases/[version]/loading';
import PlatformReleasePage from '../app/(dash)/platform/releases/[version]/page';

/**
 * Releases under Platform (Task I-96, AC-3.4, AC-2.13): the list and a release's page drawn from the fake gateway's own
 * answers, each read first on the console's server; the tiles, the two weeks on one cursor, the table with each window's
 * completeness, a partial after-window, an overlapping release named, and a release's changelog and upgrade notes through
 * the safe renderer; every state each page draws; the Ask on each page's protagonist; the view tools answering the
 * pages' own responses with the pages' own contexts; the prepared query; and no sentence that puts a change down to a
 * release.
 */
const SUPERADMIN: Me = {
  email: 'ava.lindqvist@example.com', name: 'Ava Lindqvist', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const PATH = releasesPath(RELEASES_DEFAULTS);
const LIST: Releases = releases(10, 0);
const ok: ReleasesRead = { state: 'ok', path: PATH, data: LIST };
const rows = () => (LIST.rows.state === 'ok' ? LIST.rows.data.rows : []);
/** The fixture's states, by version: two inside 72 hours of each other, one with no calls after, one before the record. */
const [NEWEST, PAIRED, , QUIET, OLDEST] = RELEASES.map((r) => r.version);

/** What a sentence would say if it put a change down to a release. */
const CAUSAL = /\b(caused|because of|due to|thanks to|led to|improv\w*|worsen\w*|reduced|increased|fixed by|regress\w*)\b/i;

/** The browser's reads: answered by `answer`, or never when it is null. */
function browser(answer: ((path: string) => [number, unknown]) | null) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (!answer) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, SUPERADMIN] : answer(url.pathname.replace('/api/console', '') + url.search);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}
/** What the browser has asked the gateway for, past who it is. */
const reads = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL][] } }).mock.calls.map(([u]) => String(u)).filter((u) => !u.endsWith('/me'));

/** `ui` in the console's providers, with an assistant listening when `ask` is given. */
function mount(ui: ReactElement, ask?: (q: string) => void, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const surface = ask ? { ask } : {};
  return render(<QueryClientProvider client={client}><SurfaceOverride surface={surface}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
/** The table of releases, by its caption, and one release's row in it. */
const table = () => screen.getByRole('table', { name: 'Releases with what was observed either side of each' });
const row = (version: string) => within(table()).getAllByRole('row').find((r) => within(r).queryAllByText(version).length > 0)!;

beforeEach(() => {
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/platform/releases');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Releases draws its tiles, its weeks and its table', () => {
  it('the four tiles: releases, last week, the latest version and when, migrations applied', () => {
    browser(null);
    mount(<PlatformReleasesView served={ok} />);
    const tile = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-split="tiles"] > .card')].find((c) => c.textContent!.startsWith(label))!;
    expect(tile('Releases').textContent).toMatch(new RegExp(`${LIST.tiles.releases}\\s*releases`));
    expect(tile('Last week').textContent).toMatch(new RegExp(`${LIST.tiles.lastWeek}\\s*releases?`));
    expect(tile('Latest tag').textContent).toContain(LIST.tiles.latest!.version);
    expect(tile('Latest tag').textContent).toContain('Tagged');
    expect(tile('Migrations applied').textContent).toContain(String(LIST.tiles.migrations.applied));
  });

  it('releases by week and malformed calls per 1,000 by week, two Column charts on one cursor', () => {
    browser(null);
    mount(<PlatformReleasesView served={ok} />);
    const charts = [screen.getByRole('figure', { name: 'Releases by week' }), screen.getByRole('figure', { name: 'Malformed calls per 1,000 by week' })];
    for (const c of charts) expect(c.querySelectorAll('[data-column]')).toHaveLength(LIST.weeks.length);
    fireEvent.keyDown(charts[0].querySelector('[data-plot]')!, { key: 'Home' });
    // Pointing at the first week of one points the other at the same week.
    expect(charts[1].querySelector('[data-column][data-active]')?.getAttribute('data-column')).toBe(LIST.weeks[0].window.from);
    if (!LIST.weeks.at(-1)!.window.complete) for (const c of charts) expect(c.querySelector('[data-column]:last-child[data-running]')).not.toBeNull();
  });

  it('the table: every release with each side\'s completeness, a partial after-window, an overlap named, no calls and no record never a zero', () => {
    browser(null);
    mount(<PlatformReleasesView served={ok} />);
    expect(within(table()).getAllByRole('row')).toHaveLength(rows().length + 1);
    // The newest is under 72 hours old: its after-window is still running, so it is partial, and its bounds say so.
    const newest = row(NEWEST);
    const after = within(newest).getAllByText('After', { exact: false }).map((e) => e.closest('[title]')!).find((e) => e.getAttribute('title')!.startsWith('After'))!;
    expect(after.textContent).toContain('partial');
    expect(after.getAttribute('title')).toMatch(/^After, partial: Observed \d+ of 72 hours so far: /);
    // Every side says how much of it was observed, a complete one too.
    const sides = [...table().querySelectorAll('tbody [title^="Before"], tbody [title^="After"]')].map((e) => e.getAttribute('title')!);
    expect(sides.length).toBe(rows().length * 2 * 3);
    for (const t of sides) expect(t).toMatch(/^(Before|After), (complete|partial|not observed): /);
    // Two releases inside 72 hours of each other each name the other.
    expect(newest.textContent).toContain(`Within 72 hours of ${PAIRED}`);
    expect(row(PAIRED).textContent).toContain(`Within 72 hours of ${NEWEST}`);
    expect(row(QUIET).textContent).toContain('After: no calls');
    expect(row(OLDEST).textContent).toContain('Before: not observed');
    expect(row(OLDEST).textContent).toContain('Not recorded');
    expect(newest.textContent).toContain('Nothing to do');
    expect(document.querySelector(`a[href="/platform/releases/${NEWEST}"]`)).not.toBeNull();
  });

  it('says no sentence that puts a change down to a release, on the page or to the assistant', () => {
    browser(null);
    const { container } = mount(<PlatformReleasesView served={ok} />);
    expect(container.textContent).not.toMatch(CAUSAL);
    expect(contextText(releasesContext(LIST, { filters: RELEASES_DEFAULTS, updatedAt: null, now: new Date() }))).not.toMatch(CAUSAL);
    for (const r of RELEASES) expect(contextText(releaseContext({ ...r, changelog: 'Words.', upgradeNotes: null }, { asOf: LIST.meta.asOf, updatedAt: null, now: new Date() }))).not.toMatch(CAUSAL);
  });
});

describe('a release\'s page draws its changelog and its upgrade notes', () => {
  const detail = releaseDetail(PAIRED)!;

  it('the published changelog with its upgrade notes, what clients do, and both windows with what of each was observed', async () => {
    browser(null);
    mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: detail }} />);
    const changelog = screen.getByText('Changelog').closest('.card') as HTMLElement;
    await waitFor(() => expect(within(changelog).getByText('Releases are recorded.')).toBeInTheDocument());
    // The upgrade notes are the changelog's own heading, said there once.
    await waitFor(() => expect(within(changelog).getByText('Re-pull the plugins.')).toBeInTheDocument());
    expect(screen.getAllByText('Upgrade notes').map((e) => e.closest('.card'))).toEqual([changelog]);
    const release = screen.getByText('This release').closest('.card') as HTMLElement;
    expect(within(release).getByText(detail.clientAction!)).toBeInTheDocument();
    expect(within(release).getByText(NEWEST)).toBeInTheDocument();
    const windows = screen.getByRole('table', { name: /either side of/ });
    expect(within(windows).getAllByRole('row')).toHaveLength(3);
    expect(windows.textContent).toContain('partial');
  });

  it('renders raw HTML in a changelog as text, never as markup', async () => {
    browser(null);
    const hostile: ReleaseDetail = { ...detail, changelog: 'Before <script>window.hostile = 1</script> after\n\n<img src="https://elsewhere.example/p.png" onerror="alert(1)">', upgradeNotes: null };
    const { container } = mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: hostile }} />);
    await waitFor(() => expect(container.querySelector('[data-protagonist="Changelog"]')?.textContent).toContain('<script>'));
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { hostile?: number }).hostile).toBeUndefined();
  });

  it('a release with no upgrade notes says what the record holds', () => {
    browser(null);
    const old = releaseDetail(OLDEST)!;
    mount(<PlatformReleaseView version={OLDEST} served={{ state: 'ok', data: old }} />);
    expect(screen.queryByText('Upgrade notes')).toBeNull();
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not observed', { exact: false }).length).toBeGreaterThan(0);
  });
});

describe('each page draws loading, empty, error and partial', () => {
  it('Releases: loading while another page is read in the browser', () => {
    window.history.replaceState(null, '', '/platform/releases?page=2');
    browser(null);
    mount(<PlatformReleasesView served={ok} />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByText('…').length).toBeGreaterThanOrEqual(4);
  });

  it('Releases: empty, with no release recorded and no zero version', () => {
    browser(null);
    const none: Releases = { ...LIST, tiles: { releases: 0, lastWeek: 0, latest: null, migrations: { applied: 0, lastAt: null } }, rows: { state: 'ok', data: { rows: [], total: 0 } } };
    mount(<PlatformReleasesView served={{ state: 'ok', path: PATH, data: none }} />);
    expect(screen.getByText('No release recorded yet')).toBeInTheDocument();
    expect(screen.getAllByText('None recorded').length).toBeGreaterThanOrEqual(2);
  });

  it('Releases: the error with the gateway\'s sentence and Retry, and no tile counted', () => {
    browser(null);
    mount(<PlatformReleasesView served={{ state: 'failed', path: PATH, reason: 'could not read the releases' }} />);
    expect(screen.getByText('could not read the releases')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Releases: a server read that did not answer in time is the error, never an endless skeleton', () => {
    browser(null);
    mount(<PlatformReleasesView served={{ state: 'slow', path: PATH }} />);
    expect(screen.getByText(`The read did not answer within ${RELEASES_BOUND_MS / 1000} seconds.`)).toBeInTheDocument();
    expect(document.querySelector('table[aria-busy="true"]')).toBeNull();
  });

  it('Releases: partial, the tiles and the weeks standing when the rows could not be listed', () => {
    browser(null);
    const partial: Releases = { ...LIST, rows: { state: 'unavailable', reason: 'the release record did not answer' } };
    mount(<PlatformReleasesView served={{ state: 'ok', path: PATH, data: partial }} />);
    expect(screen.getByText(/the release record did not answer/)).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Releases by week' })).toBeInTheDocument();
    expect(document.querySelector('[data-split="tiles"] > .card')!.textContent).toContain(String(LIST.tiles.releases));
    expect(contextText(releasesContext(partial, { filters: RELEASES_DEFAULTS, updatedAt: null, now: new Date() }))).toContain('could not be listed');
  });

  it('a release: failed and slow are the bounded error with Retry; a version the browser finds missing has the way back', async () => {
    browser(null);
    const { unmount } = mount(<PlatformReleaseView version={PAIRED} served={{ state: 'failed', reason: 'could not read a release' }} />);
    expect(screen.getByText('The release did not load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    unmount();
    const again = mount(<PlatformReleaseView version={PAIRED} served={{ state: 'slow' }} />);
    expect(screen.getByText('The release is unavailable')).toBeInTheDocument();
    again.unmount();
    browser(() => [404, null]);
    mount(<PlatformReleaseView version="9.9.9" served={{ state: 'slow' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No release of this version is recorded')).toBeInTheDocument());
  });
});

describe('the Ask on each page\'s protagonist', () => {
  it('sits in the head of the table of releases with the assistant on, and is absent with it off', () => {
    browser(null);
    const ask = vi.fn();
    const { unmount } = mount(<PlatformReleasesView served={ok} />, ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    expect(button.closest('[data-protagonist="Releases"]')).not.toBeNull();
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(/^Ask: /, ''));
    unmount();
    mount(<PlatformReleasesView served={ok} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });

  it('sits in the head of a release\'s changelog with the assistant on, and is absent with it off', () => {
    browser(null);
    const detail = releaseDetail(PAIRED)!;
    const { unmount } = mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: detail }} />, vi.fn());
    const [button] = screen.getAllByRole('button', { name: /^Ask: / });
    const card = button.closest('[data-protagonist="Changelog"]')!;
    expect(card.classList.contains('card')).toBe(true);
    expect(card.firstElementChild?.contains(button)).toBe(true);
    unmount();
    mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: detail }} />);
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('the first read is the server\'s, and so is another page\'s', () => {
  it('no browser read on mount after the server\'s, nor when the address moves to the next page and the server reads it', async () => {
    browser((path) => [200, releases(10, Number(new URLSearchParams(path.split('?')[1]).get('offset') ?? 0))]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = mount(<PlatformReleasesView served={ok} />, undefined, client);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    act(() => { window.history.pushState(null, '', '/platform/releases?page=2'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
    const next: ReleasesRead = { state: 'ok', path: releasesPath({ ...RELEASES_DEFAULTS, page: '2' }), data: releases(10, 10) };
    rerender(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider><PlatformReleasesView served={next} /></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
  });

  it('a release: no browser read on mount after the server\'s', async () => {
    browser(() => [200, releaseDetail(PAIRED)]);
    mount(<PlatformReleaseView version={PAIRED} served={{ state: 'ok', data: releaseDetail(PAIRED)! }} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(reads()).toEqual([]);
  });
});

describe('the first paint of a later page', () => {
  it('draws the page and the rows the server read, then hydrates onto the same markup', async () => {
    window.history.replaceState(null, '', '/platform/releases?page=2');
    browser(null);
    // The fixture's releases fit one page, so the second is the first's rows under a total that reaches a second page.
    const drawnRows = rows();
    const second: Releases = { ...LIST, rows: { state: 'ok', data: { rows: drawnRows, total: 10 + drawnRows.length } } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <QueryClientProvider client={client}><Tooltip.Provider><PlatformReleasesView served={{ state: 'ok', path: releasesPath({ page: '2' }), data: second }} /></Tooltip.Provider></QueryClientProvider>;
    const container = document.body.appendChild(document.createElement('div'));
    try {
      container.innerHTML = renderToString(view);
      const drawn = () => container.querySelectorAll('section[aria-label="Releases with what was observed either side of each"] tbody tr');
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
      expect(drawn()).toHaveLength(drawnRows.length);
      expect(container.querySelector('button[aria-current="page"]')?.textContent).toBe('2');
      // The browser takes the server's markup over as it stands: no mismatch, the rows stay drawn, and nothing is read.
      const mismatches: unknown[] = [];
      await act(async () => { hydrateRoot(container, view, { onRecoverableError: (e) => mismatches.push(e) }); });
      expect(mismatches).toEqual([]);
      expect(drawn()).toHaveLength(drawnRows.length);
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(reads()).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it('reads the address back from the server\'s path', () => {
    for (const f of [RELEASES_DEFAULTS, { page: '2' }, { page: '7' }]) expect(filtersOfPath(releasesPath(f))).toEqual(f);
  });
});

describe('the view tools answer the pages\' own responses', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      if (path.startsWith('/platform/releases?')) {
        const q = new URLSearchParams(path.split('?')[1]);
        return releases(Number(q.get('limit')), Number(q.get('offset')));
      }
      const found = releaseDetail(decodeURIComponent(path.split('/').at(-1)!));
      if (!found) throw new GatewayError(404, 'HTTP 404');
      return found;
    });
  });

  it('view_releases reads the page\'s address and tells the page\'s context', async () => {
    const { data, context } = await releasesTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual(LIST);
    const page = releasesContext(LIST, { filters: RELEASES_DEFAULTS, updatedAt: null, now: new Date() });
    expect({ ...context, freshness: null }).toEqual({ ...page, freshness: null });
    expect(releasesTool.page).toBe('/platform/releases');
  });

  it('view_releases takes the route\'s own limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(releasesTool.input.shape).sort()).toEqual(['limit', 'offset']);
    const onPage = await releasesTool.read({ limit: 10, offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/releases?limit=10&offset=10');
    expect(onPage.context.address).toBe('/platform/releases?page=2');
    const off = await releasesTool.read({ limit: 2, offset: 1 });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/releases?limit=2&offset=1');
    expect(contextText(off.context)).toContain('The page lists the releases ten a page, so /platform/releases does not show exactly these');
  });

  it('view_release reads one release\'s own response and tells its page\'s context', async () => {
    const { data, context } = await releaseTool.read({ version: PAIRED });
    expect(gateway.get).toHaveBeenCalledWith(`/platform/releases/${PAIRED}`);
    expect(data).toEqual(releaseDetail(PAIRED));
    expect(context.view).toBe('release');
    expect(context.address).toBe(`/platform/releases/${PAIRED}`);
    expect(releaseTool.page).toBe('/platform/releases/[version]');
    expect(Object.keys(releaseTool.input.shape)).toEqual(['version']);
  });

  it('explore_releases declares releases, migrations and malformed over /platform/query, drilling to each release\'s page', () => {
    const { sources } = releasesTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ releases: 'releases', migrations: 'migrations', malformed: 'malformed', calls: 'platform_calls' });
    for (const s of Object.values(sources)) expect(PREPARED.find((p) => p.name === s.collection)?.route).toBe('platform');
    expect(sources.malformed.measures.per1000).toMatchObject({ derive: 'ratio', of: ['malformed', 'calls.calls'] });
    expect(sources.releases.drill.columns).toContain('version');
    expect(sources.releases.drill.address({ version: NEWEST })).toBe(`/platform/releases/${NEWEST}`);
    expect(sources.calls.facets).not.toContain('team');
    expect(releaseTool.explore).toBe(releasesTool.explore);
  });
});

describe('the shared contexts carry what the pages draw, and what it cannot say', () => {
  it('Releases: the four tiles, each release with both sides and its completeness, the overlap, and the windows\' limits', () => {
    const text = contextText(releasesContext(LIST, { filters: RELEASES_DEFAULTS, updatedAt: null, now: new Date() }));
    for (const v of [LIST.tiles.releases, LIST.tiles.lastWeek, LIST.tiles.migrations.applied]) expect(text).toContain(String(v));
    expect(text).toContain(LIST.tiles.latest!.version);
    for (const r of rows().slice(0, 5)) expect(text).toContain(`${r.version} (`);
    expect(text).toContain(`then ${rows()[0].after.malformedPer1000.value!.toFixed(1)} (partial)`);
    expect(text).toContain(`within 72 hours of ${PAIRED}`);
    expect(text).toContain('not what the release did');
    expect(text).toContain('By week, oldest first');
  });

  it('a release: its windows, its client action, its changelog as published and what it cannot say', () => {
    const r = releaseDetail(PAIRED)!;
    const text = contextText(releaseContext(r, { asOf: LIST.meta.asOf, updatedAt: null, now: new Date() }));
    expect(text).toContain(r.clientAction!);
    expect(text).toContain('Releases are recorded.');
    expect(text).toContain('Re-pull the plugins.');
    expect(text).toContain(NEWEST);
    expect(text).toContain('not what the release did');
  });

  it('hold to the budget on a full page of long summaries and a long changelog', () => {
    const long = 'A summary somebody wrote in full because the changelog keeps what it is given and never shortens it, '.repeat(3);
    const many = Array.from({ length: 10 }, (_, i) => ({ ...rows()[i % rows().length], version: `1.${i}.0-with-a-long-prerelease-tag`, summary: long, clientAction: long, before: { ...rows()[0].before, overlappingVersions: ['1.0.0', '1.1.0', '1.2.0'] } }));
    const full: Releases = { ...LIST, rows: { state: 'ok', data: { rows: many, total: 240 } } };
    const text = contextText(releasesContext(full, { filters: { page: '7' }, updatedAt: null, now: new Date() }));
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(text).toContain('and 5 more (see the page)');
    const r = releaseDetail(PAIRED)!;
    const told = contextText(releaseContext({ ...r, summary: long, changelog: `${long}\n\n`.repeat(40), upgradeNotes: `${long}\n`.repeat(20) }, { asOf: LIST.meta.asOf, updatedAt: null, now: new Date() }));
    expect(told.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });
});

/** The text a server page's answer renders, once rendered with nothing listening. */
async function markupOf(answer: ReactNode | Promise<ReactNode>): Promise<HTMLElement> {
  const node = await answer;
  let container = document.body;
  await act(async () => { container = mount(<>{node}</>).container; });
  return container;
}

describe('the pages on the console\'s server', () => {
  beforeEach(() => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/me') return SUPERADMIN;
      if (path.startsWith('/platform/releases?')) return LIST;
      const found = releaseDetail(decodeURIComponent(path.split('/').at(-1)!));
      if (!found) throw new GatewayError(404, 'HTTP 404');
      return found;
    });
  });

  it('are titled as their own pages', async () => {
    expect(await releasesMetadata()).toEqual({ title: 'Releases' });
  });

  it('read the address\'s page once, as the person, and hand the one read to the as-of line and the page', async () => {
    const reads: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props.read) reads.push(props.read);
      Object.values(props).forEach(walk);
    };
    walk(await PlatformReleasesPage({ searchParams: Promise.resolve({ page: '1' }) }));
    expect(reads).toHaveLength(2);
    expect(reads[0]).toBe(reads[1]);
    expect(await reads[0]).toEqual(ok);
    expect(gateway.get.mock.calls.filter(([p]) => p === PATH)).toHaveLength(1);
  });

  it('an unknown version is answered by the missing page, and names no release', async () => {
    const page = await markupOf(PlatformReleasePage({ params: Promise.resolve({ version: '9.9.9' }) }));
    expect(page.querySelector('[data-missing-page]')).not.toBeNull();
    expect(page.textContent).not.toMatch(/9\.9\.9|release/i);
  });

  it('wait on loading states under refusal: \'absent\' that name nothing', () => {
    for (const Loading of [PlatformReleasesLoading, PlatformReleaseLoading]) {
      const { container, unmount } = render(<Loading />);
      expect(container.textContent).not.toMatch(/release/i);
      unmount();
    }
  });
});

describe('the reads on the console\'s server', () => {
  it('read the address\'s page of releases, and a release, as the person', async () => {
    gateway.get.mockResolvedValueOnce(LIST);
    expect(await readReleases(RELEASES_DEFAULTS)).toEqual(ok);
    expect(gateway.get).toHaveBeenLastCalledWith(PATH);
    gateway.get.mockResolvedValueOnce(releaseDetail(PAIRED));
    expect(await readRelease(PAIRED)).toEqual({ state: 'ok', data: releaseDetail(PAIRED) });
    expect(gateway.get).toHaveBeenLastCalledWith(`/platform/releases/${PAIRED}`);
  });

  it('say a version the record does not hold and a failure, and never reject', async () => {
    gateway.get.mockRejectedValueOnce(new GatewayError(500, 'could not read the releases'));
    expect(await readReleases(RELEASES_DEFAULTS)).toEqual({ state: 'failed', path: PATH, reason: 'could not read the releases' });
    gateway.get.mockRejectedValueOnce(new GatewayError(404, 'HTTP 404'));
    expect(await readRelease('9.9.9')).toEqual({ state: 'missing' });
  });

  it('are slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValue(new Promise(() => {}));
    const list = readReleases(RELEASES_DEFAULTS);
    const one = readRelease(PAIRED);
    await vi.advanceTimersByTimeAsync(RELEASES_BOUND_MS);
    expect(await list).toEqual({ state: 'slow', path: PATH });
    expect(await one).toEqual({ state: 'slow' });
  });
});
