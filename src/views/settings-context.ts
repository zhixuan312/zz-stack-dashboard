/**
 * The Settings page's shared context (decision 0011): who is signed in, which team this browser acts for, and which
 * tiers of settings their role carries. Nothing a token is made of is in it: the store keeps a hash, and the one
 * plaintext value is shown once, on the page, when a token is issued.
 */
import type { Me, MyAccessToken, MyTeams } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival, type ViewMode } from './context';

export function settingsContext({ me, teams, tokens, mode, ...arrival }: { me: Me; teams?: MyTeams; tokens?: MyAccessToken[]; mode: ViewMode } & Arrival): SharedContext {
  const admin = me.teams.filter((t) => t.role === 'admin').map((t) => t.slug);
  const live = (tokens ?? []).filter((t) => !t.revoked_at);
  const unused = live.filter((t) => !t.last_used_at);
  const insights: Insight[] = [];
  insights.push({ text: `This page has the person's own sections (Console scope, Your teams, Access tokens, Client setup)${admin.length ? `, Team administration for ${admin.join(', ')}` : ''}${me.superadmin ? ', and the platform\'s People and Platform teams' : ''}.` });
  if (teams?.teams.length) insights.push({ text: `Their teams: ${teams.teams.map((t) => `${t.team} (${t.role}${t.active ? ', the one this browser acts for' : ''})`).join(', ')}.${teams.note ? ` ${teams.note}` : ''}` });
  if (live.length) insights.push({ text: `Their live tokens: ${listed(live, (t) => `"${t.label}" issued ${formatDate(t.created_at)}, ${t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : 'never used'}`, 'see Access tokens on /settings', 10)}.` });
  if (unused.length) insights.push({ text: `${unused.length} live ${plural(unused.length, 'token has', 'tokens have')} never made a platform call.` });
  insights.push({ text: 'Every change here is made on this page by the person: switching team, issuing or revoking a token, adding or removing a member, adding a person, creating or archiving a team. The gateway decides whether they may.' });
  return budgeted({
    view: 'settings',
    title: 'Settings',
    address: '/settings',
    scope: `${me.name || me.email}'s own settings${mode === 'platform' ? ', with the console showing the platform' : ', with the console showing one team'}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Signed in as', value: `${me.name || me.email} (${me.email})` },
      { label: 'Platform role', value: me.role, definition: 'A superadmin administers people and teams across the platform. A member acts inside their teams.' },
      { label: 'Acting for', value: me.activeTeam ?? 'no team', definition: 'The team this browser\'s session acts for. Agents that authenticate as the same person keep their own.' },
      { label: 'Console scope', value: mode === 'platform' ? 'Platform' : 'Team', definition: 'Platform shows every team\'s work and the fleet pages; Team shows what a member of the active team sees. Only a superadmin has the choice.' },
      ...(tokens ? [{ label: 'Live tokens', value: formatCount(live.length), definition: 'Platform tokens not revoked. A client authenticates with one.' }] : []),
    ],
    insights,
    unknowns: ['A token\'s value is shown once, when it is issued, and can never be read again: not here and not by the assistant.'],
  });
}
