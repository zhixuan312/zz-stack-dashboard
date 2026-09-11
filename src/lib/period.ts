/**
 * The reporting-period vocabulary, shared by pages, queries and the picker.
 *
 * Deliberately dependency-free so a `'use client'` control can import it
 * without dragging a database driver into the browser bundle — the picker and
 * the query that answers it must agree on the vocabulary, and one module is how
 * you guarantee that.
 */
export const PERIODS = ['1d', '7d', '30d', '90d', 'all'] as const;
export type Period = (typeof PERIODS)[number];

/**
 * ALL TIME IS THE DEFAULT, and that is a decision about honesty rather than about
 * convenience. A console that silently opens on the last 30 days shows a total which is
 * not the total, under a heading that does not say so — and every number on this page is
 * the kind somebody quotes. Opening on everything means the first read is the true one and
 * narrowing is the deliberate act.
 */
export const DEFAULT_PERIOD: Period = 'all';

export const PERIOD_LABEL: Record<Period, string> = {
  '1d': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

/** Days in a period, or `null` for `all`. */
export const PERIOD_DAYS: Record<Period, number | null> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/** Narrow an untrusted query param. Never casts a raw string through. */
export function parsePeriod(raw: string | null | undefined): Period {
  return (PERIODS as readonly string[]).includes(raw ?? '') ? (raw as Period) : DEFAULT_PERIOD;
}

/**
 * The cutoff instant for a period, or `null` for `all`.
 *
 * Pass this into a bound query parameter (`received_at >= $1`) — never
 * interpolate a period into SQL as a string.
 */
export function periodCutoff(period: Period, now: Date = new Date()): Date | null {
  const days = PERIOD_DAYS[period];
  if (days === null) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
