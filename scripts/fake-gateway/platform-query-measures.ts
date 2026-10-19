/**
 * The measures of the fake gateway's Platform prepared query (platform-query.ts), as the gateway's
 * platform-query-measures.ts declares them: each one's dimensions and who may ask them, what it counts and the rows it
 * drills to, read off the facts its own page's answer holds (platform-query-facts.ts).
 *
 *   calls          Usage's calls by week, by tool and, the superadmin's, by team
 *   refusals       Usage's refusals, under their four owners
 *   malformed      Status's and Releases' malformed calls
 *   releases       Releases' releases by week, and its rows
 *   migrations     Releases' migrations applied
 *   bugs_filed     Bugs' filed by week, by impact and the queue's counts
 *   bugs_resolved  Bugs' resolved, dated by filing
 *   findings       Evaluation's findings by decision and by owner
 *   scores         Evaluation's scores established: a plugin whose latest scoring by the window's end is established
 *   lessons        Knowledge health's lessons made, imports told apart
 *   searches       Knowledge health's and Status's searches
 *   model_calls    Usage's model calls
 *   teams          Teams' tiles, a stock
 *   people         People's tiles, a stock
 *   sign_ins       People's recorded sign-ins
 *   audit          Audit's events, page views left out
 *
 * What a member reads is what the measure's page shows a member: no team's name, since `team` is the superadmin's
 * dimension and a member's shelves are their own, the shared one and the rest of them unnamed; a bug report's public
 * row; a finding's safe form; and nothing of Teams, People, sign-ins, Audit or the questions searches asked.
 *
 * COUPLED: the gateway's services/gateway/src/console/platform-query-measures.ts, whose dimensions, vocabularies and
 * refusal sentences these are. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import { localDay, midnight, now } from './clock.ts';
import { badFilter } from './platform-bugs.ts';
import { CATALOG } from './platform.ts';
import {
  KINDS, UNREGISTERED, auditFacts, auditRows, callFacts, findingFacts, lessonFacts, malformedFacts, migrationFacts, modelFacts,
  newest, personRows, pluginsScored, questionRows, registeredTools, releaseRows, reportRows, scoredBy, searchFacts, signInFacts,
  teamRows, teamSlugs, type Fact, type FindingRef, type Row,
} from './platform-query-facts.ts';
import { SHARED_TEAM } from './work-knowledge.ts';
import { addDays } from './work-query-buckets.ts';

export type Who = Pick<Me, 'superadmin' | 'activeTeam'>;
/** The days a read reaches, both included: `from` null for every day before `to`. */
export type Span = { from: string | null; to: string };
export type { Fact };
type Drilled = { rows: Row[]; total: number };

/** One dimension: whether a value is in its vocabulary; the values always answered, an empty one as zero; the sentence
 *  a value outside it is refused with, which never echoes the value; the label of the group with no value; and its
 *  groups' labels. */
export type Dim = {
  superadmin?: true;
  has: (who: Who, value: string) => boolean;
  fixed?: (who: Who) => readonly string[];
  refuse: (who: Who) => string;
  none: string;
  label?: (key: string, who: Who) => string;
};
export type Measure = {
  dims: Record<string, Dim>;
  superadmin?: true;
  /** Counted as of the window's last day, whatever its first: no window before it and no bucket. */
  stock?: true;
  buckets: boolean;
  population: string;
  /** The sentence a drill is refused with, naming the page that lists its rows; absent where it is drilled. */
  notDrilled?: string;
  /** Drilled for the superadmin alone. */
  drillSuperadmin?: true;
  facts(who: Who, span: Span): Fact[];
  /** `span` the window's days, for a page whose rows the fixture dates on their own. */
  rows?(who: Who, kept: Fact[], want: number, span: Span): Drilled;
};

const words = (key: string) => key[0].toUpperCase() + key.slice(1).replaceAll('_', ' ');
const closed = (name: string, values: readonly string[]) => () => `a filter on ${name} takes one of ${values.join(', ')}`;
const inSpan = (day: string, s: Span) => (s.from === null || day >= s.from) && day <= s.to;
/** Facts inside a span; every fact is before the cutoff. */
const within = (facts: Fact[], s: Span) => facts.filter((f) => inSpan(f.day, s));
/** Facts of one each, `ref` the row a drill answers, read back in the order the measure's page gives them. */
const refs = <T>(kept: Fact[]) => kept.map((f) => f.ref as T);

/* The closed vocabularies, in the gateway's order. COUPLED: its contracts, platform-bugs.ts, teams.ts and people.ts. */
const OWNERS = ['guardrail', 'ours', 'theirs', 'other'];
const IMPACTS = ['blocks_work', 'wrong_result', 'confusing', 'cosmetic'];
const STATUSES = ['open', 'fixed', 'not_a_bug', 'duplicate'];

const TOOL: Dim = { has: (_w, v) => registeredTools().has(v), refuse: () => 'tool must be a tool a door registers, as door:name', none: UNREGISTERED };
const TEAM: Dim = { superadmin: true, has: (_w, v) => teamSlugs().includes(v), refuse: () => "team must be a team's slug", none: 'No team' };
const PLUGIN: Dim = {
  has: (_w, v) => pluginsScored().has(v) || CATALOG.some((p) => p.plugin === v), refuse: () => "plugin must be a plugin's name", none: 'No plugin',
};
/** A closed vocabulary, every value of it answered unless `fixed` is false. */
const vocabularyOf = (name: string, values: readonly string[], fixed = true): Dim => ({
  has: (_w, v) => values.includes(v), ...(fixed ? { fixed: () => values } : {}), refuse: closed(name, values), none: 'None', label: words,
});

/** A member's shelves are their own, the shared one, and the rest unnamed; the superadmin's are every team's slug. */
function shelfOf(slug: string, who: Who): string | null {
  if (who.superadmin) return slug;
  if (slug === SHARED_TEAM) return 'shared';
  return who.activeTeam !== null && who.activeTeam !== SHARED_TEAM && slug === who.activeTeam ? 'own' : null;
}

/** Bug reports as facts, each counted on the day it was filed: the caller's queue rows, public or the superadmin's. */
const reportFacts = (who: Who, s: Span, keep: (r: ReturnType<typeof reportRows>[number]) => boolean, keys: (r: ReturnType<typeof reportRows>[number]) => Fact['keys']): Fact[] =>
  within(reportRows(who.superadmin).filter(keep).map((r) => ({ day: localDay(Date.parse(r.filedAt)), keys: keys(r), n: 1, lastMs: Date.parse(r.filedAt), ref: r })), s);
const reportDrill = (_who: Who, kept: Fact[], want: number): Drilled => {
  const rows = newest(refs<ReturnType<typeof reportRows>[number]>(kept), (r) => Date.parse(r.filedAt), (r) => r.id, () => '/platform/bugs');
  return { rows: rows.slice(0, want), total: rows.length };
};

export const MEASURES: Record<string, Measure> = {
  calls: {
    dims: { tool: TOOL, refused: vocabularyOf('refused', ['refused', 'answered']), team: TEAM },
    buckets: true, population: 'real-work tool calls',
    facts: (_w, s) => within(callFacts(), s).map((f) => ({ ...f, keys: { tool: f.keys.tool, refused: f.keys.owner === null ? 'answered' : 'refused', team: f.keys.team } })),
    // Usage's tools called most: each registered tool, every other counted as one, by its calls in the kept facts.
    rows(_w, kept) {
      const by = new Map<string | null, { calls: number; ms: number }>();
      for (const f of kept) {
        const was = by.get(f.keys.tool) ?? { calls: 0, ms: 0 };
        by.set(f.keys.tool, { calls: was.calls + f.n, ms: Math.max(was.ms, f.lastMs) });
      }
      const rows = newest([...by].map(([tool, t]) => ({ tool: tool ?? UNREGISTERED, calls: t.calls, ms: t.ms })), (t) => t.ms, (t) => t.tool, () => '/platform/usage');
      return { rows: rows.map(({ ms: _ms, ...r }) => r as Row), total: rows.length };
    },
  },
  refusals: {
    dims: { owner: vocabularyOf('owner', OWNERS), tool: TOOL, team: TEAM },
    buckets: true, population: 'real-work tool calls refused, under the four owners',
    notDrilled: 'refusals are not drilled: Usage and Status count them and list none',
    facts: (_w, s) => within(callFacts(), s).filter((f) => f.keys.owner !== null),
  },
  malformed: {
    dims: { tool: TOOL },
    buckets: true, population: 'real-work tool calls refused for their shape',
    notDrilled: 'malformed calls are not drilled: Status and Releases count them and list none',
    facts: (_w, s) => within(malformedFacts(), s),
  },
  releases: {
    dims: {}, buckets: true, population: 'recorded releases',
    facts: (_w, s) => within(releaseRows().map((r) => ({ day: localDay(Date.parse(r.releasedAt)), keys: {}, n: 1, lastMs: Date.parse(r.releasedAt), ref: r })), s),
    rows(_w, kept, want) {
      const rows = newest(refs<ReturnType<typeof releaseRows>[number]>(kept), (r) => Date.parse(r.releasedAt), (r) => r.version, () => '/platform/releases');
      return { rows: rows.slice(0, want), total: rows.length };
    },
  },
  migrations: {
    dims: {}, buckets: true, population: 'migrations applied',
    notDrilled: 'migrations are not drilled: Releases counts them and lists none',
    facts: (_w, s) => within(migrationFacts(), s),
  },
  bugs_filed: {
    dims: {
      impact: vocabularyOf('impact', IMPACTS), state: vocabularyOf('state', ['open', 'resolved']),
      surface: { has: (_w, v) => badFilter({ state: null, impact: null, surface: v }) === null, refuse: () => 'surface must be a tool, a door or console', none: 'No surface named' },
    },
    buckets: true, population: 'real bug reports, by the day each was filed',
    facts: (w, s) => reportFacts(w, s, () => true, (r) => ({ impact: r.impact, surface: r.surface, state: r.status === 'open' ? 'open' : 'resolved' })),
    rows: reportDrill,
  },
  bugs_resolved: {
    dims: { outcome: vocabularyOf('outcome', STATUSES.filter((x) => x !== 'open')), impact: vocabularyOf('impact', IMPACTS) },
    buckets: true, population: 'real bug reports resolved, by the day each was filed',
    facts: (w, s) => reportFacts(w, s, (r) => r.status !== 'open', (r) => ({ outcome: r.status, impact: r.impact })),
    rows: reportDrill,
  },
  findings: {
    dims: {
      decision: vocabularyOf('decision', ['applied', 'rejected', 'deferred']),
      owner: vocabularyOf('owner', ['plugin', 'dependency', 'platform', 'environment', 'user_input', 'unknown'], false),
      plugin: PLUGIN,
    },
    buckets: true, population: 'evaluation findings, each counted once, strengths left out',
    facts: (w, s) => within(findingFacts(w.superadmin), s),
    // Evaluation's waiting summaries: of the findings kept, those waiting for a decision.
    rows(_w, kept) {
      const rows = refs<FindingRef>(kept).flatMap((f) => (f.row ? [f.row] : []));
      const drilled = newest(rows, (f) => Date.parse(f.waitingSince), (f) => f.id, () => '/platform/evaluation');
      return { rows: drilled, total: drilled.length };
    },
  },
  scores: {
    dims: { plugin: PLUGIN },
    buckets: true, population: "plugins whose latest scoring by the window's end is established and inside it",
    facts(w, s) {
      const endMs = Math.min(midnight(addDays(s.to, 1)) - 1, now());
      return within(scoredBy(endMs, w.superadmin).filter((p) => p.standing === 'established')
        .map((p) => ({ day: localDay(Date.parse(p.scoredAt)), keys: { plugin: p.plugin }, n: 1, lastMs: Date.parse(p.scoredAt), ref: p })), s);
    },
    rows(_w, kept) {
      const rows = newest(refs<ReturnType<typeof scoredBy>[number]>(kept), (p) => Date.parse(p.scoredAt), (p) => p.plugin, () => '/platform/evaluation');
      return { rows, total: rows.length };
    },
  },
  lessons: {
    dims: {
      shelf: {
        has: (w, v) => (w.superadmin ? teamSlugs().includes(v) : v === 'own' || v === 'shared'),
        fixed: (w) => (w.superadmin ? [] : w.activeTeam !== null && w.activeTeam !== SHARED_TEAM ? ['own', 'shared'] : ['shared']),
        refuse: (w) => (w.superadmin ? "shelf must be a team's slug" : 'a filter on shelf takes one of own, shared'),
        none: "Other teams' shelves",
        label: (key, w) => (w.superadmin ? key : key === 'own' ? "Your team's shelf" : 'The shared shelf'),
      },
      kind: vocabularyOf('kind', KINDS),
      imported: vocabularyOf('imported', ['imported', 'not_imported']),
    },
    buckets: true, population: 'lessons made on every shelf, imports told apart',
    notDrilled: 'lessons are not drilled: Knowledge health counts them and lists none',
    facts: (w, s) => within(lessonFacts(), s).map((f) => ({ ...f, keys: { ...f.keys, shelf: shelfOf(f.keys.shelf!, w) } })),
  },
  searches: {
    dims: { found: vocabularyOf('found', ['found', 'nothing']), widened: { ...vocabularyOf('widened', ['widened', 'not_widened']), none: 'Widening not recorded' } },
    buckets: true, population: 'real-work searches that recorded their results', drillSuperadmin: true,
    facts: (_w, s) => within(searchFacts(), s),
    // The questions Knowledge health lists, last asked inside the window, when the kept searches hold one that found
    // nothing: the fixture dates its questions on their own, not by the searches' days. Newest first.
    rows(_w, kept, _want, span) {
      const nothing = kept.some((f) => f.keys.found === 'nothing');
      const asked = nothing ? questionRows().filter((q) => inSpan(localDay(Date.parse(q.lastAskedAt)), span)) : [];
      const rows = newest(asked, (q) => Date.parse(q.lastAskedAt), (q) => `${q.question}\0${q.shelf}`, () => '/platform/knowledge');
      return { rows, total: rows.length };
    },
  },
  model_calls: {
    dims: { model: { has: () => false, refuse: () => 'model must be a model the platform has called', none: 'No model' } },
    buckets: true, population: "the platform's own model calls",
    notDrilled: 'model calls are not drilled: Usage counts them and lists none',
    facts: (_w, s) => within(modelFacts(), s),
  },
  teams: {
    dims: { status: vocabularyOf('status', ['active', 'archived']) },
    superadmin: true, stock: true, buckets: false, population: "every team made by the window's end",
    facts: (_w, s) => teamRows().filter((t) => t.created <= s.to)
      .map((t) => ({ day: t.created, keys: { status: t.status }, n: 1, lastMs: midnight(t.created), ref: t })),
    rows(_w, kept) {
      const rows = newest(refs<ReturnType<typeof teamRows>[number]>(kept).map((t) => ({ ...t })), (t) => midnight(t.created), (t) => t.slug, (t) => `/platform/teams/${t.slug}`);
      return { rows, total: rows.length };
    },
  },
  people: {
    dims: { role: vocabularyOf('role', ['superadmin', 'member']), state: vocabularyOf('state', ['active', 'deactivated']) },
    superadmin: true, stock: true, buckets: false, population: "every person added by the window's end",
    facts: (_w, s) => personRows().filter((p) => p.created <= s.to)
      .map((p) => ({ day: p.created, keys: { role: p.role, state: p.state }, n: 1, lastMs: midnight(p.created), ref: p })),
    rows(_w, kept) {
      const rows = newest(refs<ReturnType<typeof personRows>[number]>(kept), (p) => midnight(p.created), (p) => p.email, () => '/platform/people');
      return { rows, total: rows.length };
    },
  },
  sign_ins: {
    dims: { role: vocabularyOf('role', ['superadmin', 'member']) },
    superadmin: true, buckets: true, population: 'recorded console sign-ins',
    facts: (_w, s) => within(signInFacts(), s),
    // People's rows of the people who signed in, the latest kept sign-in first.
    rows(_w, kept) {
      const latest = new Map<string, number>();
      for (const f of kept) latest.set(String(f.ref), Math.max(latest.get(String(f.ref)) ?? 0, f.lastMs));
      const rows = newest(personRows().filter((p) => latest.has(p.email)), (p) => latest.get(p.email)!, (p) => p.email, () => '/platform/people');
      return { rows, total: rows.length };
    },
  },
  audit: {
    dims: {
      kind: { has: (_w, v) => /^[a-z_]+(\.[a-z_]+)?$/.test(v), refuse: () => 'kind must be an event kind', none: 'No kind' },
      team: TEAM,
    },
    superadmin: true, buckets: true, population: 'recorded events, page views left out',
    facts: (_w, s) => within(auditFacts(), s),
    // Audit's rows of the kept events, in Audit's order.
    rows(_w, kept) {
      const combos = new Set(kept.map((f) => `${f.day}\0${f.keys.kind}\0${f.keys.team ?? ''}`));
      const rows = auditRows().filter((r) => combos.has(`${localDay(Date.parse(r.at))}\0${r.kind}\0${r.team ?? ''}`)).map((r) => ({ ...r, address: '/platform/audit' }));
      return { rows, total: kept.reduce((n, f) => n + f.n, 0) };
    },
  },
};
