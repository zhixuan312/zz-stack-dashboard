// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { teams } from '../scripts/fake-gateway/platform-teams.ts';

const REPEATED = [400, { error: 'each filter and the page are given at most once' }];
const BAD_PAGE = [400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }];

// Teams and People refuse as the gateway's parse does, and in its order: a repeated filter or page, a filter value, a page.
describe("the fake's Teams and People refusals", () => {
  const ask = (read: typeof teams | typeof people, query: string) => read(ME, new URLSearchParams(query));
  it.each([['teams', teams, 'status'], ['people', people, 'state']] as const)('%s refuses a repeated filter or page', (_, read, filter) => {
    for (const query of ['limit=10&limit=50', 'offset=0&offset=10', 'q=a&q=b', `${filter}=active&${filter}=archived`]) expect(ask(read, query), query).toEqual(REPEATED);
  });
  it.each([['teams', teams, 'status'], ['people', people, 'state']] as const)('%s refuses a filter value before a page', (_, read, filter) => {
    expect(ask(read, `${filter}=nope&limit=0`)[1]).toEqual({ error: expect.stringMatching(new RegExp(`^${filter} must be one of`)) });
    expect(ask(read, 'limit=0')).toEqual(BAD_PAGE);
    expect(ask(read, 'limit=5')[0]).toBe(200);
  });
});
