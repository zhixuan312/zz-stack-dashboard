/**
 * Audit's shared context (decision 0011), and every word its two tabs are drawn with: Administration, the acts that
 * changed who may do what or closed a report, each as the sentence the gateway said it in; and Everything, the latest
 * events of every kind as metadata, filtered by kind, team and a day they came before. The page draws these words and
 * `view_audit` builds the same context from the same response, so the assistant quotes what the screen shows.
 *
 * Nothing here writes a sentence: each is the gateway's, filled from one fixed template per kind. A sentence begins with
 * its actor, or `Someone not recorded` when nobody was, and the feed is handed that actor and the rest of the sentence as
 * it stands. How an act arrived is not recorded, so nothing here names a channel: a console write is said to be one by
 * the gateway, and an event that does not say so is `Not recorded`, never another door. An event is marked as the
 * platform's own only when its origin is `platform`.
 *
 * The tab, the filters and the page are in the address (`?filter=all&kind=&team=&before=&page=`), and the gateway
 * filters and pages the events, applying the filters before its ceiling of the latest 500 so a narrow filter reaches an
 * event older than those 500: the page's first read on the console's server, its later reads, its context and
 * `view_audit` all ask `auditPath` for the address.
 */
import type { ActivityEvent } from '@/components/patterns/activity-feed';
import type { Audit, AuditRow } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { dayOf, formatDate, formatDateTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { app } from '@/app.config';
import { OWNER_LABEL } from './activity-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/* The tabs, the filters and the address */

/** The rows one page of either tab holds. */
export const PAGE_SIZE = 10;

/** The tabs by the route's own filter: Administration is `administration`, Everything is `all`. */
export const AUDIT_FILTERS = ['administration', 'all'] as const;
export type AuditFilter = (typeof AUDIT_FILTERS)[number];
export const TAB_LABEL: Record<AuditFilter, string> = { administration: 'Administration', all: 'Everything' };

/** What Audit keeps in its address: the tab, Everything's three filters (`all` is none) and the page, from 1. `before`
 *  is a day of the reporting time zone, `2026-10-01`: the events before that day began. */
export type AuditFilters = { filter: string; kind: string; team: string; before: string; page: string };
export const AUDIT_DEFAULTS: AuditFilters = { filter: 'administration', kind: 'all', team: 'all', before: 'all', page: '1' };

/** Rows by the route's own arguments: `limit` of them from `offset`. */
type AuditRows = { limit: number; offset: number };

/** The tab the address names; anything else is Administration, the default. */
export const tabOf = (f: AuditFilters): AuditFilter => (f.filter === 'all' ? 'all' : 'administration');
const pageOf = (f: AuditFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** An event kind and a team's slug as the route takes them; anything else is no filter. COUPLED: the gateway's `KIND`. */
const KIND = /^[a-z_]+(\.[a-z_]+)?$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const kindOf = (f: AuditFilters): string | null => (f.kind !== 'all' && KIND.test(f.kind) ? f.kind : null);
const teamOf = (f: AuditFilters): string | null => (f.team !== 'all' && SLUG.test(f.team) ? f.team : null);
const beforeOf = (f: AuditFilters): string | null => (f.before !== 'all' && DAY.test(f.before) && !Number.isNaN(Date.parse(f.before)) ? f.before : null);

/** Whether a filter narrows Everything. Administration takes none. */
export const narrowed = (f: AuditFilters): boolean => tabOf(f) === 'all' && (kindOf(f) !== null || teamOf(f) !== null || beforeOf(f) !== null);

/** One formatter per zone, reading an instant's wall-clock parts there. */
const WALL = new Map<string, Intl.DateTimeFormat>();
function wallMs(ms: number, timeZone: string): number {
  let fmt = WALL.get(timeZone);
  if (!fmt) {
    WALL.set(timeZone, (fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })));
  }
  const p = Object.fromEntries(fmt.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** The instant a day of the reporting time zone begins, as the gateway spells an instant: `2026-10-01` in Singapore is
 *  `2026-09-30T16:00:00Z`. The gateway reads a bare day as midnight in UTC, which is not the day a person chose. */
export function dayStart(day: string, timeZone: string = app.timezone): string {
  const [y, m, d] = day.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  // The zone's offset at that moment, read once from a guess and once from the guess corrected by it.
  const guess = utc - (wallMs(utc, timeZone) - utc);
  const at = utc - (wallMs(guess, timeZone) - guess);
  return new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The gateway address of `f`'s tab: the ten rows of its page unless `rows` names others, as `view_audit` may. Only
 *  Everything carries the filters. */
export function auditPath(f: AuditFilters, rows: AuditRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams({ filter: tabOf(f) });
  if (tabOf(f) === 'all') {
    const [kind, team, before] = [kindOf(f), teamOf(f), beforeOf(f)];
    if (kind) p.set('kind', kind);
    if (team) p.set('team', team);
    if (before) p.set('before', dayStart(before));
  }
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/platform/audit?${p}`;
}

/** The page's address for rows read from `offset` of `filter`'s tab: the page of ten the offset falls in. */
export const pageAt = (filter: AuditFilter, offset: number): AuditFilters => ({ ...AUDIT_DEFAULTS, filter, page: String(Math.floor(offset / PAGE_SIZE) + 1) });

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (k: keyof AuditFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? AUDIT_DEFAULTS[k];
  };
  return { filter: one('filter'), kind: one('kind'), team: one('team'), before: one('before'), page: one('page') };
}

/**
 * The page's address read back from a gateway path `auditPath` wrote: the tab, Everything's filters, `before` as the
 * reporting time zone's day its instant begins, and the page of ten the offset falls in. The view draws this until the
 * browser knows its own address, so the first paint of a filtered address is the one the server read.
 */
export function filtersOfPath(path: string): AuditFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  const before = q.get('before');
  const offset = Math.max(0, Number(q.get('offset')) || 0);
  return {
    filter: q.get('filter') === 'all' ? 'all' : 'administration',
    kind: q.get('kind') ?? 'all',
    team: q.get('team') ?? 'all',
    before: before === null ? 'all' : dayOf(before),
    page: String(Math.floor(offset / PAGE_SIZE) + 1),
  };
}

/* The read */

/** How long the console's server waits for the Audit read: half a second under five, for a phone to draw what it says. */
export const AUDIT_BOUND_MS = 4_500;

/** The read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type AuditRead =
  | { state: 'ok'; path: string; data: Audit }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function auditTrouble(read: { state: 'failed'; reason: string } | { state: 'slow' }): string {
  return read.state === 'slow' ? `The read did not answer within ${AUDIT_BOUND_MS / 1000} seconds.` : read.reason;
}

/* The words */

/** Who an event names when nobody was recorded: the gateway's own words, which every sentence begins with. */
export const NOBODY = 'Someone not recorded';

/** An act as the feed draws it: its actor, and the rest of the gateway's sentence as it stands. A sentence that does not
 *  begin with its actor, which no template writes, is drawn whole after the actor's mark rather than cut. The `system`
 *  mark is the platform's own maintenance alone; `via`, the agent that acted for a person, is never recorded, so it is
 *  never set. */
export function feedEvent(r: AuditRow): ActivityEvent {
  const actor = r.actor ?? NOBODY;
  const said = r.sentence ?? `${actor} recorded ${r.kind}`;
  const verb = said.startsWith(`${actor} `) ? said.slice(actor.length + 1) : said;
  return { id: r.id, at: r.at, actor, ...(r.origin === 'platform' ? { system: true } : {}), verb, object: '' };
}

/** The result of an event: a refusal names who it is put down to; an event that is no call has none. */
export const resultOf = (r: AuditRow): string => (r.ok === false ? `Refused: ${OWNER_LABEL[r.refusalOwner ?? 'other']}` : r.ok === true ? 'OK' : 'No result');
/** How an event arrived, as far as the record says: a console write says so, and nothing else is recorded. */
export const channelOf = (r: AuditRow): string => (r.inConsole ? 'Console' : 'Not recorded');
/** Whose traffic an event is: the platform's own maintenance, or work. */
export const originOf = (r: AuditRow): string => (r.origin === 'platform' ? 'Platform maintenance' : 'Work');

/** The kinds Everything's filter offers before the page names any: every call, and each act of administration a
 *  template says. COUPLED: the gateway's templates in console/platform-audit.ts. */
const BASE_KINDS = [
  'tool_call', 'admin.create_team', 'admin.archive_team', 'admin.add_member', 'admin.remove_member', 'admin.add_person',
  'admin.deactivate_person', 'admin.issue_enrolment', 'admin.issue_pat', 'admin.revoke_pat', 'admin.revoke_oauth_client',
  'credential.set', 'team.switch', 'pat.self_issue', 'pat.self_revoke', 'bug.resolve', 'bug.console_resolve', 'bug.delete',
];

/** The kinds the filter offers: the base, every kind the page's rows name, and the one the address filters by, once each. */
export function kindsOf(rows: AuditRow[], current: string): string[] {
  return [...new Set([...BASE_KINDS, ...rows.map((r) => r.kind), ...(current !== 'all' && KIND.test(current) ? [current] : [])])].sort();
}

/** The teams the filter offers: every team the page's rows name, and the one the address filters by. No read lists the
 *  platform's teams here, so a team is offered once an event on the page names it. */
export function teamsOf(rows: AuditRow[], current: string): string[] {
  const named = rows.map((r) => r.team).filter((t): t is string => t !== null);
  return [...new Set([...named, ...(current !== 'all' && SLUG.test(current) ? [current] : [])])].sort();
}

const MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
/** A day of the reporting time zone as the filter names it: `1 Oct 2026`. */
export const dayWords = (day: string): string => (DAY.test(day) ? MONTH.format(Date.parse(`${day}T00:00:00Z`)) : day);

/** How many months back the `before` filter offers. */
const MONTHS_OFFERED = 12;

/**
 * The days the `before` filter offers: the first of each month since the record began, up to the read's cutoff, newest
 * first, at most a year of them, and the one the address filters by. Each reaches the events before it began, however far
 * past the latest 500 they lie.
 */
export function beforeDays(meta: Audit['meta'], current: string): string[] {
  const out: string[] = [];
  const first = meta.coverageFrom ? Date.parse(meta.coverageFrom) : null;
  const [y, m] = dayOf(meta.asOf).split('-').map(Number);
  for (let i = 0; i < MONTHS_OFFERED && first !== null; i++) {
    const at = new Date(Date.UTC(y, m - 1 - i, 1));
    const day = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-01`;
    if (Date.parse(dayStart(day)) <= first) break;
    out.push(day);
  }
  return current !== 'all' && DAY.test(current) && !out.includes(current) ? [...out, current].sort().reverse() : out;
}

/** The count of what a tab read, as its result line says it: at the ceiling it is as far as the read reached. */
export function countWords(data: Audit, noun: string): string {
  return `${formatCount(data.total)} ${plural(data.total, noun)}${data.total >= data.ceiling ? `, the latest ${formatCount(data.ceiling)}` : ''}`;
}

/** What Audit cannot show, as a sentence: the acts that leave no event. */
export const notRecordedWords = (data: Audit): string | null => {
  if (!data.notRecorded.length) return null;
  const acts = data.notRecorded.length > 1 ? `${data.notRecorded.slice(0, -1).join(', ')} and ${data.notRecorded.at(-1)}` : data.notRecorded[0];
  return `Some acts of administration leave no event, so Audit cannot show them: ${acts}.`;
};

/* What the assistant is told */

/** How many rows of a page the context names. */
const NAMED = 5;

/** One event of Everything as the assistant is told it: its kind, team, actor, subject, result and origin. */
function eventLine(r: AuditRow): string {
  const subject = r.subject ? ` on ${clip(r.subject, 48)}` : '';
  return `${formatDateTime(r.at)} ${r.kind}${subject}, ${r.team ?? 'no team'}, by ${r.actor ?? 'nobody recorded'}, ${resultOf(r).toLowerCase()}`
    + `${r.origin === 'platform' ? ', platform maintenance' : ''}${r.inConsole ? ', in the console' : ''}`;
}

/** One act of Administration as the assistant is told it: the gateway's sentence, and when. */
const actLine = (r: AuditRow): string => `${clip(r.sentence ?? `${r.actor ?? NOBODY} recorded ${r.kind}`, 160)} (${formatDateTime(r.at)})`;

/** The filters as words: `kind team.switch, team beacon, before 1 Oct 2026`. */
function filterWords(f: AuditFilters): string {
  return [
    kindOf(f) ? `kind ${kindOf(f)}` : null,
    teamOf(f) ? `team ${teamOf(f)}` : null,
    beforeOf(f) ? `before ${dayWords(beforeOf(f)!)}` : null,
  ].filter(Boolean).join(', ');
}

/** What every view of Audit says it cannot say. */
const UNKNOWNS = [
  'How an act arrived (the console, a door or a script) is not recorded; only a console write says so.',
  'An event nobody was recorded for names nobody: its actor is not recorded, never guessed.',
  'Events are metadata only: no document, lesson, label, question or refusal text leaves the gateway.',
];

/**
 * `filters` is the page's address. `read` is how `view_audit` read the rows, by the route's `limit` and `offset`, when it
 * did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function auditContext(data: Audit, { filters, read, ...arrival }: { filters: AuditFilters; read?: AuditRows } & Arrival): SharedContext {
  const tab = tabOf(filters);
  const first = read ? read.offset : (pageOf(filters) - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/platform/audit', tab === 'all' ? filters : { ...AUDIT_DEFAULTS, page: filters.page }, AUDIT_DEFAULTS);
  const admin = tab === 'administration';
  const narrow = narrowed(filters);
  const shown = first + data.rows.length;
  const facts: Fact[] = [
    {
      label: admin ? 'Acts of administration' : 'Events', value: countWords(data, admin ? 'act' : 'event'),
      definition: admin
        ? 'Recorded acts that changed who may do what, or closed a report, platform maintenance included, up to the latest 500.'
        : `Every recorded event but page views${narrow ? ' that the filters keep' : ''}, up to the latest 500 the filters reach.`,
    },
    { label: 'Record begins', value: data.meta.coverageFrom ? formatDate(data.meta.coverageFrom) : 'Nothing recorded yet' },
  ];
  const insights: Insight[] = data.rows.length
    ? [{ text: admin ? `The acts on this page, newest first: ${listed(data.rows, actLine, 'see the page', NAMED)}.` : `The events on this page, newest first: ${listed(data.rows, eventLine, 'see the page', NAMED)}.`, evidence: address }]
    : [];
  const unrecorded = notRecordedWords(data);
  return budgeted({
    view: 'audit',
    title: 'Audit',
    address,
    scope: `${admin ? 'the recorded acts of administration' : `every recorded event, page views left out${narrow ? `, narrowed to ${filterWords(filters)}` : ''}`}, every team on the platform`
      + `${data.rows.length ? `; rows ${first + 1} to ${shown} of ${formatCount(data.total)}` : ''}`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns: [
      ...UNKNOWNS,
      ...(unrecorded ? [unrecorded] : []),
      ...(data.total >= data.ceiling ? [`The read stops at the latest ${formatCount(data.ceiling)}${admin ? ' acts' : ' events the filters reach'}; ${admin ? 'older acts are not listed here' : 'a narrower filter, or an earlier day, reaches older ones'}.`] : []),
      ...(onGrid ? [] : [`The page lists ten a page, so ${address} does not show exactly these ${formatCount(data.rows.length)} rows.`]),
      ...(data.total > shown ? [`${formatCount(data.total - shown)} more on later pages.`] : []),
      ...(!data.rows.length ? [narrow ? 'No event matches these filters.' : admin ? 'No act of administration is recorded.' : 'No event is recorded.'] : []),
    ],
  });
}
