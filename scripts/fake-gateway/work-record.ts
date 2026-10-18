/**
 * The fake gateway's Record: what `GET /api/console/record?period=quarter|year|all&limit&offset` answers.
 *
 * One fixture, the active team's record: the retained text as of the cutoff, the same in every period and labelled as
 * of it; the period's work in its six slices; and the record of every initiative, a table paged on the server. The
 * period starts on the quarter's first day, on 1 January, or on the team's first record, and runs to the cutoff; a
 * period of up to 26 weeks answers weeks and a longer one months, as the gateway's `grainFor` chooses, and every figure by
 * period, the closures and the median hours to close among them, is cut at that grain. Approvals are the caller's own,
 * the rest the active team's, labelled team history: the fake's people joined after the team's first record. Nothing is
 * counted before that first record, in any period: a quarter or a year that begins earlier answers no run, no day and
 * no search before it, its periods still the period's own, as the gateway's slices answer; nor a lesson, which the
 * fake's team adopts from its first record on.
 *
 * Its closures, initiatives and approvals are read off the initiatives list and the approvals fixture, and its words
 * off Home's, so every Work page reads the same team. The coverage carries the import-made documents and the gaps
 * Home's does.
 *
 * COUPLED: zz-stack's `checks/console-work-record.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { Figure, PeriodFigure, Window } from '../../src/lib/platform-shapes.ts';
import type { RecordRead } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { callerApprovalRows } from './work-approvals.ts';
import { COVERAGE, estimateOf } from './work-home.ts';
import { WEEKS, counted, iso, rowsOf, workMeta } from './work-initiatives.ts';
import { initiativeDetail } from './work.ts';

type Answer = [status: number, body: unknown];

const DAY = 24 * 3_600_000;
const PERIODS = ['quarter', 'year', 'all'] as const;
type Period = (typeof PERIODS)[number];

/** The team's first record, 120 days before the server started. */
const FIRST_RECORD = Math.floor((now() - 120 * DAY) / DAY) * DAY;
/** The words retained as of the cutoff, eligible ones only: the same answer in every period. */
const RETAINED = 287_400;

/** Where `period` starts: the quarter's first day, 1 January, or the team's first record, in the read's timezone. */
function startOf(period: Period): number {
  const d = new Date(now());
  if (period === 'quarter') return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
  if (period === 'year') return Date.UTC(d.getUTCFullYear(), 0, 1);
  return FIRST_RECORD;
}

/** The periods of `[from, now)`: weeks up to 26 of them, months beyond. The running one is not complete. */
function periodsFrom(from: number): { grain: 'week' | 'month'; windows: Window[] } {
  const to = now();
  const weekly = to - from <= 26 * 7 * DAY;
  const starts: number[] = [];
  for (let at = from; at < to;) {
    starts.push(at);
    const d = new Date(at);
    at = weekly ? at + 7 * DAY : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return {
    grain: weekly ? 'week' : 'month',
    windows: starts.map((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : weekly ? s + 7 * DAY : Date.UTC(new Date(s).getUTCFullYear(), new Date(s).getUTCMonth() + 1, 1);
      const ended = end <= to;
      return { from: iso(s), to: iso(end), observedFrom: iso(s), observedThrough: iso(ended ? end : to), complete: ended };
    }),
  };
}

const count = (window: Window, n: number): PeriodFigure => ({ window, figure: counted(n), numerator: n, denominator: null });
/** A team's own median stands at any count, drawn beside it: the gateway never marks it insufficient. */
const median = (window: Window, hours: number | null, cohort: number): PeriodFigure =>
  ({ window, figure: hours === null ? { value: null, why: 'no_data' } : { value: hours, why: null }, numerator: null, denominator: cohort });
const spread = (m: number, largest: number): { median: Figure; largest: Figure } => ({ median: counted(m), largest: counted(largest) });

/** The record of `team` over `period`, the caller's approvals those signed in `email`'s name; its table paged. */
function recordOf(team: string | null, email: string, period: Period, page: { limit: number; offset: number }): RecordRead {
  const start = startOf(period);
  // Runs and searches are counted from here: the later of the period's start and the team's first record.
  const begins = Math.max(start, FIRST_RECORD);
  const asOf = iso(now());
  const { windows } = periodsFrom(start);
  // The periods that end by the first record count nothing; the rest count from the one that holds it.
  const firstCounted = windows.findIndex((w) => w.to > iso(begins));
  const whole: Window = { from: iso(start), to: asOf, observedFrom: iso(begins), observedThrough: asOf, complete: false };
  const inPeriod = (at: string | null) => at !== null && at >= whole.from && at < asOf;
  const all = rowsOf(team);
  const closed = all.filter((r) => inPeriod(r.closed));
  const closedIn = (w: Window) => closed.filter((r) => r.closed! >= w.from && r.closed! < w.to);
  const outcome = (o: string) => counted(closed.filter((r) => r.state === o).length);
  const outcomeIn = (w: Window, o: string) => counted(closedIn(w).filter((r) => r.state === o).length);
  const approvals = callerApprovalRows(team, email).filter((a) => a.approvedAt >= whole.from.slice(0, a.approvedAt.length));
  const added = windows.map((_, i) => 1_500 + ((i * 1_700) % 9_000));
  const byOpened = [...all].sort((a, b) => b.opened.localeCompare(a.opened) || a.slug.localeCompare(b.slug));
  const flows = [...new Set(all.map((r) => r.flow))];
  return {
    meta: {
      ...workMeta('caller-in-active-team', `${team}'s team history, and the approvals signed in the caller's name there`),
      period: { from: whole.from, to: asOf }, coverageFrom: iso(FIRST_RECORD),
    },
    period,
    lead: { estimate: estimateOf('retained_stock', RETAINED), asOf },
    cumulative: windows.map((w, i) => count(w, added.slice(0, i + 1).reduce((a, b) => a + b, 0))),
    foot: {
      closed: counted(closed.length), opened: counted(all.filter((r) => inPeriod(r.opened)).length),
      documents: counted(COVERAGE.documents), versions: counted(COVERAGE.revisions), approvalsInYourName: counted(approvals.length),
    },
    work: { state: 'ok', data: {
      closedByOutcome: { accepted: outcome('accepted'), delivered: outcome('delivered'), abandoned: outcome('abandoned') },
      // The day the record's `most_open` best below was set: the one figure, so the two are one day.
      mostOpenAtOnce: { value: counted(8), at: WEEKS[1].from },
      medianHoursToClose: median(whole, closed.length ? 312 : null, closed.length),
      medianHoursToAbandon: median(whole, closed.some((r) => r.state === 'abandoned') ? 96 : null, closed.filter((r) => r.state === 'abandoned').length),
      closuresInAll: windows.map((w) => count(w, all.filter((r) => r.closed !== null && r.closed < w.to).length)),
      closuresByWeek: windows.map((w) => ({ window: w, accepted: outcomeIn(w, 'accepted'), delivered: outcomeIn(w, 'delivered'), abandoned: outcomeIn(w, 'abandoned') })),
      medianHoursByWeek: windows.map((w, i) => (closedIn(w).length ? median(w, 120 + i * 30, closedIn(w).length) : median(w, null, 0))),
      typical: { documents: spread(5, 12), versions: spread(9, 31), sources: spread(4, 13), words: spread(6_800, 24_100) },
    } },
    documents: { state: 'ok', data: {
      flowDocuments: counted(COVERAGE.documents), versions: counted(COVERAGE.revisions), sourcesUnderGated: spread(3, 13), citations: counted(57),
      wordsByWeek: windows.map((w, i) => count(w, added[i])),
      mostRewritten: [
        { initiative: '2026-09-28-search-relevance', path: 'spec.md', versions: 7 },
        { initiative: '2026-09-12-onboarding-revamp', path: 'review.md', versions: 5 },
        { initiative: '2026-10-08-result-explanations', path: 'plan.md', versions: 4 },
      ],
      coverage: COVERAGE,
    } },
    knowledge: { state: 'ok', data: {
      adopted: counted(period === 'quarter' ? 2 : 6),
      adoptedInAll: windows.map((w, i) => count(w, i < firstCounted ? 0 : Math.min(6, Math.floor((i - firstCounted + 1) / 2)))),
      ownReturned: counted(118), meanResults: counted(4.6), sharedResults: counted(37),
      searchesWithResults: windows.map((w, i) => (i < firstCounted
        ? { window: w, figure: { value: null, why: 'no_data' }, numerator: 0, denominator: 0 }
        : { window: w, figure: { value: 80 + (i % 3) * 5, why: null }, numerator: 16 + (i % 3), denominator: 20 })),
      returnedByKind: [{ kind: 'document', results: 212 }, { kind: 'lesson', results: 118 }, { kind: 'source', results: 64 }],
      byKind: [{ kind: 'decision', lessons: 3 }, { kind: 'behavior', lessons: 2 }, { kind: 'process', lessons: 1 }],
    } },
    agents: { state: 'ok', data: {
      coverageMs: counted(212 * 3_600_000), summedMs: counted(301 * 3_600_000), peak: counted(6), runs: counted(418), zeroLength: 23, skillsUsed: counted(11),
      weekdayHour: Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (d < 5 && h >= 8 && h < 19 ? ((d + h) % 5) + 1 : 0))),
      days: Array.from({ length: Math.ceil((now() - begins) / DAY) }, (_, i) => ({ day: iso(begins + i * DAY).slice(0, 10), runs: (i * 7) % 6 })),
      bySkill: [{ skill: 'sdlc-plan', runs: 96 }, { skill: 'sdlc-spec', runs: 88 }, { skill: 'sdlc-review', runs: 71 }, { skill: 'sdlc-execute', runs: 64 }],
    } },
    firsts: { state: 'ok', data: {
      bests: [
        { key: 'most_versions', value: 7, at: all[0]?.lastTouched ?? asOf, subject: '2026-09-28-search-relevance/spec.md' },
        { key: 'most_sources', value: 13, at: WEEKS[2].from, subject: '2026-09-28-search-relevance/spec.md' },
        { key: 'most_words_week', value: 15_400, at: WEEKS[3].from, subject: null },
        { key: 'most_open', value: 8, at: WEEKS[1].from, subject: null },
      ],
      firsts: [
        { key: 'run', at: iso(FIRST_RECORD) }, { key: 'words_week', at: iso(FIRST_RECORD + 7 * DAY) },
        { key: 'approved', at: iso(FIRST_RECORD + 12 * DAY) }, { key: 'lesson', at: iso(FIRST_RECORD + 20 * DAY) },
        { key: 'closed', at: iso(FIRST_RECORD + 31 * DAY) },
      ],
    } },
    record: { state: 'ok', data: {
      rows: byOpened.slice(page.offset, page.offset + page.limit).map((r) => ({
        slug: r.slug, outcome: r.closed === null ? null : r.state, opened: r.opened, closed: r.closed,
        tookHours: r.closed === null ? null : Math.round((Date.parse(r.closed) - Date.parse(r.opened)) / 3_600_000),
        documents: initiativeDetail(team ?? '', r.slug)?.documents.filter((d) => !d.path.startsWith('sources/')).length ?? 0,
        lessons: r.state === 'accepted' ? 2 : r.state === 'delivered' ? 1 : 0,
      })),
      total: all.length,
      summary: {
        byOutcome: { open: all.filter((r) => r.closed === null).length, accepted: all.filter((r) => r.state === 'accepted').length,
          delivered: all.filter((r) => r.state === 'delivered').length, abandoned: all.filter((r) => r.state === 'abandoned').length },
        byFlow: flows.map((flow) => ({ flow, count: all.filter((r) => r.flow === flow).length })),
      },
    } },
  };
}

/** `GET /record`, as `who`: 400 for a period or a page the route does not take. */
export function record(who: Me, q: URLSearchParams): Answer {
  const period = q.get('period') ?? 'all';
  if (!(PERIODS as readonly string[]).includes(period)) return [400, { error: `period must be one of ${PERIODS.join(', ')}` }];
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return [400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }];
  return [200, recordOf(who.activeTeam, who.email, period as Period, { limit, offset })];
}
