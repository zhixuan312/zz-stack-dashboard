/**
 * Which conditions a run measures, decided from what the live probe found.
 *
 * `afterLive` starts its journey from a rail route that registers live data: an `online` event the sample `LiveProvider`
 * answers, and then a Server Action replying `{ ok: true }` (scripts/lib/journey.ts `liveRefresh`). A product whose live
 * layer is its own — a stream it re-reads in the browser — answers no route, and the condition cannot measure that product
 * at all. Left as it was, that reads as a performance result and is an absent surface: zz-stack-dashboard's 0.39.3 run
 * printed 36 FAIL lines, all `afterLive`, on a run that was otherwise green.
 *
 * So a run measures the conditions that apply to the product and reports the rest once, by name. A product where SOME
 * rail route is live keeps `afterLive`: a destination no live route reaches is then a gap in the rail, which is a real
 * finding and still fails.
 */
import type { Condition } from './journey.ts';

/** What the probe looked for, said in the product's own terms, so the line reads as an absent surface. */
export const AFTER_LIVE_WHY = 'no rail route registers live data through the sample LiveProvider';

export type Conditions = { run: Condition[]; notApplicable: { condition: Condition; why: string }[] };

/** The conditions to run, and those the product has no surface for, each with its reason. */
export function conditionsToRun(conditions: readonly Condition[], live: readonly string[]): Conditions {
  if (live.length || !conditions.includes('afterLive')) return { run: [...conditions], notApplicable: [] };
  return { run: conditions.filter((c) => c !== 'afterLive'), notApplicable: [{ condition: 'afterLive', why: AFTER_LIVE_WHY }] };
}
