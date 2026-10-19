import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace: (to: string) => window.history.replaceState(null, '', to) }),
}));

import { app, workspaces } from '@/app.config';
import type { KnowledgeBody, KnowledgeLogEntry, Me } from '@/lib/api-shapes';
import type { KnowledgeSummary } from '@/lib/destination-shapes';
import { formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { PeriodFigure } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import type { Home, RecordRead } from '@/lib/work-shapes';
import { CONTEXT_BUDGET } from '@/views/context';
import { homeContext } from '@/views/home-context';
import { knowledgeContext, type ServerRead } from '@/views/knowledge-context';
import { HomeView } from '@/views/pages/home';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { RecordView } from '@/views/pages/record';
import { RECORD_DEFAULTS, recordContext, recordPath } from '@/views/record-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { homeOf, neutralFinding } from '../scripts/fake-gateway/work-home.ts';
import { KNOWLEDGE_LOG, SHELF, knowledgeList, knowledgeSummary, lesson } from '../scripts/fake-gateway/work-knowledge.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

/**
 * Phase 7, I-166: the second re-review's findings on Home, Record, Knowledge, its log and a node, each found gone at
 * its cause on the fake gateway's own answers. A context is read as the model reads it; a page is drawn and the classes
 * and marks that decide what a still shows are read. The screenshots of the build show the rest.
 */
const AT = '2026-10-17T09:00:00Z';
const DAY = 86_400_000;
const PEOPLE: [string, Me][] = [['the superadmin', ME], ['the member', MEMBER]];
const mount = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);

/**
 * The fake's Home and Record as `who` is answered them on a run started `days` from now. The fixture's weeks move with
 * the day it is run, so the dates a context names are seven characters one month and five the next; a context held to
 * its budget on one day only is not held to it.
 */
async function fakesOn(days: number) {
  vi.useFakeTimers({ now: Date.now() + days * DAY, toFake: ['Date'] });
  vi.resetModules();
  const [h, r] = await Promise.all([import('../scripts/fake-gateway/work-home.ts'), import('../scripts/fake-gateway/work-record.ts')]);
  vi.useRealTimers();
  return {
    home: (who: Me) => h.homeOf('atlas', who.email),
    record: (who: Me) => r.record(who, new URLSearchParams('period=all'))[1] as RecordRead,
  };
}
const RUN_DAYS = [0, 5, 11, 16, 23, 30];

/** A series as a context says it: each week by its Monday with its figure, or `none` for a week with no value. */
const said = (p: PeriodFigure) => `${formatDay(p.window.from)} ${p.figure.value === null ? 'none' : formatCount(p.figure.value)}`;
const line = (t: string, start: string) => t.split('\n').find((l) => l.startsWith(start)) ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const path = url.pathname.replace('/api/console', '');
    const body = path === '/me' ? ME : path === '/knowledge' ? knowledgeList(ME, url.searchParams)[1] : record(ME, url.searchParams)[1];
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('M-9: Home\'s context carries the two series the page leads with, and all of the rest, alike for both people', () => {
  it.each(RUN_DAYS)('fits its budget whole on a run %i days on, for both people', async (days) => {
    const { home } = await fakesOn(days);
    const told = PEOPLE.map(([, who]) => {
      const h = home(who);
      const t = contextText(homeContext({ state: 'ok', home: h, team: 'atlas' }));
      expect(t.length, `${who.email}, day ${days}`).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(t, who.email).not.toContain('More is on the page');
      const weeks = (part: Home['words'] | Home['approvals']) => (part.state === 'ok' ? part.data.weeks : []);
      const words = line(t, '- Words added:');
      for (const w of weeks(h.words).slice(-8)) expect(words, `${who.email}: ${said(w)}`).toContain(said(w));
      const approvals = line(t, '- Approvals in your name:');
      for (const w of weeks(h.approvals).slice(-8)) expect(approvals, `${who.email}: ${said(w)}`).toContain(said(w));
      expect(words).toMatch(/so far\.?$/);
      for (const part of ['runs active now', 'Next milestones:', 'Closed last week:', 'open initiatives, waiting first']) expect(t, `${who.email}: ${part}`).toContain(part);
      return t.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.split(':')[0]);
    });
    // The same lines, by what each says, for both people: only the approvals in each one's name differ, and a member's
    // finding about them is one line more where theirs makes one.
    const [sa, m] = told;
    expect(m.filter((l) => !l.includes('approvals in your name'))).toEqual(sa.filter((l) => !l.includes('approvals in your name')));
  });

  it('names the week the cursor rests on, both halves, as before', () => {
    const h = homeOf('atlas', ME.email);
    const c = homeContext({ state: 'ok', home: h, team: 'atlas' }, { index: 1 });
    expect(c.focus).toMatch(/^the week of /);
  });
});

describe('M-9: Record\'s context carries the lead\'s series, and the superadmin\'s keeps every line the member\'s does', () => {
  it.each(RUN_DAYS)('fits its budget whole on a run %i days on, for both people', async (days) => {
    const { record: read } = await fakesOn(days);
    const told = PEOPLE.map(([, who]) => {
      const r = read(who);
      const t = contextText(recordContext(r, { filters: RECORD_DEFAULTS }));
      expect(t.length, `${who.email}, day ${days}`).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(t, who.email).not.toContain('More is on the page');
      const lead = line(t, '- Words added, a running total, by week:');
      for (const p of r.cumulative.slice(-8)) expect(lead, `${who.email}: ${said(p)}`).toContain(said(p));
      // Each list is told, or named in the Unknown as on the page only (Phase 7's third re-review, Work P-2).
      for (const part of ['Most rewritten documents', 'Runs by skill', 'Lessons adopted, by kind', 'Dated firsts']) expect(t, `${who.email}: ${part}`).toContain(part);
      return t.split('\n').map((l) => l.split(':')[0]);
    });
    expect(told[0]).toEqual(told[1]);
  });
});

describe('M-15: a tie names every week it ties with, the one its record is counted from as that first week', () => {
  // Weeks from Monday 7 Sept, each starting at midnight in Singapore, the running week last.
  const wk = (i: number, value: number | null, complete = true): PeriodFigure => {
    const from = new Date(Date.UTC(2026, 8, 7 + i * 7) - 8 * 3_600_000).toISOString();
    return {
      window: { from, to: from, observedFrom: from, observedThrough: null, complete },
      figure: value === null ? { value: null, why: 'no_data' } : { value, why: null }, numerator: null, denominator: null,
    };
  };
  const weeks = (values: number[]) => [...values.map((v, i) => wk(i, v)), wk(values.length, 0, false)];

  it.each([
    [[2, 1, 2], ' since 7 Sept, tied with that first week'],
    [[1, 0, 1, 1], ' since 7 Sept, tied with that first week and 21 Sept'],
    [[1, 1, 0, 1, 1], ' since 7 Sept, tied with that first week, 14 Sept and 28 Sept'],
    [[3, 1, 2, 1], ' since 7 Sept, tied with 14 Sept'],
  ] as const)('names every tied week of %j, earliest first', (values, tail) => {
    const f = neutralFinding(weeks([...values]), 'approvals in your name')!;
    expect(f.text.endsWith(tail), f.text).toBe(true);
    expect(f.tie).toBe(true);
  });

  it('says the fake\'s own findings by the rule, for both people', () => {
    for (const [, who] of PEOPLE) {
      const h = homeOf('atlas', who.email);
      if (h.approvals.state !== 'ok') throw new Error('the fixture reads the approvals');
      const whole = h.approvals.data.weeks.filter((w) => w.window.complete);
      const last = whole.at(-1)!;
      const first = whole.find((w) => w.figure.value !== null);
      const tied = whole.filter((w) => w !== last && w.figure.value !== null && w.figure.value === last.figure.value)
        .map((w) => (w === first ? 'that first week' : formatDay(w.window.from)));
      const text = h.approvals.data.finding?.text ?? '';
      if (!/^(Most|Fewest) recorded/.test(text) || !tied.length) continue;
      expect(text, who.email).toMatch(new RegExp(`, tied with ${tied.length > 1 ? `${tied.slice(0, -1).join(', ')} and ` : ''}${tied.at(-1)}$`));
    }
  });
});

describe('M-18: Home\'s line to Record keeps its arrow with its last word', () => {
  it('is inline, the arrow inside the unbreakable last word', () => {
    mount(<HomeView read={{ state: 'ok', home: homeOf('atlas', ME.email), team: 'atlas' }} />);
    const go = document.querySelector('[data-record-line]') as HTMLElement;
    expect(go.className).not.toMatch(/(^|\s)(inline-)?flex(\s|$)/);
    const held = go.querySelector('svg')!.parentElement!;
    expect(held.className).toContain('whitespace-nowrap');
    expect(held.textContent?.trim()).toBe('Record');
  });
});

describe('F-41: the record\'s rows show the way to their initiative', () => {
  it('marks every row it links with the quiet arrow', async () => {
    const r = record(ME, new URLSearchParams('period=all&limit=10&offset=0'))[1] as RecordRead;
    window.history.replaceState(null, '', '/record');
    await act(async () => { mount(<RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: r, team: 'atlas' }} />); });
    const table = screen.getByRole('table', { name: 'The record' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.querySelector('[data-goes]'), row.textContent ?? '').not.toBeNull();
  });

  it('keeps Runs\' line arrow with its last word too', async () => {
    const r = record(ME, new URLSearchParams('period=all&limit=10&offset=0'))[1] as RecordRead;
    window.history.replaceState(null, '', '/record');
    await act(async () => { mount(<RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: r, team: 'atlas' }} />); });
    const go = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/runs' && a.textContent?.includes('is on Runs'))!;
    expect(go.className).not.toMatch(/(^|\s)(inline-)?flex(\s|$)/);
    expect(go.querySelector('svg')!.parentElement!.textContent?.trim()).toBe('Runs');
  });
});

/** The fake's Knowledge summary as the page's server hands it over. */
const summaryRead = (): ServerRead<KnowledgeSummary> => ({ state: 'ok', data: knowledgeSummary(ME)[1] as KnowledgeSummary, at: AT });

describe('M-8: every question that found nothing is reachable from the page', () => {
  it('is every question the fixture holds, and the table pages to the rest', async () => {
    const read = summaryRead();
    const s = read.state === 'ok' ? read.data : null;
    if (s?.questions.state !== 'ok') throw new Error('the fixture reads the questions');
    const { rows, total } = s.questions.data;
    expect(total, 'more than a page of them').toBeGreaterThan(10);
    expect(rows).toHaveLength(total);
    window.history.replaceState(null, '', '/knowledge');
    await act(async () => { mount(<KnowledgeView read={read} />); });
    const table = screen.getByRole('table', { name: 'Questions that found nothing' });
    const card = table.closest('.card') as HTMLElement;
    expect(card.textContent).toContain(`${total} in all`);
    expect(card.textContent).not.toContain(`most asked first: 10 of ${total}`);
    expect(card.textContent).toContain(`Page 1 of ${Math.ceil(total / 10)}`);
    await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Next page' })); });
    for (const q of rows.slice(10)) expect(within(card).getByText(q.question)).toBeInTheDocument();
  });

  it('counts the rest against the total in the context, not against the rows answered', () => {
    const read = summaryRead();
    const s = read.state === 'ok' ? read.data : undefined;
    const t = contextText(knowledgeContext({ summary: s, filters: { q: '', kind: 'all' }, page: 1, updatedAt: AT, now: AT }));
    const total = s?.questions.state === 'ok' ? s.questions.data.total : 0;
    expect(t).toContain(`(${total} in all)`);
    expect(t).toContain(`and ${total - 4} more`);
  });
});

describe('F-56: the assistant\'s empty thread offers the page\'s own questions, not one', () => {
  it('offers four, each built from a figure the page shows', () => {
    const read = summaryRead();
    const s = read.state === 'ok' ? read.data : undefined;
    if (!s || s.questions.state !== 'ok' || s.newest.state !== 'ok') throw new Error('the fixture reads every part');
    const offered = knowledgeContext({ summary: s, filters: { q: '', kind: 'all' }, page: 1, updatedAt: AT, now: AT }).questions ?? [];
    expect(offered).toHaveLength(4);
    expect(offered[0]).toContain(`our ${s.tiles.standing.value} lessons adopted`);
    expect(offered[1]).toContain(`our ${s.questions.data.total} questions that found nothing`);
    expect(offered[2]).toMatch(/Why did \d+% of our searches find something in the week of .+, against \d+% the week before\?/);
    expect(offered[3]).toContain(s.newest.data[0].title);
    expect(new Set(offered).size).toBe(offered.length);
  });
});

describe('M-11: a node starts its breadcrumb at the workspace and shows which neighbours open', () => {
  const ATLAS = SHELF.filter((n) => n.team === 'atlas');
  const withNeighbours = ATLAS.map((n) => lesson('atlas', n.path, 'atlas')).find((b): b is KnowledgeBody => !!b && (b.related?.length ?? 0) > 0)!;

  it('roots the breadcrumb in ZZ Stack · Work, as every other Work page', async () => {
    window.history.replaceState(null, '', `/knowledge/atlas/${withNeighbours.path}`);
    await act(async () => { mount(<KnowledgeNodeView read={{ state: 'ok', data: withNeighbours, at: AT }} team="atlas" rel={withNeighbours.path} />); });
    const crumbs = screen.getByRole('link', { name: 'Knowledge' }).parentElement!;
    expect(crumbs.textContent?.startsWith(`${app.name} · ${workspaces.main.label}`)).toBe(true);
  });

  it('marks every neighbour row with the quiet arrow', async () => {
    window.history.replaceState(null, '', `/knowledge/atlas/${withNeighbours.path}`);
    await act(async () => { mount(<KnowledgeNodeView read={{ state: 'ok', data: withNeighbours, at: AT }} team="atlas" rel={withNeighbours.path} />); });
    const table = screen.getByRole('table', { name: 'Nodes that share a tag' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBe(Math.min(10, withNeighbours.related!.length));
    for (const row of rows) expect(row.querySelector('[data-goes]'), row.textContent ?? '').not.toBeNull();
  });
});

describe('The log shows which rows open their node', () => {
  it('marks a row whose node is on the shelf, and none whose node is gone', async () => {
    const entries: KnowledgeLogEntry[] = [...KNOWLEDGE_LOG].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 9)
      .concat([{ ts: AT, actor: 'noah.okafor@example.com', team: 'atlas', kind: 'knowledge.add', node: '0099', recorded_title: 'Gone since', superseded_by: null, node_title: null, node_status: null, path: null }]);
    window.history.replaceState(null, '', '/knowledge/log');
    await act(async () => { mount(<KnowledgeLogView read={{ state: 'ok', data: { entries }, at: AT }} />); });
    const rows = within(screen.getByRole('table', { name: 'Knowledge log' })).getAllByRole('row').slice(1);
    for (const row of rows) {
      const gone = row.textContent?.includes('Gone since');
      expect(row.querySelector('[data-goes]') === null, row.textContent ?? '').toBe(!!gone);
    }
  });
});
