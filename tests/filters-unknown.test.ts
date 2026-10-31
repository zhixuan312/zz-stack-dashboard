import { describe, expect, it } from 'vitest';
import { bugsPath, filtersOf as bugsFilters, narrowed as bugsNarrowed } from '@/logic/platform-bugs-context';
import { filtersOf as peopleFilters, narrowed as peopleNarrowed, peoplePath } from '@/logic/people-filter';
import { filtersOf as teamsFilters, narrowed as teamsNarrowed, teamsPath } from '@/logic/teams-filter';

// A value the route does not know (a stale link, an agent's guess) is no filter: the read and every word about it agree.
describe('an unknown filter value', () => {
  it('on Bugs narrows nothing', () => {
    const f = bugsFilters({ state: 'closed', impact: 'S9', surface: 'Not A Tool' });
    expect(bugsNarrowed(f)).toBe(false);
    expect(bugsPath(f)).toBe('/platform/bugs?limit=10&offset=0');
  });

  it('on People narrows nothing', () => {
    const f = peopleFilters({ state: 'archived' });
    expect(peopleNarrowed(f)).toBe(false);
    expect(peoplePath(f)).toBe('/people?limit=10&offset=0');
  });

  it('on Teams narrows nothing', () => {
    const f = teamsFilters({ status: 'x' });
    expect(teamsNarrowed(f)).toBe(false);
    expect(teamsPath(f)).toBe('/teams?limit=10&offset=0');
  });

  it('while a known one still narrows', () => {
    expect(bugsNarrowed(bugsFilters({ state: 'open' }))).toBe(true);
    expect(peopleNarrowed(peopleFilters({ state: 'active' }))).toBe(true);
    expect(teamsNarrowed(teamsFilters({ status: 'archived' }))).toBe(true);
  });
});
