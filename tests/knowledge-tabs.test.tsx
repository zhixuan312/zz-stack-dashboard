import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';

/**
 * THE TABS ARE LINKS, and that is the assertion — not decoration.
 *
 * `SkillViewTabs` drives its views with `router.push` plus `useSearchParams()`, which works
 * only because `/flows/[flow]/[skill]` is server-rendered per request. `/knowledge` is
 * statically prerendered, and on a static route that read never sees the write — the exact
 * failure that left the period picker stuck on one value while every option did nothing.
 * So these have to be real navigation, and a future edit that "tidies" them into a search
 * parameter has to break this test to do it.
 */
describe('the knowledge tab strip', () => {
  it('renders one real link per view, to its own route', () => {
    render(<KnowledgeTabs active="nodes" />);
    const hrefs = screen.getAllByRole('tab').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/knowledge', '/knowledge/ask', '/knowledge/log']);
  });

  it('marks the active view for assistive tech, not only visually', () => {
    render(<KnowledgeTabs active="log" />);
    const active = screen.getByRole('tab', { selected: true });
    expect(active).toHaveTextContent('Log');
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  it('offers no Graph view', () => {
    // That journal has one; the platform records no node-to-node edge, so a graph here
    // could only be drawn from shared tags and would assert relationships nobody wrote
    // down. Its absence is a decision, so it is asserted rather than left to be noticed.
    render(<KnowledgeTabs active="nodes" />);
    expect(screen.queryByRole('tab', { name: /graph/i })).toBeNull();
  });

  it('keeps Nodes on the bare /knowledge path, so the default view needs no parameter', () => {
    render(<KnowledgeTabs active="nodes" />);
    expect(screen.getByRole('tab', { name: /nodes/i })).toHaveAttribute('href', '/knowledge');
  });
});
