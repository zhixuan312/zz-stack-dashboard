/** The Knowledge log's shared context (decision 0011): every node recorded on the shelf and every node superseded. */
import type { KnowledgeLog } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, whose, type Arrival } from './context';

/** Whether the log holds more than it listed: the gateway answers its latest `ceiling` entries and counts every one. */
export const pastCeiling = (log: KnowledgeLog): boolean => log.totals.entries > log.ceiling;

/** The counts are the gateway's totals over the whole log; the entries named are the latest it answered. */
export function knowledgeLogContext(log: KnowledgeLog, arrival: Arrival): SharedContext {
  const { entries, totals } = log;
  const insights: Insight[] = [];
  if (entries.length) insights.push({ text: `The latest entries, newest first: ${listed(entries, (e) => `${formatDate(e.ts)} ${e.kind === 'knowledge.add' ? 'recorded' : 'superseded'} node ${e.node}, "${e.node_title ?? e.recorded_title ?? 'no longer on the shelf'}"${e.superseded_by ? `, replaced by ${e.superseded_by}` : ''} by ${e.actor ?? 'nobody the platform could name'}`, 'see /knowledge/log', 12)}.` });
  return budgeted({
    view: 'knowledge_log',
    title: 'Knowledge log',
    address: '/knowledge/log',
    scope: `every node recorded or retired, for ${whose('team')}, newest first`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Entries', value: formatCount(totals.entries), change: entries[0] ? `the latest on ${formatDate(entries[0].ts)}` : undefined, definition: 'Every entry in the log, recorded or superseded.' },
      { label: 'Recorded', value: `${formatCount(totals.recorded)} ${plural(totals.recorded, 'node')}`, definition: 'Nodes minted.' },
      { label: 'Superseded', value: `${formatCount(totals.superseded)} ${plural(totals.superseded, 'node')}`, definition: 'Nodes replaced by a newer one.' },
    ],
    insights,
    unknowns: [
      'The log starts when it was first kept: a node minted before that is on the shelf and not in the log.',
      ...(pastCeiling(log) ? [`The page lists the latest ${formatCount(log.ceiling)} entries; the counts are over all ${formatCount(totals.entries)}.`] : []),
      ...(totals.entries ? [] : ['Nothing has been logged yet.']),
    ],
  });
}
