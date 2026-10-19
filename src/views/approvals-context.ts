/**
 * Approvals' shared context (decision 0011), its address and every word its cards are drawn with: the active team's
 * revisions waiting for a decision, and the approvals recorded in the caller's name there, from the one `Approvals` the
 * gateway answered. The page draws these words and `view_approvals` tells the assistant the same ones from the same
 * response, so both say the figures the screen shows.
 *
 * Nothing here classifies an approval: where a revision was shown and the basis it was decided on are the gateway's
 * classes, read from the record by the approval's own review context and content revision, and said here as they came.
 * `Approved in your name` is all the record supports, so no word here says the person read a revision or signed it at
 * the keyboard. Nothing records who must decide a waiting revision, so Waiting is the team's queue, `Team approvals`.
 *
 * The address keeps the tab and its page; the gateway pages the tab's list, so the page's first read on the console's
 * server, its later reads in the browser, its shared context and `view_approvals` all ask `approvalsPath` for it.
 */
import { plural } from '@/lib/format';
import { encodePath } from '@/lib/store-path';
import { formatCalendarDate, formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { contextText, listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import type { ApprovalEvidence, ApprovalRow, Approvals, WaitingRow } from '@/lib/work-shapes';
import { CONTEXT_BUDGET, addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** How long the console's server waits for the read: half a second under five, for a phone to draw what it says. */
export const APPROVALS_BOUND_MS = 4_500;

/** The two lists, in the order the tabs name them; Waiting when none is named, as the route answers. */
export const APPROVALS_TABS = ['waiting', 'history'] as const;
export type ApprovalsTab = (typeof APPROVALS_TABS)[number];

/** The rows one page of a tab holds, as every table pages. */
export const PAGE_SIZE = 10;

/** The tab and its page the address keeps; `waiting` and `1` are the address with nothing in it. */
export type ApprovalsFilters = { tab: string; page: string };
export const APPROVALS_DEFAULTS: ApprovalsFilters = { tab: 'waiting', page: '1' };

/** The tab asked for, Waiting for anything the route does not take. */
export const tabOf = (f: Pick<ApprovalsFilters, 'tab'>): ApprovalsTab => ((APPROVALS_TABS as readonly string[]).includes(f.tab) ? (f.tab as ApprovalsTab) : 'waiting');
/** The page asked for, from 1, whatever the address holds. */
export const pageOf = (f: Pick<ApprovalsFilters, 'page'>): number => Math.max(1, Math.floor(Number(f.page)) || 1);
/** The page of ten `offset` falls in, from 1. */
export const pageAt = (offset: number): string => String(Math.floor(offset / PAGE_SIZE) + 1);

/** Rows of a tab by the route's own arguments: `limit` of them from `offset`. */
type ApprovalsRows = { limit: number; offset: number };

/** The gateway address of `f`: its tab, and the ten rows of its page unless `rows` names others, as the tool may. */
export function approvalsPath(f: ApprovalsFilters, rows: ApprovalsRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  return `/approvals?${new URLSearchParams({ tab: tabOf(f), limit: String(rows.limit), offset: String(rows.offset) })}`;
}

/** The page's address read back from a gateway path `approvalsPath` wrote: its tab, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): ApprovalsFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { tab: tabOf({ tab: q.get('tab') ?? '' }), page: pageAt(Math.max(0, Number(q.get('offset')) || 0)) };
}

/** The console address of a tab's page, the defaults left out: `/approvals`, `/approvals?tab=history&page=2`. */
export const approvalsAddress = (tab: ApprovalsTab, page = 1): string => addressOf('/approvals', { tab, page: String(page) }, APPROVALS_DEFAULTS);

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): ApprovalsFilters {
  const one = (k: keyof ApprovalsFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? APPROVALS_DEFAULTS[k];
  };
  return { tab: one('tab'), page: one('page') };
}

/**
 * The revision an approval names, as an address: its document's page at that version, which draws that version's text
 * when a later one has replaced it (Work M-6).
 */
export const approvedHref = (team: string, r: Pick<ApprovalRow, 'initiative' | 'path' | 'version'>): string =>
  `/initiatives/${team}/${r.initiative}/${encodePath(r.path)}?version=${r.version}`;

/** The page's own read, as the console's server or the browser made it: the answer with the team it is for, a failure, or no answer in time. */
export type ApprovalsRead =
  | { state: 'ok'; path: string; data: Approvals; team: string | null }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** The sentence a read's trouble is told in, under the table's "did not load" and to the assistant. */
export function approvalsTrouble(read: Exclude<ApprovalsRead, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The read did not answer within ${APPROVALS_BOUND_MS / 1000} seconds.` : read.reason;
}

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  waiting: { label: 'Waiting now', definition: 'Your team\'s revisions presented and not yet approved, each once.' },
  oldest: { label: 'Oldest wait', definition: 'How long the longest-waiting revision has waited, to the read\'s cutoff.' },
  inYourName: { label: 'Approvals in your name', definition: 'Recorded in your name in this team; never a teammate\'s.' },
  noPresentation: { label: 'No presentation recorded', definition: 'Of the approvals whose review context is recorded, those it showed nothing of the revision approved.' },
} as const;

/** What the waiting list is called wherever it is named: the team's queue, assigned to nobody. */
export const TEAM_APPROVALS = 'Team approvals';
/** What the history is called wherever it is named, and all it claims. */
export const IN_YOUR_NAME = 'Approved in your name';

/**
 * Where each approved revision was shown, as the gateway classified it, in words that claim nothing more: `label` on the
 * page, `short` in a context's row, where the column's name is not beside it.
 */
export const PRESENTATION: Record<ApprovalEvidence['presentation'], { label: string; short: string; definition: string }> = {
  console_revision_shown: { label: 'Shown in the console', short: 'shown in the console', definition: 'A browser presentation of this exact revision was recorded under the approval\'s review context; not that every line was read.' },
  agent_context_covered: { label: 'Covered in an agent\'s context', short: 'covered in an agent\'s context', definition: 'A tool\'s review context covered this exact revision; not that a person saw it.' },
  not_recorded: { label: 'Not recorded', short: 'no presentation recorded', definition: 'The review context is recorded, and none of it showed this revision.' },
  unknown: { label: 'Unknown', short: 'presentation unknown', definition: 'The approval names no review context, or was sealed before presentations were recorded.' },
};
/** The basis each approval was decided on, as it was stated when it was made; `short` as `PRESENTATION`'s. */
export const DECISION_BASIS: Record<ApprovalEvidence['decisionBasis'], { label: string; short: string; definition: string }> = {
  explicit_recorded: { label: 'Explicit, recorded', short: 'explicit', definition: 'The approval stated an explicit decision.' },
  standing_delegation_recorded: { label: 'Standing delegation, recorded', short: 'standing delegation', definition: 'The approval stated it was made under a standing delegation.' },
  unknown: { label: 'Unknown', short: 'basis unknown', definition: 'The approval stated no basis.' },
};
const PRESENTATIONS = Object.keys(PRESENTATION) as ApprovalEvidence['presentation'][];
const BASES = Object.keys(DECISION_BASIS) as ApprovalEvidence['decisionBasis'][];

/** What the assistant is told about approving: the person does it, on the document's page, never the assistant. */
export const APPROVAL_IS_THE_PERSON_S = 'The assistant approves nothing: a person approves a revision with Approve on the document\'s own page.';
/** What `Approved in your name` stands for, and what a presentation class does not. */
const IN_YOUR_NAME_MEANS = 'Approved in your name: the record names you as the approval\'s signer, nothing more. A presentation is what was recorded as shown, not proof that anybody read the revision.';

const HOUR = 3_600_000;
/** How long a revision has waited at `asOf`: `5 hours`, `17 days`. */
export function waited(since: string, asOf: string): string {
  const hours = Math.max(0, (Date.parse(asOf) - Date.parse(since)) / HOUR);
  if (hours < 48) return `${Math.floor(hours)} ${plural(Math.floor(hours), 'hour')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${plural(days, 'day')}`;
}

/** Whether an approval was dated by its day alone: sealed before the events began, so no time is recorded. */
export const dayOnly = (approvedAt: string): boolean => approvedAt.length === 10;
/** When an approval was made, as a cell or a line says it: its time, or the day alone where only the day is recorded. */
export const approvedWhen = (approvedAt: string): string => (dayOnly(approvedAt) ? formatCalendarDate(approvedAt) : formatDateTime(approvedAt));

/**
 * How many approvals in the caller's name the record knows nothing of how they were shown: the ones the no-presentation
 * count is not taken over, sealed before presentations were recorded or naming no review context. Null where either
 * count could not be read.
 */
const unknownOf = (n: { of: number }, inYourName: number | null): number | null => (inYourName === null ? null : Math.max(0, inYourName - n.of));

/**
 * The fourth tile's sentence, a count of the record and never an inference: `2 of 10 approved with no presentation
 * recorded, and 1 unknown`, the History tab's Unknown. The second half is what makes it add up to the approvals in
 * your name beside it: the count is taken over the approvals whose presentation is known, never over all of them.
 */
export const noPresentationLine = (n: { count: number; of: number }, inYourName: number | null): string => {
  const unknown = unknownOf(n, inYourName);
  return `${formatCount(n.count)} of ${formatCount(n.of)} approved with no presentation recorded${unknown ? `, and ${formatCount(unknown)} unknown` : ''}`;
};

/** The same count in the fourth tile's one-line note: what it is taken over, `of 10 known, 1 unknown`. */
export const noPresentationNote = (n: { of: number }, inYourName: number | null): string => {
  const unknown = unknownOf(n, inYourName);
  return `of ${formatCount(n.of)} known${unknown ? `, ${formatCount(unknown)} unknown` : ''}`;
};

/** A count of the tiles, or the word for one whose list could not be read. */
const countOr = (n: number | null): string => (n === null ? 'unavailable' : formatCount(n));

/** A revision, as a row names it: `spec.md v1 of 2026-10-04-index-rebuild (cr_…)`. */
const docOf = (r: { initiative: string; path: string; version: number; contentRevision: string }) => `${clip(r.path, 48)} v${r.version} of ${clip(r.initiative, 48)} (${r.contentRevision})`;

/** One waiting row, as the context lists it. */
const waitingLine = (asOf: string) => (r: WaitingRow) => `${docOf(r)}, waiting ${waited(r.waitingSince, asOf)} since ${formatDate(r.waitingSince)}`;
/** Where an approved revision was shown, in a history row of the context, where the summary has named each class. */
const SHOWN_IN: Record<ApprovalEvidence['presentation'], string> = {
  console_revision_shown: 'console', agent_context_covered: 'agent\'s context', not_recorded: 'none recorded', unknown: 'unknown',
};

/** When an approval was made, inside a sentence: `19 Oct, 16:09`, or the day alone where only the day is recorded. */
const approvedSaid = (approvedAt: string): string =>
  (dayOnly(approvedAt) ? `${formatDay(approvedAt)} (day only)` : `${formatDay(approvedAt)}, ${formatDateTime(approvedAt).split(', ').at(-1)}`);

/** One approval, as the context lists it under its initiative: the version, when, where it was shown and the basis. */
const historyLine = (r: ApprovalRow) =>
  `${clip(r.path, 48)} v${r.version}, ${approvedSaid(r.approvedAt)}, ${SHOWN_IN[r.presentation]}, ${DECISION_BASIS[r.decisionBasis].short}`;

/**
 * The first `n` rows of a history page, newest first, each run of one initiative's under its name once, so a page of
 * ten fits the context beside its summary: `2026-10-08-result-explanations: review.md v1, 19 Oct 2026, 16:08, console,
 * explicit; plan.md v1, …`. How many more the page shows is said.
 */
function historyRows(rows: ApprovalRow[], n: number, address: string): string {
  const groups: { initiative: string; rows: ApprovalRow[] }[] = [];
  for (const r of rows.slice(0, n)) {
    const last = groups.at(-1);
    if (last?.initiative === r.initiative) last.rows.push(r);
    else groups.push({ initiative: r.initiative, rows: [r] });
  }
  const said = groups.map((g) => `${clip(g.initiative, 48)}: ${g.rows.map(historyLine).join('; ')}`).join(' | ');
  return rows.length > n ? `${said} | and ${rows.length - n} more (on ${address})` : said;
}

/** The tiles as facts, in the order the page draws them. */
function factsOf(a: Approvals): Fact[] {
  const { waiting, oldestWaitingSince, inYourName, noPresentation } = a.tiles;
  return [
    { label: TILES.waiting.label, value: countOr(waiting), definition: TILES.waiting.definition },
    {
      label: TILES.oldest.label,
      value: oldestWaitingSince ? waited(oldestWaitingSince, a.meta.asOf) : waiting === null ? 'unavailable' : 'none waiting',
      ...(oldestWaitingSince ? { change: `presented ${formatDateTime(oldestWaitingSince)}` } : {}),
      definition: TILES.oldest.definition,
    },
    { label: TILES.inYourName.label, value: countOr(inYourName), definition: TILES.inYourName.definition },
    // Over the known alone: the unknown are History's summary's own count, by presentation, which the context says too.
    { label: TILES.noPresentation.label, value: noPresentation ? noPresentationLine(noPresentation, null) : 'unavailable', definition: TILES.noPresentation.definition },
  ];
}

/** Waiting's summary, over the whole queue: how many waited longer than 14 days, and the queue by initiative. */
function waitingSummary(a: Approvals): string | null {
  if (a.waiting.state !== 'ok') return null;
  const { total, summary } = a.waiting.data;
  if (!total) return 'Nothing in your team waits for approval.';
  const by = listed(summary.byInitiative, (b) => `${clip(b.initiative, 48)} ${b.count}`, 'the Waiting tab', 5);
  return `${TEAM_APPROVALS}: ${formatCount(total)} ${plural(total, 'revision')} waiting, ${formatCount(summary.olderThan14Days)} of them longer than 14 days; by initiative: ${by}.`;
}

/** History's summary, over every approval in the caller's name: by presentation, by decision basis, and by initiative. */
function historySummary(a: Approvals): string | null {
  if (a.history.state !== 'ok') return null;
  const { total, summary } = a.history.data;
  if (!total) return 'No approval is recorded in your name in this team.';
  const of = <K extends string>(keys: K[], counts: Record<K, number>, words: Record<K, { short: string }>) =>
    keys.filter((k) => counts[k]).map((k) => `${formatCount(counts[k])} ${words[k].short}`).join(', ');
  return `${IN_YOUR_NAME}: ${formatCount(total)}; by presentation: ${of(PRESENTATIONS, summary.byPresentation, PRESENTATION)}; by decision basis: ${of(BASES, summary.byDecisionBasis, DECISION_BASIS)}.`;
}

/** How many of the rows in view the context lists at most, each with its evidence: the whole page, as far as it fits. */
const ROWS_SAID = PAGE_SIZE;
/** The room `budgeted`'s own line takes, `More is on the page than fits here; <address> shows all of it.`, with its bullet. */
const MORE_LINE = 120;

/** How many whole weeks of approvals the context states, latest last: what the chart's last columns say. */
const WEEKS_SAID = 4;

/** The last whole weeks' approvals in the caller's name, as the chart draws them. */
function weeksLine(a: Approvals): string | null {
  const whole = a.weeks.filter((w) => w.window.complete).slice(-WEEKS_SAID);
  if (!whole.length) return null;
  const week = (w: (typeof whole)[number]) => `week of ${formatDay(w.window.from)}: ${w.figure.value === null ? 'not read' : formatCount(w.figure.value)}`;
  return `Approvals in your name by week, the last ${whole.length} whole ${plural(whole.length, 'week')}: ${whole.map(week).join('; ')}.`;
}

/**
 * `tab` and `page` are the page's address. `read` is how `view_approvals` read the rows, by the route's `limit` and
 * `offset`, when it did: the address is then the page of ten the offset falls in, and rows off the page's grid are said
 * to be so. Most important first, as `budgeted` drops from the end: the tab's own summary, the rows in view with their
 * evidence, the other tab's summary, then the weeks. The rows are what the tab shows, so they are never dropped whole:
 * as many of the page's ten as fit beside the summary are listed, and how many more the page shows is said.
 */
export function approvalsContext(a: Approvals, { tab, page, read, ...arrival }: { tab: ApprovalsTab; page: number; read?: ApprovalsRows } & Arrival): SharedContext {
  const list = tab === 'waiting' ? a.waiting : a.history;
  const total = list.state === 'ok' ? list.data.total : 0;
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = approvalsAddress(tab, page);
  const summaries = { waiting: waitingSummary(a), history: historySummary(a) };
  const other: ApprovalsTab = tab === 'waiting' ? 'history' : 'waiting';
  const coverage = a.meta.coverageFrom;
  const context: SharedContext = {
    view: 'approvals',
    title: 'Approvals',
    address,
    scope: `your team's revisions waiting and your approvals in it; the ${tab === 'waiting' ? 'Waiting' : 'History'} tab, page ${page} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`,
    freshness: arrived(arrival),
    facts: factsOf(a),
    insights: summaries[tab] ? [{ text: summaries[tab]!, evidence: address }] : [],
    unknowns: [
      APPROVAL_IS_THE_PERSON_S,
      ...(tab === 'waiting' ? [`${TEAM_APPROVALS}: nothing records who must decide a waiting revision, so no row is assigned to anybody.`] : []),
      IN_YOUR_NAME_MEANS,
      ...(coverage ? [`Presentations are recorded from ${formatDate(coverage)}; an approval before then is unknown.`] : []),
      ...(a.waiting.state === 'ok' ? [] : ['The waiting queue could not be read; History and its figures stand.']),
      ...(a.history.state === 'ok' ? [] : ['The approvals in your name could not be read; Waiting and its figures stand.']),
      ...(onGrid ? [] : [`The page lists ten rows a page, so ${address} does not show exactly these ${formatCount(list.state === 'ok' ? list.data.rows.length : 0)} rows.`]),
      ...(list.state === 'ok' && !list.data.rows.length && total ? ['This page is past the last row.'] : []),
    ],
  };
  const rowsLine = (n: number): Insight | null => {
    if (tab === 'waiting' && a.waiting.state === 'ok' && a.waiting.data.rows.length) {
      const rows = a.waiting.data.rows;
      return { text: `Rows ${first + 1} to ${first + rows.length} of ${total}, longest waiting first: ${listed(rows, waitingLine(a.meta.asOf), `on ${address}`, n)}.`, evidence: address };
    }
    if (tab === 'history' && a.history.state === 'ok' && a.history.data.rows.length) {
      const rows = a.history.data.rows;
      // Where a row leads is said once, for every row, rather than an address a row.
      return { text: `Rows ${first + 1} to ${first + rows.length} of ${total}, newest first, each opening its document at that version (?version=<n>); by initiative, as version, approved, shown in, basis: ${historyRows(rows, n, address)}.`, evidence: address };
    }
    return null;
  };
  // Room is kept for the line `budgeted` adds when it drops what follows the rows.
  const fits = (line: Insight) => contextText({ ...context, insights: [...context.insights, line] }).length <= CONTEXT_BUDGET - MORE_LINE;
  let n = ROWS_SAID;
  while (n > 1 && !fits(rowsLine(n) ?? { text: '' })) n--;
  const rows = rowsLine(n);
  const weeks = weeksLine(a);
  return budgeted({
    ...context,
    insights: [
      ...context.insights,
      ...(rows ? [rows] : []),
      ...(summaries[other] ? [{ text: summaries[other]!, evidence: approvalsAddress(other) }] : []),
      ...(weeks ? [{ text: weeks }] : []),
    ],
  });
}
