/**
 * The facts the fake gateway's Platform prepared query counts (platform-query.ts), each read off the answer the
 * measure's own page route gives, never written a second time: Usage's calls by week, by team and by tool, its refusals
 * and model calls; Status's malformed calls and searches; Releases' rows and migrations; Bugs' queue; Evaluation's
 * waiting findings, its tallies, its plugin rows and their history; Knowledge health's lessons made; Teams', People's
 * and Audit's rows. So every figure the query answers over a window a page draws is that page's figure, whatever the
 * fixtures beneath them come to say.
 *
 * A fact is a count of one day and one key along each dimension. A page answers totals, so where it says how many and
 * not when or of what, each fact is placed by one rule, the same every read:
 *
 *   - a week's calls, refusals, malformed calls, model calls, searches and lessons are spread evenly over its days, the
 *     running week's over its days through today, each dated at noon or the cutoff, whichever is earlier;
 *   - a call's team is the week's split by team (CALLS_BY_TEAM) in its order, its tool the last whole week's calls by
 *     tool in Usage's order, repeated over the other weeks, and a refusal's owner the last whole week's four owners
 *     the same way; the refused calls of a week are spread evenly among its calls;
 *   - a malformed call's tool is read the way a call's is; Status's malformed calls are their own count, since
 *     Usage's last whole week refuses six calls as ours where Status counts eight malformed;
 *   - a model call records no model in the fixture, so every one is counted under none;
 *   - a search found nothing in as many of a week's searches as Status says did not find something, spread evenly, and
 *     was widened in as many as Status says were, a week before widening was recorded under none;
 *   - a lesson made outside an import is on the shelves the last whole week's lessons were made on, in Knowledge
 *     health's order, repeated over the other weeks; an import's are on the shared shelf; every lesson's kind is the
 *     next of the kinds in turn, since no page counts lessons made by kind;
 *   - a decided finding is dated at the record's first day, under no plugin, its owner the next of Evaluation's owners
 *     the waiting findings leave; a waiting one is the row Evaluation lists, dated when it began to wait;
 *   - a migration is applied a day before the next one, the latest when Releases says;
 *   - a sign-in is each person's latest, as People lists it, and in the last whole week the ones beyond those are the
 *     later signers-in's, the latest first, spread over its days.
 *
 * COUPLED: the fixtures read here, and zz-stack's checks/console-platform-query-shape.ts through platform-query.ts. So
 * nothing here is imported through the console's path alias.
 */
import type { Audit, AuditRow, People } from '../../src/lib/fleet-shapes.ts';
import type { Evaluation, Part, PlatformQueryRow, ReleaseRow, SafeFinding } from '../../src/lib/platform-shapes.ts';
import { localDay, midnight, now } from './clock.ts';
import { ME } from './people.ts';
import { audit } from './platform-audit.ts';
import { bugs } from './platform-bugs.ts';
import { evaluation } from './platform-evaluation.ts';
import { knowledge } from './platform-knowledge.ts';
import { PEOPLE, people } from './platform-people.ts';
import { releases } from './platform-releases.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { CALLS_BY_TEAM, TEAMS } from './platform-teams.ts';
import { usage } from './platform-usage.ts';
import { SHARED_TEAM } from './work-knowledge.ts';

/** A count on one day under one key along each dimension; `lastMs` the latest of them; `ref` what a drill reads its row
 *  from. */
export type Fact = { day: string; keys: Record<string, string | null>; n: number; lastMs: number; ref?: unknown };
export type Row = PlatformQueryRow;
/** One fact of one, before facts of the same day and keys are added up. */
type Unit = { day: string; keys: Record<string, string | null>; ms?: number; ref?: unknown };

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** What Usage counts the calls to a tool no door registers under. COUPLED: the gateway's platform-usage.ts. */
export const UNREGISTERED = 'Unregistered tools';
/** The kinds a lesson may have, in the gateway's order. COUPLED: the gateway's platform-knowledge.ts `KINDS`. */
export const KINDS = ['decision', 'design', 'process', 'knowledge', 'behavior', 'style'] as const;

/** The part of a page's answer that was read; every fixture's part is. */
function ok<T>(p: Part<T>): T {
  if (p.state !== 'ok') throw new Error('a fixture answered a part unavailable');
  return p.data;
}

const status = (key: string) => PLATFORM_STATUS.measures.find((m) => m.key === key)!;
/** The status fixture's weeks, oldest first, the running one last; `LAST` is the last whole week. */
const WEEKS = status('malformed_per_1000').weeks.map((w) => w.window);
const LAST = WEEKS.length - 2;

/** The days of week `i` the record holds by the cutoff: seven, the running week's through today. */
function daysOf(i: number): string[] {
  const from = Date.parse(WEEKS[i].from), end = Math.min(Date.parse(WEEKS[i].to), now() + 1);
  return Array.from({ length: Math.ceil((end - from) / DAY) }, (_, d) => localDay(from + d * DAY));
}
/** Which of `slots` the `k`th of `n` falls in, spread evenly. */
const slot = (k: number, n: number, slots: number) => Math.floor((k * slots) / n);
/** Whether the `k`th of `n` is one of `r` spread evenly among them. */
const hit = (k: number, r: number, n: number) => Math.floor(((k + 1) * r) / n) > Math.floor((k * r) / n);
/** Each value repeated as many times as it is counted, in order. */
const expand = <T>(counts: [T, number][]): T[] => counts.flatMap(([v, n]) => Array<T>(Math.max(0, n)).fill(v));

/** Units of one day and the same keys added up, each dated at noon or the cutoff, whichever is earlier, unless its own
 *  instant is known. */
function factsOf(units: Unit[]): Fact[] {
  const facts = new Map<string, Fact>();
  for (const u of units) {
    const ms = u.ms ?? Math.min(midnight(u.day) + DAY / 2, now());
    const at = `${u.day}\0${JSON.stringify(u.keys)}\0${u.ref === undefined ? '' : JSON.stringify(u.ref)}`;
    const was = facts.get(at);
    facts.set(at, was ? { ...was, n: was.n + 1, lastMs: Math.max(was.lastMs, ms) } : { day: u.day, keys: u.keys, n: 1, lastMs: ms, ref: u.ref });
  }
  return [...facts.values()];
}

/** `n` units of each week, spread over its days, the `k`th of a week keyed by `keys(i, k, n)`. */
function weekly(counts: number[], keys: (i: number, k: number, n: number) => Record<string, string | null>): Unit[] {
  return counts.flatMap((n, i) => {
    const days = daysOf(i);
    return Array.from({ length: n }, (_, k) => ({ day: days[slot(k, n, days.length)], keys: keys(i, k, n) }));
  });
}

/* Usage: calls, refusals and model calls, and Status's malformed calls. */

/** The tools a door registers, as Usage names them: every one it lists but the calls to none. */
export function registeredTools(): Set<string> {
  const u = usage(true);
  return new Set([...ok(u.mostUsed).rows.map((r) => r.tool), ...ok(u.tools).rows.map((r) => r.tool)].filter((t) => t !== UNREGISTERED));
}

/** Every real-work call, keyed by its tool (null for one no door registers), its team, and its owner when refused. */
export function callFacts(): Fact[] {
  const u = usage(true);
  const calls = ok(u.callsByWeek).weeks.map((w) => w.calls.value ?? 0);
  const refused = ok(u.tiles).refusedShare.weeks.map((w) => w.numerator ?? 0);
  const tools = expand(ok(u.mostUsed).rows.map((r): [string | null, number] => [r.tool === UNREGISTERED ? null : r.tool, r.calls]));
  const r = ok(u.refusals);
  const owners = expand<string>([['guardrail', r.guardrail], ['ours', r.ours], ['theirs', r.theirs], ['other', r.other]]);
  let refusals = 0;
  return factsOf(weekly(calls, (i, k, n) => {
    const teams = expand(CALLS_BY_TEAM.map((t): [string, number] => [t.team, t.calls[i]]));
    const owner = hit(k, refused[i], n) ? owners[refusals++ % owners.length] : null;
    return { tool: tools[k % tools.length] ?? null, team: teams[k] ?? null, owner };
  }));
}

/** Status's malformed calls by week, each keyed by its tool as a call's is. */
export function malformedFacts(): Fact[] {
  const tools = expand(ok(usage(true).mostUsed).rows.map((r): [string | null, number] => [r.tool === UNREGISTERED ? null : r.tool, r.calls]));
  return factsOf(weekly(status('malformed_per_1000').weeks.map((w) => w.numerator ?? 0), (_i, k) => ({ tool: tools[k % tools.length] ?? null })));
}

/** Usage's model calls, its last whole week and the one before, under no model. */
export function modelFacts(): Fact[] {
  const m = ok(usage(true).modelCalls);
  return factsOf(weekly(WEEKS.map((_, i) => (i === LAST ? m.last.calls : i === LAST - 1 ? m.previous.calls : 0)), () => ({ model: null })));
}

/** Status's searches that recorded their results, by whether they found something and whether they were widened. */
export function searchFacts(): Fact[] {
  const s = status('searches_with_results_pct');
  const searches = s.weeks.map((w) => (w.figure.why === 'unavailable' ? 0 : w.denominator ?? 0));
  return factsOf(weekly(searches, (i, k, n) => {
    const w = s.widened![i];
    const widened = w.figure.why === 'unavailable' ? null : hit(k, w.numerator ?? 0, n) ? 'widened' : 'not_widened';
    return { found: hit(k, n - (s.weeks[i].numerator ?? 0), n) ? 'nothing' : 'found', widened };
  }));
}

/** The questions searches that found nothing asked, as Knowledge health lists them to the superadmin. */
export function questionRows(): { question: string; shelf: string; asked: number; lastAskedAt: string }[] {
  return ok(knowledge(true, ME.activeTeam).questions!).rows;
}

/* Knowledge health: lessons made. */

/** Every lesson made, by the shelf's slug it was made on, its kind and whether an import made it. */
export function lessonFacts(): Fact[] {
  const k = knowledge(true, null);
  const weeks = ok(k.made).weeks;
  const shelves = expand(ok(k.shelves).rows.filter((s) => s.kind !== 'all').map((s): [string, number] => [s.shelf, s.madeLastWeek]));
  let made = 0, lessons = 0;
  const kind = () => KINDS[lessons++ % KINDS.length];
  return factsOf(weekly(weeks.map((w) => (w.made.value ?? 0) + w.importedExact + w.importedByDay), (i, j) => {
    const own = weeks[i].made.value ?? 0;
    if (j >= own) return { shelf: SHARED_TEAM, kind: kind(), imported: 'imported' };
    return { shelf: shelves.length ? shelves[made++ % shelves.length] : SHARED_TEAM, kind: kind(), imported: 'not_imported' };
  }));
}

/* Releases. */

/** Every release recorded, its row as Releases lists it. */
export const releaseRows = (): ReleaseRow[] => ok(releases(1_000, 0).rows).rows;

/** Every migration applied: the latest when Releases says, each other a day before the next. */
export function migrationFacts(): Fact[] {
  const { applied, lastAt } = releases(1, 0).tiles.migrations;
  const last = lastAt === null ? now() : Date.parse(lastAt);
  return factsOf(Array.from({ length: applied }, (_, k) => ({ day: localDay(last - k * DAY), keys: {}, ms: last - k * DAY })));
}

/* Bugs. */

/** Every real report, its queue row as the caller's Bugs lists it. */
export const reportRows = (admin: boolean) => ok(bugs(admin, { state: null, impact: null, surface: null }, 1_000, 0).queue).rows;

/* Evaluation. */

type PluginRow = Extract<Evaluation['plugins'], { state: 'ok' }>['data'][number];
/** A finding counted once, strengths left out: `row` the waiting summary the caller's Evaluation lists, null for one decided. */
export type FindingRef = { id: string | null; row: SafeFinding | null };

/** Every finding Evaluation counts, by decision, owner and plugin; the waiting ones are its rows. */
export function findingFacts(admin: boolean): Fact[] {
  const e = evaluation(admin);
  const waiting = ok(e.waiting).rows;
  const left = new Map(Object.entries(ok(e.byOwner)));
  for (const f of waiting) left.set(f.owner, (left.get(f.owner) ?? 0) - 1);
  const owners = expand([...left]);
  const decided = expand(Object.entries(ok(e.byDecision)).filter(([d]) => d !== 'deferred'));
  const first = localDay(Date.parse(e.meta.period.from));
  return factsOf([
    ...waiting.map((f) => ({ day: localDay(Date.parse(f.waitingSince)), ms: Date.parse(f.waitingSince), ref: { id: f.id, row: f },
      keys: { decision: 'deferred', owner: f.owner, plugin: f.plugin } })),
    ...decided.map((decision, j) => ({ day: first, ms: midnight(first), ref: { id: null, row: null },
      keys: { decision, owner: owners[j] ?? 'unknown', plugin: null } })),
  ]);
}

/** The plugins Evaluation names. */
export function pluginsScored(): Set<string> {
  const e = evaluation(true);
  return new Set([...ok(e.plugins).map((p) => p.plugin), ...ok(e.waiting).rows.map((f) => f.plugin)]);
}

/** Each plugin's latest scoring by an instant, as Evaluation's plugin row draws it: its latest row where that is the one,
 *  and otherwise that row with the earlier scoring's score, standing, protocol and date. */
export function scoredBy(endMs: number, admin: boolean): PluginRow[] {
  const e = evaluation(admin);
  const latest = new Map(ok(e.plugins).map((p) => [p.plugin, p]));
  return ok(e.history).flatMap((h) => {
    const runs = h.series.flatMap((s) => s.runs.map((r) => ({ ...r, protocol: s.protocol })))
      .filter((r) => Date.parse(r.scoredAt) <= endMs).sort((a, b) => a.scoredAt.localeCompare(b.scoredAt));
    const run = runs.at(-1);
    const row = latest.get(h.plugin);
    if (!run || !row) return [];
    return [run.scoredAt === row.scoredAt ? row : {
      ...row, score: run.score === null ? { value: null, why: 'no_data' as const } : { value: run.score, why: null },
      lower: run.lower, upper: run.upper, standing: run.standing as PluginRow['standing'], protocol: run.protocol, scoredAt: run.scoredAt,
    }];
  });
}

/* Teams, People and Audit: the superadmin's. */

export const teamRows = () => TEAMS;
export const teamSlugs = (): string[] => [...new Set([...TEAMS.map((t) => t.slug), SHARED_TEAM])].sort();
export const personRows = () => PEOPLE;

/** Every recorded sign-in, by the person's role: each person's latest, and the last whole week's beyond those. */
export function signInFacts(): Fact[] {
  const [, answer] = people(ME, new URLSearchParams(), { limit: 1_000, offset: 0 })!;
  const tile = (answer as People).tiles.signInsLastWeek;
  const [from, to] = [Date.parse(tile.window.from), Date.parse(tile.window.to)];
  const latest = PEOPLE.filter((p) => p.lastSignIn !== null).map((p) => ({ p, ms: Date.parse(p.lastSignIn!) }));
  const later = latest.filter((x) => x.ms >= to).sort((a, b) => b.ms - a.ms);
  const extra = Math.max(0, (tile.figure.value ?? 0) - latest.filter((x) => x.ms >= from && x.ms < to).length);
  const days = daysOf(LAST);
  return factsOf([
    ...latest.map(({ p, ms }) => ({ day: localDay(ms), ms, keys: { role: p.role }, ref: p.email })),
    ...(later.length ? Array.from({ length: extra }, (_, k) => {
      const day = days[slot(k, extra, days.length)];
      return { day, keys: { role: later[k % later.length].p.role }, ref: later[k % later.length].p.email };
    }) : []),
  ]);
}

/** Every event Audit records, page views left out, newest first as Audit lists them. */
export function auditRows(): AuditRow[] {
  const [, answer] = audit(new URLSearchParams({ filter: 'all' }), { limit: 500, offset: 0 })!;
  return (answer as Audit).rows;
}

export const auditFacts = (): Fact[] =>
  factsOf(auditRows().map((r) => ({ day: localDay(Date.parse(r.at)), ms: Date.parse(r.at), keys: { kind: r.kind, team: r.team } })));

/** Rows of their own instants, newest first, `id` breaking a tie, each with the instant and the console address. */
export function newest<T extends object>(rows: T[], ms: (r: T) => number, id: (r: T) => string, address: (r: T) => string): Row[] {
  return [...rows].sort((a, b) => ms(b) - ms(a) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0))
    .map((r) => ({ ...r, at: iso(ms(r)), address: address(r) }));
}
