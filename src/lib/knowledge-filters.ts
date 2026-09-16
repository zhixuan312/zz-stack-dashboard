import type { KnowledgeNode } from './api';

/**
 * The three filters the knowledge shelf composes, kept dependency-free
 * (no React, no Next) so this file can sit alongside `page.tsx` and be
 * imported by a plain Vitest test without dragging a component tree,
 * a router, or a network layer into the test — the same reason
 * `period.ts` and `format.ts` are shaped this way.
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
 * AND across team, tags and search — each filter a reader sets narrows the
 * shelf further, which is the composition the AC calls for. OR *within* the
 * tag facet — checking a second tag widens the facet's own contribution
 * (nodes carrying either tag) rather than demanding both on one node, which
 * is the standard "select tags" reading and the one that keeps adding a tag
 * from ever *shrinking* what the facet alone would show.
 *
 * The free-text search matches title and excerpt only, not tags — the
 * stakeholder asked for tags as a real facet (exact, selectable, counted),
 * explicitly not something a substring search happens to also match. Giving
 * a tag two different ways to be found — one exact, one fuzzy — is the kind
 * of drift this split is meant to prevent.
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
 * Tags actually present, each with its count — counted from the LOADED node
 * set, not from whatever the other filters have already narrowed to. A count
 * that shifted every time a reader typed a search character would make the
 * facet a moving target; a stable count next to a filtered-to-zero shelf is
 * what the empty state's "nothing matches" wording is for instead.
 *
 * Sorted most-common first (what a reader scans a facet for), ties broken
 * alphabetically so the order is stable across renders.
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
 * PLATFORM MODE IS THE ONLY CALLER. This used to take a `mode` and a `Me`, because in team
 * mode it listed the caller's OTHER memberships so they could switch shelves from here.
 * That was an offer the page could not honour twice over: the gateway scopes a team-mode
 * read to `active_team_id`, so a sibling team's rows were never fetched and picking one
 * emptied the list; and switching the team a person acts for changes every page at once,
 * which is a decision that belongs in Settings rather than in one list's filter row.
 *
 * A platform read already spans every team the caller may act on, so here "what came back"
 * and "what they can reach" are the same question — which is why the loaded set is the
 * honest source for the options.
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
