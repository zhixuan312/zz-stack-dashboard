import { describe, expect, it } from 'vitest';
import { pageOf, paramsOf } from '@/logic/context';
import { INITIATIVES_DEFAULTS, filtersOf as initiativesFilters, listPath, narrowed as initiativesNarrowed } from '@/logic/initiatives-filter';
import { filtersOf as runsFilters } from '@/logic/runs-context';
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

  it('on Initiatives narrows nothing, and is never asked of the gateway', () => {
    const f = initiativesFilters({ state: 'closed' });
    expect(initiativesNarrowed(f)).toBe(false);
    expect(listPath(f)).toBe('/initiatives?limit=10&offset=0');
    // The browser reads its address without `filtersOf`, so the address it writes holds the same rule.
    expect(listPath({ ...INITIATIVES_DEFAULTS, state: 'closed' })).toBe('/initiatives?limit=10&offset=0');
  });

  it('while a known one still narrows', () => {
    expect(bugsNarrowed(bugsFilters({ state: 'open' }))).toBe(true);
    expect(peopleNarrowed(peopleFilters({ state: 'active' }))).toBe(true);
    expect(teamsNarrowed(teamsFilters({ status: 'archived' }))).toBe(true);
    expect(initiativesNarrowed(initiativesFilters({ state: 'waiting' }))).toBe(true);
  });
});

// Every list reads its address the one way: the first of a repeated value, the default for a missing or empty one.
describe('a list address', () => {
  it('reads one value each, the first', () => {
    expect(paramsOf({ q: ['a', 'b'], state: 'active' }, { q: '', state: 'all', page: '1' })).toEqual({ q: 'a', state: 'active', page: '1' });
  });

  it('reads an empty value as the default, on every list alike', () => {
    expect(paramsOf({ state: '', page: '' }, { state: 'all', page: '1' })).toEqual({ state: 'all', page: '1' });
    expect([runsFilters({ skill: '' }).skill, initiativesFilters({ state: '' }).state]).toEqual(['all', 'all']);
  });

  it('pages from 1, whatever the address says', () => {
    expect([pageOf({ page: '3' }), pageOf({ page: '0' }), pageOf({ page: 'x' }), pageOf({ page: '2.7' })]).toEqual([3, 1, 1, 2]);
  });
});
