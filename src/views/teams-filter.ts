/** The Teams list's filter, shared by the page that draws the rows and the context that describes them. */
import type { Team } from '@/lib/api-shapes';

/** The filters the Teams list keeps in its address. */
export type TeamsFilters = { q: string; status: string };

/** The rows the list shows for `f`: the page's own filter, so the page and the context cannot disagree. */
export function filterTeams(teams: Team[], f: TeamsFilters): Team[] {
  const needle = f.q.trim().toLowerCase();
  return teams.filter((t) => (f.status === 'all' || t.status === f.status) && (!needle || t.slug.includes(needle) || t.name.toLowerCase().includes(needle)));
}
