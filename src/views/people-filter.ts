/** The People list's filter, shared by the page that draws the rows and the context that describes them. */
import { teamSlug, type Person } from '@/lib/api-shapes';

/** The filters the People list keeps in its address. */
export type PeopleFilters = { q: string; team: string };

/** The rows the list shows for `f`: the page's own filter. */
export function filterPeople(people: Person[], f: PeopleFilters): Person[] {
  const needle = f.q.trim().toLowerCase();
  return people.filter((p) => (f.team === 'all' || p.teams.some((t) => teamSlug(t) === f.team)) && (!needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle)));
}
