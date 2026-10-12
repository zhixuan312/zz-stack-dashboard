/** The Knowledge log's shared context (decision 0011): every node recorded on the shelf and every node superseded. */
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, whose, type Arrival, type ViewMode } from './context';

export function knowledgeLogContext(entries: KnowledgeLogEntry[], { mode, ...arrival }: { mode: ViewMode } & Arrival): SharedContext {
  const added = entries.filter((e) => e.kind === 'knowledge.add').length;
  const insights: Insight[] = [];
  if (entries.length) insights.push({ text: `The latest entries, newest first: ${listed(entries, (e) => `${formatDate(e.ts)} ${e.kind === 'knowledge.add' ? 'recorded' : 'superseded'} node ${e.node}${e.team ? ` (${e.team})` : ''}, "${e.node_title ?? e.recorded_title ?? 'no longer on the shelf'}"${e.superseded_by ? `, replaced by ${e.superseded_by}` : ''} by ${e.actor.split('@')[0]}`, 'see /knowledge/log', 12)}.` });
  return budgeted({
    view: 'knowledge_log',
    title: 'Knowledge log',
    address: '/knowledge/log',
    scope: `every node recorded or retired, for ${whose(mode)}, newest first`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Entries', value: formatCount(entries.length), change: entries[0] ? `the latest on ${formatDate(entries[0].ts)}` : undefined },
      { label: 'Recorded', value: `${formatCount(added)} ${plural(added, 'node')}`, definition: 'Nodes minted.' },
      { label: 'Superseded', value: `${formatCount(entries.length - added)} ${plural(entries.length - added, 'node')}`, definition: 'Nodes replaced by a newer one.' },
    ],
    insights,
    unknowns: ['The log starts when it was first kept: a node minted before that is on the shelf and not in the log.', ...(entries.length ? [] : ['Nothing has been logged yet.'])],
  });
}
