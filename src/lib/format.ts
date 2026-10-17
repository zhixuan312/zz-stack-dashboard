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

/** A place in a row, with its ending: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. One function, so a rule's line and a page's title spell the same run the same way. */
export function ordinal(n: number): string {
  const teens = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teens ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}

/** Built once: an Intl formatter costs far more to construct than to use, and a table formats a figure per cell. */
const INT = new Intl.NumberFormat('en-US');
const CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money in `app.currency`, symbol first: $298.43, €1,204. An amount under a cent keeps four decimals, and one too small for those keeps its first two digits ($0.0000018), so a cost that is not zero never reads as zero. A credit is negative, and its minus stands before the mark at every size — `$-0.0050` reads as a typo and hides the sign a column is sorted by. */
export function formatCost(amount: number | null): string {
  if (amount === null) return '—';
  if (amount === 0) return `${CURRENCY}0`;
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  if (a < 0.00005) return `${sign}${CURRENCY}${a.toFixed(Math.min(20, 1 - Math.floor(Math.log10(a))))}`;
  if (a < 0.01) return `${sign}${CURRENCY}${a.toFixed(4)}`;
  // Two decimals at every size, so a column of amounts keeps one precision and its decimals line up.
  return `${sign}${CURRENCY}${CENTS.format(a)}`;
}

/** Money at a glance, for dense tables and tiles: $1.2M, $340K, $912. The exact amount belongs in the tooltip. */
function formatCostCompact(amount: number | null): string {
  if (amount === null) return '—';
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  return a < 1000 ? `${sign}${CURRENCY}${INT.format(Math.round(a))}` : `${sign}${CURRENCY}${formatCompact(a)}`;
}

/** "$298.43" steps the cents down; "2.9M", "0.90%" and "294ms" keep the number whole and step the unit down.
 *
 * ONE parser for the two figures that do this (the Featured metric and the Metric tile). It is total: a string it
 * cannot split comes back whole as `int`, so a caller never tests for a match — and never dereferences one that is
 * not there. The symbol is whatever abuts the number, not a list of currencies: `$`, `S$`, `CHF` — this
 *  repository's own `formatCost` concatenates the narrow symbol with no space, so it always abuts.
 */
export function splitFigure(s: string): { pre?: string; int: string; frac?: string; unit?: string } {
  const m = s.match(/^([^\d\s.,-]*)([\d,]+)(\.\d+)?\s*([%a-zA-Z]*)$/);
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
  // The unit keeps the space it had: "12.5M tokens", "12.5Mms" never arises (durations step up to hours first).
  return pre ? formatCostCompact(value) : `${formatCompact(value)}${unit ? (/\s[%a-zA-Z]+$/.test(text) ? ' ' : '') + unit : ''}`;
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
  if (abs < 1_000) return INT.format(n);
  const thousands = Math.round(abs / 1_000);
  if (thousands < 1_000) return `${sign}${thousands}K`;
  // The smallest step whose one decimal reads under a thousand, written as that one decimal: 999,999 rounds to 1000K
  // and reads 1.0M, 950,000,000 reads 950.0M as its axis tick does, and 999,960,000,000 would read 1000.0B, so it reads
  // 1.0T. The step is decided and the digits written by one rounding: toFixed alone prints 0.95 as 0.9.
  const tenths = (size: number) => Math.round((abs / size) * 10);
  const step = STEPS.find((s) => tenths(s.size) < 10_000) ?? STEPS[STEPS.length - 1];
  return `${sign}${(tenths(step.size) / 10).toFixed(1)}${step.unit}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const totalMinutes = totalSeconds / 60;
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  return `${(totalMinutes / 60).toFixed(1)}h`;
}

function formatCount(n: number | null): string {
  if (n === null) return '—';
  return INT.format(n);
}

export function formatPercent(fraction: number | null, digits = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
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
  count: (n) => (n === null ? '—' : formatAxisCount(n)),
  compact: (n) => (n === null ? '—' : formatAxisCount(n)),
  // Both money entries read a tick the same way, so whichever a chart names, a tick at 2,500 reads $2.5K and never $3K.
  'cost-compact': formatAxisCost,
  cost: formatAxisCost,
  duration: formatDuration,
  percent: (n) => formatPercent(n, 0),
};

/** A tick's number within its step: whole where it is, else to two decimals at most, so 1,250,000 reads 1.25M, never 1.3M. */
const tick = (v: number): string => String(Math.round(v * 100) / 100);

/** A count on an axis tick: 0, 250, 1.5K, 2M; as short as the scale allows, never two ticks reading the same. */
function formatAxisCount(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  // The steps the figure at rest takes (formatCompact), so a 1.5B tick never reads 1500M beside a column that reads 1.1B.
  if (abs >= 1_000_000_000_000) return `${tick(n / 1_000_000_000_000)}T`;
  if (abs >= 1_000_000_000) return `${tick(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${tick(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${tick(n / 1_000)}K`;
  return INT.format(n);
}

/** Built once, as `CENTS` is: a money tick under a thousand that is not whole keeps its cents, and a smaller step its digits ($0.025). */
const TICK_CENTS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

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
