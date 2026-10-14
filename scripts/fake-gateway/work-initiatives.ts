/**
 * The fake gateway's initiatives list, and its close: what `GET /api/console/initiatives?state&flow&q&limit&offset` and
 * `POST /api/console/initiatives/:team/:slug/close` answer.
 *
 * One fixture, the work fixture's initiatives (`INITIATIVES` in work.ts) read as the list's rows: each with its flow
 * position as zz-core's `next_move` would say it, its state, the gates passed of the flow's gated documents, when it was
 * last touched, opened and closed. Work is the active team's, for the superadmin too, so a request is answered the
 * caller's active team and nothing else: `?team=` and `?scope=platform` widen nothing, and no row names a team. The
 * filters and the page are the server's, with the total and the summary over the whole filtered population.
 *
 * Atlas, which both people act for, holds more than ten initiatives so the list pages, every state the list draws
 * (waiting, open, quiet) and every outcome, two of them closed last week. The weeks are the status fixture's, so the
 * closures by week line up with every other weekly figure.
 *
 * The close is answered as the platform's `initiative_close` decides it, and forgotten, so every run starts from the
 * same data: the outcome is derived from the facts the body submits, never taken from it, and what the route refuses is
 * refused here with the same status.
 *
 * COUPLED: zz-stack's `checks/console-work-initiatives.ts` and `checks/console-close.ts` import this file with plain
 * `node` and compare its key sets with the real routes' answers. So nothing here is imported through the console's
 * path alias.
 */
import type { Initiative, Me } from '../../src/lib/api-shapes.ts';
import type { Figure, PeriodFigure, ReadMeta, Window } from '../../src/lib/platform-shapes.ts';
import type { CloseInput, CloseResult, InitiativeList, InitiativeRow, NextMove } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { INITIATIVES, initiativeDetail } from './work.ts';

type Answer = [status: number, body: unknown];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The status fixture's weeks, oldest first, the running one last: every weekly figure of Work is drawn on them. */
export const WEEKS: Window[] = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.weeks.map((w) => w.window);
/** The last whole week, which Home is about. */
export const LAST_WEEK = WEEKS.length - 2;
const RUNNING = Date.parse(WEEKS.at(-1)!.from);
/** An instant `hours` into the week `back` weeks before the running one; in the running week, halfway to now. */
export const inWeek = (back: number, hours: number) => (back === 0 ? RUNNING + (now() - RUNNING) / 2 : RUNNING - back * 7 * DAY + hours * HOUR);

/** A count in one week, which stands at any size: a zero is a week that was read and held none. */
export const tally = (i: number, n: number): PeriodFigure => ({ window: WEEKS[i], figure: { value: n, why: null }, numerator: n, denominator: null });
export const counted = (n: number): Figure => ({ value: n, why: null });

/** One read's cutoff and scope, for the caller's active team. */
export function workMeta(scope: ReadMeta['scope'], population: string): ReadMeta {
  const asOf = iso(now());
  return { ...PLATFORM_STATUS.meta, asOf, period: { from: WEEKS[0].from, to: asOf }, scope, population };
}

/** When atlas's work was opened and closed, as `[weeks back, hours into that week]`, so its closures fall in the weeks
 *  the pages draw and two of them in the last whole week. Every other team's are read off its last touch. */
const WHEN: Record<string, { opened: [number, number]; closed?: [number, number] }> = {
  '2026-09-28-search-relevance': { opened: [2, 30] },
  '2026-10-02-query-latency': { opened: [1, 20] },
  '2026-10-03-ranking-weights': { opened: [1, 44] },
  '2026-10-04-index-rebuild': { opened: [4, 70] },
  '2026-09-12-onboarding-revamp': { opened: [4, 10], closed: [1, 50] },
  '2026-09-05-research-notes': { opened: [6, 30] },
  '2026-10-08-result-explanations': { opened: [3, 12] },
  '2026-10-06-snippet-quality': { opened: [1, 100] },
  '2026-09-15-tagging-model': { opened: [5, 60] },
  '2026-08-25-eval-harness': { opened: [6, 10], closed: [3, 40] },
  '2026-08-14-citation-graph': { opened: [7, 20], closed: [4, 80] },
  '2026-08-02-ingest-pipeline': { opened: [3, 2], closed: [1, 90] },
};

/** Quiet: open, and nothing of it written for 14 days or more. */
const QUIET_AFTER = 14 * DAY;

/** A gate's document, by the gate's name: `approve plan` is plan.md's. */
const documentOf = (gate: string) => `${gate.replace(/^approve /, '')}.md`;

/** Where it goes next, as `initiative_status` would say it. */
function nextMoveOf(i: Initiative): NextMove {
  const own = i.gates.filter((g) => g.role !== 'handover');
  const waiting = own.find((g) => g.written && !g.passed);
  if (i.closed) {
    return i.correction
      ? { action: 'approve', stage: i.stage || null, document: i.correction.path, waitingOn: 'a person', why: `${i.correction.path} was corrected after the close and waits on approval again` }
      : { action: 'none', stage: null, document: null, waitingOn: null, why: `closed as ${i.outcome}` };
  }
  if (!i.flow) return { action: 'write', stage: null, document: null, waitingOn: 'the agent', why: 'no flow is declared, so nothing says what comes next' };
  if (waiting) return { action: 'approve', stage: i.stage || null, document: documentOf(waiting.name), waitingOn: 'a person', why: `${documentOf(waiting.name)} is written and waits on approval` };
  if (own.length && own.every((g) => g.passed)) return { action: 'close', stage: i.stage || null, document: 'review.md', waitingOn: 'a person', why: 'every gate is approved and no outcome is recorded' };
  const step = i.steps.find((s) => s.current);
  return { action: 'write', stage: step?.name ?? (i.stage || null), document: step?.produces || null, waitingOn: 'the agent', why: `the ${step?.name ?? i.stage} stage is under way` };
}

/** One initiative as the list reads it. */
function rowOf(i: Initiative): InitiativeRow {
  const when = WHEN[i.slug];
  const touched = Date.parse(i.updated);
  const closedAt = !i.closed ? null : when?.closed ? inWeek(...when.closed) : touched;
  const lastTouched = Math.max(touched, closedAt ?? 0);
  const own = i.gates.filter((g) => g.role !== 'handover');
  const waiting = own.some((g) => g.written && !g.passed);
  const state: InitiativeRow['state'] = i.closed ? (i.outcome as InitiativeRow['state'])
    : waiting ? 'waiting' : now() - lastTouched >= QUIET_AFTER ? 'quiet' : 'open';
  return {
    slug: i.slug, flow: i.flow, nextMove: nextMoveOf(i), state,
    gates: { passed: own.filter((g) => g.passed).length, of: own.length },
    lastTouched: iso(lastTouched),
    opened: iso(when ? inWeek(...when.opened) : touched - (3 + i.at) * DAY),
    closed: closedAt === null ? null : iso(closedAt),
  };
}

/** Waiting first, then the most recently touched, the slug breaking a tie. */
const ORDER = (a: InitiativeRow, b: InitiativeRow) =>
  Number(b.state === 'waiting') - Number(a.state === 'waiting') || b.lastTouched.localeCompare(a.lastTouched) || a.slug.localeCompare(b.slug);

/** Every initiative of `team`, as the list reads it, in the list's order. */
export const rowsOf = (team: string | null): InitiativeRow[] => INITIATIVES.filter((i) => i.team === team).map(rowOf).sort(ORDER);

const STATES: InitiativeRow['state'][] = ['open', 'waiting', 'quiet', 'accepted', 'delivered', 'abandoned'];
const OUTCOMES = ['accepted', 'delivered', 'abandoned'] as const;
const within = (at: string | null, w: Window) => at !== null && at >= w.from && at < w.to;

/** Closures by week and outcome, over `rows`. */
export const closuresOf = (rows: InitiativeRow[]) => WEEKS.map((window) => ({
  window, ...Object.fromEntries(OUTCOMES.map((o) => [o, counted(rows.filter((r) => r.state === o && within(r.closed, window)).length)])) as Record<(typeof OUTCOMES)[number], Figure>,
}));

/** The filters a list read takes, once each; the refusal's sentence for a filter or a page the route does not take. */
export function listParams(q: URLSearchParams): { state: string | null; flow: string | null; q: string; limit: number; offset: number } | string {
  for (const name of ['state', 'flow', 'q', 'limit', 'offset']) if (q.getAll(name).length > 1) return 'each filter and the page are given at most once';
  const state = q.get('state');
  if (state !== null && !STATES.includes(state as InitiativeRow['state'])) return `state must be one of ${STATES.join(', ')}`;
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return 'limit must be a whole number from 1 to 100, and offset one from 0';
  return { state, flow: q.get('flow'), q: (q.get('q') ?? '').trim().toLowerCase(), limit, offset };
}

/** The rows `p` names, of `team`: a state, a flow by its exact name, and text in the slug. */
export const filtered = (team: string | null, p: { state: string | null; flow: string | null; q: string }) => rowsOf(team)
  .filter((r) => (p.state === null || r.state === p.state) && (p.flow === null || r.flow === p.flow) && (!p.q || r.slug.includes(p.q)));

/** `GET /initiatives`, as `who`: the active team's, filtered and paged; 400 for a filter or a page it does not take. */
export function initiativeList(who: Me, q: URLSearchParams): Answer {
  const p = listParams(q);
  if (typeof p === 'string') return [400, { error: p }];
  const team = who.activeTeam;
  const all = rowsOf(team);
  const rows = filtered(team, p);
  const flows = [...new Set(rows.map((r) => r.flow))];
  const previous = WEEKS[LAST_WEEK];
  const answer: InitiativeList = {
    meta: workMeta('active-team', `${team}'s initiatives, its knowledge shelf's own left out`),
    tiles: {
      open: all.filter((r) => !OUTCOMES.includes(r.state as (typeof OUTCOMES)[number])).length,
      waiting: all.filter((r) => r.state === 'waiting').length,
      closed: Object.fromEntries(OUTCOMES.map((o) => [o, all.filter((r) => r.state === o).length])) as InitiativeList['tiles']['closed'],
    },
    closures: { state: 'ok', data: closuresOf(all) },
    rows: rows.slice(p.offset, p.offset + p.limit).map((r) => ({ ...r })),
    total: rows.length,
    summary: { state: 'ok', data: {
      total: rows.length,
      byState: Object.fromEntries(STATES.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<InitiativeRow['state'], number>,
      byFlow: flows.map((flow) => ({ flow, count: rows.filter((r) => r.flow === flow).length })).sort((a, b) => b.count - a.count || String(a.flow).localeCompare(String(b.flow))),
      touched: WEEKS.map((w, i) => tally(i, rows.filter((r) => within(r.lastTouched, w)).length)),
      previous: { window: previous, total: rows.filter((r) => r.opened < previous.to).length },
    } },
    nextMoveState: 'ok',
  };
  return [200, answer];
}

/** The fields a close may not carry: the platform records them. */
const RECORDED = ['outcome', 'closed_by'];

/**
 * `POST /initiatives/:team/:slug/close`, as `who`, with the facts in `body`.
 *
 * As the route answers it: 404 for any team but the active one, before anything is read; 400 for a body naming what
 * the platform records, for a disposition outside the two, and for zz-core's own refusals (both sign-off fields, a gate
 * not approved, a freeform close with no document); 409 for an initiative already closed. Otherwise the outcome
 * `initiative_close` derives: finished with no sign-off field is accepted by the closer, finished with a reason for no
 * sign-off is delivered, and abandoned is abandoned.
 */
export function close(who: Me, team: string, slug: string, body: Record<string, unknown>): Answer {
  const i = team === who.activeTeam ? INITIATIVES.find((x) => x.team === team && x.slug === slug) : undefined;
  if (!i) return [404, { error: `initiative ${team}/${slug} does not exist on this deployment` }];
  const named = RECORDED.filter((k) => k in body);
  if (named.length) return [400, { error: `${named.join(' and ')} ${named.length === 1 ? 'is' : 'are'} the platform's to record: send the disposition and the sign-off, and it derives the outcome` }];
  // The facts `CloseInput` names, each still to be checked: a body is whatever the client sent.
  const { disposition, accepted_by: acceptor, no_signoff_reason: reason, document } = body as { [K in keyof CloseInput]?: unknown };
  if (disposition !== 'finished' && disposition !== 'abandoned') return [400, { error: 'disposition must be finished or abandoned' }];
  for (const [name, v] of [['accepted_by', acceptor], ['no_signoff_reason', reason], ['document', document]] as const) {
    if (v !== undefined && (typeof v !== 'string' || !v.trim())) return [400, { error: `ERROR: ${name} must be a non-empty string when given.` }];
  }
  if (acceptor !== undefined && reason !== undefined) return [400, { error: 'ERROR: accepted_by and no_signoff_reason are exclusive: name who accepted it, or say why nobody signed off.' }];
  if (i.closed) return [409, { conflict: 'closed', error: `${slug} is already closed as ${i.outcome}. The first decision stands.` }];
  // The documents a close may land on: a flow's own, never a source, and never the handover written after it.
  const docs = initiativeDetail(team, slug)!.documents.filter((d) => !d.path.startsWith('sources/') && d.type !== 'handover').map((d) => d.path);
  if (typeof document === 'string' && !docs.includes(document)) return [400, { error: `ERROR: ${document} is not a document of ${slug}.` }];
  const result = (outcome: CloseResult['outcome'], closing: string | null): Answer => [200, { outcome, closedBy: who.email, document: closing } satisfies CloseResult];
  if (disposition === 'abandoned') return result('abandoned', (document as string | undefined) ?? docs.at(-1) ?? null);
  const unpassed = i.gates.filter((g) => g.role !== 'handover' && !g.passed).map((g) => g.name);
  if (unpassed.length) return [400, { error: `ERROR: ${slug} cannot be closed as finished: ${unpassed.join(', ')} ${unpassed.length === 1 ? 'is' : 'are'} not approved.` }];
  const closing = i.flow ? 'review.md' : (document as string | undefined) ?? null;
  if (!closing) return [400, { error: `ERROR: ${slug} declares no flow, so a finished close names the document it lands on.` }];
  return result(reason === undefined ? 'accepted' : 'delivered', closing);
}
