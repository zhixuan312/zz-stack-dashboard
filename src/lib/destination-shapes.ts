/**
 * What Work's remaining destinations read: Knowledge, Activity, Runs, the plugins' public score and Access. Split from
 * work-shapes.ts, which holds Home, Record, Initiatives and Approvals, and platform-shapes.ts, which holds the shapes
 * every figure arrives in; the gateway is the author of every shape here too. COUPLED: the gateway's
 * console/knowledge.ts, console/knowledge-summary.ts, console/refusals.ts, console/activity.ts, console/runs.ts,
 * console/runs-observed.ts, console/catalog.ts, console/platform-evaluation.ts and console/access.ts.
 */
import type { KnowledgeNode } from './api-shapes';
import type { Figure, Part, PeriodFigure, ReadMeta, Window } from './platform-shapes';

/* /knowledge */

/** A lesson on the team's shelf, as the list answers it: the list's row is the one the shelf has always answered. */
export type KnowledgeRow = KnowledgeNode;
/** One lesson among the newest the team recorded. */
type NewLesson = { team: string; path: string; title: string; kind: string; createdAt: string; imported: boolean };
/** A question the team asked whose search found nothing, normalised for case and spacing. */
type Question = { question: string; asked: number; lastAsked: string };
/** `GET /knowledge/summary`: the active team's shelf as of the cutoff, its own questions that found nothing and its
 *  searches by week; a search that found something is retrieval coverage, never an answer. */
export type KnowledgeSummary = {
  meta: ReadMeta;
  tiles: { standing: Figure & { imported: number }; superseded: Figure; searches: PeriodFigure; noResult: PeriodFigure };
  questions: Part<{ rows: Question[]; total: number }>;
  weeks: Part<PeriodFigure[]>;
  newest: Part<NewLesson[]>;
};
/** `GET /knowledge?q&kind&limit&offset`: the team's shelf, filtered and paged on the server, with the whole filtered
 *  population counted by kind and standing. */
export type KnowledgeList = {
  meta: ReadMeta; rows: KnowledgeRow[]; total: number;
  summary: { byKind: Record<string, number>; standing: number; superseded: number };
};

/* /activity */

/** Who a refusal is put down to: a guardrail that held, a malformed call, a tool that failed, or anything else. */
export type RefusalOwner = 'guardrail' | 'ours' | 'theirs' | 'other';
/** The team's refusals of one owner, tool and message normalised for case, digits and identifiers; `message` is the
 *  group's most recent stored text, null for a refusal recorded with none. */
export type RefusalGroup = { owner: RefusalOwner; tool: string; message: string | null; count: number; lastSeen: string };
/** One week of the team's real-work calls: the refused among them by owner, the owners summing to `refused`. */
type RefusalWeek = { window: Window; complete: boolean; calls: number; refused: number; owners: Record<RefusalOwner, number> };
/** `GET /activity/summary`: last whole week's calls and refusals, the four owners by week, the team's refusals grouped,
 *  and the maintenance left out of all of it. */
export type ActivitySummary = {
  meta: ReadMeta;
  tiles: {
    calls: PeriodFigure;
    refused: PeriodFigure & { owners: Record<RefusalOwner, number> };
    mostRefused: { tool: string; count: number; of: number } | null;
  };
  weeks: Part<RefusalWeek[]>;
  groups: Part<{ rows: RefusalGroup[]; groups: number; rest: { groups: number; count: number } | null }>;
  maintenance: { calls: number; refused: number };
};
/** One event of the team's real work; a refused call carries its owner and its stored message. */
export type ActivityRow = {
  id: string; ts: string; kind: string; tool: string | null; initiative: string | null; step: string | null;
  ok: boolean | null; owner: RefusalOwner | null; message: string | null; actor: string | null;
};
/** `GET /activity?kind&tool&initiative&refused&limit&offset`: the team's real-work events newest first, filtered before
 *  the latest 500 are taken, and paged; `kinds` and `tools` are the values the filters may take. */
export type ActivityLog = { meta: ReadMeta; rows: ActivityRow[]; total: number; ceiling: 500; kinds: string[]; tools: string[] };

/* /runs */

/** One run of a skill, from its first call to its last: `active` while the last call is within five minutes of the
 *  cutoff, never drawn as running beyond it; `bytes` is its observed output, null when nothing was measured. */
export type RunRow = {
  id: string; skill: string; initiative: string | null; startedAt: string; lastCallAt: string;
  calls: number; refusals: number; bytes: number | null; lengthMs: number;
  state: 'active' | 'last_call' | 'one_call';
};
/** One skill's runs: typical length is the median over its runs longer than one call, `timed` of them. */
export type SkillRunRow = {
  skill: string; runs: number; callsPerRun: number; shareRefused: number | null; outputPerRun: number | null;
  typicalMs: number | null; timed: number;
};
/** `GET /runs?skill&limit&offset`: every recorded run of the team since its first, by skill and lately. */
export type Runs = {
  meta: ReadMeta; since: string | null;
  tiles: { runs: Figure; outputPerRun: Figure & { unmeasured: number }; largest: RunRow | null };
  coverage: { coverageMs: number; summedMs: number; peak: number; oneCall: number };
  bySkill: Part<{ rows: SkillRunRow[] }>;
  recent: Part<{ rows: RunRow[]; total: number }>;
};

/* /plugins */

/** A plugin's latest public score, out of 10, as the platform's Evaluation read selects it; the protocol's key is the
 *  owning team's words and reaches the superadmin alone. */
export type PluginScore = {
  value: number; lower: number | null; upper: number | null;
  standing: 'established' | 'provisional' | 'not_established';
  protocol: { key: string | null; version: number };
  scoredAt: string;
};

/* /access */

/** One of the caller's tokens: labels and dates, and the application it was minted for; never its value. */
export type AccessToken = { id: string; label: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; application: string | null };
/** An application the caller authorised, by the tokens minted for them through it. */
export type AccessApplication = { client: string; name: string; issuedCount: number; firstAt: string; lastUsedAt: string | null };
/** A browser the caller is signed in on, by its session's id; never its cookie, its hash or its address. */
export type AccessBrowser = { id: string; current: boolean; userAgent: string | null; issuedAt: string; lastSeenAt: string | null; expiresAt: string };
/** A passkey the caller registered: its label, transports and dates, never its credential. */
export type AccessPasskey = { label: string | null; transports: string[]; createdAt: string; lastUsedAt: string | null };
/** `GET /access`: the caller's own, and nothing named after a token or a key, so the gateway's redaction leaves it be. */
export type Access = {
  meta: ReadMeta;
  issued: AccessToken[];
  applications: AccessApplication[];
  browsers: AccessBrowser[];
  authenticators: AccessPasskey[];
  teams: { actingFor: string | null; teams: { team: string; role: string; active: boolean }[] };
  setup: { client: string; config: string };
};
/** `DELETE /settings/me/applications/:client` and `/settings/me/browsers/:id`. */
export type Revoked = { ok: true; revoked: number };
