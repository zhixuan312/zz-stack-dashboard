import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ConsoleError from '../app/error';

/**
 * What a route's loading state owes its page, and what the boundary above the shell does when a screen throws.
 *
 * The loading state is checked against the page rather than rendered: the shift a wrong skeleton causes happens between
 * two states, and jsdom draws neither of them. So the two files that must agree are read — the route's own `loading.tsx`
 * and the view its `page.tsx` renders — and held to each other. Each rule is a defect a skeleton was found with: two
 * tables drawn for a page with one, a page's row of tiles left out, and a filter bar hidden on a page that draws one.
 *
 * The boundary is rendered, because its props are what a person presses.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
/** Code only: a comment naming what a page draws is not what it draws. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

type Route = { route: string; loading: string; view: string };

/** Every route's own loading state, with the view its page renders. The group's fallback has no page beside it, is
 *  painted on any route, and is deliberately shapeless, so it is not one of these. */
function routes(): Route[] {
  const out: Route[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const at = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(at); continue; }
      if (entry.name !== 'loading.tsx') continue;
      const page = `${dir}/page.tsx`;
      if (!fs.existsSync(path.join(ROOT, page))) continue;
      const named = /from '@\/views\/pages\/([\w-]+)'/.exec(read(page));
      if (!named) throw new Error(`${page} renders no view under src/views/pages, so its loading state has no page to match`);
      out.push({ route: page.replace('app/(dash)/', '').replace('/page.tsx', ''), loading: at, view: `src/views/pages/${named[1]}.tsx` });
    }
  };
  walk('app/(dash)');
  return out;
}

const ROUTES = routes();
/** The tables a page's view draws. A route whose table lives in a panel under `src/console` counts none here: this
 *  reads the route's own two files, and a frame that draws more tables than they name is the defect it holds. */
const viewTables = (src: string) => (src.match(/<DataTable\b/g) ?? []).length;
/** The tables a loading state draws: a records skeleton stands for one table, as a data table does. */
const skeletonTables = (src: string) => (src.match(/<(?:TableSkeleton|RecordsSkeleton)\b/g) ?? []).length;
const drawsTiles = (src: string) => /<TilesSkeleton\b/.test(src) || /tiles=\{[1-9]\d*\}/.test(src);
const hidesFilters = (src: string) => /filters=\{false\}/.test(src);
const drawsFilterBar = (src: string) => /<FilterBar\b/.test(src);
/** The tallest block a file draws, in pixels: `h-<n>` is n × 0.25 rem against a 16px root, so h-72 is 288. A
 *  `min-h-` floor is deliberately not counted — it is not the height the block takes. */
const tallestBlock = (src: string): number => {
  const heights = [...src.matchAll(/(?<![-\w])h-(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]) * 4);
  return heights.length ? Math.max(...heights) : 0;
};
/** The rooms a view reserves for itself while its own read is in flight, in pixels: its `skeleton={…}` props. */
const declaredSkeletons = (src: string): number[] =>
  [...src.matchAll(/skeleton=\{(<Skeleton[^}]*)\}/g)].map((m) => tallestBlock(m[1]));

describe('a route, while the page it stands in for is on its way', () => {
  // A walk that found nothing passes every rule below for ever, which is the way a guard like this dies.
  it('has a loading state for every console page in the shell', () => {
    expect(ROUTES.map((r) => r.route).sort()).toContain('settings');
    expect(ROUTES.length).toBeGreaterThan(10);
  });

  it.each(ROUTES)('$route draws no more tables than its page draws', ({ loading, view }) => {
    expect(skeletonTables(code(read(loading)))).toBeLessThanOrEqual(viewTables(code(read(view))));
  });

  it.each(ROUTES.filter((r) => /split="tiles"/.test(code(read(r.view)))))('$route draws the tiles its page draws', ({ loading }) => {
    expect(drawsTiles(code(read(loading)))).toBe(true);
  });

  it.each(ROUTES.filter((r) => skeletonTables(code(read(r.loading))) > 0))('$route draws the filter bar exactly when its page draws one', ({ loading, view }) => {
    expect(hidesFilters(code(read(loading)))).toBe(!drawsFilterBar(code(read(view))));
  });

  /**
   * The page's own `skeleton={…}` is the room it means to take while a read is in flight, so a frame that reserves
   * less than that grows at the moment the page arrives. It is checked one way on purpose: taller is a different
   * defect and not one two files can settle, but shorter is the direction that pushes the rest of the page down.
   *
   * This rule comes from the one route it catches. `plugins/[plugin]/[skill]`'s frame drew two `h-48` charts where
   * its cost view reserves an `h-72` region — 96px short — and a Web Vitals run on a quiet machine, the first
   * citable one, read the result as CLS 0.106 against a bar of 0.1, largest mover `span.shimmer.block`.
   */
  it.each(ROUTES.filter((r) => declaredSkeletons(code(read(r.view))).length > 0))(
    '$route reserves at least the room its page reserves', ({ loading, view }) => {
      const owed = Math.max(...declaredSkeletons(code(read(view))));
      expect(tallestBlock(code(read(loading)))).toBeGreaterThanOrEqual(owed);
    });
});

describe('the settings frame, whose page is a stack of sections', () => {
  const view = code(read('src/views/pages/settings.tsx'));
  const loading = code(read('app/(dash)/settings/loading.tsx'));
  /** The page's own sections: the self-closing components it stacks, one per line, inside its section wrapper. */
  const stack = /<div className="([^"]*flex flex-col gap-\d+[^"]*)">([\s\S]*?)<\/div>/.exec(view);

  it('holds the page\'s own section spacing', () => {
    expect(stack).not.toBeNull();
    expect(loading).toContain(stack![1]);
  });

  /** How many sections the frame draws: a count it names, or the array a literal one is mapped over. */
  const drawnSections = (src: string): number => {
    const named = /const SECTIONS = (\d+)/.exec(src);
    if (named) return Number(named[1]);
    const literal = /\[((?:\s*\d+\s*,)+\s*\d+\s*)\]\.map/.exec(src);
    return literal ? literal[1].split(',').length : NaN;
  };

  /**
   * A component in the page's stack that renders more than one section, and how many. `PlatformSection` returns a
   * fragment holding the People and the platform-teams panels for a superadmin, and a frame that counted components
   * rather than sections was one short of the tallest page — which grows the page at the moment it arrives, the one
   * thing the frame exists to prevent. Named here rather than derived, so a change to the page meets this list.
   */
  const EXPANDS: Record<string, number> = { PlatformSection: 2 };

  it('draws one placeholder section per section the page stacks', () => {
    // Sections, not components: a component that renders two says so above.
    const stacked = [...(stack![2].matchAll(/<([A-Z]\w+) \/>/g))]
      .reduce((n, m) => n + (EXPANDS[m[1]] ?? 1), 0);
    expect(stacked, 'the settings view stacks its sections one component per line').toBeGreaterThan(1);
    expect(drawnSections(loading), 'the frame draws no sections at all').toBe(stacked);
  });
});

describe('the boundary above the shell', () => {
  const logged = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('asks the server again on Retry, rather than redrawing what failed', () => {
    logged();
    const retry = vi.fn();
    render(<ConsoleError error={new Error('boom')} retry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  // The screens this boundary covers have no rail, so this button is the only way back there is to offer.
  it('offers the way back to the console', () => {
    logged();
    render(<ConsoleError error={new Error('boom')} retry={() => {}} />);
    expect(screen.getByRole('link', { name: 'Back to the console' })).toHaveAttribute('href', '/');
  });

  it('hands over the reference a report quotes when the server threw, and logs the error', () => {
    const spy = logged();
    const error = Object.assign(new Error('boom'), { digest: 'e2f7c1a4' });
    render(<ConsoleError error={error} retry={() => {}} />);
    expect(screen.getByText('The server could not draw this page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nothing here was read.');
    expect(screen.getByText(/e2f7c1a4/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(error);
  });

  it('names a failure thrown while the page drew as one, with no reference to quote', () => {
    logged();
    render(<ConsoleError error={new Error('boom')} retry={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong while it was drawn.');
    expect(screen.queryByText(/Reference/)).toBeNull();
  });
});
