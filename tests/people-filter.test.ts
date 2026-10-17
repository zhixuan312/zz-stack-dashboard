import { describe, expect, it } from 'vitest';
import { PEOPLE_DEFAULTS, filtersOf, narrowed, pageAt, peoplePath } from '@/views/people-filter';

/**
 * The People list's filters and the one gateway address they are read at: the page's server read, its browser reads,
 * its context and `view_people` all ask this module, so the gateway filters and pages the list and nothing else does.
 */
describe('the People list filter', () => {
  it('reads every person, ten to a page, by default', () => {
    expect(peoplePath(PEOPLE_DEFAULTS)).toBe('/people?limit=10&offset=0');
    expect(narrowed(PEOPLE_DEFAULTS)).toBe(false);
  });

  it('sends the search trimmed and a state the route takes, and pages by ten', () => {
    expect(peoplePath({ q: '  Ada.Lovelace@Example.com ', state: 'deactivated', page: '3' })).toBe('/people?q=Ada.Lovelace%40Example.com&state=deactivated&limit=10&offset=20');
    expect(narrowed({ q: ' ', state: 'active', page: '1' })).toBe(true);
  });

  it('sends no state the route does not take, and no search of spaces', () => {
    expect(peoplePath({ q: '   ', state: 'gone', page: 'nonsense' })).toBe('/people?limit=10&offset=0');
  });

  it('reads the route\'s own limit and offset for view_people, at the page of ten the offset falls in', () => {
    expect(peoplePath(PEOPLE_DEFAULTS, { limit: 3, offset: 12 })).toBe('/people?limit=3&offset=12');
    expect(pageAt(12)).toEqual({ ...PEOPLE_DEFAULTS, page: '2' });
  });

  it('takes the first value of each parameter a page\'s address names', () => {
    expect(filtersOf({ q: ['ada', 'grace'], state: 'active' })).toEqual({ q: 'ada', state: 'active', page: '1' });
    expect(filtersOf({})).toEqual(PEOPLE_DEFAULTS);
  });
});
