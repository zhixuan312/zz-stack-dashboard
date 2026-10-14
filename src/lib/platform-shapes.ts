/**
 * What the Platform workspace's reads say: the shapes every figure arrives in, and each /platform route's payload.
 * Split from api-shapes.ts, which holds the Work routes; the gateway is the author of every shape here too.
 */

/* /platform/status */

/* The shapes every figure a destination draws arrives in, as the gateway writes them: one read cutoff per response,
 * every number finite, and null never meaning zero. COUPLED: the gateway's console/figures.ts and console/findings.ts. */
export type Figure = {
  value: number | null;
  why: 'no_data' | 'insufficient' | 'unavailable' | null;   // null when the value stands
};
export type Window = {
  from: string; to: string;       // requested half-open interval [from, to)
  observedFrom: string | null; observedThrough: string | null;
  complete: boolean;              // ended AND fully observed under this definition
};
export type PeriodFigure = {
  window: Window; figure: Figure;
  numerator: number | null; denominator: number | null;
};
export type ReadMeta = {
  asOf: string; timezone: string;
  period: { from: string; to: string };
  scope: 'active-team' | 'caller-in-active-team' | 'platform-public' | 'platform-admin';
  population: string; coverageFrom: string | null;
};
export type Part<T> = { state: 'ok'; data: T } | { state: 'unavailable'; reason: string };
type MeasureKey = 'malformed_per_1000' | 'same_tool_followup_pct' | 'call_p50_ms' | 'call_p95_ms'
  | 'searches_with_results_pct' | 'bugs_per_1000' | 'sessions' | 'work_finished';
export type Measure = {
  key: MeasureKey; weeks: PeriodFigure[];
  first: PeriodFigure | null; best: PeriodFigure | null;
  last: PeriodFigure | null; previous: PeriodFigure | null;
  highest: PeriodFigure | null; lowest: PeriodFigure | null;
  better: 'up' | 'down' | 'neutral';
  judgement: 'improved' | 'worsened' | 'unchanged' | 'neutral' | 'not_comparable';
  finding: Finding | null;        // null when nothing holds: the page draws no finding
  /* What a measure's page draws beside its weeks, one entry a week and on the measure it belongs to: the refusals
   * behind refusals put right; the calls with no usable duration beside each latency; the share of searches widened
   * and the refused searches beside searches that found something; the calls with no session beside sessions. A
   * measure whose counts could not be read carries its arrays empty. */
  followupCounts?: { refusals: number; eligible: number; missingSession: number; withinLookahead: number }[];
  missingDuration?: number[];
  widened?: PeriodFigure[];
  failed?: number[];
  withoutSession?: number[];
};
/* The one sentence a figure is said in, chosen by the gateway (console/findings.ts) so the page and the assistant say
 * the same thing; `dates` are the local dates it names, in the read's timezone. */
type Finding = {
  kind: 'best_week' | 'high_week' | 'low_week' | 'run' | 'no_failure' | 'count' | 'incomplete';
  text: string; dates: string[]; tie: boolean;
};
type NeedKind = 'bugs' | 'evaluation' | 'approvals' | 'drift' | 'door';
type Need = {
  kind: NeedKind; title: string; detail: string;
  instanceCount: number; oldestAt: string | null;
  href: string | null; tone: 'critical' | 'warning';
};
type Needs = {
  state: 'complete' | 'partial' | 'unavailable'; rows: Need[];
  total: number | null; knownCount: number;   // instances found by the checks that completed; equal to total when all did
  unavailableKinds: NeedKind[];
  overflowByKind: Partial<Record<NeedKind, number>>;
  /* The sentence the page leads with, chosen by the gateway for the reader: `N things need you` (the superadmin) or
   * `N things are known and open` (a member), `Nothing needs you` or `No known open issues` when every check found
   * nothing, `N known issues; some checks unavailable`, or `Status checks unavailable`. */
  headline: string;
};
/* One door's real-work calls by local day, from where the record begins (at most 365 days) through today, which is not
 * complete; its totals over those days, `others` the refusals classified `other`, which the page draws beside tool
 * failures, and fault days counted over complete days only, `lastFaultDay` null for none recorded; its run of days
 * under 1% tool failures, null under three; and the one finding said of them. */
type DoorObservation = {
  door: 'core' | 'manage' | 'eval';
  days: { date: string; calls: number | null; toolFailures: number | null;
    state: 'clear' | 'marked' | 'red' | 'none' | 'unavailable'; complete: boolean }[];
  totals: { calls: number; toolFailures: number; others: number; faultDays: number; lastFaultDay: string | null };
  run: { days: number; atLeast: boolean; through: string } | null;
  finding: Finding;
};
/** `GET /platform/status`: the platform's own health, answered alike to everyone signed in. */
export type PlatformStatus = {
  meta: ReadMeta; needs: Needs; measures: Measure[];
  records: Part<{ daysWithWork: number; daysUnderOnePercent: number;
    longestUnderOnePercent: { days: number; from: string; to: string } | null }>;
  doors: Part<DoorObservation[]>;
  running: Part<{ platform: string; console: string | null; releasedAt: string;
    previous: string | null; migrations: number | null }>;
  own: Part<{ malformed: PeriodFigure[]; followup: PeriodFigure[]; sessions: PeriodFigure[];
    bugs: { filed: number; fixed: number; notABug: number; duplicate: number; open: number } }>;
};

/* /platform/releases, /platform/bugs, /platform/evaluation, answered alike to everyone signed in; a superadmin's answer
 * adds only what a comment below names. COUPLED: the gateway's console/platform-{releases,bugs,evaluation}.ts. */

/* /platform/releases */

type ReleaseWindow = {
  window: Window; calls: Figure; malformed: Figure; malformedPer1000: Figure; toolFailures: Figure; p95Ms: Figure;
  overlappingVersions: string[];
};
export type ReleaseRow = {
  version: string; consoleVersion: string | null; releasedAt: string; summary: string;
  clientAction: string | null; before: ReleaseWindow; after: ReleaseWindow;
};
export type ReleaseDetail = ReleaseRow & { changelog: string; upgradeNotes: string | null };
export type Releases = {
  meta: ReadMeta;
  tiles: {
    releases: number; lastWeek: number;
    latest: { version: string; releasedAt: string } | null;
    migrations: { applied: number; lastAt: string | null };
  };
  weeks: { window: Window; releases: number; malformedPer1000: PeriodFigure }[];
  rows: Part<{ rows: ReleaseRow[]; total: number }>;
};

/* /platform/bugs */

type BugImpact = 'blocks_work' | 'wrong_result' | 'confusing' | 'cosmetic';
type BugStatus = 'open' | 'fixed' | 'not_a_bug' | 'duplicate';
export type PublicBugRow = {
  id: string;
  title: string;                  // generated public template, not zz.bug.title
  impact: BugImpact;
  surface: string | null;         // canonical server vocabulary only
  filedAt: string;
  platformVersion: string | null; // the version it was filed against, as zz.bug records it
  status: BugStatus; resolvedAt: string | null;
};
/** A queue row as the superadmin reads it. */
export type AdminBugRow = PublicBugRow & { internalTitle: string; team: string | null };
/** `GET /platform/bugs/:id`, the superadmin's alone. */
export type BugReport = {
  id: string; title: string; detail: string; surface: string | null; impact: string; status: string;
  platformVersion: string | null; reportedAt: string; resolvedAt: string | null;
  resolution: string | null; duplicateOf: string | null; team: string | null;
};
export type Bugs = {
  meta: ReadMeta;
  counts: Part<{
    open: number; resolved: number;
    byImpact: Record<BugImpact, number>; byStatus: Record<BugStatus, number>;
  }>;
  oldestOpenAt: string | null; medianResolveHours: Figure;
  cohorts: {
    week: string; filed: Figure; resolved: Figure; stillOpen: Figure; filedPer1000: Figure; medianResolveHours: Figure;
  }[];
  queue: Part<{ rows: PublicBugRow[]; total: number }>;
};
export type BugResolveInput =
  | { status: 'fixed' | 'not_a_bug'; resolution: string; duplicate_of?: never }
  | { status: 'duplicate'; resolution: string; duplicate_of: string };

/* /platform/evaluation */

/** A finding awaiting a decision, in the form everybody may read; the superadmin's row adds its `pattern`. */
export type SafeFinding = {
  id: string; plugin: string; kind: 'defect' | 'unknown'; owner: string; measure: string | null;
  waitingSince: string; summary: string;
};
type ProtocolRef = { key: string | null; version: number };   // key null for a member: the owning team's words
export type Evaluation = {
  meta: ReadMeta;
  tiles: { waiting: number; established: number; lastScored: string | null; daysScored: number };
  plugins: Part<{
    plugin: string; score: Figure; lower: number | null; upper: number | null;
    standing: 'established' | 'provisional' | 'not_established';
    guardrails: 'pass' | 'fail' | 'not_established'; protocol: ProtocolRef; scoredAt: string;
  }[]>;
  history: Part<{
    plugin: string; statement: string;
    series: {
      protocol: ProtocolRef; population: string | null;
      runs: { scoredAt: string; score: number | null; lower: number | null; upper: number | null; standing: string }[];
    }[];
  }[]>;
  byDecision: Part<Record<'applied' | 'rejected' | 'deferred', number>>;
  byOwner: Part<Record<string, number>>;
  waiting: Part<{ rows: SafeFinding[]; total: number }>;
};
