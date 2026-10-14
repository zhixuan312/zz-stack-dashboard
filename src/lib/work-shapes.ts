/**
 * What the Work workspace's reads say: Home, Record, Initiatives, Approvals, the close and the prepared queries.
 * Split from api-shapes.ts, which holds today's routes, and platform-shapes.ts, which holds the shapes every figure
 * arrives in; the gateway is the author of every shape here too. COUPLED: the gateway's console/home.ts,
 * console/record.ts, console/record-slices.ts, console/initiative-list.ts, console/work-figures.ts, console/writing.ts,
 * console/runs-observed.ts, console/home-findings.ts, console/approvals.ts, console/work-query.ts and console-close.ts.
 */
import type { Figure, Finding, Part, PeriodFigure, ReadMeta, Window } from './platform-shapes';

/* /initiatives */

/** Where an initiative goes next, as zz-core's `initiative_status` answers it; the console never derives one. */
export type NextMove = { action: string; stage: string | null; document: string | null; waitingOn: string | null; why: string };
export type InitiativeRow = {
  slug: string; flow: string | null; nextMove: NextMove | null;
  state: 'open' | 'waiting' | 'quiet' | 'accepted' | 'delivered' | 'abandoned';
  gates: { passed: number; of: number };   // the flow's gated documents, the handover left out
  lastTouched: string; opened: string; closed: string | null;
};
type ClosureWeek = { window: Window; accepted: Figure; delivered: Figure; abandoned: Figure };
/** Over the whole filtered population, not the page: a filter changes it, a page does not. */
type ListSummary = {
  total: number;
  byState: Record<InitiativeRow['state'], number>;
  byFlow: { flow: string | null; count: number }[];
  touched: PeriodFigure[];
  previous: { window: Window; total: number };
};
/** `GET /initiatives?state&flow&q&limit&offset`: the active team's initiatives, filtered and paged on the server. */
export type InitiativeList = {
  meta: ReadMeta;
  tiles: { open: number; waiting: number; closed: { accepted: number; delivered: number; abandoned: number } };
  closures: Part<ClosureWeek[]>;
  rows: InitiativeRow[]; total: number;
  summary: Part<ListSummary>;
  nextMoveState: 'ok' | 'partial' | 'unavailable';
};

/* POST /initiatives/:team/:slug/close */

/** The facts a close submits; the platform derives the outcome from them, and refuses a body naming one. */
export type CloseInput = {
  disposition: 'finished' | 'abandoned';
  accepted_by?: string;
  no_signoff_reason?: string;
  document?: string;
};
/** What the close recorded, read back from the initiative after it. */
export type CloseResult = { outcome: 'accepted' | 'delivered' | 'abandoned'; closedBy: string; document: string | null };

/* Words, runs and milestones, the parts Home and Record are made of */

export type WritingCoverage = {
  documents: number; revisions: number; importMade: number; unrecorded: number; mixed: number;
  datedByLastWrite: number; undated: number; missingLegacy: number;
};
/** An estimate of hours at a stated pace, never a measurement: the basis, the words and the coverage travel with it. */
export type WritingEstimate = {
  basis: 'retained_stock' | 'period_net_additions';
  words: number | null; assumedWordsPerHour: number; hours: number | null;
  coverage: WritingCoverage;
};
/** The runs active now, one group a run while there are four or fewer, grouped by initiative above four. */
export type ActiveGroup = { initiative: string | null; runs: { skill: string; startedAt: string; lastAt: string }[] };
type Milestone = { count: 'closed' | 'documents' | 'lessons' | 'words'; next: number; last: number; value: number };

/* /home */

/** `GET /home`: the active team's last week, and what waits; the approvals the caller's alone. */
export type Home = {
  meta: ReadMeta;
  title: { sentence: string; rule: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'fallback' };
  waiting: Part<{ count: number; oldestSince: string | null; one: { initiative: string; path: string; version: number } | null }>;
  words: Part<{ weeks: PeriodFigure[]; finding: Finding | null; coverage: WritingCoverage }>;
  approvals: Part<{ weeks: PeriodFigure[]; finding: Finding | null }>;
  foot: { estimate: WritingEstimate; coverageMs: Figure; peak: Figure };
  tiles: { closed: PeriodFigure; medianHoursToClose: PeriodFigure; searchesWithResults: PeriodFigure; agentDays: PeriodFigure };
  runs: Part<{ active: ActiveGroup[]; more: number; lastRunAt: string | null }>;
  milestones: Part<Milestone[]>;
  openWork: Part<{ rows: InitiativeRow[]; quiet: number; total: number }>;
  closedLastWeek: Part<{ slug: string; outcome: string; closedAt: string }[]>;
};

/* /approvals */

/** What is recorded about one approval: the exact revision, where it was shown, and the basis it was decided on. */
export type ApprovalEvidence = {
  version: number; contentRevision: string;
  approvedAt: string;              // a date alone when only the day was recorded
  presentation: 'console_revision_shown' | 'agent_context_covered' | 'not_recorded' | 'unknown';
  decisionBasis: 'explicit_recorded' | 'standing_delegation_recorded' | 'unknown';
};
export type ApprovalRow = { initiative: string; path: string } & ApprovalEvidence;
/** A revision presented and not approved: the team's queue, since nothing records who must decide it. */
export type WaitingRow = { initiative: string; path: string; version: number; contentRevision: string; waitingSince: string };
/** `GET /approvals?tab=waiting|history&limit&offset`: `tab` pages its own list, the other answers its first page. */
export type Approvals = {
  meta: ReadMeta;
  tiles: { waiting: number; oldestWaitingSince: string | null; inYourName: number; noPresentation: { count: number; of: number } };
  weeks: PeriodFigure[];
  waiting: Part<{
    rows: WaitingRow[]; total: number; queue: 'team';
    summary: { byInitiative: { initiative: string; count: number }[]; olderThan14Days: number };
  }>;
  history: Part<{
    rows: ApprovalRow[]; total: number;
    summary: {
      byPresentation: Record<ApprovalEvidence['presentation'], number>;
      byDecisionBasis: Record<ApprovalEvidence['decisionBasis'], number>;
      byInitiative: { initiative: string; count: number }[];
    };
  }>;
};

/* /record */

type Spread = { median: Figure; largest: Figure };
type WorkSlice = {
  closedByOutcome: { accepted: Figure; delivered: Figure; abandoned: Figure };
  mostOpenAtOnce: { value: Figure; at: string | null };
  medianHoursToClose: PeriodFigure; medianHoursToAbandon: PeriodFigure;
  closuresInAll: PeriodFigure[];
  closuresByWeek: ClosureWeek[];
  medianHoursByWeek: PeriodFigure[];
  typical: { documents: Spread; versions: Spread; sources: Spread; words: Spread };
};
type DocumentsSlice = {
  flowDocuments: Figure; versions: Figure; sourcesUnderGated: Spread; citations: Figure;
  wordsByWeek: PeriodFigure[];
  mostRewritten: { initiative: string; path: string; versions: number }[];
  coverage: WritingCoverage;
};
type KnowledgeSlice = {
  adopted: Figure; adoptedInAll: PeriodFigure[]; ownReturned: Figure; meanResults: Figure; sharedResults: Figure;
  searchesWithResults: PeriodFigure[];
  returnedByKind: { kind: string; results: number }[];
  byKind: { kind: string; lessons: number }[];
};
type AgentsSlice = {
  coverageMs: Figure; summedMs: Figure; peak: Figure; runs: Figure; zeroLength: number; skillsUsed: Figure;
  weekdayHour: number[][];
  days: { day: string; runs: number }[];
  bySkill: { skill: string; runs: number }[];
};
type FirstsSlice = {
  bests: { key: 'most_versions' | 'most_sources' | 'most_words_week' | 'most_open'; value: number; at: string; subject: string | null }[];
  firsts: { key: 'closed' | 'approved' | 'lesson' | 'run' | 'words_week'; at: string }[];
};
/** `GET /record?period=quarter|year|all&limit&offset`: the retained text as of the cutoff, and the period's work. */
export type RecordRead = {
  meta: ReadMeta;
  period: 'quarter' | 'year' | 'all';
  lead: { estimate: WritingEstimate; asOf: string };
  cumulative: PeriodFigure[];
  foot: { closed: Figure; opened: Figure; documents: Figure; versions: Figure; approvalsInYourName: Figure };
  work: Part<WorkSlice>;
  documents: Part<DocumentsSlice>;
  knowledge: Part<KnowledgeSlice>;
  agents: Part<AgentsSlice>;
  firsts: Part<FirstsSlice>;
  record: Part<{
    rows: { slug: string; outcome: string | null; opened: string; closed: string | null; tookHours: number | null; documents: number; lessons: number }[];
    total: number;
    summary: {
      byOutcome: { open: number; accepted: number; delivered: number; abandoned: number };
      byFlow: { flow: string | null; count: number }[];
    };
  }>;
};

/* /work/query */

/** One row of a drilled group: the row its measure's page shows, never a body or a question's text. */
export type WorkQueryRow =
  | InitiativeRow                                                                   // closures, opened
  | { initiative: string; path: string; added: number }                             // words
  | ApprovalRow                                                                     // approvals
  | { kind: string; at: string }                                                    // lessons
  | { skill: string; initiative: string | null; startedAt: string; lengthMs: number } // runs
  | { at: string; found: boolean };                                                 // searches
/** `GET /work/query?measure&by&from&to&compare&state&flow&q&group&limit&offset`: one prepared question, answered. */
export type WorkQuery = {
  meta: ReadMeta;
  measure: string; by: string; window: Window;
  grain: 'week' | 'month' | 'quarter' | null;
  groups: { key: string; label: string; value: Figure; share: number | null; previous: Figure | null }[];
  rest: { groups: number; value: number } | null;
  total: Figure;
  rows: Part<{ rows: WorkQueryRow[]; total: number }> | null;
};
