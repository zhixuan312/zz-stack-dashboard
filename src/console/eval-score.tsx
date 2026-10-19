'use client';

import { ArrowRight } from 'lucide-react';
import type { PluginScore } from '@/lib/destination-shapes';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/format-date';
import { protocolNamed, protocolSaid, standingSaid } from '@/views/plugins-context';

/**
 * A plugin's latest public score, as the platform's Evaluation read selects it: out of 10, how far it can be trusted,
 * and the protocol and date it was scored against. The same selection on the list and on a plugin's page, so the two
 * never quote different latest scores, and whether two scores compare is the gateway's sentence, quoted as it is.
 *
 * A `not_established` score shows its standing, never a number: a figure nobody established is not one to quote. Every
 * word here is a person's: an enum or a key is put in words before it is drawn.
 */

/**
 * A score's standing as the console's tone for it — one map, because the list, the plugin's score and the evaluation
 * page's headline answer the same question about the same three words, and two copies of that answer would drift.
 */
export const STANDING_TONE: Record<PluginScore['standing'], 'positive' | 'warning' | 'neutral'> = {
  established: 'positive', provisional: 'warning', not_established: 'neutral',
};

/**
 * A day, whole, with its time on hover: what a plugin page says of when something was scored, qualified or run. The
 * pages are drawn on the console's server, so a relative "3 d ago" would be worked out against no clock in the first
 * paint and change under the reader once the browser's arrived; a date reads the same in both.
 */
export const Day = ({ at }: { at: string | null }) => (at ? <time dateTime={at} title={formatDateTime(at)}>{formatDate(at)}</time> : <span className="text-ink-3">Never</span>);

/**
 * The arrow after a row's name that opens its own page, as Status's rows end with one: the row is the target, and a
 * still picture of the table says so without a pointer over it. Quiet, and ink on the row's hover.
 */
export const Goes = ({ className = '' }: { className?: string }) => (
  <ArrowRight data-goes aria-hidden className={`inline size-3.5 shrink-0 align-[-0.15em] text-ink-3 group-hover/row:text-ink ${className}`} />
);

/**
 * The list's score cell, on two lines that each stay whole: the score out of 10 (or its standing, when nobody
 * established it) with the day it was scored, and under it the protocol it was scored against; the year, the standing
 * and the range on hover. The day sits beside the figure rather than under it, so the longer line is the protocol's
 * name alone and the column is no wider than that. Under 896px of table the version and the counts are gone and the
 * columns left share less: there the day may go under the figure and the protocol may wrap, as it once did everywhere,
 * so it never sets the table wider than its frame.
 */
export function ScoreCell({ of }: { of: PluginScore | null }) {
  if (!of) return <span className="text-xs text-ink-3">Never scored</span>;
  const range = of.lower !== null && of.upper !== null ? `, ${of.lower.toFixed(1)} to ${of.upper.toFixed(1)}` : '';
  return (
    <span className="inline-flex flex-col items-center gap-0.5" title={`${standingSaid(of.standing)}${range}, ${protocolSaid(of)}, scored ${formatDateTime(of.scoredAt)}`}>
      <span className="whitespace-nowrap @max-[896px]:whitespace-normal">
        {of.standing === 'not_established' ? (
          <span className="text-xs text-ink-3">Not established</span>
        ) : (
          <span className="text-sm font-semibold whitespace-nowrap tabular-nums text-ink">
            {of.value.toFixed(1)}
            <span className="text-xs font-regular text-ink-3"> / {SCORE_OUT_OF}</span>
          </span>
        )}
        {' '}
        <span className="text-xs whitespace-nowrap text-ink-3">· {formatShortDate(of.scoredAt)}</span>
      </span>
      <span className="text-2xs whitespace-nowrap text-ink-3 @max-[896px]:whitespace-normal">{protocolNamed(of)}</span>
    </span>
  );
}

/** The list's score as a phone card's fact: one line, the figure first. */
/** The scale every plugin score reads on: the overall is 10 × the weighted sum of shares in [0, 1]. */
export const SCORE_OUT_OF = 10;

export const scoreFact = (of: PluginScore | null): string => (!of ? 'Never scored'
  : `${of.standing === 'not_established' ? 'Not established' : `${of.value.toFixed(1)} / ${SCORE_OUT_OF}`}, ${protocolSaid(of)}, ${formatDate(of.scoredAt)}`);
