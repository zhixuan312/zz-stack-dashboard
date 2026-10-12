/**
 * The Knowledge shelf's shared context (decision 0011): what the page and the assistant are both told about what
 * earlier initiatives settled.
 */
import type { KnowledgeNode } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatRelative } from '@/lib/format-date';
import { filterKnowledgeNodes, knowledgeNodeHref, tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, whose, type Arrival, type ViewMode } from './context';
import { nodeName as name } from './knowledge-name';

/** The filters the shelf keeps in its address. */
type KnowledgeFilters = { q: string; team: string; tag: string };

export function knowledgeContext(nodes: KnowledgeNode[], { filters, mode, ...arrival }: { filters: KnowledgeFilters; mode: ViewMode } & Arrival): SharedContext {
  const rows = filterKnowledgeNodes(nodes, { team: filters.team, tags: filters.tag === 'all' ? [] : [filters.tag], search: filters.q });
  const narrowed = filters.q !== '' || filters.team !== 'all' || filters.tag !== 'all';
  const multiTeam = new Set(nodes.map((n) => n.team)).size > 1;
  const adopted = rows.filter((n) => n.status === 'adopted').length;
  const superseded = rows.filter((n) => n.status === 'superseded').length;
  const latest = rows.reduce<KnowledgeNode | null>((a, n) => (!a || n.updated > a.updated ? n : a), null);
  const tags = tagFacetCounts(rows).slice(0, 8);
  const insights: Insight[] = [];
  if (tags.length) insights.push({ text: `The commonest subjects: ${tags.map((t) => `${t.tag} ${t.count}`).join(', ')}.` });
  if (multiTeam) insights.push({ text: `By team: ${teamFacetOptions(rows).map((t) => `${t.slug} ${t.count}`).join(', ')}.` });
  if (latest) insights.push({ text: `The latest recorded is ${name(latest, multiTeam)}, on ${formatDate(latest.updated)}.`, evidence: knowledgeNodeHref(latest.team, latest.path) });
  if (rows.length) insights.push({ text: `The nodes listed, newest first: ${listed([...rows].sort((a, b) => (a.updated < b.updated ? 1 : -1)), (n) => `${name(n, multiTeam)} (${n.status})`, 'search or filter on /knowledge', 15)}.` });
  const said = [filters.team !== 'all' ? `team ${filters.team}` : '', filters.tag !== 'all' ? `tag ${filters.tag}` : '', filters.q ? `matching "${filters.q}"` : ''].filter(Boolean);
  return budgeted({
    view: 'knowledge',
    title: 'Knowledge',
    address: addressOf('/knowledge', filters, { team: 'all', tag: 'all' }),
    scope: `the knowledge shelf of ${whose(mode)}${said.length ? `; filtered to ${said.join(', ')}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Nodes', value: `${formatCount(rows.length)}${narrowed ? ` of ${formatCount(nodes.length)}` : ''}`, definition: 'A node is one lesson, written down when an initiative closed and something in it was worth keeping.' },
      { label: 'Adopted', value: formatCount(adopted), definition: 'Current lessons.' },
      { label: 'Superseded', value: formatCount(superseded), definition: 'Replaced by a later node, and still readable.' },
      { label: 'Last recorded', value: latest ? `${formatRelative(latest.updated, new Date(arrival.now))} (${formatDate(latest.updated)})` : 'never' },
    ],
    insights,
    unknowns: [
      'A node\'s own text is on its page. The shelf lists the title, the tags and an opening excerpt; search reads the title and the excerpt, and a tag is a filter.',
      'The store records no link between two nodes other than a shared tag.',
      ...(rows.length ? [] : [narrowed ? 'No node matches these filters.' : 'Nothing is on the shelf yet.']),
    ],
  });
}
