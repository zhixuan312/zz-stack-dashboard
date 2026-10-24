/**
 * A plugin's evaluation in the words and on the scale its page draws, for the page and the assistant alike. Not a
 * client module: the assistant's `view_plugin` tool calls these on the console's server, where a function exported from
 * a client module is a reference that can be rendered and never called.
 */
import type { DimensionScore } from '@/lib/api-shapes';
import { wordsOf } from './plugins-context';

/** A plugin's evaluation score as every view words it, 0 to 10; a score nobody established is not a number to quote. */
export const scoreOf = (e: { overallScore: number | null; scoreStatus: string | null } | null | undefined): string => (!e ? 'never evaluated' : e.scoreStatus === 'not_established' || e.overallScore === null ? 'not established' : `${e.overallScore.toFixed(1)} of 10 (${e.scoreStatus})`);

/** A dimension's score as the page's table prints it: a share in [0, 1] read out of 10, `0.78` as `7.8`. */
export const outOfTen = (share: number): string => (share * 10).toFixed(1);

/**
 * A measure's value as a person reads it: every value the scorer keeps is in [0, 1] (`scoreRun` refuses anything else),
 * so it is a share, and a share is a percent: `0.0310` reads "3.1%".
 */
export const shareSaid = (v: number): string => `${(v * 100).toFixed(1)}%`;

/**
 * Each scored dimension's points of the overall score, in tenths, as `scoreRun` (zz-core's eval/score.ts) adds them:
 * the overall is 10 × the weighted mean over the applicable dimensions that scored, re-normalised, so a dimension
 * counts `weight / counted` of it, `counted` being the weight of those dimensions. A not-applicable or unscored one's
 * weight is shared out, never a zero. Rounded so the parts sum to their whole rounded: largest remainders first.
 */
export function contributionsOf(dimensions: DimensionScore[]): { parts: { key: string; tenths: number }[]; counted: number; declared: number } {
  const scored = dimensions.filter((d) => d.applicable && d.score !== null);
  const counted = scored.reduce((n, d) => n + d.weight, 0);
  const declared = dimensions.reduce((n, d) => n + d.weight, 0);
  if (!(counted > 0)) return { parts: [], counted: 0, declared };
  const raw = scored.map((d) => (100 * d.weight * d.score!) / counted);
  const whole = Math.round(raw.reduce((a, b) => a + b, 0));
  const tenths = raw.map(Math.floor);
  const order = raw.map((_, i) => i).sort((a, b) => (raw[b] - tenths[b]) - (raw[a] - tenths[a]) || a - b);
  for (let left = whole - tenths.reduce((a, b) => a + b, 0), k = 0; left > 0; left--, k++) tenths[order[k % order.length]] += 1;
  return { parts: scored.map((d, i) => ({ key: d.key, tenths: tenths[i] })), counted, declared };
}

/** A weight as a share, to a whole percent where it is one: `25%`, `33.3%`. */
const weightSaid = (w: number): string => `${Math.round(w * 1000) / 10}%`;

/**
 * The sentence that rebuilds the overall score from its parts, as the Quality card prints it under its bar and the
 * assistant is told it: how a left-out dimension's weight was shared, then the sum. Null when no dimension scored.
 */
export function rebuiltSaid(dimensions: DimensionScore[]): string | null {
  const { parts, counted, declared } = contributionsOf(dimensions);
  if (!parts.length) return null;
  const left = dimensions.filter((d) => !d.applicable || d.score === null);
  const sum = parts.reduce((n, p) => n + p.tenths, 0);
  const how = left.length && counted < declared
    ? `${left.map((d) => wordsOf(d.key)).join(' and ')} ${left.length === 1 ? 'is' : 'are'} left out, as the table says, so ${left.length === 1 ? 'its' : 'their'} ${weightSaid(declared - counted)} is shared out over the ${parts.length} that count: each part is its score times its weight over ${weightSaid(counted)}. `
    : 'Each part is its score times its weight. ';
  return `${how}${parts.map((p) => (p.tenths / 10).toFixed(1)).join(' + ')} = ${(sum / 10).toFixed(1)} out of 10.`;
}
