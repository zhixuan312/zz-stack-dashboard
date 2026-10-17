import { describe, expect, it } from 'vitest';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { knowledgePath, narrowed, searchPath } from '@/views/knowledge-context';

// This file lives in `tests/` because vitest.config.ts scans only `tests/**` — a test
// anywhere else is skipped in silence while the suite still reports success.
//
// The shelf is filtered and paged by the gateway and the search ranked by it, so what is left for the console is the
// address each is read at, and the link each lesson opens. The page reads the shelf by its kind and page alone;
// `view_knowledge` adds the route's own words filter, which the page has no field for.

describe('knowledgePath', () => {
  it('asks for one page of ten from the first when no kind narrows the shelf', () => {
    expect(knowledgePath({ kind: 'all' })).toBe('/knowledge?limit=10&offset=0');
  });

  it('sends the kind to the route, and the page it was asked for', () => {
    expect(knowledgePath({ kind: 'decision' }, { limit: 25, offset: 50 })).toBe('/knowledge?kind=decision&limit=25&offset=50');
  });

  it('sends the route\'s words filter when view_knowledge gives one', () => {
    expect(knowledgePath({ q: '  rank by recency ', kind: 'decision' }, { limit: 25, offset: 50 })).toBe('/knowledge?q=rank+by+recency&kind=decision&limit=25&offset=50');
  });
});

describe('searchPath', () => {
  it('asks the ranked search for the question as typed, trimmed, and as many results as the page lists', () => {
    expect(searchPath('  rank by recency ')).toBe('/search?q=rank+by+recency&limit=10');
  });
});

describe('narrowed', () => {
  it('is a kind but all, and the question never narrows the shelf', () => {
    expect(narrowed({ kind: 'all' })).toBe(false);
    expect(narrowed({ kind: 'style' })).toBe(true);
  });
});

describe('knowledgeNodeHref', () => {
  it('links a node to its own page, one encoded segment per path part', () => {
    expect(knowledgeNodeHref('team-one', 'nodes/0007-a b.md')).toBe('/knowledge/team-one/nodes/0007-a%20b.md');
  });
});
