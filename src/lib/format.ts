/**
 * Dense-table formatters. Every one accepts `null` and renders it as an em dash, so a missing
 * measurement never renders as `0` — "we measured zero" and "nobody measured" are different facts,
 * and the distinction is lost the moment a formatter coerces.
 *
 * Add your domain's formatters here rather than inline at the call site, so a quantity reads the
 * same in a metric tile, a table cell and a tooltip.
 */

export function formatCost(usd: number | null): string {
  if (usd === null) return '—';
  if (usd === 0) return '$0';
  if (Math.abs(usd) < 0.01) return `$${usd.toFixed(4)}`;
  if (Math.abs(usd) >= 1000) return `$${Math.round(usd).toLocaleString()}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) {
    // Rounding to whole thousands can reach 1000K (999_999 does); that reads as 1.0M.
    const thousands = Math.round(n / 1_000);
    return thousands >= 1_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${thousands}K`;
  }
  return n.toLocaleString();
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

export function formatCount(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
}

export function formatPercent(fraction: number | null, digits = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/**
 * Serializable formatter names.
 *
 * A client component cannot receive a function prop from a server component — React cannot
 * serialize it across the RSC boundary and the page 500s with "Functions cannot be passed directly
 * to Client Components". So a chart config that crosses that boundary names its formatter and the
 * client resolves the name here.
 *
 * Server components (BarList, CompositionBar) may take a function directly; only `'use client'`
 * components need this.
 */
export type NumberFormat = 'count' | 'cost' | 'duration' | 'percent';

export const FORMATTERS: Record<NumberFormat, (n: number | null) => string> = {
  count: formatCount,
  cost: formatCost,
  duration: formatDuration,
  percent: (n) => formatPercent(n),
};

/** Resolve a named formatter, defaulting to `count`. */
export function formatBy(kind: NumberFormat | undefined, value: number | null): string {
  return FORMATTERS[kind ?? 'count'](value);
}

/**
 * A count for an axis tick, where the only thing that matters is that neighbouring ticks read as
 * different numbers. `formatTokens` rounds to whole thousands, which on an axis running 0…3,000 in
 * steps of 500 gives three pairs of duplicate labels. One decimal where the value needs it, none
 * where it does not.
 */
export function formatAxisCount(n: number): string {
  if (n === 0) return '0';
  const trim = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return n.toLocaleString();
}

/**
 * Axis-tick formatters. An axis label repeats four or five times up the side of a chart, is read as
 * a scale rather than as a quantity, and every character it spends pushes the plot area narrower —
 * so `$12.00` becomes `$12` and `1,200,000` becomes `1.2M`. The cents and the exact digits are in
 * the tooltip and the sr-only table.
 *
 * Same keys as `FORMATTERS`, so a series names its format once and both the value and the axis do
 * the right thing.
 */
export const AXIS_FORMATTERS: Record<NumberFormat, (n: number | null) => string> = {
  count: (n) => (n === null ? '—' : formatAxisCount(n)),
  cost: (n) => {
    if (n === null) return '—';
    if (n === 0) return '$0';
    if (Math.abs(n) < 1) return `$${n.toFixed(2)}`;
    return `$${Math.round(n).toLocaleString()}`;
  },
  duration: formatDuration,
  percent: (n) => formatPercent(n, 0),
};

/**
 * Seconds → the coarsest unit that still reads as a duration.
 *
 * `< 1 s` is a band, not a rounding down. The dash is reserved for null — nothing measured — and
 * this platform has both: a skill with no run long enough to time, and a genuine 0.1s median.
 */
export function formatSeconds(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—';
  if (s < 1) return s === 0 ? '0 s' : '< 1 s';
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

/**
 * Kilobytes → KB or MB, whichever reads without a leading zero.
 *
 * Null is a dash and never "0 KB". The gateway sends this field as null for a skill nobody has
 * measured the payload of, and rounding it reports a skill that moved nothing.
 */
export function formatKb(kb: number | null): string {
  if (kb === null || !Number.isFinite(kb)) return '—';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
