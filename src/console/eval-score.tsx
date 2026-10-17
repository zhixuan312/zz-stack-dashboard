'use client';

import { Badge } from '@/components/ui/badge';
import { KeyValue } from '@/components/ui/key-value';
import { Panel } from '@/console/panel';
import type { PluginScore } from '@/lib/destination-shapes';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { protocolSaid } from '@/views/plugins-context';

/**
 * A plugin's latest public score, as the platform's Evaluation read selects it: out of 10, how far it can be trusted,
 * and the protocol and date it was scored against. The same selection on the list and on a plugin's page, so the two
 * never quote different latest scores, and whether two scores compare is the gateway's sentence, quoted as it is.
 *
 * A `not_established` score shows its standing, never a number: a figure nobody established is not one to quote.
 */

/**
 * A score's standing as the console's tone for it — one map, because the list, the plugin's score and the evaluation
 * page's headline answer the same question about the same three words, and two copies of that answer would drift.
 */
export const STANDING_TONE: Record<PluginScore['standing'], 'positive' | 'warning' | 'neutral'> = {
  established: 'positive', provisional: 'warning', not_established: 'neutral',
};

/** The standing as a reader says it — `not_established` is an enum, not a word. */
const said = (standing: string) => standing.replace(/_/g, ' ');

/**
 * A day, whole, with its time on hover: what a plugin page says of when something was scored, qualified or run. The
 * pages are drawn on the console's server, so a relative "3 d ago" would be worked out against no clock in the first
 * paint and change under the reader once the browser's arrived; a date reads the same in both.
 */
export const Day = ({ at }: { at: string | null }) => (at ? <time dateTime={at} title={formatDateTime(at)}>{formatDate(at)}</time> : <span className="text-ink-3">Never</span>);

/**
 * The list's score cell: the score out of 10 (or its standing, when nobody established it), and under it the protocol
 * and the date it was scored against, because a score belongs to its protocol's version and to its day.
 */
export function ScoreCell({ of }: { of: PluginScore | null }) {
  if (!of) return <span className="text-xs text-ink-3">Never scored</span>;
  return (
    <span className="inline-flex flex-col items-center gap-0.5" title={of.lower !== null && of.upper !== null ? `${of.lower.toFixed(1)} to ${of.upper.toFixed(1)}` : undefined}>
      {of.standing === 'not_established' ? (
        <span className="text-xs text-ink-3">Not established</span>
      ) : (
        <span className="text-sm font-semibold tabular-nums text-ink">
          {of.value.toFixed(1)}
          <span className="text-xs font-regular text-ink-3"> / 10</span>
        </span>
      )}
      <span className="block whitespace-nowrap text-2xs text-ink-3">{protocolSaid(of)} · <Day at={of.scoredAt} /></span>
    </span>
  );
}

/** The list's score as a phone card's fact: one line, the figure first. */
export const scoreFact = (of: PluginScore | null): string => (!of ? 'Never scored'
  : `${of.standing === 'not_established' ? 'Not established' : `${of.value.toFixed(1)} / 10`}, ${protocolSaid(of)}, ${formatDate(of.scoredAt)}`);

/**
 * A plugin's public score as its page draws it: the figure, its range and standing, the protocol and the date, and the
 * gateway's comparability statement verbatim. Nothing here starts an evaluation, and the card says so.
 */
export function PublicScore({ of, comparability }: { of: PluginScore | null; comparability: string }) {
  return (
    <Panel title="Its public score" description="The platform's latest scoring of it, the same for everybody">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          {!of ? (
            <p className="t-figure text-ink-3">Never scored</p>
          ) : of.standing === 'not_established' ? (
            <p className="t-figure text-ink-3">Not established</p>
          ) : (
            <p className="t-figure text-ink">{of.value.toFixed(1)}<span className="unit"> / 10</span></p>
          )}
          {of ? <Badge tone={STANDING_TONE[of.standing]} dot>{said(of.standing)}</Badge> : null}
        </div>
        <KeyValue
          items={[
            ...(of ? [
              { label: 'Range', value: of.lower !== null && of.upper !== null ? `${of.lower.toFixed(1)} to ${of.upper.toFixed(1)}` : <span className="text-ink-3">Not recorded</span> },
              { label: 'Protocol', value: protocolSaid(of).replace(/^protocol /, ''), mono: true },
              { label: 'Scored', value: <Day at={of.scoredAt} /> },
            ] : []),
            // The gateway's own sentence: whether its scores compare is decided where the protocols are, not here.
            { label: 'Compares', wrap: true, value: <span data-comparability="">{comparability}</span> },
          ]}
        />
        <p className="t-caption">Nobody starts an evaluation from the console: a plugin is evaluated through the zz-plugin-eval flow, against a protocol a person agreed.</p>
      </div>
    </Panel>
  );
}
