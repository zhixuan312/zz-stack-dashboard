import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
/** The console's server's reads, answered without a gateway, and its gate let through: the reads are under test. */
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  gate: async () => null,
  may: async () => false,
  chromeAccess: async () => ({ only: ['/record'], user: { name: 'Ava', role: 'atlas' }, team: 'atlas', caller: 'ava.lindqvist@example.com' }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { VersionChain } from '@/console/version-chain';
import { GatewayError } from '@/data/gateway';
import type { DocumentDetail } from '@/lib/api-shapes';
import { decodePath } from '@/lib/store-path';
import type { Approvals, Home, RecordRead } from '@/lib/work-shapes';
import { APPROVALS_DEFAULTS, approvalsPath } from '@/views/approvals-context';
import { documentContext } from '@/views/document-context';
import { waitingOf } from '@/views/home-context';
import { sourceName } from '@/views/initiative-name';
import { MissingPage } from '@/views/no-access';
import { ApprovalsView } from '@/views/pages/approvals';
import { RecordView } from '@/views/pages/record';
import { RECORD_DEFAULTS, recordPath } from '@/views/record-context';
import { shelf } from '@/views/tools/sources';
import { readAccess } from '../app/(dash)/access/read-access';
import { readSummary } from '../app/(dash)/activity/read-summary';
import DocumentPage, { generateMetadata as documentMetadata } from '../app/(dash)/initiatives/[team]/[slug]/[...path]/page';
import InitiativePage, { generateMetadata as initiativeMetadata } from '../app/(dash)/initiatives/[team]/[slug]/page';
import KnowledgeNodePage from '../app/(dash)/knowledge/[team]/[...path]/page';
import { readFirst } from '../app/(dash)/knowledge/read';
import { ME } from '../scripts/fake-gateway/people.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * A store path is carried through an address segment by segment, each escaped (`encodePath`, src/lib/store-path.ts),
 * and an address is read back the same way (review round 2, R2-C4 to R2-C8, R2-C22 to R2-C24, R2-C37, R2-C42, R2-C45,
 * R2-C47, R2-C52, R2-C56; round 3, R3-C18 to R3-C20, R3-C22). zz-core writes a document under any name but a dot-prefixed segment, so a name holding `#`,
 * `?` or `%` is a real one: built raw into a link it opens another address, `#` cutting it short and `?` turning the
 * rest into a query, and built raw into a gateway read it asks for another document. Every link and read the console
 * builds from a store path is held here to the one encoded address, an address whose escapes do not decode to a store
 * path draws the missing page, and a session that ended between the gate and the read goes to sign-in on every page.
 */
const NAME = 'sources/call #2? 100%.md';
/** `NAME` as an address holds it, and as Next hands a page its segments: still escaped. */
const ENCODED = 'sources/call%20%232%3F%20100%25.md';
const SEGMENTS = ENCODED.split('/');
const SLUG = '2026-09-28-search-relevance';

const realFetch = globalThis.fetch;
beforeEach(() => { gateway.get.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

const providers = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>
  </QueryClientProvider>
);
/** Every address a link on the page opens. */
const hrefs = () => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
const documentPage = (path: string[], team = 'atlas', slug = SLUG) => DocumentPage({ params: Promise.resolve({ team, slug, path }), searchParams: Promise.resolve({}) });
const nodePage = (path: string[], team = 'atlas') => KnowledgeNodePage({ params: Promise.resolve({ team, path }) });

describe('a document whose name holds #, ? and %', () => {
  it('is linked at its encoded address from Approvals\' waiting rows', () => {
    const path = approvalsPath(APPROVALS_DEFAULTS);
    const data = approvals(ME, new URLSearchParams(path.split('?')[1]))[1] as Approvals;
    if (data.waiting.state !== 'ok') throw new Error('the fixture answers a waiting queue');
    const [first, ...rest] = data.waiting.data.rows;
    const named = { ...data, waiting: { ...data.waiting, data: { ...data.waiting.data, rows: [{ ...first, path: NAME }, ...rest] } } };
    window.history.replaceState(null, '', '/approvals');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(providers(<ApprovalsView served={{ state: 'ok', path, data: named, team: 'atlas' }} />));
    // The row and its document cell both open it, and neither at another address.
    expect(new Set(hrefs().filter((h) => h?.includes('call')))).toEqual(new Set([`/initiatives/atlas/${first.initiative}/${ENCODED}`]));
  });

  it('is linked at its encoded address from Home\'s one waiting revision', () => {
    const home = { waiting: { state: 'ok', data: { count: 1, oldestSince: null, one: { initiative: SLUG, path: NAME, version: 2 } } } } as unknown as Home;
    expect(waitingOf(home, 'atlas')).toMatchObject({ kind: 'one', href: `/initiatives/atlas/${SLUG}/${ENCODED}` });
  });

  it('is linked at its encoded address from Record\'s most rewritten documents', () => {
    const data = record(ME, new URLSearchParams('period=all'))[1] as RecordRead;
    if (data.documents.state !== 'ok') throw new Error('the fixture answers the documents slice');
    const named: RecordRead = { ...data, documents: { ...data.documents, data: { ...data.documents.data, mostRewritten: [{ initiative: SLUG, path: NAME, versions: 3 }] } } };
    window.history.replaceState(null, '', '/record');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(providers(<RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: named, team: 'atlas' }} />));
    expect(hrefs()).toContain(`/initiatives/atlas/${SLUG}/${ENCODED}`);
  });

  it('has an earlier snapshot read at its encoded address by the version chain', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      fetched.push(String(url));
      return { ok: true, status: 200, json: async () => ({ version: 1, revision: 2, body: 'text of r2\n' }) } as unknown as Response;
    }));
    const version = (v: number, revision: number) => ({ path: NAME, hash: `h${revision}`, status: 'draft', approved_by: null, updated_at: '2026-08-30T00:00:00Z', version: v, revision, superseded_approved: null });
    const doc = { team: 'atlas', initiative: SLUG, path: NAME, current_revision: 3, body: 'text of r3\n', versions: [version(1, 2), version(2, 3)], sources: [] } as unknown as DocumentDetail;
    render(providers(<VersionChain doc={doc} />));
    await waitFor(() => expect(fetched.length).toBeGreaterThan(0));
    expect(fetched.map((u) => u.replace(/[?&]scope=platform/, ''))).toEqual([`/api/console/document/atlas/${SLUG}/${ENCODED}?revision=2`]);
  });

  it('is given to the assistant at its encoded address, the one the page is at before and after its read arrives', () => {
    const d = { ...documentDetail('atlas', SLUG, 'spec.md')!, path: NAME };
    const arrival = { updatedAt: d.updated_at, now: d.updated_at };
    expect(documentContext(d, arrival).address).toBe(`/initiatives/atlas/${SLUG}/${ENCODED}`);
    const earlier = { version: 1, revision: 2, approvedBy: null, approvedAt: null, earlier: true, body: 'text of r2' };
    const shared = documentContext(d, arrival, earlier);
    expect(shared.address).toBe(`/initiatives/atlas/${SLUG}/${ENCODED}?version=1`);
    expect(shared.insights.map((i) => i.text).join(' ')).toContain(`Approve is offered on the current text alone, at /initiatives/atlas/${SLUG}/${ENCODED}.`);
  });

  it('is read on the console\'s server at its encoded address, and a lost session comes back to it after sign-in', async () => {
    gateway.get.mockReturnValue(new Promise(() => {}));
    void documentPage(SEGMENTS);
    await waitFor(() => expect(gateway.get).toHaveBeenCalledWith(`/document/atlas/${SLUG}/${ENCODED}`));
    gateway.get.mockReset();
    gateway.get.mockRejectedValue(new GatewayError(401, 'not signed in'));
    await expect(documentPage(SEGMENTS)).rejects.toThrow(`NEXT_REDIRECT /login?next=${encodeURIComponent(`/initiatives/atlas/${SLUG}/${ENCODED}`)}`);
  });

  it('is a knowledge node read at its encoded address, and drilled to there from the shelf', async () => {
    gateway.get.mockReturnValue(new Promise(() => {}));
    void nodePage(SEGMENTS);
    await waitFor(() => expect(gateway.get).toHaveBeenCalledWith(`/knowledge/atlas/${ENCODED}`));
    expect(shelf.drill.address({ team: 'atlas', path: NAME })).toBe(`/knowledge/atlas/${ENCODED}`);
  });
});

describe('an address whose escapes do not name a store path', () => {
  it('draws the missing page for a knowledge node, and reads nothing', async () => {
    for (const [team, path] of [['atlas', ['%zz']], ['atlas', ['nodes', '%E0%A4%A']], ['%zz', ['nodes', '0001-a.md']]] as const) {
      expect((await nodePage([...path], team)).type, `${team}/${path.join('/')}`).toBe(MissingPage);
    }
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it('draws the missing page for a document, and reads nothing', async () => {
    for (const path of [['sp%zzec.md'], ['sources', '%']]) {
      expect((await documentPage(path)).type, path.join('/')).toBe(MissingPage);
    }
    expect(gateway.get).not.toHaveBeenCalled();
  });

  // Next hands `..%2F` to a page inside one segment, still escaped. Decoded and built into the read, `../../../auth` under
  // `/api/console/knowledge/atlas/` was resolved by fetch to `GET /api/auth` with the person's cookie; escaping the decoded
  // path again does not help, since `..` has nothing to escape. No store path holds a `.` or `..` segment.
  it('draws the missing page for an address whose segments climb out of the route, and reads nothing', async () => {
    expect(decodePath(['..%2F..%2F..%2Fauth'])).toBeNull();
    expect(decodePath(['nodes', '.'])).toBeNull();
    expect(decodePath(SEGMENTS)).toBe(NAME);
    expect((await nodePage(['..%2F..%2F..%2Fauth'])).type).toBe(MissingPage);
    expect((await documentPage(['..%2F..%2F..%2Fknowledge%2Flog'])).type).toBe(MissingPage);
    expect(gateway.get).not.toHaveBeenCalled();
  });

  // A document's team and initiative are segments of the gateway's address as well, and so are an initiative's own.
  // Next hands `..` or `%2e%2e` in either as it was sent, and `fetch` resolves `/api/console/document/../../auth` to
  // `/api/auth`.
  it('draws the missing page for a document or an initiative whose team or slug climbs out, and reads nothing', async () => {
    for (const [team, slug] of [['..', SLUG], ['%2e%2e', SLUG], ['atlas', '..'], ['atlas', '%2E%2E'], ['atlas', '.'], ['%zz', SLUG]]) {
      const params = Promise.resolve({ team, slug, path: ['spec.md'] });
      expect((await documentPage(['spec.md'], team, slug)).type, `${team}/${slug}`).toBe(MissingPage);
      expect(await documentMetadata({ params }), `${team}/${slug}`).toHaveProperty('title', 'Not found');
      expect((await InitiativePage({ params })).type, `${team}/${slug}`).toBe(MissingPage);
      expect(await initiativeMetadata({ params }), `${team}/${slug}`).toHaveProperty('title', 'Not found');
    }
    expect(gateway.get).not.toHaveBeenCalled();
  });

  it('names a source filed under a web address with a stray % without throwing', () => {
    expect(sourceName('https://example.com/report%zz.pdf', 'sources/report.md')).toEqual({ name: 'Report%zz', host: 'example.com' });
    expect(sourceName('https://docs.example.com/the%20guide.html', 'sources/guide.md')).toEqual({ name: 'The guide', host: 'docs.example.com' });
  });
});

describe('a session that ended between the gate and the read', () => {
  it('goes to sign-in from Access, Activity and every Knowledge page, and back to the page after', async () => {
    gateway.get.mockRejectedValue(new GatewayError(401, 'not signed in'));
    await expect(readAccess()).rejects.toThrow('NEXT_REDIRECT /login?next=%2Faccess');
    await expect(readSummary()).rejects.toThrow('NEXT_REDIRECT /login?next=%2Factivity');
    await expect(readFirst('/knowledge/summary')).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fknowledge');
    await expect(readFirst('/knowledge/log')).rejects.toThrow('NEXT_REDIRECT /login?next=%2Fknowledge%2Flog');
    await expect(nodePage(SEGMENTS)).rejects.toThrow(`NEXT_REDIRECT /login?next=${encodeURIComponent(`/knowledge/atlas/${ENCODED}`)}`);
  });

  it('is still the gateway\'s sentence on these pages for any other refusal', async () => {
    gateway.get.mockRejectedValue(new GatewayError(503, 'The gateway could not reach its database.'));
    await expect(readAccess()).resolves.toEqual({ state: 'failed', reason: 'The gateway could not reach its database.' });
    await expect(readSummary()).resolves.toEqual({ state: 'failed', reason: 'The gateway could not reach its database.' });
    await expect(readFirst('/knowledge/summary')).resolves.toEqual({ state: 'failed', reason: 'The gateway could not reach its database.' });
  });
});

describe('the fake gateway answers as the gateway does', () => {
  let proc: ChildProcess | undefined;
  afterEach(() => { proc?.kill(); proc = undefined; });
  const start = async () => { const fixture = await startFakeGateway(); proc = fixture.proc; return fixture.base; };

  it('answers an address with a malformed escape 400, and keeps answering after it', async () => {
    const base = await start();
    for (const bad of ['/api/console/knowledge/atlas/%E0%A4%A', '/api/console/document/atlas/x/%zz', '/api/console/me%']) {
      expect((await realFetch(`${base}${bad}`)).status, bad).toBe(400);
    }
    expect((await realFetch(`${base}/api/console/me`)).status).toBe(200);
  });

  // As settings/platform.ts answers each: the field the route asks for first, then `superOnly` in its admin function's
  // own sentence (admin/people.ts, admin/teams.ts).
  it('refuses a member every platform administration write, as only a superadmin may make them', async () => {
    const base = await start();
    const send = (method: string, path: string, body: unknown, cookie?: string) => realFetch(`${base}/api/console/settings/platform/${path}`, {
      method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
    });
    for (const [method, path, body, field, refusal] of [
      ['POST', 'people', { email: 'new.person@example.com' }, 'email', 'superadmin required'],
      ['POST', 'enrolments', { email: 'new.person@example.com' }, 'email', 'superadmin required'],
      ['DELETE', 'people', { email: 'ivy@example.com', confirm: 'ivy@example.com' }, 'email', 'superadmin required'],
      ['POST', 'teams', { slug: 'delta', name: 'Delta' }, 'slug', 'superadmin required'],
      ['DELETE', 'teams', { team: 'cinder', confirm: 'cinder' }, 'team', 'superadmin required (retiring a team removes access)'],
    ] as const) {
      const write = `${method} ${path}`;
      const refused = await send(method, path, body, 'zz_console=member');
      expect(refused.status, write).toBe(403);
      expect(await refused.json(), write).toEqual({ error: refusal });
      const unnamed = await send(method, path, {}, 'zz_console=member');
      expect([unnamed.status, await unnamed.json()], `${write} with no ${field}`).toEqual([400, { error: `${field} is required` }]);
      expect((await send(method, path, body)).status, `${write} as the superadmin`).toBe(200);
    }
    for (const [body, error] of [[{ slug: 'Delta Team', name: 'Delta' }, 'slug must be lowercase letters, digits, - or _'], [{ slug: 'delta' }, 'name is required']] as const) {
      const refused = await send('POST', 'teams', body, 'zz_console=member');
      expect([refused.status, await refused.json()], JSON.stringify(body)).toEqual([400, { error }]);
    }
  });

  it('answers a caller who acts for no team 400 on the knowledge log, as on its summary and a lesson', async () => {
    const base = await start();
    const none = { cookie: 'zz_console=superadmin-in-no-team' };
    for (const path of ['knowledge/log', 'knowledge/summary', 'knowledge/atlas/nodes/0001-a.md']) {
      const res = await realFetch(`${base}/api/console/${path}`, { headers: none });
      expect([res.status, await res.json()], path).toEqual([400, { error: "no team: Work is the active team's, and you act for none" }]);
    }
  });
});
