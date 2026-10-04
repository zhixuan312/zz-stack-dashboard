import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnowledgeTabs } from '@/console/knowledge-tabs';

/**
 * DELIBERATE: the tabs are real links, and that is the assertion.
 *
 * A tab written as a search parameter is read back with `useSearchParams()`, and on a statically
 * prerendered route like `/knowledge` that read never sees the write. An edit that tidies these
 * into a search parameter has to break this test to do it.
 */
describe('the knowledge tab strip', () => {
  it('renders one real link per view, to its own route', () => {
    render(<KnowledgeTabs active="nodes" />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/knowledge', '/knowledge/ask', '/knowledge/log']);
  });

  it('marks the active view for assistive tech, not only visually', () => {
    render(<KnowledgeTabs active="log" />);
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent('Log');
  });

  it('offers no Graph view', () => {
    // This platform records no node-to-node edge, so a graph here could only be drawn from
    // shared tags and would assert relationships nobody wrote down. Its absence is a decision,
    // so it is asserted rather than left to be noticed.
    render(<KnowledgeTabs active="nodes" />);
    expect(screen.queryByRole('link', { name: /graph/i })).toBeNull();
  });

  it('keeps Nodes on the bare /knowledge path, so the default view needs no parameter', () => {
    render(<KnowledgeTabs active="nodes" />);
    expect(screen.getByRole('link', { name: /nodes/i })).toHaveAttribute('href', '/knowledge');
  });
});
