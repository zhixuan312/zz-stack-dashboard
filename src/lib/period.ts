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

/** The picker's own default. Read it with `parsePeriod(undefined)`, which returns this for anything it does not know —
 *  a product's own period context does not need a second constant to start from. All time, as the gateway's own
 *  default: a console that opens on 30 days shows a total that is not the total. */
const DEFAULT_PERIOD: Period = 'all';

export const PERIOD_LABEL: Record<Period, string> = {
  '1d': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

/** The picker's short label per period ("30D"), here beside the full name so one file holds the vocabulary and the picker
 *  follows it, with nothing to patch in the component. The file is one Meridian manages: a product with other periods
 *  edits it and names it in `.meridian/keep.json` with the reason, so an update leaves it alone. */
export const PERIOD_SHORT: Record<Period, string> = {
  '1d': '24H',
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  all: 'All',
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
