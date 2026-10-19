/**
 * The fake gateway's busy platform past every ceiling (Task I-127, spec AC-2.7): the `extreme` answers of the routes
 * whose ceiling the spec or the gateway sets, each above it and in the gateway's own shape.
 *
 * A paged list is as long as a busy platform's, its total in the hundreds or thousands, and a page is the rows at the
 * request's offset: row `i` is grown from the fixture's row `i` modulo its length and named by `i`, so a second page
 * holds other rows than the first and the same page read twice holds the same ones. A list the gateway cuts to a count
 * of its own is answered full to that count with more beyond it: the five needs Status lists, the four groups of runs
 * Home draws, its five rows of open work, the ten tools Usage names, the ten questions Knowledge health names, the
 * five newest lessons and the five most rewritten documents. The audit is its ceiling, the latest 500 events.
 *
 * A series is cut at the grain the gateway's `grainFor` draws its window at: weeks up to 26 of them, months up to
 * three years, quarters beyond. The busy team's record began four and a half years ago, so Record's whole record
 * arrives in quarters and its year in months, with days in five calendar years; its closures on Initiatives, over the
 * two years its work was opened in, arrive in months.
 *
 * Home's waiting is the one state no default person reaches in the normal world: one document waiting, which the strip
 * links to directly. Nothing to grow from means nothing invented: an empty list stays empty (states.ts's `grown`).
 */
import type { PluginRow } from '../../src/lib/api-shapes.ts';
import type { ActivityLog, KnowledgeList, Runs } from '../../src/lib/destination-shapes.ts';
import type { Audit, KnowledgeHealth, People, Teams, Usage } from '../../src/lib/fleet-shapes.ts';
import type { Bugs, Evaluation, PeriodFigure, PlatformStatus, Releases, Window } from '../../src/lib/platform-shapes.ts';
import type { ActiveGroup, Approvals, Home, InitiativeList, RecordRead } from '../../src/lib/work-shapes.ts';
import { now } from './clock.ts';
import { ME } from './people.ts';
import { audit } from './platform-audit.ts';
import { bugs } from './platform-bugs.ts';
import { people } from './platform-people.ts';
import { releases } from './platform-releases.ts';
import { teams } from './platform-teams.ts';
import { activityLog } from './work-activity.ts';
import { waitingOf } from './work-approvals.ts';
import { initiativeList } from './work-initiatives.ts';
import { knowledgeList } from './work-knowledge.ts';
import { record } from './work-record.ts';
import { runs } from './work-runs.ts';

export const LONG = 'with-a-name-nobody-planned-for-because-it-came-from-a-ticket-title';
export const big = (n: number) => n * 1_000 + (n % 7) * 137;
const WORDS = LONG.replace(/-/g, ' ');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const counted = (n: number) => ({ value: n, why: null });

/* Paging */

/** `?limit&offset` as every list takes them: ten rows from the first by default. */
const pageOf = (q: URLSearchParams) => ({ limit: Number(q.get('limit') ?? 10) || 10, offset: Math.max(0, Number(q.get('offset') ?? 0) || 0) });
/** The rows of one page of a list `total` long: each grown from its template, named by its place in the whole list. */
function paged<T>(templates: T[], total: number, q: URLSearchParams, name: (row: T, i: number) => T): T[] {
  if (!templates.length) return [];
  const { limit, offset } = pageOf(q);
  return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) => name(templates[(offset + k) % templates.length], offset + k));
}
/** The same request from the first row, as many as a list answers, for the templates a later page is grown from. */
const fromTheTop = (q: URLSearchParams) => { const top = new URLSearchParams(q); top.set('offset', '0'); top.set('limit', '100'); return top; };
const acting = (team: string | null) => ({ ...ME, activeTeam: team });

/* Periods, at the gateway's grain */

type Grain = 'week' | 'month' | 'quarter';
/** Weeks up to 26 of them, months up to three years, quarters beyond: the gateway's `grainFor`. */
function grainFor(fromMs: number, toMs: number): Grain {
  if (toMs - fromMs <= 26 * WEEK) return 'week';
  const three = new Date(fromMs);
  three.setUTCFullYear(three.getUTCFullYear() + 3);
  return toMs <= three.getTime() ? 'month' : 'quarter';
}
/** The first instant of the period of `grain` holding `ms`: a Monday, the first of a month or of a quarter. */
function periodStart(ms: number, grain: Grain): number {
  const d = new Date(ms);
  if (grain === 'week') { const day = Math.floor(ms / DAY) * DAY; return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY; }
  return Date.UTC(d.getUTCFullYear(), grain === 'month' ? d.getUTCMonth() : Math.floor(d.getUTCMonth() / 3) * 3, 1);
}
const periodAfter = (ms: number, grain: Grain) => (grain === 'week' ? ms + WEEK
  : Date.UTC(new Date(ms).getUTCFullYear(), new Date(ms).getUTCMonth() + (grain === 'month' ? 1 : 3), 1));
/** The window's periods, oldest first, as the gateway's `periodsOf` cuts them: the first holds its start, the last the cutoff. */
function periodsOf(fromMs: number, toMs: number): Window[] {
  const grain = grainFor(fromMs, toMs);
  const out: Window[] = [];
  for (let p = periodStart(fromMs, grain); p < toMs; p = periodAfter(p, grain)) {
    const end = periodAfter(p, grain);
    out.push({ from: iso(p), to: iso(end), observedFrom: iso(Math.max(p, fromMs)), observedThrough: iso(Math.min(end, toMs)), complete: p >= fromMs && end <= toMs });
  }
  return out;
}
const tallied = (window: Window, n: number): PeriodFigure => ({ window, figure: counted(n), numerator: n, denominator: null });
/** A running total over the periods. */
const running = (windows: Window[], each: (i: number) => number): PeriodFigure[] => {
  let sum = 0;
  return windows.map((w, i) => tallied(w, (sum += each(i))));
};

/* Work */

/** The busy team's first record: four and a half years before the server started. */
const FIRST = Math.floor((now() - 1_650 * DAY) / DAY) * DAY;
/** More initiatives than the fixture's, in every list that counts them. */
const MORE_WORK = 3_904;
const slugAt = (i: number) => `20${22 + (i % 5)}-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}-${LONG}-${i}`;

/** The list is paged on the server: a page of names longer than any layout planned for under counts in the thousands,
 *  and the closures over the two years the team's work was opened in, by month. */
function busyInitiatives(l: InitiativeList, q: URLSearchParams, team: string | null): InitiativeList {
  if (!l.total) return l;
  const all = (initiativeList(acting(team), fromTheTop(q))[1] as InitiativeList).rows;
  const total = l.total + MORE_WORK;
  const windows = periodsOf(periodStart(now() - 730 * DAY, 'week'), now());
  return {
    ...l,
    tiles: { open: l.tiles.open + 812, waiting: l.tiles.waiting + 140, closed: { accepted: big(l.tiles.closed.accepted), delivered: big(l.tiles.closed.delivered), abandoned: big(l.tiles.closed.abandoned) } },
    closures: l.closures.state === 'ok' ? { state: 'ok', data: windows.map((window, i) => ({ window, accepted: counted(40 + (i * 7) % 30), delivered: counted(20 + (i * 5) % 20), abandoned: counted((i * 3) % 9) })) } : l.closures,
    rows: paged(all.length ? all : l.rows, total, q, (r, i) => ({ ...r, slug: slugAt(i), flow: r.flow && `${r.flow}-${LONG}` })),
    total,
    summary: l.summary.state === 'ok' ? { state: 'ok', data: { ...l.summary.data, total: l.summary.data.total + MORE_WORK, touched: windows.map((w, i) => tallied(w, 300 + (i * 41) % 500)) } } : l.summary,
  };
}

/** Record's period, from the period's start or the busy team's first record, at its grain; every series on one set of periods. */
function busyRecord(r: RecordRead, q: URLSearchParams, team: string | null): RecordRead {
  const d = new Date(now());
  const start = r.period === 'quarter' ? Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1)
    : r.period === 'year' ? Date.UTC(d.getUTCFullYear(), 0, 1) : FIRST;
  const windows = periodsOf(start, now());
  const added = (i: number) => 40_000 + (i * 17_300) % 90_000;
  const closes = (i: number) => [40 + (i * 7) % 30, 20 + (i * 5) % 20, (i * 3) % 9];
  const top = record(acting(team), fromTheTop(q))[1] as RecordRead;
  const work = r.work.state === 'ok' ? r.work.data : null;
  const docs = r.documents.state === 'ok' ? r.documents.data : null;
  const know = r.knowledge.state === 'ok' ? r.knowledge.data : null;
  const agents = r.agents.state === 'ok' ? r.agents.data : null;
  const rec = r.record.state === 'ok' ? r.record.data : null;
  const templates = top.record.state === 'ok' ? top.record.data.rows : [];
  const total = rec ? rec.total + MORE_WORK : 0;
  return {
    ...r,
    meta: { ...r.meta, period: { from: iso(start), to: r.meta.period.to }, coverageFrom: iso(FIRST) },
    cumulative: running(windows, added),
    foot: { ...r.foot, closed: counted(big(41)), opened: counted(big(44)), documents: counted(big(96)), versions: counted(big(310)) },
    work: work ? { state: 'ok', data: {
      ...work,
      closedByOutcome: { accepted: counted(big(23)), delivered: counted(big(12)), abandoned: counted(big(4)) },
      closuresInAll: running(windows, (i) => closes(i).reduce((a, b) => a + b, 0)),
      closuresByWeek: windows.map((window, i) => { const [a, b, c] = closes(i); return { window, accepted: counted(a), delivered: counted(b), abandoned: counted(c) }; }),
      medianHoursByWeek: windows.map((window, i) => ({ window, figure: counted(100 + (i * 37) % 400), numerator: null, denominator: closes(i)[0] })),
    } } : r.work,
    documents: docs ? { state: 'ok', data: {
      ...docs,
      flowDocuments: counted(big(96)), versions: counted(big(310)),
      wordsByWeek: windows.map((w, i) => tallied(w, added(i))),
      mostRewritten: Array.from({ length: 5 }, (_, i) => ({ initiative: slugAt(i), path: `${['spec', 'plan', 'review', 'explore', 'handover'][i]}.md`, versions: 412 - i * 37 })),
    } } : r.documents,
    knowledge: know ? { state: 'ok', data: {
      ...know,
      adoptedInAll: running(windows, (i) => 30 + (i * 11) % 40),
      searchesWithResults: windows.map((window, i) => ({ window, figure: counted(70 + (i % 5) * 5), numerator: 700 + (i % 5) * 50, denominator: 1_000 })),
    } } : r.knowledge,
    agents: agents ? { state: 'ok', data: {
      ...agents,
      runs: counted(big(418)),
      days: Array.from({ length: Math.ceil((now() - Math.max(start, FIRST)) / DAY) }, (_, i) => ({ day: iso(Math.max(start, FIRST) + i * DAY).slice(0, 10), runs: (i * 13) % 40 })),
    } } : r.agents,
    record: rec ? { state: 'ok', data: {
      ...rec, total,
      rows: paged(templates.length ? templates : rec.rows, total, q, (x, i) => ({ ...x, slug: slugAt(i), documents: 5 + (i % 30), lessons: i % 4 })),
      summary: { ...rec.summary, byOutcome: { open: big(1), accepted: big(2), delivered: big(1), abandoned: rec.summary.byOutcome.abandoned + 400 } },
    } } : r.record,
  };
}

/** The shelf is paged on the server: a page of titles longer than any layout planned for under a total in the thousands. */
function busyShelf(l: KnowledgeList, q: URLSearchParams, team: string | null): KnowledgeList {
  if (!l.total) return l;
  const top = knowledgeList(acting(team), fromTheTop(q))[1] as KnowledgeList;
  const total = l.total + 9_000;
  return {
    ...l, total,
    rows: paged(top.rows, total, q, (n, i) => ({ ...n, key: `${n.key}#${i}`,
      title: `When the gateway rejects an argument the client cached, reconnect before retrying, ${WORDS} (${i})`, tags: ['gateway', 'clients', 'schema-cache', 'reconnect', 'retries'] })),
    summary: { ...l.summary, standing: l.summary.standing + 9_000 },
  };
}

/** The activity log at its ceiling: the latest 500 events within the filters, ten a page, each its own event. */
function busyLog(l: ActivityLog, q: URLSearchParams, team: string | null): ActivityLog {
  if (!l.total) return l;
  const top = activityLog(acting(team), fromTheTop(q))[1] as ActivityLog;
  return { ...l, total: l.ceiling, rows: paged(top.rows, l.ceiling, q, (e, i) => ({ ...e, id: `${e.id}-${i}`, ts: iso(now() - (i + 1) * 0.2 * HOUR), tool: e.tool && `${e.tool}_${LONG}` })) };
}

/** Runs on a busy team: counts in the thousands, skills with long names, and the recent runs paged past the fixture's. */
function busyRuns(r: Runs, q: URLSearchParams, team: string | null): Runs {
  const recent = r.recent.state === 'ok' ? r.recent.data : null;
  const top = runs(acting(team), fromTheTop(q))[1] as Runs;
  const total = recent && recent.total ? big(recent.total) : 0;
  return {
    ...r,
    tiles: { ...r.tiles, runs: { value: big(r.tiles.runs.value ?? 0), why: null } },
    bySkill: r.bySkill.state === 'ok' ? { state: 'ok', data: { rows: r.bySkill.data.rows.map((k) => ({ ...k, skill: `${k.skill}-${LONG}`, runs: big(k.runs) })) } } : r.bySkill,
    recent: recent ? { state: 'ok', data: { total, rows: paged(top.recent.state === 'ok' ? top.recent.data.rows : recent.rows, total, q,
      (k, i) => ({ ...k, id: `${k.id}-${i}`, skill: `${k.skill}-${LONG}`, initiative: k.initiative && `${k.initiative}-${LONG}` })) } } : r.recent,
  };
}

/** The team's queue past a page: the revisions the fixture holds and more, longest waiting first. */
function busyApprovals(a: Approvals, q: URLSearchParams, team: string | null): Approvals {
  if (a.waiting.state !== 'ok' || !a.waiting.data.total) return a;
  const total = a.waiting.data.total + 148;
  const waitingTab = (q.get('tab') ?? 'waiting') === 'waiting';
  const at = waitingTab ? q : new URLSearchParams({ limit: '10', offset: '0' });
  const since = (i: number) => iso(now() - (total - i) * 5 * HOUR);
  return {
    ...a,
    tiles: { ...a.tiles, waiting: total, oldestWaitingSince: since(0) },
    waiting: { state: 'ok', data: {
      ...a.waiting.data, total,
      rows: paged(waitingOf(team), total, at, (w, i) => ({ ...w, initiative: slugAt(i), version: 1 + (i % 9), contentRevision: `${w.contentRevision.slice(0, 8)}${String(i).padStart(6, '0')}`, waitingSince: since(i) })),
      summary: { ...a.waiting.data.summary, olderThan14Days: total - 30 },
    } },
  };
}

/** Home on a busy week: runs in a dozen initiatives, four groups drawn and the rest counted; open work past its five;
 *  and one document waiting, which the strip names. */
function busyHome(h: Home, team: string | null): Home {
  const [one] = waitingOf(team);
  const runs = h.runs.state === 'ok' ? h.runs.data : null;
  const groups: ActiveGroup[] = Array.from({ length: 12 }, (_, g) => ({
    initiative: g === 11 ? null : slugAt(g),
    runs: Array.from({ length: 1 + (g % 3) }, (_, k) => ({ skill: `sdlc-${['plan', 'review', 'spec'][k]}-${LONG}`, startedAt: iso(now() - (g * 3 + k + 1) * 0.1 * HOUR), lastAt: runs?.lastRunAt ?? iso(now()) })),
  }));
  const open = h.openWork.state === 'ok' ? h.openWork.data : null;
  return {
    ...h,
    waiting: one ? { state: 'ok', data: { count: 1, oldestSince: one.waitingSince, one: { initiative: one.initiative, path: one.path, version: one.version } } } : h.waiting,
    runs: runs ? { state: 'ok', data: { ...runs, active: groups.slice(0, 4), more: groups.slice(4).reduce((n, g) => n + g.runs.length, 0) } } : h.runs,
    openWork: open && open.total ? { state: 'ok', data: { ...open, quiet: open.quiet + 36, total: open.total + 808 } } : h.openWork,
  };
}

/* Platform */

/** Every instance a busy platform's checks found, in the order the gateway sorts them: critical first, then by kind
 *  (bugs, door, evaluation, approvals, drift), the oldest first. Nine teams wait, and both latencies have doubled. */
function instances(): PlatformStatus['needs']['rows'] {
  const at = (hours: number) => iso(now() - hours * HOUR);
  const drift = (label: string, from: number, to: number) => ({ kind: 'drift' as const, tone: 'warning' as const, instanceCount: 1, oldestAt: at(7 * 24), href: '/platform/usage',
    title: `${label} has at least doubled`, detail: `${to.toLocaleString('en-US')} ms in the last whole week, against ${from.toLocaleString('en-US')} ms in the first` });
  return [
    { kind: 'bugs', tone: 'critical', instanceCount: 1, oldestAt: at(900), href: '/platform/bugs?state=open', title: 'Bug reports are open', detail: '1,240 open reports, 212 blocking work' },
    { kind: 'door', tone: 'critical', instanceCount: 1, oldestAt: at(2), href: '/platform/usage', title: 'The core door has a fault day today, so far', detail: '1,904 tool failures in 81,200 calls so far today' },
    { kind: 'evaluation', tone: 'warning', instanceCount: 1, oldestAt: at(800), href: '/platform/evaluation', title: 'Evaluation findings are waiting for a decision', detail: '41 findings have waited 14 days or more for a decision' },
    ...Array.from({ length: 9 }, (_, t) => ({ kind: 'approvals' as const, tone: 'warning' as const, instanceCount: 1, oldestAt: at(700 - t * 20), href: '/platform/teams',
      title: `Approvals are waiting in team-${t + 1}-${LONG}`.slice(0, 120), detail: `${t + 2} revisions were presented 14 days ago or more and not approved` })),
    drift('Median call duration', 610, 1_390), drift('95th percentile call duration', 2_100, 5_800),
  ];
}
/** What needs attention as the gateway answers the reader: a member's approvals folded into one row naming no team,
 *  then the first five rows, and what the cut left out counted by its kind. */
function busyNeeds(superadmin: boolean): PlatformStatus['needs'] {
  const found = instances();
  const waiting = found.filter((n) => n.kind === 'approvals');
  const folded = superadmin ? found : found.flatMap((n) => (n.kind !== 'approvals' ? [n] : n === waiting[0] ? [{
    ...n, instanceCount: waiting.length, href: null,
    title: `Approvals are waiting in ${waiting.length} teams`, detail: `${waiting.length} teams have a revision presented 14 days ago or more and not approved`,
  }] : []));
  const overflowByKind: PlatformStatus['needs']['overflowByKind'] = {};
  for (const n of folded.slice(5)) overflowByKind[n.kind] = (overflowByKind[n.kind] ?? 0) + n.instanceCount;
  const total = found.length;
  return { state: 'complete', rows: folded.slice(0, 5), total, knownCount: total, unavailableKinds: [], overflowByKind,
    headline: superadmin ? `${total} things need you` : `${total} things are known and open` };
}

/** The usage of a busy platform: every registered tool past the ten named, and each week's calls split among the three
 *  teams with the most and Other, which holds every other team's. */
function busyUsage(u: Usage, superadmin: boolean): Usage {
  const tools = u.tools.state === 'ok' ? u.tools.data : null;
  const most = u.mostUsed.state === 'ok' ? u.mostUsed.data : null;
  const named = (tool: string, i: number) => `${tool.split(':')[0]}:${tool.split(':')[1]}_${i}_${LONG}`;
  const TOOLS = 23;
  const split = (calls: number) => {
    const [a, b, c] = [Math.floor(calls * 0.21), Math.floor(calls * 0.17), Math.floor(calls * 0.12)];
    return [{ label: `team-1-${LONG}`.slice(0, 63), calls: a }, { label: `team-2-${LONG}`.slice(0, 63), calls: b }, { label: `team-3-${LONG}`.slice(0, 63), calls: c }, { label: 'Other', calls: calls - a - b - c }];
  };
  return {
    ...u,
    callsByWeek: u.callsByWeek.state === 'ok' ? { state: 'ok', data: { weeks: u.callsByWeek.data.weeks.map((w) => ({ ...w, parts: superadmin && w.calls.value !== null ? split(w.calls.value) : w.parts })) } } : u.callsByWeek,
    tools: tools ? { state: 'ok', data: { rows: Array.from({ length: 10 }, (_, i) => ({ ...tools.rows[i % tools.rows.length], tool: named(tools.rows[i % tools.rows.length].tool, i) })), total: TOOLS } } : u.tools,
    mostUsed: most ? { state: 'ok', data: { rows: Array.from({ length: 10 }, (_, i) => ({ tool: named(most.rows[i % most.rows.length].tool.replace('Unregistered tools', 'core:unnamed'), i), calls: 9_000 - i * 610 })), total: TOOLS } } : u.mostUsed,
  };
}

const RELEASED = 140;
/** Newest first: four releases a minor version. */
const versionAt = (i: number) => `0.${97 - Math.floor(i / 4)}.${3 - (i % 4)}`;
function busyReleases(r: Releases, q: URLSearchParams): Releases {
  if (r.rows.state !== 'ok' || !r.rows.data.total) return r;
  const top = releases(100, 0).rows;
  const releasedAt = (i: number) => iso(now() - (i + 1) * 31 * HOUR);
  return {
    ...r,
    tiles: { ...r.tiles, releases: RELEASED, latest: { version: versionAt(0), releasedAt: releasedAt(0) }, migrations: { ...r.tiles.migrations, applied: 1_204 } },
    rows: { state: 'ok', data: { total: RELEASED, rows: paged(top.state === 'ok' ? top.data.rows : [], RELEASED, q,
      (x, i) => ({ ...x, version: versionAt(i), releasedAt: releasedAt(i), summary: `${x.summary} ${WORDS}` })) } },
  };
}

function busyBugs(b: Bugs, q: URLSearchParams, superadmin: boolean): Bugs {
  if (b.queue.state !== 'ok' || !b.queue.data.total) return b;
  const filter = { state: q.get('state'), impact: q.get('impact'), surface: q.get('surface') };
  const top = bugs(superadmin, filter, 100, 0).queue;
  const total = b.queue.data.total + 1_232;
  return {
    ...b,
    counts: b.counts.state === 'ok' ? { state: 'ok', data: { ...b.counts.data, open: b.counts.data.open + 1_236 } } : b.counts,
    queue: { state: 'ok', data: { total, rows: paged(top.state === 'ok' ? top.data.rows : [], total, q,
      // The superadmin's row carries the report's own title too, which their queue draws.
      (x, i) => ({ ...x, id: `0b3f2a6e-8c41-4d2a-9f10-${String(i).padStart(12, '0')}`, title: `${x.title} ${WORDS} (${i + 1})`,
        ...('internalTitle' in x ? { internalTitle: `${String(x.internalTitle)}, ${WORDS} (${i + 1})` } : {}) })) } },
  };
}

function busyEvaluation(e: Evaluation): Evaluation {
  const grow = <T,>(rows: T[], n: number, name: (row: T, i: number) => T) => (rows.length ? Array.from({ length: n }, (_, i) => name(rows[i % rows.length], i)) : rows);
  const plugin = (p: string, i: number) => `${p}-${i}-${LONG}`.slice(0, 80);
  const waiting = e.waiting.state === 'ok' ? grow(e.waiting.data.rows, 41, (f, i) => ({ ...f, id: `f1c0e7a2-5b3d-4e8f-a1c2-${String(i).padStart(12, '0')}`, plugin: plugin(f.plugin, i) })) : null;
  return {
    ...e,
    tiles: { ...e.tiles, waiting: waiting ? waiting.length : e.tiles.waiting },
    plugins: e.plugins.state === 'ok' ? { state: 'ok', data: grow(e.plugins.data, 34, (p, i) => ({ ...p, plugin: plugin(p.plugin, i) })) } : e.plugins,
    history: e.history.state === 'ok' ? { state: 'ok', data: grow(e.history.data, 34, (h, i) => ({ ...h, plugin: plugin(h.plugin, i) })) } : e.history,
    waiting: waiting ? { state: 'ok', data: { rows: waiting, total: waiting.length } } : e.waiting,
  };
}

/** Every team's shelf, for the superadmin, past a page; the questions the gateway names, ten of thousands asked. */
function busyKnowledgeHealth(k: KnowledgeHealth): KnowledgeHealth {
  const shelves = k.shelves.state === 'ok' ? k.shelves.data.rows : null;
  const team = shelves?.find((r) => r.kind === 'team');
  const questions = k.questions?.state === 'ok' ? k.questions.data : null;
  return {
    ...k,
    shelves: shelves && team ? { state: 'ok', data: { rows: [
      ...shelves.filter((r) => r.kind === 'own'),
      ...Array.from({ length: 28 }, (_, i) => ({ ...team, shelf: `team-${i + 1}-${LONG}`.slice(0, 63), standing: big(i + 3), searchesLastWeek: 300 + i })),
      ...shelves.filter((r) => r.kind === 'shared' || r.kind === 'all'),
    ] } } : k.shelves,
    questions: questions && questions.rows.length ? { state: 'ok', data: { ...questions, total: 4_000,
      rows: Array.from({ length: 10 }, (_, i) => ({ ...questions.rows[i % questions.rows.length], question: `${questions.rows[i % questions.rows.length].question} ${WORDS} ${i}`, asked: 900 - i * 61 })) } } : k.questions,
  };
}

/** The audit at its ceiling: the latest 500 events within the filters, ten a page, each its own event. */
function busyAudit(a: Audit, q: URLSearchParams): Audit {
  if (!a.total) return a;
  const top = audit(fromTheTop(q), { limit: 100, offset: 0 });
  const templates = top && top[0] === 200 ? (top[1] as Audit).rows : a.rows;
  return { ...a, total: a.ceiling, rows: paged(templates, a.ceiling, q, (r, i) => ({ ...r, id: String(90_000 - i), at: iso(now() - (i + 1) * 0.5 * HOUR) })) };
}

/** The catalog of a busy platform: more plugins than a page, the fixture's own first and under their own names, since a
 *  plugin's page and a skill's find themselves in the catalog by their names; and each plugin that ships a skill ships
 *  more than a page of them, its own first. */
function busyCatalog(c: { plugins: PluginRow[] }): { plugins: PluginRow[] } {
  if (!c.plugins.length) return c;
  const skilled = c.plugins.map((p) => ({ ...p, skills: p.skills.length ? [...p.skills, ...Array.from({ length: 24 - p.skills.length }, (_, k) => ({ ...p.skills[k % p.skills.length], name: `${p.skills[k % p.skills.length].name}-${k + 1}`, isEntry: false }))] : p.skills }));
  const grown = Array.from({ length: 34 - c.plugins.length }, (_, k) => {
    const p = c.plugins[k % c.plugins.length];
    const name = `${p.plugin}-${k + 1}`;
    return { ...p, plugin: name, install: p.install.replace(p.plugin, name) };
  });
  return { plugins: [...skilled, ...grown] };
}

/** The superadmin's Teams and People: a page of names longer than any layout planned for under counts in the thousands. */
function busyTeams(t: Teams, q: URLSearchParams): Teams {
  const top = teams(ME, fromTheTop(q), { limit: 100, offset: 0 });
  const total = t.total ? t.total + 214 : 0;
  return {
    ...t,
    tiles: { teams: t.tiles.teams + 214, openWork: big(t.tiles.openWork), pending: t.tiles.pending + 140, lessons: big(t.tiles.lessons) },
    teams: paged(top ? (top[1] as Teams).teams : t.teams, total, q, (r, i) => ({ ...r, slug: `team-${i + 1}-${LONG}`.slice(0, 63), name: `Regional delivery group ${i + 1}, ${WORDS}`, people: 300 + i, openWork: 1_000 + i * 17, waiting: 40 + i, lessons: 9_000 + i })),
    total,
  };
}
function busyPeople(p: People, q: URLSearchParams): People {
  const top = people(ME, fromTheTop(q), { limit: 100, offset: 0 });
  const total = p.total ? p.total + 480 : 0;
  return {
    ...p,
    tiles: { ...p.tiles, people: p.tiles.people + 480, withPasskey: p.tiles.withPasskey + 410, neverSignedIn: p.tiles.neverSignedIn + 37 },
    people: paged(top ? (top[1] as People).people : p.people, total, q, (r, i) => ({ ...r, email: `person.${i}.${LONG}@example.com`, name: `Person ${i} ${WORDS}`, teams: Array.from({ length: 6 }, (_, j) => `${`team-${j + 1}-${LONG}`.slice(0, 63)} (member)`), passkeys: r.passkeys + 3 })),
    total,
  };
}

/**
 * The `extreme` answer of a route with a ceiling, or `undefined` for a route this does not shape. `own` is the one team
 * a member is held to, so nothing grown for them names another; `team` is the team the caller acts for.
 */
export function aboveCeilings(seg: string[], body: unknown, own: string | null, q: URLSearchParams, team: string | null): unknown {
  const [head, a, b] = seg;
  switch (head) {
    case 'teams': return a || own ? body : busyTeams(body as Teams, q);
    case 'people': return own ? body : busyPeople(body as People, q);
    case 'initiatives': return a && b ? undefined : busyInitiatives(body as InitiativeList, q, team);
    case 'record': return busyRecord(body as RecordRead, q, team);
    case 'knowledge': return a ? undefined : busyShelf(body as KnowledgeList, q, team);
    case 'activity': return a ? undefined : busyLog(body as ActivityLog, q, team);
    case 'runs': return busyRuns(body as Runs, q, team);
    case 'approvals': return busyApprovals(body as Approvals, q, team);
    case 'home': return busyHome(body as Home, team);
    case 'plugins': return a ? undefined : busyCatalog(body as { plugins: PluginRow[] });
    case 'platform':
      if (b !== undefined) return undefined;
      if (a === 'status') { const s = body as PlatformStatus; return { ...s, needs: busyNeeds(own === null) }; }
      if (a === 'usage') return busyUsage(body as Usage, own === null);
      if (a === 'releases') return busyReleases(body as Releases, q);
      if (a === 'bugs') return busyBugs(body as Bugs, q, own === null);
      if (a === 'evaluation') return busyEvaluation(body as Evaluation);
      if (a === 'knowledge') return own === null ? busyKnowledgeHealth(body as KnowledgeHealth) : body;
      if (a === 'audit') return busyAudit(body as Audit, q);
      return undefined;
    default: return undefined;
  }
}
