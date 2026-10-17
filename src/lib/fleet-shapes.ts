/**
 * What the Platform workspace's Fleet reads say: Teams, People, Usage, Audit and Knowledge health.
 * Split from platform-shapes.ts, which holds Status, Releases, Bugs and Evaluation and the shapes every figure arrives in;
 * the gateway is the author of every shape here too. COUPLED: the gateway's console/teams.ts, console/people.ts and
 * console/platform-{usage,audit,knowledge}.ts.
 */
import type { Figure, Part, PeriodFigure, ReadMeta, Window } from './platform-shapes';

/* /teams and /teams/:slug, the superadmin's */

/** A team as Teams draws it: the team, and beside it its figures against its own past. */
export type TeamRow = {
  slug: string; name: string; status: string; created: string;
  people: number;                 // its memberships
  openWork: number;               // its initiatives not closed
  waiting: number;                // its revisions presented and not approved, as the platform's pending query counts them
  lessons: number;                // its shelf's lessons whose lifecycle is adopted
  sessions: PeriodFigure[];       // by Monday week, the running one not complete
  calls: { last: PeriodFigure; previous: PeriodFigure };
  lastActive: string | null;      // its latest real-work call; null when it has none
};
/** `GET /teams`: the tiles over every team, and one page of the rows the filters match, `total` of them. */
export type Teams = {
  meta: ReadMeta;
  tiles: { teams: number; openWork: number; pending: number; lessons: number };
  teams: TeamRow[]; total: number;
};
/** `GET /teams/:slug`: the team, its members, its row's tiles and its calls by week. */
export type TeamDetail = {
  team: { slug: string; name: string; status: string; created: string };
  members: { email: string; name: string; role: string; joined: string }[];
  meta: ReadMeta;
  tiles: { people: number; openWork: number; waiting: number; lessons: number };
  calls: PeriodFigure[];
};

/* /people, the superadmin's */

/** A person as People draws them, and the day they were added, which the rows sort by. */
export type PersonRow = {
  email: string; name: string; role: string;
  created: string;                // the local day they were added
  teams: string[];                // `<slug> (<role>)`, one entry per membership
  passkeys: number;
  lastSignIn: string | null;      // the latest recorded sign-in; null when none was recorded, never a guessed date
  state: 'active' | 'deactivated';
};
/** `GET /people`: the tiles over everybody, and one page of the rows the filters match, `total` of them. */
export type People = {
  meta: ReadMeta;
  tiles: { people: number; withPasskey: number; neverSignedIn: number; signInsLastWeek: PeriodFigure };
  people: PersonRow[]; total: number;
};

/* /platform/usage */

/** One figure by week, with the last complete week and the one before it named. */
export type Tile = { weeks: PeriodFigure[]; last: PeriodFigure; previous: PeriodFigure };
/** The platform's own model calls in one week. Nothing records what they cost. */
export type ModelWeek = { window: Window; calls: number; failed: number; inputTokens: number; outputTokens: number };
/** `GET /platform/usage`: real-work calls unless a part says otherwise. A week's `parts` are the three teams with the
 *  most calls and `Other`, the superadmin's alone; a member's are null. */
export type Usage = {
  meta: ReadMeta;
  tiles: Part<{ calls: Tile; refusedShare: Tile; p95Ms: Tile; sessions: Tile }>;
  callsByWeek: Part<{ weeks: { window: Window; calls: Figure; parts: { label: string; calls: number }[] | null }[] }>;
  traffic: Part<{ window: Window; work: number; maintenance: number }>;
  refusals: Part<{ window: Window; guardrail: number; ours: number; theirs: number; other: number; maintenance: number }>;
  followup: Part<{ weeks: { window: Window; putRight: PeriodFigure; medianSeconds: Figure; sessionsContinued: PeriodFigure; unassessable: number }[] }>;
  tools: Part<{
    rows: { tool: string; first: { window: Window; medianMs: Figure; calls: number }; last: { window: Window; medianMs: Figure; calls: number } }[];
    total: number;
  }>;
  rhythm: Part<{ timezone: string; window: Window; values: number[][] }>;   // seven rows from Monday, 24 hours each
  mostUsed: Part<{ rows: { tool: string; calls: number }[]; total: number }>;
  perApproval: Part<{ last: PeriodFigure; previous: PeriodFigure }>;
  modelCalls: Part<{ last: ModelWeek; previous: ModelWeek; byPurpose: { purpose: string; calls: number }[]; cost: 'not_recorded' }>;
};

/* /platform/audit, the superadmin's */

/** One event as metadata: never its detail, its refusal's text or a subject that could be free text. */
export type AuditRow = {
  id: string; at: string;
  actor: string | null;           // the person's email; null when nobody was recorded
  team: string | null; kind: string;
  subject: string | null;         // only for the kinds whose subject is a slug, an email, an id or a tool
  ok: boolean | null;
  refusalOwner: 'guardrail' | 'ours' | 'theirs' | 'other' | null;
  origin: 'work' | 'platform';
  inConsole: boolean;
  sentence: string | null;        // an act of administration, said from a fixed template; null for every other event
};
export type Audit = {
  meta: ReadMeta; filter: 'administration' | 'all';
  rows: AuditRow[];
  total: number;                  // the matching events, at most the ceiling
  ceiling: 500;
  notRecorded: string[];          // the acts of administration that leave no event
};

/* /platform/knowledge */

/** `GET /platform/knowledge`. A member's shelves are `own`, `shared` and `all`, and their `questions` null; the
 *  superadmin's shelves are named by slug, with `all`. */
export type KnowledgeHealth = {
  meta: ReadMeta;
  tiles: Part<{
    standing: number;
    madeLastWeek: { last: PeriodFigure; previous: PeriodFigure };
    searches: { last: PeriodFigure; previous: PeriodFigure };
    noResult: { last: PeriodFigure; previous: PeriodFigure };
  }>;
  shelves: Part<{ rows: {
    shelf: string; kind: 'own' | 'shared' | 'team' | 'all';
    standing: number; superseded: number; imported: number; madeLastWeek: number; searchesLastWeek: number; noResult: PeriodFigure;
  }[] }>;
  made: Part<{ exactFrom: string | null; weeks: { window: Window; made: Figure; importedExact: number; importedByDay: number }[] }>;
  searches: Part<{ weeks: { window: Window; noResult: PeriodFigure; widened: PeriodFigure; meanResults: Figure }[] }>;
  cohorts: Part<{ rows: { window: Window; made: number; supersededSince: number; imported: number; basis: 'exact' | 'by_day' | null }[] }>;
  byKind: Part<{ kind: string; standing: number }[]>;
  questions: Part<{ window: Window; rows: { question: string; shelf: string; asked: number; lastAskedAt: string }[]; total: number }> | null;
};
