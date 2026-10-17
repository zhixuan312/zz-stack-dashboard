/**
 * The Initiatives list's shared context (decision 0011): what the page and the assistant are both told about the active
 * team's work, from the one `InitiativeList` the gateway answered. The rows are the page in view; the counts are the
 * tiles and the summary the gateway computed over the whole filtered population, so a context never grows with the data
 * and never counts one page as if it were all of it. The page draws the tiles with the words here, and `view_initiatives`
 * builds the same context from the same response, so the assistant quotes the figures the screen shows.
 */
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatDay } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import type { InitiativeList, InitiativeRow } from '@/lib/work-shapes';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';
import { INITIATIVES_DEFAULTS, LIST_STATES, PAGE_SIZE, STATE_LABEL, narrowed, type InitiativesFilters, type InitiativesRows } from './initiatives-filter';

/** The page's own read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type InitiativesRead =
  | { state: 'ok'; path: string; data: InitiativeList; team: string | null }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** How long the console's server waits for the list: half a second under five, for a phone to draw what it says. */
export const INITIATIVES_BOUND_MS = 4_500;

/** The sentence a read's trouble is told in, under the table's "The initiatives did not load" and to the assistant. */
export function initiativesTrouble(read: Exclude<InitiativesRead, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The read did not answer within ${INITIATIVES_BOUND_MS / 1000} seconds.` : read.reason;
}

/** The three tiles, as the page labels them and the assistant is told what each counts: the whole team's, never a filter's. */
export const TILES = {
  open: { label: 'Open', definition: 'No outcome yet, the waiting and the quiet among them; the whole team\'s, whatever the filters.' },
  waiting: { label: 'Waiting', definition: 'Open, with a revision presented and not yet approved.' },
  closed: { label: 'Closed', definition: 'Every initiative closed, by the outcome the platform recorded for it.' },
} as const;

/** The outcomes a close records, in the order the tiles and the chart name them. */
export const OUTCOMES = ['accepted', 'delivered', 'abandoned'] as const;

/** The closed tile's line: each outcome's count, as the platform recorded it. */
export const closedLine = (closed: InitiativeList['tiles']['closed']): string =>
  OUTCOMES.map((o) => `${formatCount(closed[o])} ${o}`).join(', ');

/** What the assistant is told about who closes: the person, in the dialog, never the assistant. */
export const CLOSE_IS_THE_PERSON_S = 'The assistant closes nothing: a person closes an initiative with Close initiative on its own page, in the dialog there.';

/**
 * What comes next, in words. zz-core's `next_move` answers a token (`await_approval`) that an agent reads as it is, in
 * `explore_initiatives`' drilled rows; a person, and the context that quotes the page, read the sentence. A token not named here is
 * shown with its underscores as spaces rather than hidden.
 */
const ACTION: Record<string, (doc: string | null, stage: string | null) => string> = {
  write_document: (d) => (d ? `Write ${d}` : 'Write the next document'),
  await_approval: (d) => (d ? `Approve ${d}` : 'Approve the document presented'),
  add_source: (d) => (d ? `Add a source for ${d}` : 'Add a source'),
  decide: (d) => (d ? `Decide on ${d}` : 'A decision'),
  fix: (d) => (d ? `Fix what the review of ${d} found` : 'Fix what the review found'),
  run_experiment: () => 'Run an experiment',
  run_stage: (_d, st) => (st ? `Run ${st}` : 'Run the next stage'),
  resolve_branch: () => 'Choose the branch to take',
  close: () => 'Close it',
  closed: () => 'Closed',
  none: () => 'No next move',
};
const WAITER: Record<string, string> = { stakeholder: 'a person', agent: 'the agent' };

/** Where a row goes next and who it waits on, as its flow position reads on the page and in the context. */
export const nextOf = (r: InitiativeRow): string => {
  const m = r.nextMove;
  if (!m) return 'Next move unavailable';
  const said = ACTION[m.action]?.(m.document, m.stage) ?? `${m.action.replaceAll('_', ' ')}${m.document ? ` ${m.document}` : ''}`;
  const waiter = m.waitingOn ? WAITER[m.waitingOn] : undefined;
  return waiter ? `${said}, waiting on ${waiter}` : said;
};

/** How many whole weeks of closures the context states, latest last: what the chart's last columns say. */
const WEEKS_SAID = 4;

/** The last whole weeks' closures by outcome, as the chart draws them: a week not read is said to be so, never zero. */
function closuresLine(list: InitiativeList): string | null {
  if (list.closures.state !== 'ok') return null;
  const whole = list.closures.data.filter((w) => w.window.complete).slice(-WEEKS_SAID);
  if (!whole.length) return null;
  const week = (w: (typeof whole)[number]) => {
    const parts = OUTCOMES.map((o) => (w[o].value === null ? `${o} not read` : `${formatCount(w[o].value)} ${o}`));
    return `week of ${formatDay(w.window.from)}: ${parts.join(', ')}`;
  };
  return `Closures by week and outcome, the last ${whole.length} whole ${plural(whole.length, 'week')}: ${whole.map(week).join('; ')}.`;
}

/**
 * `filters` and `page` are the page's address. `read` is how `view_initiatives` read the rows, by the route's `limit`
 * and `offset`, when it did: the address is then the page of ten the offset falls in, and rows off the page's grid are
 * said to be so.
 */
export function initiativesContext(list: InitiativeList, { filters, page, read, ...arrival }: { filters: Omit<InitiativesFilters, 'page'>; page: number; read?: InitiativesRows } & Arrival): SharedContext {
  const summary = list.summary.state === 'ok' ? list.summary.data : null;
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/initiatives', { ...filters, page: String(page) }, INITIATIVES_DEFAULTS);
  const insights: Insight[] = [];
  if (summary) {
    const byState = LIST_STATES.filter((st) => summary.byState[st]).map((st) => `${summary.byState[st]} ${STATE_LABEL[st].toLowerCase()}`);
    if (byState.length) insights.push({ text: `By state: ${byState.join(', ')}.` });
  }
  if (list.rows.length) {
    insights.push({
      text: `Rows ${first + 1} to ${first + list.rows.length} of ${list.total}, waiting first: ${listed(list.rows, (r) => `${clip(r.slug)} (${STATE_LABEL[r.state].toLowerCase()}, ${r.gates.of ? `${r.gates.passed} of ${r.gates.of} gates` : 'no gates'}, touched ${formatDate(r.lastTouched)}; next: ${nextOf(r)})`, 'page or filter on /initiatives', PAGE_SIZE)}.`,
      evidence: address,
    });
  }
  if (summary && summary.byFlow.length > 1) insights.push({ text: `By flow: ${summary.byFlow.map((f) => `${f.flow ?? 'no flow'} ${f.count}`).join(', ')}.` });
  const closures = closuresLine(list);
  if (closures) insights.push({ text: closures });
  const said = [filters.state !== 'all' ? `state ${filters.state}` : '', filters.flow !== 'all' ? `flow ${filters.flow}` : '', filters.q.trim() ? `matching "${filters.q.trim()}"` : ''].filter(Boolean);
  const closed = list.tiles.closed;
  return budgeted({
    view: 'initiatives',
    title: 'Initiatives',
    address,
    scope: `your active team's work${said.length ? `, filtered to ${said.join(', ')}` : ''}; page ${page} of ${Math.max(1, Math.ceil(list.total / PAGE_SIZE))}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Initiatives', value: formatCount(list.total), definition: narrowed(filters) ? 'All that these filters match, not this page.' : 'Every piece of work the team has opened.' },
      { label: TILES.open.label, value: formatCount(list.tiles.open), definition: TILES.open.definition },
      { label: TILES.waiting.label, value: formatCount(list.tiles.waiting), definition: TILES.waiting.definition },
      { label: TILES.closed.label, value: formatCount(closed.accepted + closed.delivered + closed.abandoned), change: closedLine(closed), definition: TILES.closed.definition },
    ],
    insights,
    unknowns: [
      'Work is your active team\'s alone; another team\'s initiatives are not in this list.',
      CLOSE_IS_THE_PERSON_S,
      ...(summary ? [] : ['The counts by state and flow could not be read; the rows and the total stand.']),
      ...(list.closures.state === 'ok' ? [] : ['The closures by week could not be read; the tiles and the rows stand.']),
      ...(list.nextMoveState === 'ok' ? [] : [list.nextMoveState === 'partial' ? 'zz-core did not answer for some rows, so their next move is unknown.' : 'zz-core did not answer, so no row\'s next move is known.']),
      ...(onGrid ? [] : [`The page lists the initiatives ten a page, so ${address} does not show exactly these ${formatCount(list.rows.length)} rows.`]),
      ...(list.rows.length ? [] : [narrowed(filters) ? 'No initiative matches these filters.' : page > 1 ? 'This page is past the last initiative.' : 'No initiative has been opened yet.']),
    ],
  });
}
