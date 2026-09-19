import { describe, expect, it } from 'vitest';
import type { KnowledgeNode } from '@/lib/api-shapes';
import { filterKnowledgeNodes, knowledgeNodeHref, tagFacetCounts, teamFacetOptions } from '@/lib/knowledge-filters';

// This file lives in `tests/` because vitest.config.ts scans ONLY `tests/**` —
// a test anywhere else is skipped in silence while the suite still reports
// success. The filtering logic itself is exported from `src/lib/knowledge-filters.ts`
// (not left inline in `page.tsx`) specifically so it can be exercised here
// without mounting the page, its query client, or the Next router.

function node(partial: Partial<KnowledgeNode> & { key: string; team: string }): KnowledgeNode {
  return {
    num: '0001', path: `nodes/${partial.key}`, type: 'lesson', status: 'adopted',
    title: partial.key, tags: null, updated: '2026-01-01T00:00:00Z', bytes: 100,
    excerpt: '', evidence: null, superseded_by: null,
    ...partial,
  };
}

const nodes: KnowledgeNode[] = [
  node({
    key: 'a/1', team: 'a', title: 'Retry storms take down the gateway',
    excerpt: 'a retry storm during an incident', tags: ['reliability', 'gateway'],
  }),
  node({
    key: 'a/2', team: 'a', title: 'Prompt shape for flow runs',
    excerpt: 'a short plain opener works best', tags: ['prompting'],
  }),
  node({
    key: 'b/1', team: 'b', title: 'Migrations need a rollback plan',
    excerpt: 'schema changes without a way back', tags: ['reliability', 'migrations'],
  }),
  node({ key: 'b/2', team: 'b', title: 'Undocumented default', excerpt: 'a quiet default', tags: null }),
];

describe('filterKnowledgeNodes', () => {
  it('returns everything when no filter is set', () => {
    expect(filterKnowledgeNodes(nodes, { team: 'all', tags: [], search: '' })).toHaveLength(4);
  });

  it('narrows by team alone', () => {
    const rows = filterKnowledgeNodes(nodes, { team: 'b', tags: [], search: '' });
    expect(rows.map((n) => n.key)).toEqual(['b/1', 'b/2']);
  });

  it('matches search against title and excerpt, never against tags', () => {
    // "reliability" is a TAG on a/1 and b/1, not a substring of either title or
    // excerpt — free text must not double as tag matching now that tags have
    // their own facet (the stakeholder's own words: selectable, not free-text).
    expect(filterKnowledgeNodes(nodes, { team: 'all', tags: [], search: 'reliability' })).toHaveLength(0);
    expect(filterKnowledgeNodes(nodes, { team: 'all', tags: [], search: 'retry storm' })
      .map((n) => n.key)).toEqual(['a/1']);
  });

  it('ORs within the tag facet — selecting a second tag widens the facet, not narrows it', () => {
    const oneTag = filterKnowledgeNodes(nodes, { team: 'all', tags: ['migrations'], search: '' });
    expect(oneTag.map((n) => n.key)).toEqual(['b/1']);
    const twoTags = filterKnowledgeNodes(nodes, { team: 'all', tags: ['migrations', 'prompting'], search: '' });
    expect(twoTags.map((n) => n.key).sort()).toEqual(['a/2', 'b/1']);
  });

  it('ANDs team, tags and search together — each filter narrows further', () => {
    // Both a/1 and b/1 carry "reliability", but only a/1 is on team "a" and
    // matches the search term — team, tag and search must all hold at once.
    const rows = filterKnowledgeNodes(nodes, { team: 'a', tags: ['reliability'], search: 'gateway' });
    expect(rows.map((n) => n.key)).toEqual(['a/1']);
    expect(filterKnowledgeNodes(nodes, { team: 'b', tags: ['reliability'], search: 'gateway' })).toHaveLength(0);
  });
});

describe('tagFacetCounts', () => {
  it('counts every tag in the loaded set, most-common first, ties broken alphabetically', () => {
    expect(tagFacetCounts(nodes)).toEqual([
      { tag: 'reliability', count: 2 },
      { tag: 'gateway', count: 1 },
      { tag: 'migrations', count: 1 },
      { tag: 'prompting', count: 1 },
    ]);
  });

  it('does not shrink when a team or search filter is applied elsewhere — it reads the loaded set', () => {
    // Regression guard for the "counts computed from the loaded node set" contract:
    // calling it on a team-narrowed slice (what the page must NOT do) gives a
    // different, smaller answer, which is exactly why the page always calls
    // this on `nodes`, not on `rows`.
    const teamA = filterKnowledgeNodes(nodes, { team: 'a', tags: [], search: '' });
    expect(tagFacetCounts(teamA)).toEqual([
      { tag: 'gateway', count: 1 },
      { tag: 'prompting', count: 1 },
      { tag: 'reliability', count: 1 },
    ]);
    expect(tagFacetCounts(nodes)).not.toEqual(tagFacetCounts(teamA));
  });
});

describe('teamFacetOptions', () => {
  /**
   * ONE QUESTION NOW: which teams are on screen. It used to take a mode and a `Me` so that
   * in team mode it could list the caller's OTHER memberships, and those tests are gone with
   * that behaviour — deliberately, because the behaviour was wrong in two ways at once.
   *
   * The gateway scopes a team-mode read to `active_team_id`, so a sibling team's rows were
   * never fetched: naming that team at "count 0" offered a shelf the page could not show,
   * and picking it emptied the list. And switching the team a person acts for changes every
   * page at once, so it belongs in Settings, not in one list's filter row. The facet is
   * platform-mode only now, where a read really does span every team.
   */
  it('names every team present in the loaded set, with its true count', () => {
    expect(teamFacetOptions(nodes)).toEqual([
      { slug: 'a', count: 2 },
      { slug: 'b', count: 2 },
    ]);
  });

  it('names one team when one team is loaded — not silence, and not a zero for the others', () => {
    // The original bug this function was extracted for: visibility derived from
    // `new Set(nodes.map(n => n.team)).length > 1` hid the control the moment every loaded
    // row shared a team, leaving a reader unable to tell "filtering is missing" from
    // "there is only one team". One option, named, is the honest answer.
    const teamAOnly = filterKnowledgeNodes(nodes, { team: 'a', tags: [], search: '' });
    expect(teamFacetOptions(teamAOnly)).toEqual([{ slug: 'a', count: 2 }]);
  });

  it('is empty when nothing is loaded, rather than inventing a team', () => {
    expect(teamFacetOptions([])).toEqual([]);
  });

  it('sorts by slug, so the control does not reorder itself between renders', () => {
    expect(teamFacetOptions(nodes).map((o) => o.slug)).toEqual(['a', 'b']);
  });
});

describe('knowledgeNodeHref', () => {
  it('links a node to its own page, one encoded segment per path part', () => {
    expect(knowledgeNodeHref('team-one', 'nodes/0007-a b.md')).toBe('/knowledge/team-one/nodes/0007-a%20b.md');
  });
});
