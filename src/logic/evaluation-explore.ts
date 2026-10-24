/**
 * Evaluation's prepared query, `explore_evaluation`: the findings and the scores established, each over
 * `/platform/query` as Evaluation counts them. The findings are counted by decision, owner category and plugin, a week or
 * a month at a time, and a drilled finding is one still waiting for a decision, in the form the caller reads it: a
 * member's row is its fixed summary, never the finding's own words. The scores established are the plugins whose latest
 * scoring by a window's end is established, by plugin, down to that scoring. Neither changes anything: an evaluation is
 * run and a finding decided through zz-plugin-eval's own tools, never from the console.
 */
import type { PreparedQuery, Source } from '@/lib/explore';
import { DECISIONS, OWNER_KEYS, ownerOf } from './platform-evaluation-context';
import { findings as counted, scores } from './tools/sources';

/** The findings as Evaluation counts them, with the decisions and owner categories the gateway answers named. */
const findings: Source = {
  ...counted,
  filters: { ...counted.filters, owner: { ops: ['eq'], values: OWNER_KEYS } },
  labels: {
    decision: Object.fromEntries(DECISIONS.map((d) => [d.key, d.label.toLowerCase()])),
    owner: Object.fromEntries(OWNER_KEYS.map((o) => [o, ownerOf(o).toLowerCase()])),
  },
};

export const evaluationExplore: PreparedQuery = { sources: { findings, scores } };
