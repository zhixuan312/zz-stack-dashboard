/**
 * The rules behind the facts a page states, worked out by code so a card, a page's title and an agent's context all
 * say the same thing. Pure: a rule reads nothing and imports no data and no React. It takes plain values and returns
 * what is true of them.
 *
 * A rule that states a fact writes the fact's one line itself, with the product's formatters, so the line is written
 * once: a page draws it and the page's context shares it. Each returns its fact when the rule holds and null when it
 * does not, and none has a weaker thing to say in its place. A line is a figure and what it counts, never a judgement
 * of it. What a rule needs of the product (the history a record asks for, the thresholds of a first, the band of a steady day) is an argument:
 * the readers pass `facts` from `src/app.config.ts`.
 */
import { formatPercent, ordinal, plural } from './format';
import { formatDate } from './format-date';

type FactKind = 'record' | 'first' | 'run' | 'steady' | 'all' | 'total';
/** One fact a rule found: its kind, its one line, where a person can see it for themselves, and the day it is about. */
export type Fact = { kind: FactKind; text: string; evidence?: string; day?: string };

/** One day's figure. */
type DayValue = { date: string; value: number };

/**
 * A page's figure a whole period at a time: the sum of each whole window of `length` values, counted back from the
 * latest, oldest first. A window short of the length is left out, so every value `record` is handed covers as many days.
 */
export function periods(values: readonly number[], length: number): number[] {
  const sums: number[] = [];
  for (let end = values.length; length > 0 && end - length >= 0; end -= length) {
    let sum = 0;
    for (let i = end - length; i < end; i++) sum += values[i];
    sums.unshift(sum);
  }
  return sums;
}

/**
 * The rule of a record: the latest period is higher than every one before it. `values` is one figure a whole period,
 * oldest first. A period may be called a record only when it and the periods before it number at least `needs`: with
 * less history the highest yet says little. `run` counts the periods in a row, ending with the latest, that were each a
 * record; a period that only equals the highest is not one.
 *
 * `day` is the date the latest value is about, when the caller has one: the fact carries it and its line names it, "on"
 * the day, or "in the week to" it when `week` says the value is a week's.
 *
 * `beside` says the figure this record is about already stands beside the line — the card's own hero figure, and the
 * caption under it — so the line states the record and not the number a second time. A period record under a hero
 * figure is the case it is for; the record of a day, whose figure is nowhere else on the card, states its own.
 */
export function record(values: readonly number[], { needs, what, format, day, week, beside }: { needs: number; what: string; format: (n: number) => string; day?: string; week?: boolean; beside?: boolean }): (Fact & { run: number }) | null {
  let highest = -Infinity, run = 0;
  values.forEach((value, i) => {
    run = i + 1 >= needs && value > highest ? run + 1 : 0;
    highest = Math.max(highest, value);
  });
  if (!run) return null;
  const on = day ? `, ${week ? 'in the week to' : 'on'} ${formatDate(day)}` : '';
  return { kind: 'record', run, ...(day ? { day } : {}), text: `The highest ${what} yet${beside ? '' : `: ${format(values[values.length - 1])}`}${run > 1 ? `, the ${ordinal(run)} record in a row` : ''}${on}` };
}

/**
 * The rule of a first: the first day a threshold was passed, and how many days have passed it since. `days` is one
 * figure a day, oldest first. Of the thresholds, the fact is about the largest some day is above. It is nothing when no
 * threshold has been passed, and nothing when the earliest day is not below that threshold: a threshold already passed
 * when the records begin has no first day the product can know. `daysSince` counts the later days above it, not the
 * days gone by.
 *
 * `period` is how many of the latest days are a page's period, when the fact is stated about one: it counts how many of
 * them passed the threshold (`inPeriod`), and the line says so. The rule is still given every day kept, never the
 * period's days alone, which would make a day inside the period the first ever.
 */
export function first(days: readonly DayValue[], { thresholds, what, format, period }: { thresholds: readonly number[]; what: string; format: (n: number) => string; period?: number }): (Fact & { threshold: number; day: string; daysSince: number; inPeriod?: number }) | null {
  const passed = thresholds.filter((t) => days.some((d) => d.value > t));
  if (!passed.length) return null;
  const threshold = Math.max(...passed);
  if (!(days[0].value < threshold)) return null;
  const at = days.findIndex((d) => d.value > threshold);
  const daysSince = days.slice(at + 1).filter((d) => d.value > threshold).length;
  const day = days[at].date;
  const since = daysSince ? `; ${daysSince} ${plural(daysSince, 'day has', 'days have')} passed it since` : '';
  if (!period) return { kind: 'first', threshold, day, daysSince, text: `${what} first passed ${format(threshold)} in a day on ${formatDate(day)}${since}` };
  const n = Math.min(period, days.length);
  const inPeriod = days.slice(-n).filter((d) => d.value > threshold).length;
  const within = `${since ? ', and' : ';'} ${inPeriod} of the last ${n} ${plural(n, 'day')} passed it`;
  return { kind: 'first', threshold, day, daysSince, inPeriod, text: `${what} first passed ${format(threshold)} in a day on ${formatDate(day)}${since}${within}` };
}

/**
 * The rule of an "all": every member of a set did the same thing, written N of N. `sets` is the sets to try, in order:
 * the whole set first, with an empty label, then each named subset. The fact is the first set that has a member and
 * whose every member did it; one member short and it is not a fact. `say.what` names the members and `say.did` what
 * they did.
 */
export function all<T>(sets: readonly { label: string; members: readonly T[] }[], did: (member: T) => boolean, say: { what: string; did: string }): (Fact & { count: number; label: string }) | null {
  const set = sets.find((s) => s.members.length > 0 && s.members.every(did));
  if (!set) return null;
  const count = set.members.length;
  return { kind: 'all', count, label: set.label, text: [`${count} of ${count}`, set.label, say.what, say.did].filter(Boolean).join(' ') };
}

/**
 * The rule of a total: the sum of everything recorded, with its first day and its latest. `days` is one figure a day,
 * oldest first. `format` writes the sum; hand it one that keeps every digit wherever the page has room for them. The
 * fact is about its latest day.
 *
 * `share` is a part of each day's figure, in the same order, when the caller wants the part's share of the sum beside
 * it: "99.57% of them without an error". It is left out when the sum is zero, which has no share.
 */
export function total(days: readonly DayValue[], { what, format, share }: { what: string; format: (n: number) => string; share?: { part: readonly number[]; what: string } }): (Fact & { sum: number; share?: number }) | null {
  if (!days.length) return null;
  const sum = days.reduce((s, d) => s + d.value, 0);
  const part = share && sum ? share.part.reduce((s, v) => s + v, 0) / sum : null;
  const text = `${format(sum)} ${what} in ${days.length} ${plural(days.length, 'day')}, from ${formatDate(days[0].date)} to ${formatDate(days[days.length - 1].date)}`;
  return { kind: 'total', sum, day: days[days.length - 1].date, ...(part !== null ? { share: part } : {}), text: part !== null ? `${text}, ${formatPercent(part, 2)} ${share!.what}` : text };
}

/**
 * The rule of a run, as a fact: how long `name` has held the `good` state, up to today. `days` is one state a day,
 * oldest first, the last of them today. Nothing when today is not `good` or no day is given. A run that reaches the
 * earliest day given is "at least" that long and never the longest; otherwise it is called its longest when no run
 * among the days is longer. Worked out by `runOf`, which the Status list draws from the same days.
 */
export function run<S>(days: readonly S[], good: S, { name }: { name: string }): (Fact & { length: number; atLeast: boolean; longest: boolean }) | null {
  const { length, reachesStart, longest } = runOf(days, good);
  if (!length) return null;
  const mine = longest && !reachesStart;
  return {
    kind: 'run', length, atLeast: reachesStart, longest: mine,
    text: `${name} has run ${reachesStart ? 'at least ' : ''}${length} ${plural(length, 'day')} without a mark${mine ? `, its longest in ${days.length}` : ''}`,
  };
}

/** One complete day as `steady` reads it: its p95 in milliseconds, its errors and its requests. */
type DayService = { date: string; p95: number; errors: number; requests: number };

/**
 * The rule of a steady state: how many of the days given were inside the band, and which were not, by date. `days`
 * are complete days, oldest first; the caller leaves the day in progress out. A day is inside when its p95 is under
 * `band.p95Under` and its errors over its requests under `band.errorRateUnder`: a day at either edge is outside, and so
 * is a day with no requests, which has no rate to hold. The line names the band's own figures, then the first three
 * days outside it and how many more.
 */
export function steady(days: readonly DayService[], band: { p95Under: number; errorRateUnder: number }): (Fact & { inside: number; of: number; outside: string[] }) | null {
  if (!days.length) return null;
  const outside = days.filter((d) => !(d.p95 < band.p95Under && d.errors / d.requests < band.errorRateUnder)).map((d) => d.date);
  const inside = days.length - outside.length;
  const named = outside.slice(0, 3).map(formatDate);
  const more = outside.length - named.length;
  const list = more ? `${named.join(', ')} and ${more} more` : named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named.at(-1)}` : named[0];
  // The band as it was given, to the hundredth of a percent: a band of 0.5% is not written 1%.
  const rate = `${Number((band.errorRateUnder * 100).toFixed(2))}%`;
  return {
    kind: 'steady', inside, of: days.length, outside,
    text: `${inside} of ${days.length} ${plural(days.length, 'day')} inside the band of p95 under ${band.p95Under} ms and errors under ${rate}${outside.length ? `; outside it on ${list}` : ''}`,
  };
}

/**
 * How long a state has held, up to today. `days` is one state a day, oldest first, the last of them today; `good` is
 * the state that counts. `run` states it as a fact; the Status list draws it under each service's strip.
 *
 * - `length`: the days in a row that end today and were `good`, today included; 0 when today is not.
 * - `reachesStart`: the run goes back to the earliest day given. What came before is not known, so the run is at least
 *   this long, and nobody may call it the longest.
 * - `longest`: no run among the days given is longer. A run an earlier one only equals still is.
 */
export function runOf<S>(days: readonly S[], good: S) {
  let length = 0;
  while (length < days.length && days[days.length - 1 - length] === good) length++;
  // Every run before this one ends at a day that was not good, so the days ahead of the run are counted on their own.
  let longer = false;
  for (let i = 0, held = 0; i < days.length - length && !longer; i++) {
    held = days[i] === good ? held + 1 : 0;
    longer = held > length;
  }
  return { length, reachesStart: length > 0 && length === days.length, longest: length > 0 && !longer };
}
