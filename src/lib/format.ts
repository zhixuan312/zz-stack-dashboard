/**
 * Dense-table formatters. Every one accepts `null` and renders it as an em
 * dash, so a missing measurement never renders as `0` — the distinction
 * between "we measured zero" and "nobody measured" is one a dashboard has to
 * keep, and it is lost the moment a formatter coerces.
 *
 * Add your domain's formatters here rather than inline at the call site, so a
 * quantity reads the same in a metric tile, a table cell and a tooltip.
 */
import { app } from '@/app.config';

/** The symbol for `app.currency`: $, €, £, ¥; the narrow symbol, so SGD reads $1,234, not SGD1,234. */
const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: app.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? app.currency;

/** Money in `app.currency`, symbol first: $298.43, €1,204. */
export function formatCost(amount: number | null): string {
  if (amount === null) return '—';
  if (amount === 0) return `${CURRENCY}0`;
  if (Math.abs(amount) < 0.01) return `${CURRENCY}${amount.toFixed(4)}`;
  if (Math.abs(amount) >= 1000) return `${CURRENCY}${Math.round(amount).toLocaleString('en-US')}`;
  return `${CURRENCY}${amount.toFixed(2)}`;
}

/** Money at a glance, for dense tables and tiles: $1.2M, $340K, $912. The exact amount belongs in the tooltip. */
function formatCostCompact(amount: number | null): string {
  if (amount === null) return '—';
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);
  return a < 1000 ? `${sign}${CURRENCY}${Math.round(a).toLocaleString('en-US')}` : `${sign}${CURRENCY}${formatCompact(a)}`;
}

/** 1.2M, 846K, 912: a count at a glance. The exact number belongs in the tooltip and the table. */
export function formatCompact(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) {
    // Rounding to whole thousands can reach 1000K (999_999 does); that reads as 1.0M.
    const thousands = Math.round(n / 1_000);
    return thousands >= 1_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${thousands}K`;
  }
  return n.toLocaleString('en-US');
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
  return n.toLocaleString('en-US');
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
  count: (n) => (n === null ? '—' : formatCompact(n)),
  compact: (n) => (n === null ? '—' : formatCompact(n)),
  'cost-compact': formatCostCompact,
  cost: (n) => {
    if (n === null) return '—';
    if (n === 0) return `${CURRENCY}0`;
    if (Math.abs(n) < 1) return `${CURRENCY}${n.toFixed(2)}`;
    return `${CURRENCY}${Math.round(n).toLocaleString('en-US')}`;
  },
  duration: formatDuration,
  percent: (n) => formatPercent(n, 0),
};

/** A count on an axis tick: 0, 250, 1.5K, 2M; as short as the scale allows. */
export function formatAxisCount(n: number): string {
  if (n === 0) return '0';
  const trim = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return n.toLocaleString('en-US');
}

/** A run's span in seconds, at the unit a person reads it in: `< 1 s`, `42 s`, `7 min`, `1.4 h`. */
export function formatSeconds(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—';
  if (s < 1) return s === 0 ? '0 s' : '< 1 s';
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

/** Bytes moved, given in KB: `840 KB`, `1.6 MB`. */
export function formatKb(kb: number | null): string {
  if (kb === null || !Number.isFinite(kb)) return '—';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
