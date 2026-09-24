import type { KnowledgeNode } from './api-shapes';

/**
 * The three filters the knowledge shelf composes, kept dependency-free (no React, no Next) so a
 * plain Vitest test can import this without a component tree, a router or a network layer — the
 * same reason `period.ts` and `format.ts` are shaped this way.
 */
interface KnowledgeFilters {
  /** A team slug, or `'all'` for no team narrowing. */
  team: string;
  /** Selected tags. Empty means the facet applies no narrowing. */
  tags: string[];
  /** Free text, matched against title, excerpt and tags. */
  search: string;
}

/**
 * AND across team, tags and search — each filter a reader sets narrows the shelf further. OR within
 * the tag facet: checking a second tag widens the facet's own contribution (nodes carrying either
 * tag) rather than demanding both on one node, so adding a tag never shrinks what the facet alone
 * would show.
 *
 * The free-text search matches title and excerpt only, not tags: tags are a real facet — exact,
 * selectable, counted — and giving a tag two ways to be found, one exact and one fuzzy, is the
 * drift this split prevents.
 */
export function filterKnowledgeNodes(
  nodes: KnowledgeNode[],
  { team, tags, search }: KnowledgeFilters,
): KnowledgeNode[] {
  const needle = search.trim().toLowerCase();
  return nodes.filter((n) => {
    if (team !== 'all' && n.team !== team) return false;
    if (tags.length && !tags.some((t) => (n.tags ?? []).includes(t))) return false;
    if (needle && !n.title.toLowerCase().includes(needle) && !n.excerpt.toLowerCase().includes(needle)) {
      return false;
    }
    return true;
  });
}

/**
 * Tags actually present, each with its count — counted from the loaded node set, not from whatever
 * the other filters have narrowed to, so a count does not shift every time a reader types a search
 * character.
 *
 * Sorted most-common first, ties broken alphabetically so the order is stable across renders.
 */
export function tagFacetCounts(nodes: KnowledgeNode[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * The team control's options — the teams present in the loaded set.
 *
 * Platform mode is the only caller. In team mode the gateway scopes a read to `active_team_id`, so
 * a sibling team's rows are never fetched and offering one empties the list; switching the team a
 * person acts for changes every page at once, which belongs in Settings. A platform read already
 * spans every team the caller may act on, so the loaded set is the honest source for the options.
 */
export function teamFacetOptions(nodes: KnowledgeNode[]): { slug: string; count: number }[] {
  const countFor = (slug: string) => nodes.filter((n) => n.team === slug).length;
  return [...new Set(nodes.map((n) => n.team))].sort().map((slug) => ({ slug, count: countFor(slug) }));
}

/**
 * A node's own page: `/knowledge/<team>/<path...>`. Each path segment is encoded on its own
 * so the slashes stay route separators — the entry page decodes them back segment by segment.
 */
export function knowledgeNodeHref(team: string, path: string): string {
  return `/knowledge/${encodeURIComponent(team)}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
}
