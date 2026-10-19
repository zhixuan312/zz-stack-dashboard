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
 * Its closures, initiatives and approvals are read off the initiatives list and the approvals fixture, its words off
 * Home's additions, its runs off Runs', and its lessons and searches off Knowledge's, so every Work page reads the same
 * team; the firsts, the bests and the medians are read from the same series its charts draw, as the gateway's are. A
 * document's revisions, the most rewritten, the most a document was given and a typical piece of work's, are its
 * snapshots in the work fixture, the ones its own page's content history lists, so Record and the document agree. The
 * team's first record is when its first initiative opened, and a weekly period is cut Monday to Monday, as Home's weeks
 * are. The coverage carries the import-made documents and the gaps Home's does.
 *
 * COUPLED: zz-stack's `checks/console-work-record.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { Figure, PeriodFigure, Window } from '../../src/lib/platform-shapes.ts';
import type { RecordRead } from '../../src/lib/work-shapes.ts';
import { nextStart, now, startOf } from './clock.ts';
import { approvedMs, callerApprovalRows, firstApproval } from './work-approvals.ts';
import { ADDITIONS, COVERAGE, estimateOf, wordsIn } from './work-home.ts';
import { counted, iso, rowsOf, workMeta } from './work-initiatives.ts';
import { lessonsCiting, lessonsMade, searchesOf, SHELF } from './work-knowledge.ts';
import { median as middle, observedRuns, runsOf } from './work-runs.ts';
import { documentDetail, initiativeDetail } from './work.ts';

type Answer = [status: number, body: unknown];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const PERIODS = ['quarter', 'year', 'all'] as const;
type Period = (typeof PERIODS)[number];
type Firsts = Extract<RecordRead['firsts'], { state: 'ok' }>['data'];
type Best = Firsts['bests'][number];
type FirstKey = Firsts['firsts'][number]['key'];

/** The words retained as of the cutoff, eligible ones only: the same answer in every period, and less than the words
 *  ever added, since a later revision removes some of what an earlier one wrote. */
const RETAINED = 49_800;

/** When `team`'s first initiative opened, its first record; null with none. */
function firstRecordOf(team: string | null): number | null {
  const opened = rowsOf(team).map((r) => Date.parse(r.opened));
  return opened.length ? Math.min(...opened) : null;
}

/** Where `period` starts: the quarter's first day, 1 January, or the team's first record. */
function periodStart(period: Period, first: number | null): number {
  if (period === 'quarter' || period === 'year') return startOf(now(), period);
  return first ?? now();
}

/** A period `[pFrom, pTo)` of the window `[from, now)`, observed over its part inside the window and before the cutoff,
 *  complete when it lies wholly inside and has ended (`windowOf` in the gateway). */
const windowOf = (pFrom: number, pTo: number, from: number): Window => ({
  from: iso(pFrom), to: iso(pTo), observedFrom: iso(Math.max(pFrom, from)), observedThrough: iso(Math.min(pTo, now())),
  complete: pFrom >= from && pTo <= now(),
});

/** The periods of `[from, now)` at `grain`, oldest first: the first holds `from`, cut on the calendar, so a week runs
 *  Monday to Monday. None when the window holds nothing. */
function periodsOf(from: number, grain: 'week' | 'month'): { fromMs: number; toMs: number; window: Window }[] {
  const out: { fromMs: number; toMs: number; window: Window }[] = [];
  for (let at = startOf(from, grain); at < now();) {
    const to = nextStart(at, grain);
    out.push({ fromMs: at, toMs: to, window: windowOf(at, to, from) });
    at = to;
  }
  return out;
}

const count = (window: Window, n: number): PeriodFigure => ({ window, figure: counted(n), numerator: n, denominator: null });
/** A team's own median stands at any count, drawn beside it: the gateway never marks it insufficient. */
const median = (window: Window, hours: number[]): PeriodFigure =>
  ({ window, figure: hours.length ? { value: middle(hours)!, why: null } : { value: null, why: 'no_data' }, numerator: null, denominator: hours.length });
const spread = (m: number, largest: number): { median: Figure; largest: Figure } => ({ median: counted(m), largest: counted(largest) });
const spreadOf = (xs: number[]) => (xs.length ? spread(middle(xs)!, Math.max(...xs)) : { median: { value: null, why: 'no_data' } as Figure, largest: { value: null, why: 'no_data' } as Figure });
/** The kinds and counts of `keys`, the most first, then by name. */
/** Most rewritten documents the gateway answers: the five given the most revisions, each given two or more. */
const MOST_REWRITTEN = 5;
const tallyOf = (keys: string[]) => [...keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** The most initiatives of `rows` open at one moment in `[from, end)`, and the first moment it was reached; a close and
 *  an open at the same instant are not open together (`mostOpenAtOnce` in the gateway). */
function mostOpen(rows: ReturnType<typeof rowsOf>, from: number, end: number): { value: Figure; at: string | null } {
  const changes = rows.filter((r) => Date.parse(r.opened) < end && (r.closed === null || Date.parse(r.closed) > from)).flatMap((r) => [
    { at: Math.max(Date.parse(r.opened), from), by: 1 },
    ...(r.closed !== null && Date.parse(r.closed) < end ? [{ at: Date.parse(r.closed), by: -1 }] : []),
  ]).sort((a, b) => a.at - b.at || a.by - b.by);
  let open = 0, most = 0, at: number | null = null;
  for (const c of changes) {
    open += c.by;
    if (open > most) { most = open; at = c.at; }
  }
  return { value: counted(most), at: at === null ? null : iso(at) };
}

/** The record of `team` over `period`, the caller's approvals those signed in `email`'s name; its table paged. */
function recordOf(team: string | null, email: string, period: Period, page: { limit: number; offset: number }): RecordRead {
  const first = firstRecordOf(team);
  const start = periodStart(period, first);
  const end = now();
  // Runs, searches and lessons are counted from here: the later of the period's start and the team's first record.
  const begins = first === null ? end : Math.max(start, first);
  const asOf = iso(end);
  const grain = end - start <= 26 * WEEK ? 'week' : 'month';
  const periods = periodsOf(start, grain);
  const whole: Window = { from: iso(start), to: asOf, observedFrom: iso(begins), observedThrough: asOf, complete: false };
  const inPeriod = (at: string | null) => at !== null && at >= whole.from && at < asOf;
  const all = rowsOf(team);
  const closed = all.filter((r) => inPeriod(r.closed));
  const tookOf = (rs: typeof all) => rs.map((r) => (Date.parse(r.closed!) - Date.parse(r.opened)) / HOUR);
  const closedIn = (p: (typeof periods)[number]) => closed.filter((r) => Date.parse(r.closed!) >= p.fromMs && Date.parse(r.closed!) < p.toMs);
  const outcome = (o: string) => counted(closed.filter((r) => r.state === o).length);
  const outcomeIn = (p: (typeof periods)[number], o: string) => counted(closedIn(p).filter((r) => r.state === o).length);
  const approvals = callerApprovalRows(team, email).filter((a) => approvedMs(a) >= start);
  const byOpened = [...all].sort((a, b) => b.opened.localeCompare(a.opened) || a.slug.localeCompare(b.slug));
  const flows = [...new Set(all.map((r) => r.flow))];
  const docsOf = (slug: string) => initiativeDetail(team ?? '', slug)?.documents.filter((d) => !d.path.startsWith('sources/')) ?? [];
  const documentsOf = (slug: string) => docsOf(slug).length;
  // Each flow document's revisions, as its own page's content history counts them: every snapshot, an approval's included.
  const revised = all.flatMap((r) => docsOf(r.slug).map((d) => ({ initiative: r.slug, path: d.path, versions: documentDetail(team ?? '', r.slug, d.path)?.current_revision ?? 0 })));
  const revisionsOf = (slug: string) => revised.filter((d) => d.initiative === slug).reduce((n, d) => n + d.versions, 0);
  const mostRewritten = revised.filter((d) => d.versions >= 2)
    .sort((a, b) => b.versions - a.versions || a.initiative.localeCompare(b.initiative) || a.path.localeCompare(b.path)).slice(0, MOST_REWRITTEN);

  // The words: each period's additions, their running total, and the most in a whole week of the window.
  const words = periods.map((p) => wordsIn(Math.max(p.fromMs, start), Math.min(p.toMs, end)));
  let total = 0;
  const cumulative = periods.map((p, i) => count(p.window, (total += words[i] ?? 0)));
  const bestWeek = periodsOf(start, 'week').filter((w) => w.window.complete)
    .reduce<{ words: number; at: string } | null>((b, w) => { const n = wordsIn(w.fromMs, w.toMs) ?? 0; return n > 0 && n > (b?.words ?? 0) ? { words: n, at: w.window.from } : b; }, null);
  const open = mostOpen(all, start, end);

  // The lessons made outside an import, the standing ones by kind, and the searches, all of the team's own.
  const made = team ? lessonsMade(team).map((n) => Date.parse(n.updated)) : [];
  const searches = team ? searchesOf(team).filter((x) => Date.parse(x.at) >= begins && Date.parse(x.at) < end) : [];
  const agents = team ? observedRuns(team, begins, end) : null;

  // The whole record's firsts, the earliest first, one not yet reached left out.
  const firstWords = Math.min(...ADDITIONS.map((a) => a.atMs).filter((ms) => ms < end), ...made);
  const firstRun = team ? runsOf(team).reduce<string | null>((a, r) => (!a || r.startedAt < a ? r.startedAt : a), null) : null;
  const firstClosed = all.flatMap((r) => (r.closed ? [r.closed] : [])).sort()[0] ?? null;
  const firstApproved = firstApproval(team);
  const firsts = ([
    ['closed', firstClosed && Date.parse(firstClosed)], ['approved', firstApproved], ['lesson', made.length ? Math.min(...made) : null],
    ['run', firstRun && Date.parse(firstRun)], ['words_week', Number.isFinite(firstWords) ? startOf(firstWords, 'week') : null],
  ] as [FirstKey, number | null][])
    .filter((f): f is [FirstKey, number] => f[1] !== null).sort((a, b) => a[1] - b[1]).map(([key, ms]) => ({ key, at: iso(ms) }));
  // A best set before the window began is not the window's, and is left out.
  const within = (b: Best | null): b is Best => b !== null && b.at >= whole.from;
  const lastTouched = all.find((r) => r.slug === '2026-09-28-search-relevance')?.lastTouched ?? asOf;

  return {
    meta: {
      ...workMeta('caller-in-active-team', `${team}'s team history, and the approvals signed in the caller's name there`),
      period: { from: whole.from, to: asOf }, coverageFrom: first === null ? null : iso(first),
    },
    period,
    lead: { estimate: estimateOf('retained_stock', RETAINED), asOf },
    cumulative,
    foot: {
      closed: counted(closed.length), opened: counted(all.filter((r) => inPeriod(r.opened)).length),
      documents: counted(COVERAGE.documents), versions: counted(COVERAGE.revisions), approvalsInYourName: counted(approvals.length),
    },
    work: { state: 'ok', data: {
      closedByOutcome: { accepted: outcome('accepted'), delivered: outcome('delivered'), abandoned: outcome('abandoned') },
      mostOpenAtOnce: open,
      medianHoursToClose: median(whole, tookOf(closed)),
      medianHoursToAbandon: median(whole, tookOf(closed.filter((r) => r.state === 'abandoned'))),
      closuresInAll: periods.map((p) => count(p.window, all.filter((r) => r.closed !== null && Date.parse(r.closed) < Math.min(p.toMs, end)).length)),
      closuresByWeek: periods.map((p) => ({ window: p.window, accepted: outcomeIn(p, 'accepted'), delivered: outcomeIn(p, 'delivered'), abandoned: outcomeIn(p, 'abandoned') })),
      medianHoursByWeek: periods.map((p) => median(p.window, tookOf(closedIn(p)))),
      typical: { documents: spreadOf(closed.map((r) => documentsOf(r.slug))), versions: spreadOf(closed.map((r) => revisionsOf(r.slug))), sources: spread(4, 13), words: spread(3_400, 7_900) },
    } },
    documents: { state: 'ok', data: {
      flowDocuments: counted(COVERAGE.documents), versions: counted(COVERAGE.revisions), sourcesUnderGated: spread(3, 13), citations: counted(57),
      wordsByWeek: periods.map((p, i) => (words[i] === null
        ? { window: p.window, figure: { value: null, why: 'no_data' }, numerator: null, denominator: null }
        : count(p.window, words[i]!))),
      mostRewritten,
      coverage: COVERAGE,
    } },
    knowledge: { state: 'ok', data: {
      adopted: counted(made.filter((ms) => ms >= begins && ms < end).length),
      adoptedInAll: periods.map((p) => count(p.window, made.filter((ms) => ms < Math.min(p.toMs, end)).length)),
      ownReturned: counted(118), meanResults: counted(4.6), sharedResults: counted(37),
      searchesWithResults: periods.map((p) => {
        const here = searches.filter((x) => Date.parse(x.at) >= p.fromMs && Date.parse(x.at) < p.toMs);
        const found = here.filter((x) => x.found).length;
        return { window: p.window, figure: here.length ? { value: (100 * found) / here.length, why: null } : { value: null, why: 'no_data' }, numerator: found, denominator: here.length };
      }),
      returnedByKind: [{ kind: 'document', results: 212 }, { kind: 'lesson', results: 118 }, { kind: 'source', results: 64 }],
      byKind: tallyOf(SHELF.filter((n) => n.team === team && n.status === 'adopted').map((n) => n.type)).map(([kind, lessons]) => ({ kind, lessons })),
    } },
    agents: { state: 'ok', data: {
      coverageMs: counted(agents?.coverageMs ?? 0), summedMs: counted(agents?.summedMs ?? 0), peak: counted(agents?.peak ?? 0), runs: counted(agents?.runs ?? 0),
      zeroLength: agents?.zeroLength ?? 0, skillsUsed: counted(agents?.bySkill.length ?? 0),
      weekdayHour: agents?.weekdayHour ?? Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
      days: agents?.days ?? [],
      bySkill: agents?.bySkill ?? [],
    } },
    firsts: { state: 'ok', data: {
      bests: [
        mostRewritten[0] ? ({ key: 'most_versions', value: mostRewritten[0].versions, at: lastTouched, subject: `${mostRewritten[0].initiative}/${mostRewritten[0].path}` } as Best) : null,
        { key: 'most_sources', value: 13, at: iso(Date.parse(lastTouched) - 2 * DAY), subject: '2026-09-28-search-relevance/spec.md' } as Best,
        bestWeek && ({ key: 'most_words_week', value: bestWeek.words, at: bestWeek.at, subject: null } as Best),
        open.at !== null && open.value.value !== null ? ({ key: 'most_open', value: open.value.value, at: open.at, subject: null } as Best) : null,
      ].filter(within),
      firsts,
    } },
    record: { state: 'ok', data: {
      rows: byOpened.slice(page.offset, page.offset + page.limit).map((r) => ({
        slug: r.slug, outcome: r.closed === null ? null : r.state, opened: r.opened, closed: r.closed,
        tookHours: r.closed === null ? null : (Date.parse(r.closed) - Date.parse(r.opened)) / HOUR,
        documents: documentsOf(r.slug),
        lessons: lessonsCiting(r.slug),
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
