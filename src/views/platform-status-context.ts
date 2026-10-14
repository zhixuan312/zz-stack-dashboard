/**
 * The platform's Status page's shared context (decision 0011), and the words its one tile is drawn with: malformed calls
 * per 1,000 real-work calls, for the last whole week the gateway answered. The page draws these words and the
 * assistant is told the same ones, so it quotes the figure the screen shows.
 *
 * Only that figure is read. What else the status read carries, and the parts it marks unavailable, are not drawn and
 * not described: no verdict, no list of what needs attention, no doors.
 */
import type { Measure, PeriodFigure, PlatformStatus } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import type { SharedContext } from '@/lib/shared-context';
import { pendingContext } from './context';

/** How long the page waits for the status read before it says the read is unavailable. */
export const STATUS_BOUND_MS = 5_000;

/**
 * What the page's one read came back as: the figure with the read's own facts, a status with no such measure, a read
 * that failed, or one that did not answer within `STATUS_BOUND_MS`.
 */
export type StatusRead =
  | { state: 'ok'; meta: PlatformStatus['meta']; last: Measure['last'] }
  | { state: 'missing' }
  | { state: 'failed' }
  | { state: 'slow' };

/** The status read, reduced to the one measure the page draws. */
export function statusRead(status: PlatformStatus): StatusRead {
  const measure = status.measures.find((m) => m.key === 'malformed_per_1000');
  return measure ? { state: 'ok', meta: status.meta, last: measure.last } : { state: 'missing' };
}

export const LABEL = 'Malformed calls per 1,000';
export const DEFINITION = 'Tool calls refused as malformed (a missing argument, an invalid value) in every 1,000 real-work calls over one whole week. The release check, imports and the doctor are not real work.';
const TOO_FEW = 'Too few calls to compare';

const RATE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** A rate per 1,000, to one decimal place: `64.0`. */
export const formatRate = (n: number): string => RATE.format(n);

/** What the tile shows: a figure (a number, or a word when there is none), its one line, and a finding when the figure cannot be judged. */
type Tile = { value: number | string; note?: string; finding?: string };

/**
 * The tile for the last whole week: the rate with its counts and the week, `No calls that week` with no number when
 * nothing was called, and the rate with `Too few calls to compare` when the week is too small to judge.
 */
export function tileOf(last: PeriodFigure | null): Tile {
  if (!last) return { value: 'No whole week yet' };
  const day = formatDay(last.window.from);
  const { value, why } = last.figure;
  if (why === 'unavailable') return { value: 'Unavailable', note: `Not worked out for the week of ${day}` };
  if (why === 'no_data' || value === null) return { value: 'No calls that week', note: `Week of ${day}` };
  const note = last.numerator !== null && last.denominator !== null
    ? `${formatCount(last.numerator)} of ${formatCount(last.denominator)} real-work calls, week of ${day}`
    : `Week of ${day}`;
  return { value, note, ...(why === 'insufficient' ? { finding: TOO_FEW } : {}) };
}

/** The page's as-of line: the read's own cutoff, in the console's zone. */
export const asOfLine = (meta: PlatformStatus['meta']): string => `As of ${formatDateTime(meta.asOf)}`;

/** What a read that did not bring the figure is called on the page, and the one sentence under it. */
export function troubleOf(state: Exclude<StatusRead['state'], 'ok'>): { title: string; detail: string } {
  if (state === 'slow') return { title: "The platform's status is unavailable", detail: `It did not answer within ${STATUS_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  if (state === 'missing') return { title: "The platform's status did not include this figure", detail: 'The read answered without malformed calls per 1,000, so there is nothing to draw.' };
  return { title: "The platform's status did not load", detail: 'The platform did not answer the read. Nothing on this page was read.' };
}

const VIEW = { view: 'platform-status', title: 'Status', address: '/platform' } as const;

export function platformStatusContext(read: StatusRead): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = troubleOf(read.state);
    return pendingContext({ ...VIEW, scope: 'real-work tool calls across the platform' }, `${title}. ${detail}`);
  }
  const { meta, last } = read;
  const tile = tileOf(last);
  const value = typeof tile.value === 'number' ? formatRate(tile.value) : tile.value;
  return {
    ...VIEW,
    scope: last ? `${meta.population} across the platform, the week of ${formatDate(last.window.from)}` : `${meta.population} across the platform`,
    freshness: `${asOfLine(meta)}.`,
    facts: [{ label: LABEL, value, ...(tile.note ? { change: tile.note } : {}), definition: DEFINITION }],
    insights: [],
    unknowns: [
      ...(tile.finding ? [`${TOO_FEW}: a week this small says nothing about whether calls are getting better or worse.`] : []),
      "This page reads one figure. What needs attention, the doors, the running versions and the team's own counts are not read here, so nothing about them can be said from it.",
    ],
  };
}
