'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import { BarList } from '@/components/charts/BarList';
import { Segmented } from '@/components/ui';
import { formatCount } from '@/lib/format';
import type { Overview } from '@/lib/api';

/**
 * Where the platform refuses — the same refused tool calls the Refusal rate tile counts,
 * on whichever of two axes the reader picks.
 *
 * THE TWO AXES ANSWER DIFFERENT QUESTIONS and neither can be derived from the other. One
 * tool refusing for nine reasons is a surface somebody should look at; nine tools refusing
 * with one identical message is a single bug with nine symptoms. A panel that offered only
 * "by tool" made the second case look like nine small problems.
 *
 * This replaced a table of tool · count · message. The table was honest and nearly
 * unreadable: the message column truncated at 36 characters, which is where these
 * refusals differ from each other, and ranking by count put the same tool in every row.
 */
export function RefusalsPanel({ refusals }: { refusals: Overview['refusals'] }) {
  const [axis, setAxis] = useState<'tool' | 'message'>('tool');

  /* THE CALLOUT IS FOR A CONCENTRATION, and it fires only when there is one.
   *
   * "90% is one error message" is worth a banner. The same banner over 10% is a headline
   * for a non-story, and a panel that always shouts teaches the reader to stop looking.
   * Measured on production while this was written, the commonest message was about a tenth
   * of the refusals — so the quiet path is the ordinary one, and it has to look deliberate
   * rather than broken. */
  const top = refusals.byMessage[0];
  const share = top && refusals.total ? top.n / refusals.total : 0;
  const concentrated = share >= CONCENTRATION;

  const rows = axis === 'tool'
    ? refusals.byTool.map((r) => ({
      key: r.tool,
      label: <span className="font-mono text-xs">{r.tool}</span>,
      value: r.n,
      tint: 'rose' as const,
    }))
    : refusals.byMessage.map((r) => ({
      key: r.message,
      label: <span className="line-clamp-2 text-xs leading-snug">{r.message}</span>,
      // Which tool said it — and, when more than one does, that IS the finding.
      caption: r.tools > 1 ? `${r.tools} tools` : r.tool,
      value: r.n,
      tint: 'rose' as const,
    }));

  return (
    <Panel
      title="Where it refuses"
      aside={
        <span className="flex items-center gap-3">
          <span className="tabular-nums text-ink-soft">{formatCount(refusals.total)}</span>
          <Segmented
            label="Group refusals by"
            value={axis}
            onChange={(v) => setAxis(v as 'tool' | 'message')}
            options={[{ value: 'tool', label: 'by tool' }, { value: 'message', label: 'by message' }]}
          />
        </span>
      }
    >
      {concentrated ? (
        <p className="mb-3 rounded-[var(--r-md)] bg-[var(--rose-tint)] px-4 py-3 text-sm leading-snug text-ink">
          <b className="t-stat mr-1.5 text-[1.375rem] text-[var(--rose-deep)]">
            {Math.round(share * 100)}%
          </b>
          is <b>one error message</b> from <code className="font-mono text-xs">{top.tool}</code>
          {' — '}{formatCount(top.n)} of {formatCount(refusals.total)}.
        </p>
      ) : null}

      {refusals.total === 0
        ? <p className="py-8 text-center text-sm text-ink-faint">Nothing refused a call in this period.</p>
        : <BarList limit={10} rows={rows} />}
    </Panel>
  );
}

/** Half. Below this, one message among many is the normal shape of a refusal list. */
const CONCENTRATION = 0.5;
