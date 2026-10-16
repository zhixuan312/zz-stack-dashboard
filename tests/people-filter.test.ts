import { describe, expect, it } from 'vitest';
import type { Person } from '@/lib/api-shapes';
import { filterPeople } from '@/views/people-filter';

/**
 * The filter the People page draws its rows with and the assistant's `people` context describes them with.
 *
 * The case is the whole subject: an address is written with the capitals its holder chose, and a person types a search
 * in lower case, so folding the name and not the address made a lower-case search miss the very person it named.
 */
const person = (over: Partial<Person> & { email: string; name: string }): Person => ({
  role: 'member', status: 'active', created: '2026-08-01', activeTeam: 'atlas',
  teams: ['atlas (member)'], tokens: 0, last_used: null, ...over,
});

const ADA = person({ email: 'Ada.Lovelace@Example.com', name: 'Ada Lovelace' });
const GRACE = person({ email: 'grace@example.com', name: 'Grace Hopper', activeTeam: 'beacon', teams: ['beacon (admin)'] });
const ALL = [ADA, GRACE];

/** The addresses the filter keeps, so a case can say which people it found and not only how many. */
const found = (q: string, team = 'all') => filterPeople(ALL, { q, team }).map((p) => p.email);

describe('the People list filter', () => {
  it('finds an address whatever case the search is typed in', () => {
    expect(found('ada.lovelace@example.com')).toEqual([ADA.email]);
    expect(found('ADA.LOVELACE@EXAMPLE.COM')).toEqual([ADA.email]);
  });

  it('finds part of an address, not only the whole of it', () => {
    expect(found('lovelace@')).toEqual([ADA.email]);
  });

  it('finds a name whatever case the search is typed in', () => {
    expect(found('GRACE')).toEqual([GRACE.email]);
  });

  it('keeps the team filter beside the search', () => {
    // Both rows carry an `a`; only one of them is on beacon.
    expect(found('a', 'beacon')).toEqual([GRACE.email]);
  });

  it('keeps everyone when the search is empty, spaces included', () => {
    expect(found('   ')).toEqual(ALL.map((p) => p.email));
  });
});
