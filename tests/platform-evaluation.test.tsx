import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/evaluation',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', () => ({ gatewayGet: gateway.get }));
vi.mock('@/data/access', async (load) => ({ ...(await load<typeof import('@/data/access')>()), requireNeed: async () => {} }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (load) => ({ ...(await load<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { MAIN_ROLES, effective } from '@/data/roles';
import { formatDateTime } from '@/lib/format-date';
import type { Evaluation, Part } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { EvaluationAsOf, PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { EVALUATION_BOUND_MS, evaluationContext, scoredAgo, seriesRows, trendOf, type EvaluationRead } from '@/views/platform-evaluation-context';
import { evaluationTool } from '@/views/tools/evaluation';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { readEvaluation } from '../app/(dash)/platform/evaluation/read-evaluation';
import EvaluationLoading from '../app/(dash)/platform/evaluation/loading';

/**
 * Evaluation under Platform (Task I-98): the page drawn from the fake gateway's own answer as the superadmin and as a
 * member, read first on the console's server; the four tiles, each plugin's latest score, every score by series with
 * its comparability statement and a trend only within one series, the findings by decision and by owner, and the
 * findings waiting in the caller's form; every state; no write control; the Ask on the protagonist; and
 * `view_evaluation` with `explore_evaluation`.
 */
const ADMIN = evaluation(true);
const MEMBER = evaluation(false);
const ok = (e: Evaluation): EvaluationRead => ({ state: 'ok', evaluation: e });
/** A part the fixture answers, which is every one of them. */
function data<T>(p: Part<T>): T {
  if (p.state !== 'ok') throw new Error(p.reason);
  return p.data;
}
const KEYS = ['sdlc-flow-quality', 'core-door-reliability', 'eval-scoring-honesty'];
const PATTERNS = data(ADMIN.waiting).rows.map((r) => (r as { pattern?: string }).pattern!);
const MEASURES = data(ADMIN.waiting).rows.map((r) => r.measure!);

/** Evaluation on a fresh deployment: nothing scored, no finding, nothing waiting. COUPLED: the `noEvaluation` the fake's
 *  `empty` world is given (reported for `scripts/fake-gateway/states.ts`). */
const NOTHING: Evaluation = {
  ...ADMIN,
  meta: { ...ADMIN.meta, period: { from: ADMIN.meta.asOf, to: ADMIN.meta.asOf }, coverageFrom: null },
  tiles: { waiting: 0, established: 0, lastScored: null, daysScored: 0 },
  plugins: { state: 'ok', data: [] }, history: { state: 'ok', data: [] },
  byDecision: { state: 'ok', data: { applied: 0, rejected: 0, deferred: 0 } }, byOwner: { state: 'ok', data: {} },
  waiting: { state: 'ok', data: { rows: [], total: 0 } },
};

/** The view as the shell holds it: inside the tooltip provider, on the console's surface, with an assistant when `ask` is given. */
const draw = (read: EvaluationRead, ask?: (q: string) => void) =>
  render(<SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><PlatformEvaluationView read={read} /></Tooltip.Provider></SurfaceOverride>);
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section, .card') as HTMLElement;
const table = (name: string) => screen.getByRole('table', { name });
const rowOf = (t: HTMLElement, text: string) => within(t).getAllByRole('row').filter((r) => r.textContent!.includes(text));

beforeEach(() => { router.refresh.mockReset(); gateway.get.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('who opens Evaluation', () => {
  it('needs platform:read, which both roles hold', () => {
    expect(FEATURES.evaluation).toEqual({ title: 'Evaluation', needs: 'platform:read' });
    for (const role of MAIN_ROLES) expect(effective(role).has('platform:read'), role).toBe(true);
  });
});

describe('the page, as the fake gateway answers it', () => {
  it('draws the four tiles from the read, with Never for a platform nothing has scored', () => {
    const { container, unmount } = draw(ok(ADMIN));
    for (const label of ['Findings waiting', 'Scores established', 'Last scored', 'Days scored']) expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    const values = [...container.querySelectorAll('[data-figures="read"] [data-value]')].map((v) => v.textContent);
    expect(values).toEqual([String(ADMIN.tiles.waiting), String(ADMIN.tiles.established), scoredAgo(ADMIN.tiles.lastScored!, ADMIN.meta.asOf), String(ADMIN.tiles.daysScored)]);
    expect(card('Scores established').textContent).toContain(`Of ${data(ADMIN.plugins).length} plugins scored`);
    unmount();
    const nothing = draw(ok(NOTHING));
    expect([...nothing.container.querySelectorAll('[data-figures="read"] [data-value]')].map((v) => v.textContent)).toEqual(['0', '0', 'Never', '0']);
  });

  it('draws each plugin\'s latest score with its range, standing, guardrails, protocol and date, and no score as no number', () => {
    draw(ok(ADMIN));
    const plugins = table('Each plugin\'s latest score');
    expect(within(plugins).getAllByRole('row')).toHaveLength(data(ADMIN.plugins).length + 1);
    const [sdlc] = rowOf(plugins, 'sdlc-flow');
    expect(sdlc.textContent).toContain('7.1');
    expect(sdlc.textContent).toContain('6.5 to 7.7');
    expect(sdlc.textContent).toContain('Established');
    expect(sdlc.textContent).toContain('sdlc-flow-quality v2');
    expect(rowOf(plugins, 'core-door')[0].textContent).toContain('One failed');
    const [unscored] = rowOf(plugins, 'eval-scoring');
    expect(unscored.textContent).toContain('No score');
    expect(unscored.textContent).toContain('Not established');
    expect(unscored.textContent).not.toMatch(/\b0\.0\b/);
  });

  it('draws every score by series, each plugin with the read\'s own statement of whether its series compare', () => {
    draw(ok(ADMIN));
    const series = table('Every score, by series');
    const rows = seriesRows(data(ADMIN.history));
    expect(within(series).getAllByRole('row')).toHaveLength(rows.length + 1);
    // The statement is the plugin's, so it is said once, on the plugin's first series.
    const statements = [...series.querySelectorAll('[data-statement]')].map((s) => s.textContent);
    expect(statements).toEqual(rows.filter((r) => r.first).map((r) => r.statement));
    expect(statements).toHaveLength(new Set(rows.map((r) => r.plugin)).size);
    expect(statements).toContain('Not comparable: a different protocol version');
    expect(statements).toContain('Not comparable: a different population');
    expect(statements).toContain('Comparable: one protocol version and population');
  });

  it('draws a trend within one series alone, never across two (AC-3.10)', () => {
    draw(ok(ADMIN));
    const series = table('Every score, by series');
    const trends = series.querySelectorAll('[data-trend]');
    // sdlc's second protocol version holds two scores; its first holds one, zz-core's two populations one each, and
    // zz-plugin-eval's one series a score and a scoring with none.
    expect(trends).toHaveLength(1);
    const row = trends[0].closest('tr')!;
    expect(row.textContent).toContain('sdlc-flow-quality v2');
    expect(row.textContent).toContain('0.7 pts');
    expect(rowOf(series, 'sdlc-flow-quality v1')[0].querySelector('[data-trend]')).toBeNull();
    for (const r of rowOf(series, 'core-door-reliability')) expect(r.querySelector('[data-trend]')).toBeNull();
    // The change is the series' own, first score to last: 6.4 to 7.1, never 5.8 (protocol v1) to 7.1.
    const sdlc = data(ADMIN.history).find((h) => h.plugin === 'sdlc')!;
    expect(trendOf(sdlc.series[0])).toBeNull();
    const t = trendOf(sdlc.series[1])!;
    expect([t.from.score, t.to.score, t.points]).toEqual([6.4, 7.1, [6.4, 7.1]]);
    expect(t.change).toBeCloseTo(0.7);
    expect(trendOf(data(ADMIN.history).find((h) => h.plugin === 'zz-plugin-eval')!.series[0])).toBeNull();
  });

  it('draws a trend wherever recorded scores compare, rather than a fixed no-trend sentence (AC-3.10)', () => {
    // zz-core's two scorings recorded under one population: one series, comparable, so its change is drawn.
    const history = data(ADMIN.history).map((h) => (h.plugin !== 'zz-core' ? h : {
      ...h, statement: 'Comparable: one protocol version and population',
      series: [{ ...h.series[0], runs: h.series.flatMap((s) => s.runs) }],
    }));
    draw(ok({ ...ADMIN, history: { state: 'ok', data: history } }));
    const series = table('Every score, by series');
    expect(series.querySelectorAll('[data-trend]')).toHaveLength(2);
    expect(rowOf(series, 'core-door-reliability')[0].querySelector('[data-trend]')!.textContent).toContain('0.3 pts');
  });

  it('draws the findings by decision as a Composition bar and by owner as a Bar list', () => {
    draw(ok(ADMIN));
    const decided = data(ADMIN.byDecision);
    const decision = card('Findings by decision');
    for (const t of [`Applied: ${decided.applied}`, `Rejected: ${decided.rejected}`, `Deferred, waiting: ${decided.deferred}`]) expect(within(decision).getByTitle(t)).toBeInTheDocument();
    const owner = card('Findings by owner');
    for (const label of ['The plugin', 'A dependency', 'The platform', 'Not known']) expect(owner.textContent).toContain(label);
  });

  it('lists the findings waiting oldest first, each named by the superadmin\'s pattern over its measure', () => {
    draw(ok(ADMIN));
    const waiting = table('Findings waiting for a decision, oldest first');
    const rows = within(waiting).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('[data-finding-name]')!.textContent)).toEqual(PATTERNS);
    expect(rows.map((r) => r.querySelector('[data-measure]')!.textContent)).toEqual(MEASURES.map((m) => `Measure ${m}`));
    for (const header of ['Finding', 'Plugin', 'Kind', 'Owner', 'Waiting']) expect(within(waiting).getByRole('columnheader', { name: header })).toBeInTheDocument();
  });

  it('shows a member the form everybody may read: no protocol key, no measure, no finding\'s own words', () => {
    const { container } = draw(ok(MEMBER));
    for (const key of [...KEYS, ...MEASURES, ...PATTERNS]) expect(container.textContent).not.toContain(key);
    expect(table('Each plugin\'s latest score').textContent).toContain('Protocol v2');
    const waiting = table('Findings waiting for a decision, oldest first');
    expect(waiting.querySelector('[data-measure]')).toBeNull();
    const rows = within(waiting).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('[data-finding-name]')!.textContent)).toEqual(data(MEMBER.waiting).rows.map((f) => f.summary));
    expect(data(MEMBER.waiting).rows.map((f) => f.summary)).toEqual(['A defect in sdlc, owned by the plugin', 'Evaluation finding awaiting a decision']);
    // The name says the plugin and the owner category, or the plugin is under it, so a member's row has no column for either.
    expect(within(waiting).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Finding', 'Kind', 'Waiting']);
  });

  it('offers no write control: nothing starts an evaluation or decides a finding', () => {
    for (const e of [ADMIN, MEMBER]) {
      const { container, unmount } = draw(ok(e), vi.fn());
      expect(container.querySelector('form, input, textarea, select, [role="checkbox"], [role="menuitem"]')).toBeNull();
      for (const b of screen.getAllByRole('button')) expect(b.getAttribute('aria-label') ?? '').toMatch(/^(About |Ask: )/);
      unmount();
    }
  });
});

describe('the page\'s states', () => {
  it('loading: the page\'s shape, announced as busy, naming no page under the absent refusal', () => {
    render(<Tooltip.Provider><EvaluationLoading /></Tooltip.Provider>);
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveAttribute('aria-busy', 'true');
    expect(document.title).not.toContain('Evaluation');
  });

  it('empty: a platform nothing has scored says so in every card, with no zero standing in for a score', () => {
    draw(ok(NOTHING));
    expect(screen.getByText('No plugin scored yet')).toBeInTheDocument();
    expect(screen.getByText('No score recorded yet')).toBeInTheDocument();
    expect(screen.getAllByText('No finding recorded yet')).toHaveLength(2);
    expect(screen.getAllByText('Nothing waits for a decision').length).toBeGreaterThanOrEqual(2);
  });

  it('partial: a part that is unavailable draws its own state, the rest stands, and the Ask stays with its table', () => {
    draw(ok({ ...ADMIN, plugins: { state: 'unavailable', reason: 'failed' }, byOwner: { state: 'unavailable', reason: 'failed' } }), vi.fn());
    expect(screen.getByText('The plugins did not load')).toBeInTheDocument();
    expect(screen.getByText('Findings by owner: unavailable')).toBeInTheDocument();
    expect(card('Findings by decision')).toBeTruthy();
    expect(table('Every score, by series')).toBeTruthy();
    const ask = screen.getByRole('button', { name: /^Ask: / });
    expect(ask.closest('[data-protagonist="Each plugin\'s latest score"]')).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  const failures: [EvaluationRead, string, string][] = [
    [{ state: 'failed', reason: 'The gateway refused the read' }, 'Evaluation did not load', 'The gateway refused the read. Nothing on this page was read.'],
    [{ state: 'slow' }, 'Evaluation is unavailable', `The read did not answer within ${EVALUATION_BOUND_MS / 1000} seconds.`],
  ];
  for (const [read, title, detail] of failures) {
    it(`error: a ${read.state} read is the error state, with Retry asking the server again`, () => {
      const { container } = draw(read);
      expect(screen.getByRole('alert')).toHaveTextContent(title);
      expect(screen.getByRole('alert')).toHaveTextContent(detail);
      expect(container.querySelector('[data-figures]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  }

  it('dates the masthead with the read\'s own cutoff, and nothing when there is no read', () => {
    const { unmount } = render(<EvaluationAsOf read={ok(ADMIN)} />);
    expect(screen.getByText(`As of ${formatDateTime(ADMIN.meta.asOf)}`)).toBeInTheDocument();
    unmount();
    const { container } = render(<EvaluationAsOf read={{ state: 'slow' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('the Ask on each plugin\'s latest score', () => {
  it('sits in the header actions of the table of plugins with the assistant on, and is absent with it off', () => {
    const ask = vi.fn();
    const { unmount } = draw(ok(ADMIN), ask);
    const buttons = screen.getAllByRole('button', { name: /^Ask: / });
    expect(buttons).toHaveLength(1);
    const head = buttons[0].closest('[data-protagonist="Each plugin\'s latest score"]')!.querySelector('section, .card')!;
    expect(head.firstElementChild?.contains(buttons[0])).toBe(true);
    fireEvent.click(buttons[0]);
    expect(ask).toHaveBeenCalledWith('Which plugins\' latest scores can be relied on, which guardrails failed, and what is still waiting for a decision?');
    unmount();
    draw(ok(ADMIN));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('what the assistant is told', () => {
  const text = (e: Evaluation) => contextText(evaluationContext(ok(e)));

  it('carries the values the page draws, inside the budget', () => {
    const t = text(ADMIN);
    expect(t).toContain(`- Findings waiting: ${ADMIN.tiles.waiting}, the oldest waiting`);
    expect(t).toContain(`- Scores established: ${ADMIN.tiles.established}, of 3 plugins scored`);
    expect(t).toContain(`- Last scored: ${scoredAgo(ADMIN.tiles.lastScored!, ADMIN.meta.asOf)}, ${formatDateTime(ADMIN.tiles.lastScored!)}`);
    expect(t).toContain(`- Days scored: ${ADMIN.tiles.daysScored}`);
    expect(t).toContain('Applied 1; Rejected 1; Deferred, waiting 2');
    expect(t).toContain('sdlc: latest 7.1 of 10 (6.5 to 7.7), established, guardrails held; by series, not comparable: a different protocol version: sdlc-flow-quality v1');
    expect(t).toContain('zz-plugin-eval: latest no score, not established');
    expect(t).toContain('up 0.7 points within the series');
    expect(t).toContain(PATTERNS[0].slice(0, 40));
    expect(t).toContain(`As of ${formatDateTime(ADMIN.meta.asOf)}`);
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('says what the figures cannot say: no change across series, and no overall score', () => {
    const t = text(ADMIN);
    expect(t).toContain('A change is stated within one series (one protocol version and one population), never across two; no score is combined into an overall one.');
    expect(t).not.toContain('More is on the page than fits here');
    expect(t).toContain('A score not established is not a number to quote');
    // Only sdlc's second series holds two scores: no other plugin is said to have moved.
    expect(t.match(/within the series/g)).toHaveLength(1);
  });

  it('tells a member nothing the page withholds, and says why', () => {
    const t = text(MEMBER);
    for (const key of [...KEYS, ...MEASURES, ...PATTERNS]) expect(t).not.toContain(key);
    expect(t).toContain('Protocol v2');
    expect(t).toContain('a member reads the version, and a finding by its kind, plugin and owner category');
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('stays inside the budget on a busy platform, the findings waiting going first and their count kept', () => {
    const LONG = 'a-plugin-with-a-name-nobody-planned-for-because-it-came-from-a-ticket-title';
    const [run] = data(ADMIN.plugins);
    const [h] = data(ADMIN.history);
    const [f] = data(ADMIN.waiting).rows;
    const busy: Evaluation = {
      ...ADMIN,
      tiles: { ...ADMIN.tiles, waiting: 300 },
      plugins: { state: 'ok', data: Array.from({ length: 40 }, (_, i) => ({ ...run, plugin: `${LONG}-${i}` })) },
      history: { state: 'ok', data: Array.from({ length: 40 }, (_, i) => ({ ...h, plugin: `${LONG}-${i}` })) },
      waiting: { state: 'ok', data: { total: 300, rows: Array.from({ length: 300 }, (_, i) => ({ ...f, id: `f${i}`, pattern: 'word '.repeat(80) })) } },
    };
    for (const e of [busy, { ...busy, meta: { ...busy.meta, scope: 'platform-public' as const } }]) {
      const t = text(e);
      expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(t).toContain('- Findings waiting: 300');
      expect(t).not.toContain('Findings waiting, oldest first');
      expect(t).toContain(`${LONG}-0: latest`);
      expect(t).toContain('More is on the page than fits here; /platform/evaluation shows all of it.');
    }
  });

  it('says which parts could not be read, and that nothing was read when nothing was', () => {
    expect(text({ ...ADMIN, history: { state: 'unavailable', reason: 'failed' } })).toContain('Every score by series could not be read (failed).');
    const slow = contextText(evaluationContext({ state: 'slow' }));
    expect(slow).toContain('Evaluation is unavailable');
    expect(slow).not.toContain('Facts:');
  });
});

describe('view_evaluation and explore_evaluation', () => {
  it('answers the same response its page reads, with the page\'s context', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    const { context, data: answered } = await evaluationTool.read({});
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/evaluation');
    expect(answered).toBe(ADMIN);
    expect(context).toEqual(evaluationContext(ok(ADMIN)));
    expect(evaluationTool.name).toBe('evaluation');
    expect(evaluationTool.page).toBe('/platform/evaluation');
    expect(evaluationTool.needs).toBe(FEATURES.evaluation.needs);
    expect(evaluationTool.input.safeParse({}).success).toBe(true);
    expect(Object.keys(evaluationTool.input.shape)).toEqual([]);
  });

  it('declares the findings and the scores, and drills to nothing a member may not read', () => {
    const { sources } = evaluationTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ findings: 'findings', scores: 'scores' });
    expect(sources.findings.facets).toEqual(['decision', 'owner', 'plugin']);
    expect(sources.findings.filters.owner.values).toEqual(['plugin', 'dependency', 'platform', 'environment', 'user_input', 'unknown']);
    for (const s of Object.values(sources)) {
      expect(s.drill.columns).not.toContain('pattern');
      expect(s.drill.columns).not.toContain('measure');
      expect(s.drill.columns).not.toContain('protocol');
    }
  });
});

describe('the read on the server', () => {
  it('asks the gateway for the evaluation and hands the whole of it on', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    expect(await readEvaluation()).toEqual({ state: 'ok', evaluation: ADMIN });
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/evaluation');
  });

  it('is failed with the gateway\'s sentence when it refuses, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new Error('could not read the evaluation'));
    expect(await readEvaluation()).toEqual({ state: 'failed', reason: 'could not read the evaluation' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const read = readEvaluation();
    let settled: EvaluationRead | null = null;
    void read.then((r) => { settled = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(EVALUATION_BOUND_MS - 1); });
    expect(settled).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(await read).toEqual({ state: 'slow' });
  });
});
