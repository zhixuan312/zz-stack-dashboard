/**
 * The Teams list's shared context (decision 0011), and the words its tiles and its week figures are drawn with: what
 * the page and the assistant are both told about every team on the platform. The page draws these words and
 * `view_teams` builds the same context from the same response, so the assistant quotes the figures the screen shows.
 *
 * Every figure is the read's. A team is set beside its own past (its sessions by week, its calls last week and the week
 * before) and never beside another team: nothing here ranks, compares or totals one team against the rest.
 */
import type { TeamRow, Teams } from '@/lib/fleet-shapes';
import type { PeriodFigure } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf } from './context';
import { rostered } from './platform-roster';
import { PAGE_SIZE, TEAMS_DEFAULTS, narrowed, pageOf, type TeamsFilters, type TeamsRows } from './teams-filter';

/** The page's own read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type TeamsRead =
  | { state: 'ok'; path: string; data: Teams }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** How long the console's server waits for a Teams read: half a second under five, for a phone to draw what it says. */
export const TEAMS_BOUND_MS = 4_500;

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  teams: { label: 'Teams', definition: 'Every team, active or archived.' },
  openWork: { label: 'Open work', definition: 'Initiatives not yet closed.' },
  pending: { label: 'Pending revisions', definition: 'Revisions presented and not yet approved, each once.' },
  lessons: { label: 'Lessons adopted', definition: 'Lessons standing on the teams\' shelves.' },
} as const;

/** What the assistant is told about a change to a team: the person makes it, on this page or the team's own, never the assistant. */
export const TEAMS_CHANGES = 'The assistant changes no team: a person creates one with Create a team on this page, /platform/teams, and archives a team, adds a member or removes one with Archive, Add member and Remove on that team\'s own page, /platform/teams/<slug>.';

/** What a week's figure reads as: its count, `Unavailable` when it could not be read, nothing before the record. */
export function weekCount(w: PeriodFigure): string {
  if (w.figure.why === 'unavailable' || w.figure.value === null) return 'Unavailable';
  return formatCount(w.figure.value);
}

/** What a team that never made a real-work call reads as, in the table, on a phone's card and to the assistant. */
export const NO_ACTIVITY = 'No activity yet';

/** A team's sessions by week as a Sparkline draws them: a week that could not be read is a gap, never a zero. */
export const sessionPoints = (t: TeamRow): (number | null)[] => t.sessions.map((w) => (w.figure.why === null ? w.figure.value : null));

/** The sentence a read's trouble is told in, under the table's "The teams did not load" and to the assistant. */
export function teamsTrouble(read: Exclude<TeamsRead, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The read did not answer within ${TEAMS_BOUND_MS / 1000} seconds.` : read.reason;
}

/** How many teams of a page the context names at most, each whole, and says how many more: the page's ten, as many as fit. */
const NAMED = PAGE_SIZE;

/** One team as the assistant is told it: its people, its work and lessons, its own two last weeks of calls, and when it last made one. */
function teamLine(t: TeamRow): string {
  const calls = t.calls.last.figure.why === 'unavailable' ? 'calls unavailable' : `calls ${weekCount(t.calls.previous)} then ${weekCount(t.calls.last)}`;
  return `${t.slug}${t.name !== t.slug ? ` (${t.name})` : ''}${t.status === 'archived' ? ', archived' : ''}: ${formatCount(t.people)} ${plural(t.people, 'person', 'people')}, `
    + `${formatCount(t.openWork)} open, ${formatCount(t.waiting)} waiting, ${formatCount(t.lessons)} ${plural(t.lessons, 'lesson')}, ${calls}, ${t.lastActive ? `active ${formatDate(t.lastActive)}` : NO_ACTIVITY.toLowerCase()}`;
}

/**
 * `filters` is the page's address. `read` is how `view_teams` read the rows, by the route's `limit` and `offset`, when it
 * did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function teamsContext(data: Teams, { filters, read }: { filters: TeamsFilters; read?: TeamsRows }): SharedContext {
  const page = pageOf(filters);
  const rows = data.teams;
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/platform/teams', filters, TEAMS_DEFAULTS);
  const narrow = narrowed(filters);
  const conditions = [filters.status !== 'all' ? `status ${filters.status}` : '', filters.q.trim() ? `matching "${filters.q.trim()}"` : ''].filter(Boolean).join(', ');
  const scope = `${narrow ? `${formatCount(data.total)} of ${formatCount(data.tiles.teams)} teams, ${conditions}` : 'every team on the platform'}`
    + (rows.length ? `; rows ${first + 1} to ${first + rows.length} of ${formatCount(data.total)}` : '');
  const unavailable = rows.some((t) => t.calls.last.figure.why === 'unavailable');
  const weeks = rows.length ? `the weeks of ${formatDay(rows[0].calls.previous.window.from)} and ${formatDay(rows[0].calls.last.window.from)}` : '';
  const roster = (n: number) => listed(rows, teamLine, 'see the page', n);
  const insights = (n: number): Insight[] => (rows.length
    ? [{ text: `The teams on this page, latest real-work call first, each with its real-work calls in ${weeks}: ${roster(n)}.`, evidence: address }]
    : []);
  return rostered((n) => ({
    view: 'teams',
    title: 'Teams',
    address,
    scope,
    freshness: `As of ${formatDateTime(data.meta.asOf)}.`,
    facts: [
      { label: TILES.teams.label, value: formatCount(data.tiles.teams), definition: TILES.teams.definition },
      { label: TILES.openWork.label, value: formatCount(data.tiles.openWork), definition: TILES.openWork.definition },
      { label: TILES.pending.label, value: formatCount(data.tiles.pending), definition: TILES.pending.definition },
      { label: TILES.lessons.label, value: formatCount(data.tiles.lessons), definition: TILES.lessons.definition },
      ...(narrow ? [{ label: 'Matching', value: formatCount(data.total), definition: 'The teams the filters let through; the tiles count every team.' }] : []),
    ],
    insights: insights(n),
    unknowns: [
      'A team is read against its own past only: nothing here ranks one team against another.',
      TEAMS_CHANGES,
      'People counts memberships, so someone in two teams is counted in both.',
      `Calls and sessions are real-work tool calls by Monday week, as of ${formatDate(data.meta.asOf)}; the running week is not complete.`,
      ...(unavailable ? ['The calls by week could not be read, so no team\'s calls or sessions are stated.'] : []),
      ...(onGrid ? [] : [`The page lists the teams ten a page, so ${address} does not show exactly these ${formatCount(rows.length)} rows.`]),
      ...(data.total > first + rows.length ? [`${formatCount(data.total - first - rows.length)} more ${plural(data.total - first - rows.length, 'team')} match on later pages.`] : []),
      ...(rows.length ? [] : [narrow ? 'No team matches these filters.' : 'No team exists yet; a superadmin creates the first one on this page.']),
    ],
  }), roster, NAMED);
}
