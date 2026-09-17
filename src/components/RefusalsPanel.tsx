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
 *
 * NO COLOUR. Every row here is a refusal, so a red bar on each one distinguished nothing;
 * the bars are the neutral population tone and their length does the ranking.
 *
 * NO HEADLINE CALLOUT. It read "50% is one error message from …" above the list, and the
 * first bar already draws that share with its figure beside it — the same fact twice.
 */
export function RefusalsPanel({ refusals }: { refusals: Overview['refusals'] }) {
  const [axis, setAxis] = useState<'tool' | 'message'>('tool');

  const rows = axis === 'tool'
    ? refusals.byTool.map((r) => ({
      key: r.tool,
      label: <span className="font-mono text-xs">{r.tool}</span>,
      value: r.n,
    }))
    : refusals.byMessage.map((r) => ({
      key: r.message,
      label: <span className="line-clamp-2 text-xs leading-snug">{r.message}</span>,
      // Which tool said it — and, when more than one does, that IS the finding.
      caption: r.tools > 1 ? `${r.tools} tools` : r.tool,
      value: r.n,
    }));

  return (
    <Panel
      title="Refusals"
      aside={
        <span className="flex items-center gap-3">
          <span className="tabular-nums text-ink-soft">
            {formatCount(refusals.total)} refused {refusals.total === 1 ? 'call' : 'calls'}
          </span>
          <Segmented
            label="Group refusals by"
            value={axis}
            onChange={(v) => setAxis(v as 'tool' | 'message')}
            options={[{ value: 'tool', label: 'by tool' }, { value: 'message', label: 'by message' }]}
          />
        </span>
      }
    >
      {refusals.total === 0
        ? <p className="py-8 text-center text-sm text-ink-faint">Nothing refused a call in this period.</p>
        : <BarList limit={10} rows={rows} total={refusals.total} />}
    </Panel>
  );
}

