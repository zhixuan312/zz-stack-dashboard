/**
 * The fake gateway's other worlds: the same routes answered as a fresh deployment (`empty`) and as a busy one
 * (`extreme`). Each takes the normal answer and reshapes it, so a new route falls through unchanged rather than
 * breaking a mode nobody updated.
 */
import type {
  KnowledgeLogEntry, PlatformPersonRow, PluginRow, Skill,
} from '../../src/lib/api-shapes.ts';
import type { Access, ActivityLog, ActivitySummary, KnowledgeList, KnowledgeSummary, RefusalOwner, Runs } from '../../src/lib/destination-shapes.ts';
import type { Audit, KnowledgeHealth, People, Teams } from '../../src/lib/fleet-shapes.ts';
import type { Bugs, Evaluation, Part, PeriodFigure, PlatformStatus } from '../../src/lib/platform-shapes.ts';
import type { Approvals, Home, InitiativeList } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { LONG, aboveCeilings, big } from './states-extreme.ts';
import { freshDetail, noWriting } from './states-partial.ts';

/**
 * Nothing recorded yet: every list empty, every figure absent rather than zero where the API says so. Record, Releases,
 * Usage and every detail route are states-partial.ts's `freshDetail`, each record there with nothing in it.
 */
export function empty(seg: string[], body: unknown, q: URLSearchParams = new URLSearchParams()): unknown {
  const fresh = freshDetail(seg, body, q);
  if (fresh !== undefined) return fresh;
  const [head, a, b] = seg;
  const list = (key: string) => ({ ...(body as object), [key]: [] });
  switch (head) {
    case 'teams': return { ...(body as Teams), tiles: { teams: 0, openWork: 0, pending: 0, lessons: 0 }, teams: [], total: 0 } satisfies Teams;
    case 'initiatives': return nothingListed(body as InitiativeList);
    case 'home': return noHome(body as Home);
    case 'approvals': return noApprovals(body as Approvals);
    case 'knowledge': return a === 'summary' ? noKnowledge(body as KnowledgeSummary) : a === 'log' ? list('entries')
      : { ...(body as KnowledgeList), rows: [], total: 0, summary: { byKind: {}, standing: 0, superseded: 0 } } satisfies KnowledgeList;
    case 'skills': return a ? { ...(body as object), surfaces: [], busiestTools: [] } : list('skills');
    case 'people': return noPeople(body as People);
    case 'activity': return a === 'summary' ? noActivity(body as ActivitySummary)
      : { ...(body as ActivityLog), rows: [], total: 0, kinds: [], tools: [] } satisfies ActivityLog;
    case 'runs': return noRuns(body as Runs);
    // The catalog is the platform's files, so a fresh deployment still has it: nothing scored, nothing run.
    case 'plugins': return a ? body : { plugins: (body as { plugins: PluginRow[] }).plugins.map((p): PluginRow => ({
      ...p, score: null, comparability: 'No score to compare', yourTeam: { calls: 0, failed: 0, lastRun: null },
      skills: p.skills.map((k) => ({ ...k, calls: 0, everRun: false, lastRun: null })),
    })) };
    case 'access': return a ? body : noAccess(body as Access);
    case 'settings': return Array.isArray(body) ? (a === 'platform' ? (body as PlatformPersonRow[]).slice(0, 1) : []) : body;
    case 'platform': return a === 'status' ? freshStatus(body as PlatformStatus) : a === 'bugs' && !b ? noBugs(body as Bugs)
      : a === 'evaluation' ? noEvaluation(body as Evaluation) : a === 'knowledge' && !b ? noKnowledgeHealth(body as KnowledgeHealth)
        : a === 'audit' ? noAudit(body as Audit) : body;
    default: return body;
  }
}

/** Access on a fresh deployment: no token issued, no application authorised and no passkey recorded; signed in on this
 *  browser alone, which a person is to read the page at all. */
function noAccess(x: Access): Access {
  return { ...x, issued: [], applications: [], authenticators: [], browsers: x.browsers.filter((b) => b.current) };
}

/** Bugs on a fresh deployment: no report, every week's count zero with no median, and an empty queue. */
function noBugs(x: Bugs): Bugs {
  const zero = { value: 0, why: null } as const;
  const none = { value: null, why: 'no_data' } as const;
  return {
    ...x,
    counts: { state: 'ok', data: { open: 0, resolved: 0, byImpact: { blocks_work: 0, wrong_result: 0, confusing: 0, cosmetic: 0 }, byStatus: { open: 0, fixed: 0, not_a_bug: 0, duplicate: 0 } } },
    oldestOpenAt: null, medianResolveHours: none,
    cohorts: x.cohorts.map((c) => ({ ...c, filed: zero, resolved: zero, stillOpen: zero, filedPer1000: c.filedPer1000.value === null ? c.filedPer1000 : zero, medianResolveHours: none })),
    queue: { state: 'ok', data: { rows: [], total: 0 } },
  };
}

/** Evaluation on a fresh deployment: nothing scored, no finding recorded, nothing waiting, as the gateway answers it. */
function noEvaluation(x: Evaluation): Evaluation {
  return {
    ...x,
    meta: { ...x.meta, period: { from: x.meta.asOf, to: x.meta.asOf }, coverageFrom: null },
    tiles: { waiting: 0, established: 0, lastScored: null, daysScored: 0 },
    plugins: { state: 'ok', data: [] },
    history: { state: 'ok', data: [] },
    byDecision: { state: 'ok', data: { applied: 0, rejected: 0, deferred: 0 } },
    byOwner: { state: 'ok', data: {} },
    waiting: { state: 'ok', data: { rows: [], total: 0 } },
  };
}

/** Knowledge health on a fresh deployment: no lesson on any shelf, nothing made or imported, no search recorded and no
 *  question asked; the shelves, the weeks and the kinds keep their places, each at zero or with no share. */
function noKnowledgeHealth(x: KnowledgeHealth): KnowledgeHealth {
  const ok = <T,>(p: Part<T>): T | null => (p.state === 'ok' ? p.data : null);
  const none = { value: null, why: 'no_data' } as const;
  const zero = { value: 0, why: null } as const;
  const count = (p: PeriodFigure): PeriodFigure => ({ ...p, figure: zero, numerator: 0, denominator: null });
  const share = (p: PeriodFigure): PeriodFigure => ({ ...p, figure: none, numerator: 0, denominator: 0 });
  const tiles = ok(x.tiles), shelves = ok(x.shelves), made = ok(x.made), searches = ok(x.searches), cohorts = ok(x.cohorts), byKind = ok(x.byKind);
  return {
    ...x,
    tiles: tiles ? { state: 'ok', data: {
      standing: 0,
      madeLastWeek: { last: count(tiles.madeLastWeek.last), previous: count(tiles.madeLastWeek.previous) },
      searches: { last: count(tiles.searches.last), previous: count(tiles.searches.previous) },
      noResult: { last: share(tiles.noResult.last), previous: share(tiles.noResult.previous) },
    } } : x.tiles,
    shelves: shelves ? { state: 'ok', data: { rows: shelves.rows.map((r) => ({ ...r, standing: 0, superseded: 0, imported: 0, madeLastWeek: 0, searchesLastWeek: 0, noResult: share(r.noResult) })) } } : x.shelves,
    made: made ? { state: 'ok', data: { exactFrom: null, weeks: made.weeks.map((w) => ({ ...w, made: zero, importedExact: 0, importedByDay: 0 })) } } : x.made,
    searches: searches ? { state: 'ok', data: { weeks: searches.weeks.map((w) => ({ ...w, noResult: share(w.noResult), widened: share(w.widened), meanResults: none })) } } : x.searches,
    cohorts: cohorts ? { state: 'ok', data: { rows: cohorts.rows.map((c) => ({ ...c, made: 0, supersededSince: 0, imported: 0, basis: null })) } } : x.cohorts,
    byKind: byKind ? { state: 'ok', data: byKind.map((k) => ({ ...k, standing: 0 })) } : x.byKind,
    questions: x.questions?.state === 'ok' ? { state: 'ok', data: { ...x.questions.data, rows: [], total: 0 } } : x.questions,
  };
}

/** Audit on a fresh deployment: nothing recorded, so no act, no event, and no day the record begins on. */
function noAudit(x: Audit): Audit {
  return { ...x, meta: { ...x.meta, period: { from: x.meta.asOf, to: x.meta.asOf }, coverageFrom: null }, rows: [], total: 0 };
}

/** People on a fresh deployment: nobody added, and the week before the record of sign-ins began, as the gateway says it. */
function noPeople(p: People): People {
  const week = p.tiles.signInsLastWeek;
  return {
    ...p,
    tiles: {
      people: 0, withPasskey: 0, neverSignedIn: 0,
      signInsLastWeek: { window: { ...week.window, observedFrom: null, observedThrough: null, complete: false }, figure: { value: null, why: 'no_data' }, numerator: null, denominator: null },
    },
    people: [], total: 0,
  };
}

/** Status on a fresh deployment: every check answered and found nothing, every week read and holding no data, no door's day, nothing of the team's own. */
function freshStatus(s: PlatformStatus): PlatformStatus {
  const none = (w: PeriodFigure): PeriodFigure => ({ ...w, figure: { value: null, why: 'no_data' }, numerator: null, denominator: null });
  return {
    ...s,
    needs: { state: 'complete', rows: [], total: 0, knownCount: 0, unavailableKinds: [], overflowByKind: {}, headline: /need you$/.test(s.needs.headline) ? 'Nothing needs you' : 'No known open issues' },
    measures: s.measures.map((m) => ({ ...m, weeks: m.weeks.map(none), first: null, best: null, highest: null, lowest: null, last: m.last && none(m.last), previous: m.previous && none(m.previous), judgement: m.better === 'neutral' ? 'neutral' : 'not_comparable', finding: null })),
    records: { state: 'ok', data: { daysWithWork: 0, daysUnderOnePercent: 0, longestUnderOnePercent: null } },
    doors: { state: 'ok', data: [] },
    own: s.own.state === 'ok' ? { state: 'ok', data: { malformed: s.own.data.malformed.map(none), followup: s.own.data.followup.map(none), sessions: s.own.data.sessions.map(none), bugs: { filed: 0, fixed: 0, notABug: 0, duplicate: 0, open: 0 } } } : s.own,
  };
}

/** The initiatives list of a team with no work: no row, every count zero, every week read and holding none. */
function nothingListed(l: InitiativeList): InitiativeList {
  const zero = { value: 0, why: null };
  return {
    ...l,
    tiles: { open: 0, waiting: 0, closed: { accepted: 0, delivered: 0, abandoned: 0 } },
    closures: l.closures.state === 'ok' ? { state: 'ok', data: l.closures.data.map((w) => ({ ...w, accepted: zero, delivered: zero, abandoned: zero })) } : l.closures,
    rows: [], total: 0,
    summary: l.summary.state === 'ok' ? { state: 'ok', data: {
      ...l.summary.data, total: 0, byFlow: [],
      byState: { open: 0, waiting: 0, quiet: 0, accepted: 0, delivered: 0, abandoned: 0 },
      touched: l.summary.data.touched.map((w) => ({ ...w, figure: zero, numerator: 0 })),
      previous: { ...l.summary.data.previous, total: 0 },
    } } : l.summary,
  };
}

const NONE: Record<RefusalOwner, number> = { guardrail: 0, ours: 0, theirs: 0, other: 0 };
/** A count of nothing in a week that was read and held none. */
const none = (p: PeriodFigure): PeriodFigure => ({ ...p, figure: { value: 0, why: null }, numerator: 0, denominator: p.denominator === null ? null : 0 });

/** A shelf with nothing on it, searched by nobody: every week read and holding no search. */
function noKnowledge(k: KnowledgeSummary): KnowledgeSummary {
  return {
    ...k,
    tiles: { standing: { value: 0, why: null, imported: 0 }, superseded: { value: 0, why: null }, searches: none(k.tiles.searches), noResult: none(k.tiles.noResult) },
    questions: { state: 'ok', data: { rows: [], total: 0 } },
    weeks: k.weeks.state === 'ok' ? { state: 'ok', data: k.weeks.data.map((w) => ({ ...w, figure: { value: null, why: 'no_data' }, numerator: 0, denominator: 0 })) } : k.weeks,
    newest: { state: 'ok', data: [] },
  };
}

/** A team that has made no call: every week read and holding none, nothing refused, nothing grouped. */
function noActivity(a: ActivitySummary): ActivitySummary {
  return {
    ...a,
    tiles: { calls: none(a.tiles.calls), refused: { ...none(a.tiles.refused), owners: { state: 'ok', data: NONE } }, mostRefused: { state: 'ok', data: null } },
    weeks: a.weeks.state === 'ok' ? { state: 'ok', data: a.weeks.data.map((w) => ({ ...w, calls: 0, refused: 0, owners: NONE })) } : a.weeks,
    groups: { state: 'ok', data: { rows: [], groups: 0, rest: null } },
    maintenance: { state: 'ok', data: { calls: 0, refused: 0 } },
  };
}

/** Approvals on a fresh deployment, as Home's is: nothing waits, nothing is approved in anybody's name, and no week is drawn. */
function noApprovals(a: Approvals): Approvals {
  const none = { rows: [], total: 0 };
  return {
    ...a,
    tiles: { waiting: 0, oldestWaitingSince: null, inYourName: 0, noPresentation: { count: 0, of: 0 } },
    weeks: [],
    waiting: a.waiting.state === 'ok' ? { state: 'ok', data: { ...a.waiting.data, ...none, summary: { byInitiative: [], olderThan14Days: 0 } } } : a.waiting,
    history: a.history.state === 'ok' ? { state: 'ok', data: { ...a.history.data, ...none, summary: {
      byPresentation: { console_revision_shown: 0, agent_context_covered: 0, not_recorded: 0, unknown: 0 },
      byDecisionBasis: { explicit_recorded: 0, standing_delegation_recorded: 0, unknown: 0 },
      byInitiative: [],
    } } } : a.history,
  };
}

/** A team with no week recorded: no words, no approval, nothing waiting, open, closed or running, and the fallback title. */
function noHome(h: Home): Home {
  const unrecorded = (weeks: PeriodFigure[]) => weeks.map((w) => ({ ...w, figure: { value: null, why: 'no_data' as const }, numerator: null }));
  return {
    ...h,
    title: { sentence: 'Your work at a glance', rule: 'fallback' },
    waiting: { state: 'ok', data: { count: 0, oldestSince: null, one: null } },
    words: h.words.state === 'ok' ? { state: 'ok', data: { ...h.words.data, weeks: unrecorded(h.words.data.weeks), finding: null } } : h.words,
    approvals: h.approvals.state === 'ok' ? { state: 'ok', data: { weeks: unrecorded(h.approvals.data.weeks), finding: null } } : h.approvals,
    foot: { estimate: noWriting(h.foot.estimate), coverageMs: { value: null, why: 'no_data' }, peak: { value: null, why: 'no_data' } },
    tiles: { closed: none(h.tiles.closed), medianHoursToClose: { ...h.tiles.medianHoursToClose, figure: { value: null, why: 'no_data' }, denominator: 0 }, searchesWithResults: { ...none(h.tiles.searchesWithResults), figure: { value: null, why: 'no_data' } }, agentDays: none(h.tiles.agentDays) },
    runs: { state: 'ok', data: { active: [], more: 0, lastRunAt: null } },
    openWork: { state: 'ok', data: { rows: [], quiet: 0, total: 0 } },
    closedLastWeek: { state: 'ok', data: [] },
  };
}

/** A team that has run nothing: no first run to count from, and no output measured. */
const noRuns = (r: Runs): Runs => ({
  ...r, since: null,
  tiles: { runs: { value: 0, why: null }, outputPerRun: { value: null, why: 'no_data', unmeasured: 0 }, largest: null },
  coverage: { coverageMs: 0, summedMs: 0, peak: 0, oneCall: 0 },
  bySkill: { state: 'ok', data: { rows: [] } },
  recent: { state: 'ok', data: { rows: [], total: 0 } },
});

/**
 * `n` more rows, grown from the ones already there.
 *
 * Nothing to grow from means nothing invented. An empty answer is a real state — a team with no
 * work, a platform where nothing is waiting, a log with nothing recorded — and it is one the
 * console has to draw, so a mode named for the states a page must design for cannot overwrite it.
 *
 * It is also the only correct copy: `rows[i % 0]` is `undefined`, and spreading that leaves a row
 * carrying the overrides below and none of the fields they did not name. A team with no work came
 * back as 240 initiatives of `{ slug }` alone, and the console's initiative columns dereferenced
 * `stages` — so the page died in its error boundary on a shape no deployment sends.
 */
function grown<T>(rows: T[], n: number, more: (base: T, i: number) => T): T[] {
  if (!rows.length) return rows;
  return [...rows, ...Array.from({ length: n }, (_, i) => more(rows[i % rows.length], i))];
}

/**
 * A busy platform: six-figure counts, hundreds of rows, and names longer than any layout planned for. A route with a
 * ceiling is states-extreme.ts's, past it; the rest are reshaped here.
 *
 * `own` is the one team a member is held to. However busy the platform, a member is still answered their own team,
 * so no row grown for them names another. `q` is the request's own query: a row is named by its place in the whole
 * list, `offset` included, so a second page holds other names than the first. `team` is the team the caller acts for.
 */
export function extreme(seg: string[], body: unknown, own: string | null = null, q: URLSearchParams = new URLSearchParams(), team: string | null = own ?? 'atlas'): unknown {
  const busier = aboveCeilings(seg, body, own, q, team);
  if (busier !== undefined) return busier;
  const [head, a] = seg;
  switch (head) {
    case 'knowledge': {
      if (a === 'log') {
        const entries = (body as { entries: KnowledgeLogEntry[] }).entries;
        return { entries: grown(entries, 300, (_, i): KnowledgeLogEntry => ({ ts: new Date(now() - i * 3_600_000).toISOString(), actor: 'maximiliana.fitzgerald-oyelaran@example.com', team: own ?? 'atlas', kind: 'knowledge.add', node: String(1000 + i), recorded_title: `A lesson ${LONG.replace(/-/g, ' ')} number ${i}`, superseded_by: null, node_title: null, node_status: null, path: null })) };
      }
      if (a === 'summary') {
        const k = body as KnowledgeSummary;
        return {
          ...k,
          tiles: { ...k.tiles, standing: { ...k.tiles.standing, value: big(k.tiles.standing.value ?? 0), imported: big(k.tiles.standing.imported) } },
          questions: k.questions.state === 'ok' ? { state: 'ok', data: { total: k.questions.data.total + 4_000, rows: k.questions.data.rows.map((r) => ({ ...r, asked: big(r.asked), question: `${r.question} ${LONG.replace(/-/g, ' ')}` })) } } : k.questions,
          newest: k.newest.state === 'ok' ? { state: 'ok', data: k.newest.data.map((n) => ({ ...n, title: `${n.title}, ${LONG.replace(/-/g, ' ')}` })) } : k.newest,
        } satisfies KnowledgeSummary;
      }
      return body;
    }
    case 'skills': return a ? body : { skills: (body as { skills: Skill[] }).skills.map((s) => ({ ...s, runs: big(s.runs), calls: big(s.calls), refusals: big(s.refusals), durationTotal: s.durationTotal === null ? null : s.durationTotal * 900 })) };
    case 'activity': {
      if (a === 'summary') {
        const s = body as ActivitySummary;
        return {
          ...s,
          // Each owner grown on its own and the refused total their sum, so the four still add up to it.
          weeks: s.weeks.state === 'ok' ? { state: 'ok', data: s.weeks.data.map((w) => {
            const owners = { guardrail: big(w.owners.guardrail), ours: big(w.owners.ours), theirs: big(w.owners.theirs), other: big(w.owners.other) };
            const refused = owners.guardrail + owners.ours + owners.theirs + owners.other;
            return { ...w, owners, refused, calls: big(w.calls) + refused };
          }) } : s.weeks,
          groups: s.groups.state === 'ok' ? { state: 'ok', data: { ...s.groups.data, groups: s.groups.data.groups + 640, rest: { groups: 640, count: 91_000 },
            rows: s.groups.data.rows.map((g) => ({ ...g, count: big(g.count), tool: `${g.tool}_${LONG}`, message: g.message && `${g.message}. The argument was rejected before any write: the schema the client cached predates the release that renamed it, so every call from that client fails the same way until it reconnects.` })) } } : s.groups,
        } satisfies ActivitySummary;
      }
      return body;
    }
    default: return body;
  }
}
