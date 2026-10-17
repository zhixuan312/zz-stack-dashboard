/**
 * Access's prepared query, `explore_access`: the caller's own tokens, counted by state and by the application each was
 * minted through, a week or a month at a time, from the caller's own Access answer on the console's server
 * (`src/data/prepared-aggregate.ts`), down to each token by label and date. Nobody else's tokens are in it, and no
 * token's value: that is shown once, when it is issued, and is read nowhere again. It changes nothing: a token is issued
 * and revoked on the page, by the person.
 */
import type { PreparedQuery, Source } from '@/lib/explore';

const tokens: Source = {
  collection: 'tokens', date: 'createdAt',
  filters: { state: { ops: ['eq'], values: ['live', 'revoked'] }, application: { ops: ['eq'] } },
  facets: ['state', 'application'], buckets: ['week', 'month'],
  measures: { tokens: { label: 'Tokens', unit: 'tokens', definition: 'The caller\'s own platform tokens issued in the window, live or revoked.', agg: 'count' } },
  drill: { columns: ['id', 'label', 'state', 'application', 'createdAt', 'lastUsedAt'], address: () => '/access' },
  none: { application: 'issued directly' },
  cannot: 'Only the caller\'s own tokens, by label, state, application and date: a token\'s value is shown once, when it is issued, and is read nowhere again. Nothing here issues or revokes one. A window holds complete days of the reporting time zone, so today is in none.',
};

export const accessExplore: PreparedQuery = { sources: { tokens } };
