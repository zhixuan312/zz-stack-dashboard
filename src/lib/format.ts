/**
 * Dense-table formatters. Every one accepts `null` and renders it as an em
 * dash, so a missing measurement never renders as `0` — the distinction
 * between "we measured zero" and "nobody measured" is one a dashboard has to
 * keep, and it is lost the moment a formatter coerces.
 *
 * Add your domain's formatters here rather than inline at the call site, so a
 * quantity reads the same in a metric tile, a table cell and a tooltip.
 */
import { app } from '../app.config';

/** The symbol for `app.currency`: $, €, £, ¥; the narrow symbol, so SGD reads $1,234, not SGD1,234. */
const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: app.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? app.currency;

/** A count with its word: 1 day, 2 days; 1 key has, 3 keys have. `other` is for the words that do not take an `s`.
 *  It lives here for the reason the header gives: a count reads the same in a tile, a table cell, a tooltip and an
 *  aria-label, and the ten places that wrote their own `=== 1 ?` are how two of them came to say "1 days" and "1 others". */
export function plural(n: number, one: string, other?: string): string {
  return n === 1 ? one : (other ?? `${one}s`);
}

/** Items in a sentence: "a", "a and b", "a, b and c"; nothing is the empty string. */
export function inWords(items: readonly string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '');
}

/** A place in a row, with its ending: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. One function, so a rule's line and a page's title spell the same run the same way. */
export function ordinal(n: number): string {
  const teens = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teens ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}

/**
 * A figure that prints as zero carries no sign. `-0` is a number a product's data holds (`Math.round(-0.4)`, a net change
 * that rounded away), and `-0`, `-$0` or `-0.0%` reads as a fall that did not happen. Every format below passes through it.
 */
const zeroHasNoSign = (s: string): string => (/[1-9]/.test(s) ? s : s.replace(/^[-−]/, ''));

/** Built once: an Intl formatter costs far more to construct than to use, and a table formats a figure per cell. */
const INT = new Intl.NumberFormat('en-US');
/** The places of `app.currency`'s minor unit: 2 for the dollar, 0 for the yen and the won, 3 for the dinar. */
const DIGITS = new Intl.NumberFormat('en-US', { style: 'currency', currency: app.currency }).resolvedOptions().maximumFractionDigits ?? 2;
/** One minor unit: a cent, a yen, a fils. */
const MINOR = 10 ** -DIGITS;
const AMOUNT = new Intl.NumberFormat('en-US', { minimumFractionDigits: DIGITS, maximumFractionDigits: DIGITS });

/** Money in `app.currency`, symbol first, to its minor unit: $298.43, ¥1,204, KWD12.500. An amount under one minor unit keeps two places more ($0.0040, ¥0.40), and one too small for those keeps its first two digits ($0.0000018), so a cost that is not zero never reads as zero. A credit is negative, and its minus stands before the mark at every size — `$-0.0050` reads as a typo and hides the sign a column is sorted by. */
export function formatCost(amount: number | null): string {
  if (amount === null) return '—';
  if (amount === 0) return `${CURRENCY}0`;
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  if (a < MINOR / 200) {
    // The places grow with how small the amount is, one more than its leading zeroes, so a figure never reads as zero.
    // Past 20 places `toFixed` prints only zeroes, which is an amount of nothing and not a small one: there the figure
    // keeps its two leading digits in exponent form instead (`$1.2e-21`).
    const places = 1 - Math.floor(Math.log10(a));
    return `${sign}${CURRENCY}${places <= 20 ? a.toFixed(places) : a.toExponential(1)}`;
  }
  if (a < MINOR) return `${sign}${CURRENCY}${a.toFixed(DIGITS + 2)}`;
  // The minor unit's places at every size, so a column of amounts keeps one precision and its decimals line up.
  return `${sign}${CURRENCY}${AMOUNT.format(a)}`;
}

/** Money at a glance, for dense tables and tiles: $1.2M, $340K, $912. The exact amount belongs in the tooltip. A figure
 *  that has to KEEP the mark its caller wrote is `fitFigure`'s, which shortens with that mark and not this one. */
function formatCostCompact(amount: number | null): string {
  if (amount === null) return '—';
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  return zeroHasNoSign(a < 1000 ? `${sign}${CURRENCY}${INT.format(Math.round(a))}` : `${sign}${CURRENCY}${formatCompact(a)}`);
}

/** "$298.43" steps the cents down; "2.9M", "0.90%" and "294ms" keep the number whole and step the unit down.
 *
 * ONE parser for the two figures that do this (the Featured metric and the Metric tile). It is total: a string it
 * cannot split comes back whole as `int`, so a caller never tests for a match — and never dereferences one that is
 * not there. The symbol is whatever abuts the number, not a list of currencies: `$`, `S$`, `CHF` — this
 *  repository's own `formatCost` concatenates the narrow symbol with no space, so it always abuts. A credit's minus is
 *  part of it too (issue #96): `-$298.43` splits as mark `-$` and number `298.43`, so the sign the column is sorted by
 *  is still there when the figure is set in two faces.
 */
export function splitFigure(s: string): { pre?: string; int: string; frac?: string; unit?: string } {
  const m = s.match(/^([-+]?[^\d\s.,-]*)([\d,]+)(\.\d+)?\s*([%a-zA-Z]*)$/);
  if (!m) return { int: s };
  // Cents step down; the decimal of a compact amount ("$1.2M") is part of the number, not cents.
  const cents = Boolean(m[1]) && !m[4];
  return { pre: m[1] || undefined, int: cents ? m[2] : m[2] + (m[3] ?? ''), frac: cents ? m[3] : undefined, unit: m[4] || undefined };
}

/** The most characters a figure's number (integer and fraction, not its symbol or unit) is set whole in a tile or a
 * featured metric. Four tiles across a 1440px row hold about nine; past it the number was cut off by its own card. */
export const FIGURE_MAX = 9;

/**
 * A figure that fits its tile: as formatted while its number is nine characters or fewer, otherwise at a glance
 * ("9,876,543,210" reads "9.9B", "$1,234,567.89" reads "$1.2M"), keeping its unit. A cut figure says a different
 * number; a compact one says the same number less precisely, and the exact amount is in the table behind it.
 */
export function fitFigure(text: string, value: number): string {
  const { pre, int, frac, unit } = splitFigure(text);
  if ((int + (frac ?? '')).length <= FIGURE_MAX || !Number.isFinite(value)) return text;
  // The mark and the sign are the ones the caller's text carries, not a generic cost formatter's (issue #96): a tile
  // reads "HK$12.3M" and "-$1.2M", and a cost shortens the way the same amount shortens anywhere else. Where `pre`
  // already carries the minus, the number does not repeat it.
  const number = pre?.includes('-') ? formatCompact(Math.abs(value)) : formatCompact(value);
  // The unit keeps the space it had: "12.5M tokens", "12.5Mms" never arises (durations step up to hours first).
  return `${pre ?? ''}${number}${unit ? (/\s[%a-zA-Z]+$/.test(text) ? ' ' : '') + unit : ''}`;
}

/** The steps of a count at a glance from a million up, smallest first. */
const STEPS = [{ size: 1_000_000, unit: 'M' }, { size: 1_000_000_000, unit: 'B' }, { size: 1_000_000_000_000, unit: 'T' }] as const;

/** 2.2T, 1.2M, 846K, 912: a count at a glance. The exact number belongs in the tooltip and the table. */
export function formatCompact(n: number | null): string {
  if (n === null) return '—';
  // Every branch turns on the MAGNITUDE, so a negative reads like the positive it mirrors — "-1.5M", which is what an
  // axis already renders through `formatAxisCount`. Branching on the signed value dropped a negative all the way to
  // "-1,500,000", which is not a count at a glance.
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1_000) return zeroHasNoSign(INT.format(n));
  const thousands = Math.round(abs / 1_000);
  if (thousands < 1_000) return `${sign}${thousands}K`;
  // The smallest step whose one decimal reads under a thousand, written as that one decimal: 999,999 rounds to 1000K
  // and reads 1.0M, 950,000,000 reads 950.0M as its axis tick does, and 999,960,000,000 would read 1000.0B, so it reads
  // 1.0T. The step is decided and the digits written by one rounding: toFixed alone prints 0.95 as 0.9.
  const tenths = (size: number) => Math.round((abs / size) * 10);
  const step = STEPS.find((s) => tenths(s.size) < 10_000) ?? STEPS[STEPS.length - 1];
  return `${sign}${(tenths(step.size) / 10).toFixed(1)}${step.unit}`;
}

/** 294ms, 1.4s, 12m, 2.5h, 3.0d. The unit is the one the ROUNDED figure belongs to, as `formatCompact`'s step is: a p95
 *  of 999.6 ms reads 1.0s, never 1000ms, and a run of 59.96 s reads 1m, never 60.0s. Past two days, days: an incident
 *  open for three weeks reads 21.0d, not 504.0h. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const sign = ms < 0 ? '-' : '';
  const a = Math.abs(ms);
  if (Math.round(a) < 1000) return zeroHasNoSign(`${sign}${Math.round(a)}ms`);
  const tenths = Math.round(a / 100);
  if (tenths < 600) return `${sign}${(tenths / 10).toFixed(1)}s`;
  const minutes = Math.round(a / 60_000);
  if (minutes < 60) return `${sign}${minutes}m`;
  const hours = Math.round(a / 360_000);
  if (hours < 480) return `${sign}${(hours / 10).toFixed(1)}h`;
  return `${sign}${(Math.round(a / 8_640_000) / 10).toFixed(1)}d`;
}

function formatCount(n: number | null): string {
  if (n === null) return '—';
  return zeroHasNoSign(INT.format(n));
}

/** A change against the figure before, as the fraction `formatPercent` prints: null when nothing comes before or it was
 *  zero, which a tile says in words rather than as an infinite change. A featured figure draws a null `delta` as a dash
 *  against the period before, so a period with none before (all time) passes `?? undefined` and draws no change. */
export function changeOf(now: number, before: number | null | undefined): number | null {
  return before ? now / before - 1 : null;
}

/** "Past due" from "past due": a word as a label starts, the rest as it is. */
export function capitalise(word: string): string {
  return word.replace(/^./, (c) => c.toUpperCase());
}

/** 0.90%, 12.5%. A share that is not zero never reads as zero, `formatCost`'s rule: an error rate of 0.003% is one a
 *  healthy API holds, and "0.0%" says it had none, so a share too small for its places reads as the bound it is under,
 *  "<0.1%", with its own sign. */
export function formatPercent(fraction: number | null, digits = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  const said = zeroHasNoSign(`${(fraction * 100).toFixed(digits)}%`);
  if (fraction === 0 || /[1-9]/.test(said)) return said;
  return `${fraction < 0 ? '-' : ''}<${(10 ** -digits).toFixed(digits)}%`;
}

/**
 * Serializable formatter names.
 *
 * A client component cannot receive a FUNCTION prop from a server component —
 * React cannot serialize it across the RSC boundary and the page 500s with
 * "Functions cannot be passed directly to Client Components". So any chart
 * config that crosses that boundary names its formatter instead of carrying it,
 * and the client resolves the name here.
 *
 * Server components (BarList, CompositionBar) may still take a function
 * directly — they never cross the boundary. Only `'use client'` components need
 * this.
 */
export type NumberFormat = 'count' | 'compact' | 'cost' | 'cost-compact' | 'duration' | 'percent';

/** Bytes as a person reads them: "820 B", "12 KB", "3.4 MB". A payload's size, never a count of rows. */
export const formatBytes = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : b >= 1000 ? `${Math.round(b / 1000)} KB` : `${b} B`);

export const FORMATTERS: Record<NumberFormat, (n: number | null) => string> = {
  count: formatCount,
  compact: formatCompact,
  cost: formatCost,
  'cost-compact': formatCostCompact,
  duration: formatDuration,
  percent: (n) => formatPercent(n),
};

/** Resolve a named formatter, defaulting to `count`. */
export function formatBy(kind: NumberFormat | undefined, value: number | null): string {
  return FORMATTERS[kind ?? 'count'](value);
}

/**
 * Axis-tick formatters.
 *
 * An axis label has different needs from an inline value: it repeats four or
 * five times up the side of a chart, it is read as a SCALE rather than as a
 * quantity, and every character it spends pushes the plot area narrower. So
 * `$12.00` becomes `$12` and `1,200,000` becomes `1.2M` — the cents and the
 * exact digits are in the tooltip and the sr-only table, where someone actually
 * reading a number can find them.
 *
 * Same keys as `FORMATTERS`, so a series names its format once and both the
 * value and the axis do the right thing.
 */
export const AXIS_FORMATTERS: Record<NumberFormat, (n: number | null) => string> = {
  // Not formatCompact: it rounds to whole thousands, so a 0–2,000 scale in steps of 500 read "1K · 2K · 2K".
  count: (n) => (n === null ? '—' : zeroHasNoSign(formatAxisCount(n))),
  compact: (n) => (n === null ? '—' : zeroHasNoSign(formatAxisCount(n))),
  // Both money entries read a tick the same way, so whichever a chart names, a tick at 2,500 reads $2.5K and never $3K.
  'cost-compact': (n) => zeroHasNoSign(formatAxisCost(n)),
  cost: (n) => zeroHasNoSign(formatAxisCost(n)),
  duration: formatDuration,
  percent: (n) => formatPercent(n, 0),
};

/** A tick's number within its step: whole where it is, else to two decimals at most, so 1,250,000 reads 1.25M, never 1.3M. */
const tick = (v: number): string => String(Math.round(v * 100) / 100);

/** The steps of an axis tick, largest first. */
const AXIS_STEPS = [{ size: 1_000_000_000_000, unit: 'T' }, { size: 1_000_000_000, unit: 'B' }, { size: 1_000_000, unit: 'M' }, { size: 1_000, unit: 'K' }] as const;

/** A count on an axis tick: 0, 250, 1.5K, 2M; as short as the scale allows, never two ticks reading the same. */
function formatAxisCount(n: number): string {
  if (n === 0) return '0';
  // The steps the figure at rest takes (formatCompact), so a 1.5B tick never reads 1500M beside a column that reads 1.1B;
  // and the step the tick reaches once ROUNDED, so 999,999 is a 1M tick, never 1000K.
  const step = AXIS_STEPS.find((s) => Math.round((Math.abs(n) / s.size) * 100) >= 100);
  return step ? `${tick(n / step.size)}${step.unit}` : INT.format(n);
}

/** Built once, as `AMOUNT` is: a money tick under a thousand that is not whole keeps its minor unit, and a smaller step its digits ($0.025). */
const TICK_CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: DIGITS, maximumFractionDigits: DIGITS + 2 });

/**
 * Money on an axis tick: $0, $0.50, $250, $2.5K, $1.25M; the count axis's steps with the currency's symbol, so every
 * tick reads the value it stands at. The cents and the exact amount are in the tooltip and the readout.
 */
function formatAxisCost(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return `${CURRENCY}0`;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000) return `${sign}${CURRENCY}${formatAxisCount(abs)}`;
  return `${sign}${CURRENCY}${Number.isInteger(abs) ? INT.format(abs) : TICK_CENTS.format(abs)}`;
}
