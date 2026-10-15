import { describe, expect, it } from 'vitest';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { knowledgePath, narrowed } from '@/views/knowledge-context';

// This file lives in `tests/` because vitest.config.ts scans only `tests/**` — a test
// anywhere else is skipped in silence while the suite still reports success.
//
// The shelf is filtered and paged by the gateway, so what is left for the console is the one address the page, its
// context, `view_knowledge` and the `knowledge` collection all read it at, and the link each lesson opens.

describe('knowledgePath', () => {
  it('asks for one page of ten from the first when nothing narrows the shelf', () => {
    expect(knowledgePath({ q: '', kind: 'all' })).toBe('/knowledge?limit=10&offset=0');
  });

  it('sends the text and the kind to the route, and the page it was asked for', () => {
    expect(knowledgePath({ q: '  rank by recency ', kind: 'decision' }, { limit: 25, offset: 50 })).toBe('/knowledge?q=rank+by+recency&kind=decision&limit=25&offset=50');
  });
});

describe('narrowed', () => {
  it('is any filter but the defaults, and blank text is none', () => {
    expect(narrowed({ q: '', kind: 'all' })).toBe(false);
    expect(narrowed({ q: '   ', kind: 'all' })).toBe(false);
    expect(narrowed({ q: 'gateway', kind: 'all' })).toBe(true);
    expect(narrowed({ q: '', kind: 'style' })).toBe(true);
  });
});

describe('knowledgeNodeHref', () => {
  it('links a node to its own page, one encoded segment per path part', () => {
    expect(knowledgeNodeHref('team-one', 'nodes/0007-a b.md')).toBe('/knowledge/team-one/nodes/0007-a%20b.md');
  });
});
