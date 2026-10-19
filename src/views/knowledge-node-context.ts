/**
 * One knowledge node's shared context (decision 0011). It carries the lesson itself, so `view_knowledge_node` is how
 * the assistant reads what an earlier initiative settled without the person opening the node. Where it was learned is
 * said as the page says it: the initiatives of the team the reader acts for, by address, and a count of every other
 * team's, never their names (reconciliation 81).
 */
import type { KnowledgeBody } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';
import { nodeName as name } from './knowledge-name';

/** How much of a node's own text a context carries: enough to answer from, inside a view's budget. */
const LESSON_LIMIT = 1400;

export function knowledgeNodeContext(b: KnowledgeBody, arrival: Arrival): SharedContext {
  const lesson = b.body.trim().replace(/\s+/g, ' ');
  const insights: Insight[] = [
    { text: `The lesson${lesson.length > LESSON_LIMIT ? ' opens' : ''}: ${lesson.slice(0, LESSON_LIMIT)}${lesson.length > LESSON_LIMIT ? ` … (${formatCount(lesson.length - LESSON_LIMIT)} more characters on the page)` : ''}` },
  ];
  if (b.superseded_by) insights.push({ text: `It was superseded by node ${b.superseded_by} and is no longer the current lesson.` });
  const learned = (b.evidence_in ?? []).map((e) => (e.team ? `${e.name} (/initiatives/${e.team}/${e.name})` : `${e.name} (no initiative by this name on the platform)`));
  const elsewhere = b.cited_elsewhere ? `${b.cited_elsewhere} ${plural(b.cited_elsewhere, 'initiative of another team, which is', 'initiatives of other teams, which are')} not named here` : '';
  if (learned.length || elsewhere) insights.push({ text: `It was learned in ${[learned.join('; '), elsewhere].filter(Boolean).join(', and in ')}.` });
  // A superseded neighbour is said to be, as the page marks it, so it is never read as the current lesson.
  if (b.related.length) insights.push({ text: `It shares a tag with ${listed(b.related, (n) => `${name(n, b.multi_team)}${n.superseded_by ? ` (superseded by node ${n.superseded_by})` : ''}`, 'see the node\'s page', 10)}.` });
  return budgeted({
    view: 'knowledge_node',
    title: b.title,
    address: knowledgeNodeHref(b.team, b.path),
    scope: b.shelf === 'shared' ? `one knowledge node on the platform's shared shelf, ${b.team} node ${b.num}` : `one knowledge node, ${b.team} node ${b.num}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Status', value: b.status, definition: 'adopted is a current lesson; superseded was replaced by a later node.' },
      { label: 'Shelf', value: b.shelf === 'shared' ? 'shared' : 'your team\'s', definition: 'The shared shelf is the platform\'s, which every team\'s search reads beside its own and nobody here changes.' },
      { label: 'Type', value: b.type },
      { label: 'Recorded', value: formatDate(b.updated) },
      { label: 'Tags', value: b.tags?.length ? b.tags.join(', ') : 'none' },
    ],
    insights,
    unknowns: learned.length || elsewhere ? [] : ['The node names no initiative it was learned in.'],
  });
}
