/**
 * One knowledge node's shared context (decision 0011). It carries the lesson itself, so `view_knowledge_node` is how
 * the assistant reads what an earlier initiative settled without the person opening the node. Where it was learned is
 * said as the page says it: the initiatives of the team the reader acts for, by address, and a count of every other
 * team's, never their names (reconciliation 81).
 *
 * Its unknowns always say what the page holds or points at that the context does not: who recorded the lesson, what in
 * an initiative a citation stands on, the text of the node that superseded it, of its neighbours and of the lesson past
 * what is carried. With the lesson and its citations both present, a context that said nothing there read as complete
 * (Phase 7, I-163's review of what an agent on the page is told).
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
    { text: `The lesson${lesson.length > LESSON_LIMIT ? ' opens' : ''}: ${lesson.slice(0, LESSON_LIMIT)}${lesson.length > LESSON_LIMIT ? ' …' : ''}` },
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
    unknowns: unknownsOf(b, lesson, learned.length > 0 || elsewhere !== ''),
  });
}

/** What the page shows or links that this context does not carry, said briefly, most of it whatever the node holds. */
function unknownsOf(b: KnowledgeBody, lesson: string, cited: boolean): string[] {
  return [
    ...(lesson.length > LESSON_LIMIT ? [`The lesson's last ${formatCount(lesson.length - LESSON_LIMIT)} characters are on the page, not here.`] : []),
    cited
      ? 'A citation names an initiative, not the document or decision in it the lesson stands on; the store records no more.'
      : 'The node names no initiative it was learned in.',
    ...(b.superseded_by ? [`The text of node ${b.superseded_by}, which replaced it, is on its own page, not here.`] : []),
    ...(b.related.length ? ['A neighbour is named by its title alone; a shared tag is the only link the store records, and says nothing of agreement.'] : []),
    'Who recorded the lesson is not on this page; the knowledge log names who.',
  ];
}
