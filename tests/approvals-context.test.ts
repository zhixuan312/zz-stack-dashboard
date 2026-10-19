import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
vi.mock('@/data/access', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/access')>()), requireNeed: async () => undefined }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { PREPARED } from '@/data/prepared';
import { contextText } from '@/lib/shared-context';
import type { Approvals } from '@/lib/work-shapes';
import {
  APPROVALS_DEFAULTS, APPROVAL_IS_THE_PERSON_S, DECISION_BASIS, PRESENTATION, TEAM_APPROVALS, approvalsContext, approvalsPath, noPresentationLine,
  type ApprovalsRead,
} from '@/views/approvals-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { ApprovalsView } from '@/views/pages/approvals';
import { approvalsTool } from '@/views/tools/approvals';
import { ME } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';

/**
 * Approvals' agent side (Task I-107, AC-5.7, AC-5.9): the Ask in each tab's filter bar; `view_approvals`, which reads
 * what the page reads, at its waiting tab unless another is named, and tells the assistant what the page tells it;
 * `explore_approvals`' prepared query; and the context itself, which carries the tab, the rows in view with their
 * evidence and the counts, and says that a person approves on the document's page and the assistant never does.
 */
const answer = (path: string) => approvals(ME, new URLSearchParams(path.split('?')[1]))[1] as Approvals;
const WAITING_PATH = approvalsPath(APPROVALS_DEFAULTS);
const HISTORY_PATH = approvalsPath({ tab: 'history', page: '1' });
const WAITING = answer(WAITING_PATH);
const HISTORY = answer(HISTORY_PATH);
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const ASK = /^Ask: /;

function mount(served: ApprovalsRead, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const page = createElement(Tooltip.Provider, null, createElement(ApprovalsView, { served }));
  return render(createElement(QueryClientProvider, { client }, createElement(SurfaceOverride, { surface: ask ? { ask } : {} } as never, page)));
}

beforeEach(() => {
  gateway.get.mockReset();
  gateway.get.mockImplementation(async (path: string) => answer(path));
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  window.history.replaceState(null, '', '/approvals');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the Ask', () => {
  it('sits in each tab\'s filter bar, on the Approvals table, asking about what that tab shows; absent with the assistant off', () => {
    const ask = vi.fn();
    const waiting = mount({ state: 'ok', path: WAITING_PATH, data: WAITING, team: 'atlas' }, ask);
    const [button] = screen.getAllByRole('button', { name: ASK });
    expect(button.closest('[data-protagonist="Approvals"]')).not.toBeNull();
    expect(button.closest('section')?.getAttribute('aria-label')).toBe(TEAM_APPROVALS);
    expect(button.closest('section')?.firstElementChild?.contains(button)).toBe(true);
    expect(button.getAttribute('aria-label')).toMatch(/waited longest for approval/);
    waiting.unmount();
    window.history.replaceState(null, '', '/approvals?tab=history');
    const history = mount({ state: 'ok', path: HISTORY_PATH, data: HISTORY, team: 'atlas' }, ask);
    const [other] = screen.getAllByRole('button', { name: ASK });
    expect(other.closest('section')?.getAttribute('aria-label')).toBe('Approved in your name');
    expect(other.closest('section')?.firstElementChild?.contains(other)).toBe(true);
    expect(other.getAttribute('aria-label')).toMatch(/my approvals were shown and decided/);
    history.unmount();
    mount({ state: 'ok', path: HISTORY_PATH, data: HISTORY, team: 'atlas' });
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
  });
});

describe('view_approvals', () => {
  it('answers the same Approvals the page reads, at its waiting tab, both summaries included, with the page\'s context', async () => {
    const { data, context } = await approvalsTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(WAITING_PATH);
    expect(data).toEqual(WAITING);
    expect((data as Approvals).waiting.state).toBe('ok');
    expect((data as Approvals).history.state).toBe('ok');
    expect({ ...context, freshness: null }).toEqual({ ...approvalsContext(WAITING, { tab: 'waiting', page: 1, ...arrival }), freshness: null });
    expect(approvalsTool.page).toBe('/approvals');
    expect(approvalsTool.needs).toBe(FEATURES.approvals.needs);
  });

  it('takes the spec\'s arguments, tab, limit and offset, and addresses the page of ten the offset falls in', async () => {
    expect(Object.keys(approvalsTool.input.shape).sort()).toEqual(['limit', 'offset', 'tab']);
    const { context } = await approvalsTool.read({ tab: 'history', offset: 10 });
    expect(gateway.get).toHaveBeenLastCalledWith('/approvals?tab=history&limit=10&offset=10');
    expect(context.address).toBe('/approvals?tab=history&page=2');
    const off = await approvalsTool.read({ tab: 'history', limit: 3, offset: 2 });
    expect(gateway.get).toHaveBeenLastCalledWith('/approvals?tab=history&limit=3&offset=2');
    expect(contextText(off.context)).toContain('does not show exactly these 3 rows');
  });
});

describe('explore_approvals', () => {
  it('declares the approvals in the caller\'s name, by presentation and decision basis, over /work/query', () => {
    const { sources } = approvalsTool.explore;
    expect(Object.keys(sources)).toEqual(['approvals']);
    expect(PREPARED.find((r) => r.name === sources.approvals.collection)?.route).toBe('work');
    expect(sources.approvals.facets).toEqual(expect.arrayContaining(['presentation', 'decision_basis']));
    expect(sources.approvals.filters?.presentation?.values).toEqual(Object.keys(PRESENTATION));
    expect(sources.approvals.filters?.decision_basis?.values).toEqual(Object.keys(DECISION_BASIS));
  });
});

describe('the context', () => {
  const said = (a: Approvals, tab: 'waiting' | 'history', page = 1) => contextText(approvalsContext(a, { tab, page, ...arrival }));

  it('carries the tab, the waiting rows in view with their exact revision, and the counts', () => {
    const text = said(WAITING, 'waiting');
    expect(text).toContain('the Waiting tab, page 1 of 1');
    for (const r of (WAITING.waiting.state === 'ok' ? WAITING.waiting.data.rows : [])) expect(text).toContain(`${r.path} v${r.version} of ${r.initiative} (${r.contentRevision})`);
    expect(text).toContain(`Waiting now: ${WAITING.tiles.waiting}`);
    expect(text).toContain(`Approvals in your name: ${WAITING.tiles.inYourName}`);
    expect(text).toContain(`No presentation recorded: ${noPresentationLine(WAITING.tiles.noPresentation!, null)}`);
    expect(text).toContain(`${TEAM_APPROVALS}: ${WAITING.tiles.waiting} revisions waiting`);
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('carries the history rows in view with their evidence as the gateway classified it, within its budget', () => {
    const text = said(HISTORY, 'history');
    expect(text).toContain('the History tab, page 1 of 2');
    const rows = HISTORY.history.state === 'ok' ? HISTORY.history.data.rows : [];
    expect(text).toContain(`Rows 1 to 10 of ${rows.length && HISTORY.history.state === 'ok' ? HISTORY.history.data.total : 0}, newest first`);
    // The first five rows in view, each with its evidence, and how many more the page shows.
    expect(text).toContain('and 5 more (on /approvals?tab=history)');
    for (const r of rows.slice(0, 5)) {
      expect(text).toContain(`${r.path} v${r.version} of ${r.initiative} (${r.contentRevision})`);
      expect(text).toContain(`: ${PRESENTATION[r.presentation].short}, ${DECISION_BASIS[r.decisionBasis].short}`);
    }
    expect(text).toMatch(/Approved in your name: \d+; by presentation: /);
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('stays inside its budget with names as long as a name gets, the rows in view kept before the other tab and the weeks', () => {
    const LONG = '2026-10-01-a-name-somebody-typed-in-full-because-the-platform-keeps-what-it-is-given-and-never-renames-it';
    const named = <R extends { initiative: string; path: string }>(rows: R[]) => rows.map((r, i) => ({ ...r, initiative: `${LONG}-${i}`, path: `sources/${LONG}.md` }));
    const counted = (rows: { initiative: string; count: number }[]) => rows.map((r, i) => ({ ...r, initiative: `${LONG}-${i}` }));
    const long = (a: Approvals): Approvals => ({
      ...a,
      waiting: a.waiting.state === 'ok' ? { state: 'ok', data: { ...a.waiting.data, rows: named(a.waiting.data.rows), summary: { ...a.waiting.data.summary, byInitiative: counted(a.waiting.data.summary.byInitiative) } } } : a.waiting,
      history: a.history.state === 'ok' ? { state: 'ok', data: { ...a.history.data, rows: named(a.history.data.rows), summary: { ...a.history.data.summary, byInitiative: counted(a.history.data.summary.byInitiative) } } } : a.history,
    });
    for (const [a, tab] of [[long(WAITING), 'waiting'], [long(HISTORY), 'history']] as const) {
      const context = approvalsContext(a, { tab, page: 1, ...arrival });
      expect(contextText(context).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(context.insights[1]?.text).toMatch(/^Rows 1 to /);
    }
  });

  it('says the assistant never approves, and that approval is made on the document\'s page', () => {
    expect(APPROVAL_IS_THE_PERSON_S).toMatch(/assistant approves nothing/);
    expect(APPROVAL_IS_THE_PERSON_S).toMatch(/on the document's own page/);
    expect(said(WAITING, 'waiting')).toContain(APPROVAL_IS_THE_PERSON_S);
    expect(said(HISTORY, 'history')).toContain(APPROVAL_IS_THE_PERSON_S);
    for (const field of ['approve', 'decision_basis', 'content_revision', 'review_context', 'initiative', 'path']) expect(Object.keys(approvalsTool.input.shape)).not.toContain(field);
    expect(approvalsTool.description).toContain('never approves');
  });

  it('claims nothing of reading or signing beyond the record, and says the queue is assigned to nobody', () => {
    for (const text of [said(WAITING, 'waiting'), said(HISTORY, 'history')]) {
      expect(text).not.toMatch(/signed by|signed it|you read it|at the keyboard|your agent/i);
      expect(text).toContain('the record names you as the approval\'s signer, nothing more');
      expect(text).toContain('no row is assigned to anybody');
    }
  });

  it('says what it could not read, never counting it as nothing', () => {
    const lost: Approvals = { ...WAITING, tiles: { waiting: null, oldestWaitingSince: null, inYourName: null, noPresentation: null }, weeks: [], waiting: { state: 'unavailable', reason: 'down' }, history: { state: 'unavailable', reason: 'down' } };
    const text = said(lost, 'waiting');
    expect(text).toContain('Waiting now: unavailable');
    expect(text).toContain('No presentation recorded: unavailable');
    expect(text).toContain('The waiting queue could not be read');
    expect(text).toContain('The approvals in your name could not be read');
    expect(text).not.toMatch(/\d+ revisions? waiting/);
  });
});
