/** One team's shared context (decision 0011): its work, what waits on a person, its people and what it holds. */
import { initiativeState, waitingGates, waitingOnYou } from '@/console/initiative-state';
import type { Initiative, Team, TeamDetail } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, clip, type Arrival } from './context';

export function teamContext(slug: string, { team, initiatives, held, ...arrival }: { team: TeamDetail; initiatives: Initiative[]; held?: Team } & Arrival): SharedContext {
  const open = initiatives.filter((i) => !i.closed);
  const waiting = initiatives.filter(waitingOnYou);
  const admins = team.members.filter((m) => m.role === 'admin');
  const insights: Insight[] = [];
  if (waiting.length) insights.push({ text: `Waiting on a person: ${listed(waiting, (i) => `${clip(i.slug)} (${waitingGates(i).join(', ')})`, `see /teams/${slug}`)}.`, evidence: `/initiatives?team=${slug}&show=waiting` });
  if (initiatives.length) insights.push({ text: `Its initiatives: ${listed(initiatives, (i) => `${clip(i.slug)} (${initiativeState(i)}${i.of ? `, stage ${i.at} of ${i.of}` : ''})`, `see /teams/${slug}`)}.` });
  if (team.members.length) insights.push({ text: `Its people: ${listed(team.members, (m) => `${m.name || m.email} (${m.role}, joined ${formatDate(m.joined)})`, `see /teams/${slug}`)}.` });
  return budgeted({
    view: 'team',
    title: `Team ${slug}`,
    address: `/teams/${slug}`,
    scope: `${team.team.name !== slug ? `${team.team.name}, ` : ''}${team.team.status}, created ${formatDate(team.team.created)}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Initiatives', value: formatCount(initiatives.length), change: `${open.length} still open`, definition: 'Every piece of work this team has opened.' },
      { label: 'Waiting on you', value: formatCount(waiting.length), definition: 'Initiatives with a gate document written and not yet approved.' },
      { label: 'Members', value: formatCount(team.members.length), change: `${admins.length} ${plural(admins.length, 'admin')}` },
      ...(held ? [{ label: 'Knowledge nodes', value: formatCount(held.knowledge), change: `${held.documents} ${plural(held.documents, 'document')} and ${held.sources} ${plural(held.sources, 'source')}`, definition: 'Lessons on this team\'s shelf.' }] : []),
    ],
    insights,
    unknowns: [
      ...(initiatives.length ? [] : [`${slug} has started no initiative.`]),
      ...(team.members.length ? [] : ['Nobody is in this team.']),
    ],
  });
}
