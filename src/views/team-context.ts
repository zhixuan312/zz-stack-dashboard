/**
 * One team's shared context (decision 0011): what it holds, how much of its work is open and waiting, and its people,
 * all from the team's own read. Its initiatives are not named: Work answers the active team's work alone, so another
 * team's is read nowhere in the console, and the team's counts are what its page draws.
 */
import type { TeamDetail } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';

export function teamContext(slug: string, { team, ...arrival }: { team: TeamDetail } & Arrival): SharedContext {
  const admins = team.members.filter((m) => m.role === 'admin');
  const { counts, tiles } = team;
  const insights: Insight[] = [];
  if (team.members.length) insights.push({ text: `Its people: ${listed(team.members, (m) => `${m.name || m.email} (${m.role}, joined ${formatDate(m.joined)})`, `see /teams/${slug}`)}.` });
  return budgeted({
    view: 'team',
    title: `Team ${slug}`,
    address: `/teams/${slug}`,
    scope: `${team.team.name !== slug ? `${team.team.name}, ` : ''}${team.team.status}, created ${formatDate(team.team.created)}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Initiatives', value: formatCount(counts.initiatives), change: `${tiles.openWork} still open`, definition: 'Every piece of work this team has opened.' },
      { label: 'Revisions waiting', value: formatCount(tiles.waiting), definition: 'Revisions of this team\'s documents presented and not yet approved.' },
      { label: 'Members', value: formatCount(team.members.length), change: `${admins.length} ${plural(admins.length, 'admin')}` },
      { label: 'Knowledge nodes', value: formatCount(counts.knowledge), change: `${counts.documents} ${plural(counts.documents, 'document')} and ${counts.sources} ${plural(counts.sources, 'source')}`, definition: 'Lessons on this team\'s shelf.' },
    ],
    insights,
    unknowns: [
      'Which initiatives these are is the team\'s own to read: the console lists a team\'s work only to whoever acts for it.',
      ...(counts.initiatives ? [] : [`${slug} has started no initiative.`]),
      ...(team.members.length ? [] : ['Nobody is in this team.']),
    ],
  });
}
