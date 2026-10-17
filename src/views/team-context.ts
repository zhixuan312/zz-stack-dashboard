/**
 * One team's shared context (decision 0011), and the words its page is drawn with: the team, its four tiles, its calls
 * by week and its members, all from the team's own read. The page draws these words and `view_team` builds the same
 * context from the same response, so the assistant quotes the figures the screen shows.
 *
 * The team is set beside its own past and no other team's. Its initiatives are not named: Work answers the active
 * team's work alone, so another team's is read nowhere in the console.
 */
import type { TeamDetail } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, clip, type Arrival } from './context';
import { TEAMS_BOUND_MS, weekCount } from './teams-context';

/** The team page's own read: the answer, no team by that slug, a failure, or no answer in time. */
export type TeamRead =
  | { state: 'ok'; data: TeamDetail }
  | { state: 'missing' }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** How many of its latest weeks and of its members the context states: what holds the budget for a team of forty. */
const WEEKS_TOLD = 12;
const MEMBERS_TOLD = 12;

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TEAM_TILES = {
  people: { label: 'People', definition: 'The team\'s memberships, admins and members.' },
  openWork: { label: 'Open work', definition: 'The team\'s initiatives not yet closed.' },
  waiting: { label: 'Waiting', definition: 'The team\'s revisions presented and not yet approved, as the platform\'s pending query counts them.' },
  lessons: { label: 'Lessons adopted', definition: 'Lessons standing on the team\'s shelf, superseded ones left out.' },
} as const;

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function teamTrouble(slug: string, read: Exclude<TeamRead, { state: 'ok' }>): { title: string; detail: string } {
  if (read.state === 'missing') return { title: `No team called ${slug}`, detail: 'A team slug is the name a superadmin gave it; Teams lists every one that exists.' };
  return read.state === 'slow'
    ? { title: 'The team is unavailable', detail: `The read did not answer within ${TEAMS_BOUND_MS / 1000} seconds.` }
    : { title: 'The team did not load', detail: read.reason };
}

/** Whether the calls by week could not be read: the read keeps the team and its tiles, and says so of the weeks. */
export const callsUnavailable = (t: TeamDetail): boolean => t.calls.some((w) => w.figure.why === 'unavailable');

export function teamContext(slug: string, { team, ...arrival }: { team: TeamDetail } & Arrival): SharedContext {
  const admins = team.members.filter((m) => m.role === 'admin');
  const complete = team.calls.filter((w) => w.window.complete);
  const running = team.calls.find((w) => !w.window.complete);
  const unavailable = callsUnavailable(team);
  const insights: Insight[] = [];
  // The latest weeks, as the chart ends on them: at most twelve, oldest of them first.
  const recent = complete.slice(-WEEKS_TOLD);
  if (recent.length && !unavailable) {
    insights.push({ text: `Real-work calls in the last ${recent.length} complete ${plural(recent.length, 'week')}, oldest first: ${recent.map((w) => `week of ${formatDay(w.window.from)} ${weekCount(w)}`).join('; ')}${running ? `; the week of ${formatDay(running.window.from)} is still running, ${weekCount(running)} so far` : ''}.` });
  }
  if (team.members.length) insights.push({ text: `Its members, admins first: ${listed(team.members, (m) => `${clip(m.name || m.email, 40)} (${m.role}, joined ${formatDate(m.joined)})`, `see /platform/teams/${slug}`, MEMBERS_TOLD)}.` });
  const last = complete.at(-1);
  return budgeted({
    view: 'team',
    title: `Team ${slug}`,
    address: `/platform/teams/${slug}`,
    scope: `${team.team.name !== slug ? `${team.team.name}, ` : ''}${team.team.status}, created ${formatDate(team.team.created)}`,
    freshness: arrived(arrival),
    facts: [
      { label: TEAM_TILES.people.label, value: formatCount(team.tiles.people), change: `${admins.length} ${plural(admins.length, 'admin')}`, definition: TEAM_TILES.people.definition },
      { label: TEAM_TILES.openWork.label, value: formatCount(team.tiles.openWork), definition: TEAM_TILES.openWork.definition },
      { label: TEAM_TILES.waiting.label, value: formatCount(team.tiles.waiting), definition: TEAM_TILES.waiting.definition },
      { label: TEAM_TILES.lessons.label, value: formatCount(team.tiles.lessons), definition: TEAM_TILES.lessons.definition },
      ...(last ? [{ label: 'Calls last week', value: weekCount(last), change: `week of ${formatDay(last.window.from)}`, definition: 'Real-work tool calls the team made in the last complete Monday week.' }] : []),
    ],
    insights,
    unknowns: [
      'The team is read against its own past only: nothing here compares it with another team.',
      'Which initiatives these are is the team\'s own to read: the console lists a team\'s work only to whoever acts for it.',
      ...(unavailable ? ['The calls by week could not be read, so no week\'s calls are stated.'] : []),
      ...(team.calls.length ? [] : ['No week of calls is recorded yet.']),
      ...(team.members.length ? [] : ['Nobody is in this team.']),
    ],
  });
}
