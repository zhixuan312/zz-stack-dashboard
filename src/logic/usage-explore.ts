/**
 * Usage's prepared query, `explore_usage`: the platform's real-work calls, its refusals under their four owners and its
 * own model calls, each over `/platform/query` as Usage counts them, a day, a week, a month or a weekday at a time.
 * The calls and the refusals are split by team for a superadmin alone: `team` is the measures' fleet dimension
 * (`src/data/prepared.ts`), so the assistant's route offers it nobody else and the gateway refuses it to a member.
 * Its README lists the questions it answers.
 */
import type { PreparedQuery, Source } from '@/lib/explore';
import { platformCalls, platformRefusals } from './tools/sources';

const PAGE = '/platform/usage';
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';

/** The refusals as Usage counts them: by owner and tool, and by team for a superadmin, never listed. */
const refusals: Source = {
  ...platformRefusals,
  filters: { ...platformRefusals.filters, team: { ops: ['eq'] } },
  facets: [...platformRefusals.facets, 'team'],
  drill: { columns: ['owner', 'refusals'], address: () => PAGE },
  cannot: `Refusals are counted, never listed: Usage and Status count them and list none. A member reads no team's name. ${WINDOW}`,
};

/** The platform's own model calls, by model; what they cost is not recorded. */
const modelCalls: Source = {
  collection: 'model_calls', date: 'at',
  filters: { model: { ops: ['eq'] } }, facets: ['model'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { calls: { label: 'Model calls', unit: 'calls', definition: 'The platform\'s own model calls in the window, failed or answered.', agg: 'count' } },
  drill: { columns: ['model', 'calls'], address: () => PAGE },
  none: { model: 'no model recorded' },
  cannot: `Model calls are counted, never listed, and nothing records what they cost. ${WINDOW}`,
};

export const usageExplore: PreparedQuery = { sources: { calls: platformCalls(true), refusals, modelCalls } };
