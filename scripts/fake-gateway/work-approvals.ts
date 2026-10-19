/**
 * The fake gateway's approvals: what `GET /api/console/approvals?tab=waiting|history&limit&offset` answers.
 *
 * One record, the documents' own. Waiting is the team's queue, the revisions presented and not approved in its open
 * work, each read off its document as the store holds it now, which nothing records as anybody's in particular; History
 * is every approval the documents' versions record (work.ts), with its signer, its snapshot and when it was made, and a
 * caller reads only the ones signed in their own name, in their active team. So an approval on Approvals is the one its
 * document's page names, by the same person, at the same time, of a version written before it (Work M-1). Both people
 * act for atlas, so both read one queue and two different histories: neither reads the other's approvals, and an
 * approval somebody signed in beacon is read by nobody acting for atlas.
 *
 * What the documents do not hold is the approval's evidence, where it was shown and on what basis it was decided, which
 * the gateway classifies from the approval's review context; that is `EVIDENCE` below, one entry per approved version.
 * An approval made before presentations were recorded (`coverageFrom`, the first week's start) is read from its
 * revision, dated by its day alone, and nothing is known of how it was shown.
 *
 * The rows cover the states the page draws: a revision waiting longer than 14 days, every class of presentation, both
 * recorded decision bases and the unknown one, and more than ten approvals in the superadmin's name so History pages,
 * the one sealed before the events began on its second page. A journey session's approval leaves its queue and joins
 * its history, for that session alone (journey.ts).
 *
 * COUPLED: zz-stack's `checks/console-work-approvals.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { DocumentDetail, Me } from '../../src/lib/api-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import type { ApprovalEvidence, ApprovalRow, Approvals, WaitingRow } from '../../src/lib/work-shapes.ts';
import { ago } from './clock.ts';
import { kept } from './journey.ts';
import { printedDay } from './platform-releases.ts';
import { WEEKS, tally, workMeta } from './work-initiatives.ts';
import { INITIATIVES, contentRevisionOf, documentDetail, initiativeDetail } from './work.ts';

type Answer = [status: number, body: unknown];

/** The revisions presented and not approved in each team's open work, oldest wait first: the document and when it was
 *  presented. Its version and content revision are the document's own, as the store holds it when the queue is read. */
const QUEUE: { team: string; initiative: string; path: string; waitingSince: string }[] = [
  { team: 'atlas', initiative: '2026-10-04-index-rebuild', path: 'spec.md', waitingSince: ago(17 * 24) },
  { team: 'atlas', initiative: '2026-10-02-query-latency', path: 'spec.md', waitingSince: ago(70) },
  { team: 'atlas', initiative: '2026-10-03-ranking-weights', path: 'spec.md', waitingSince: ago(30) },
  { team: 'atlas', initiative: '2026-09-28-search-relevance', path: 'plan.md', waitingSince: ago(2) },
  { team: 'beacon', initiative: '2026-09-30-refund-flow', path: 'spec.md', waitingSince: ago(9) },
];

type Evidence = [presentation: ApprovalEvidence['presentation'], decisionBasis: ApprovalEvidence['decisionBasis']];

/**
 * How each approved version was shown and decided, as the gateway classifies it, by `<initiative>/<path>@v<version>`.
 * One sealed before presentations were recorded is unknown whatever it says here, so it has no entry.
 */
const EVIDENCE: Record<string, Evidence> = {
  '2026-09-28-search-relevance/spec.md@v3': ['console_revision_shown', 'explicit_recorded'],
  '2026-10-08-result-explanations/spec.md@v1': ['console_revision_shown', 'explicit_recorded'],
  '2026-10-08-result-explanations/plan.md@v1': ['agent_context_covered', 'standing_delegation_recorded'],
  '2026-10-08-result-explanations/review.md@v1': ['console_revision_shown', 'explicit_recorded'],
  '2026-09-12-onboarding-revamp/spec.md@v1': ['agent_context_covered', 'explicit_recorded'],
  '2026-09-12-onboarding-revamp/plan.md@v1': ['not_recorded', 'explicit_recorded'],
  '2026-09-12-onboarding-revamp/review.md@v1': ['console_revision_shown', 'explicit_recorded'],
  '2026-09-12-onboarding-revamp/handover.md@v1': ['agent_context_covered', 'explicit_recorded'],
  '2026-09-15-tagging-model/spec.md@v1': ['agent_context_covered', 'explicit_recorded'],
  '2026-08-25-eval-harness/spec.md@v1': ['agent_context_covered', 'explicit_recorded'],
  '2026-08-25-eval-harness/plan.md@v1': ['agent_context_covered', 'standing_delegation_recorded'],
  '2026-08-25-eval-harness/review.md@v1': ['agent_context_covered', 'standing_delegation_recorded'],
  '2026-08-25-eval-harness/handover.md@v1': ['not_recorded', 'unknown'],
  '2026-08-14-citation-graph/plan.md@v1': ['console_revision_shown', 'explicit_recorded'],
  '2026-08-14-citation-graph/review.md@v1': ['agent_context_covered', 'explicit_recorded'],
  '2026-08-14-citation-graph/handover.md@v1': ['agent_context_covered', 'unknown'],
};

/** When presentations began to be recorded: an approval before it is read from its revision, by its day alone. */
const COVERAGE_FROM = WEEKS[0].from;

type Signed = ApprovalRow & { team: string; signer: string };

/**
 * Every approval the documents of `team` record, newest first: each version approved, and each approval a later row
 * of its version superseded, with the snapshot approved, its signer and when. One signed on somebody's behalf is theirs,
 * so it carries their address and not the one of whoever pressed; one the record names nobody for is nobody's history.
 */
export function approvalsOf(team: string | null): Signed[] {
  const out: Signed[] = [];
  for (const i of INITIATIVES.filter((x) => x.team === team)) {
    for (const row of initiativeDetail(i.team, i.slug)!.documents.filter((x) => x.gated)) {
      const d = documentDetail(i.team, i.slug, row.path)!;
      for (const v of d.versions) {
        const sealed = v.status === 'approved' ? null : v.superseded_approved;
        if (v.status !== 'approved' && !sealed) continue;
        const signer = sealed ? sealed.approved_by : v.approved_by;
        const at = sealed ? sealed.approved_at : v.updated_at;
        if (!signer || !at) continue;
        const revision = sealed ? sealed.revision : v.revision;
        const before = at < COVERAGE_FROM;
        const [presentation, decisionBasis] = before ? ['unknown', 'unknown'] as Evidence : EVIDENCE[`${i.slug}/${row.path}@v${v.version}`] ?? ['unknown', 'unknown'];
        out.push({
          team: i.team, signer, initiative: i.slug, path: row.path, version: v.version,
          contentRevision: sealed?.content_revision ?? contentRevisionOf(i.team, i.slug, row.path, revision),
          approvedAt: before ? at.slice(0, 10) : at, presentation, decisionBasis,
        });
      }
    }
  }
  // Newest first; one dated by its day alone is read at that day's midnight.
  const ms = (a: Signed) => Date.parse(a.approvedAt.length === 10 ? `${a.approvedAt}T00:00:00Z` : a.approvedAt);
  return out.sort((a, b) => ms(b) - ms(a) || a.initiative.localeCompare(b.initiative) || a.path.localeCompare(b.path));
}

/** When `team` first had a document approved, by anyone: the earliest approval, one dated by its day alone at that
 *  day's midnight, as Record's firsts read it; null with none. */
export function firstApproval(team: string | null): number | null {
  const at = approvalsOf(team).map((a) => Date.parse(a.approvedAt.length === 10 ? `${a.approvedAt}T00:00:00Z` : a.approvedAt));
  return at.length ? Math.min(...at) : null;
}

/** The approvals a journey session made in `team`, newest first: none outside a journey (journey.ts). */
const approvedIn = (team: string | null) => (kept()?.approved ?? []).filter((a) => a.team === team).reverse();

/** The queue of `team`, oldest wait first, less what a journey session approved of it. */
export const waitingOf = (team: string | null): WaitingRow[] => QUEUE
  .filter((w) => w.team === team && !approvedIn(team).some((a) => a.initiative === w.initiative && a.path === w.path))
  .map(({ team: t, initiative, path, waitingSince }) => {
    const d = documentDetail(t, initiative, path)!;
    return { initiative, path, version: d.current_version, contentRevision: d.content_revision, waitingSince };
  });

/** A journey's approval as History reads it: shown in the console and approved there, the revision the queue held. */
function keptRow(a: { team: string; initiative: string; path: string; at: string }): ApprovalRow {
  const doc = documentDetail(a.team, a.initiative, a.path)!;
  return {
    initiative: a.initiative, path: a.path, version: doc.current_version, contentRevision: doc.content_revision, approvedAt: a.at,
    presentation: 'console_revision_shown', decisionBasis: 'explicit_recorded',
  };
}

/** One document as a journey session left it: approved in the signer's name, when that session approved it. */
export function documentAsKept(d: DocumentDetail | null): DocumentDetail | null {
  const approved = d && approvedIn(d.team).find((a) => a.initiative === d.initiative && a.path === d.path);
  return d && approved ? { ...d, status: 'approved', approved_by: approved.signer, approved_at: approved.at } : d;
}

/** The approvals signed in `email`'s name in `team`, newest first: what History, Home and Record count. */
export const callerApprovalRows = (team: string | null, email: string): ApprovalRow[] => [
  ...approvedIn(team).filter((a) => a.signer === email).map(keptRow),
  ...approvalsOf(team).filter((a) => a.signer === email).map(({ team: _, signer: __, ...a }) => a),
];

/** The calendar day an approval is dated on where the console prints it: its own day when only the day is recorded. */
const dayOfApproval = (a: ApprovalRow): string => (a.approvedAt.length === 10 ? a.approvedAt : printedDay(a.approvedAt));

/**
 * Those approvals by week, the running one not complete. The status fixture's weeks are cut at midnight UTC, while the
 * gateway cuts its weeks, and the console prints an approval's time, in the reporting timezone; so an approval is
 * counted in the week whose days, where the console prints them, hold the day History dates it on: one at 06:00 on a
 * Monday in Singapore is that Monday's week, though it is still Sunday in UTC (Phase 7's third re-review, Work P-1).
 * Home's last-week count is this series' last whole week. COUPLED: `holds` in platform-releases.ts, which counts a
 * release the same way.
 */
export const callerWeeks = (rows: ApprovalRow[]): PeriodFigure[] => WEEKS.map((w, i) => {
  const [from, to] = [printedDay(w.from), printedDay(w.to)];
  return tally(i, rows.map(dayOfApproval).filter((d) => d >= from && d < to).length);
});

const PRESENTATIONS: ApprovalEvidence['presentation'][] = ['console_revision_shown', 'agent_context_covered', 'not_recorded', 'unknown'];
const BASES: ApprovalEvidence['decisionBasis'][] = ['explicit_recorded', 'standing_delegation_recorded', 'unknown'];
const TABS = ['waiting', 'history'];

/** How many rows of each initiative, the most first. */
function byInitiative(rows: { initiative: string }[]): { initiative: string; count: number }[] {
  const n = new Map<string, number>();
  for (const r of rows) n.set(r.initiative, (n.get(r.initiative) ?? 0) + 1);
  return [...n].map(([initiative, count]) => ({ initiative, count })).sort((a, b) => b.count - a.count || a.initiative.localeCompare(b.initiative));
}
const tallied = <K extends string>(keys: K[], of: (k: K) => number) => Object.fromEntries(keys.map((k) => [k, of(k)])) as Record<K, number>;

/**
 * `GET /approvals`, as `who`: the active team's queue and the caller's own history. `tab` chooses which list the page
 * pages; the other answers its first page and its total. 400 for a tab or a page the route does not take.
 */
export function approvals(who: Me, q: URLSearchParams): Answer {
  const tab = q.get('tab') ?? 'waiting';
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  if (!TABS.includes(tab)) return [400, { error: `tab must be one of ${TABS.join(', ')}` }];
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return [400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }];
  const queue = waitingOf(who.activeTeam);
  const mine = callerApprovalRows(who.activeTeam, who.email);
  const pageOf = <T>(rows: T[], paged: boolean) => (paged ? rows.slice(offset, offset + limit) : rows.slice(0, 10));
  const fourteenDaysAgo = ago(14 * 24);
  const recorded = mine.filter((a) => a.presentation !== 'unknown');
  const answer: Approvals = {
    meta: workMeta('caller-in-active-team', `${who.activeTeam}'s revisions waiting, and the approvals signed in the caller's name there`),
    tiles: {
      waiting: queue.length,
      oldestWaitingSince: queue[0]?.waitingSince ?? null,
      inYourName: mine.length,
      noPresentation: { count: recorded.filter((a) => a.presentation === 'not_recorded').length, of: recorded.length },
    },
    weeks: callerWeeks(mine),
    waiting: { state: 'ok', data: {
      rows: pageOf(queue, tab === 'waiting'), total: queue.length, queue: 'team',
      summary: { byInitiative: byInitiative(queue), olderThan14Days: queue.filter((w) => w.waitingSince < fourteenDaysAgo).length },
    } },
    history: { state: 'ok', data: {
      rows: pageOf(mine, tab === 'history'), total: mine.length,
      summary: {
        byPresentation: tallied(PRESENTATIONS, (p) => mine.filter((a) => a.presentation === p).length),
        byDecisionBasis: tallied(BASES, (b) => mine.filter((a) => a.decisionBasis === b).length),
        byInitiative: byInitiative(mine),
      },
    } },
  };
  return [200, answer];
}
