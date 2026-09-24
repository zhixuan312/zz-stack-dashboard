import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardPage } from '@/components/DashboardPage';
import { GUTTER, Row, WIDTH, type PageWidth, type Split } from '@/components/ui';

/**
 * The layout contract, per page shape — see `src/components/ui/layout.tsx`.
 *
 * jsdom does no layout, so "does the page scroll" is not observable here. The facts under it
 * are: which elements can scroll, what is inside the one that does, and which classes the
 * content column carries. Asserted for every combination a page can be — with and without a
 * metric row, with and without a sub-nav, at both widths.
 */
const draw = (p: { width: PageWidth; metrics: boolean; subnav: boolean }) =>
  render(
    <TooltipProvider>
      <DashboardPage
        title="Page"
        showPeriod={false}
        width={p.width}
        subnav={p.subnav ? <span>tabs</span> : undefined}
        metrics={p.metrics ? [1, 2, 3, 4].map((n) => ({ label: `Tile ${n}`, value: n })) : undefined}
      >
        <section>body</section>
      </DashboardPage>
    </TooltipProvider>,
  ).container;

const scrollers = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>('*')].filter((el) => /\boverflow-(?:x-|y-)?(?:auto|scroll)\b/.test(el.className));

const SHAPES = (['data', 'reading'] as const).flatMap((width) =>
  [false, true].flatMap((metrics) => [false, true].map((subnav) => ({ width, metrics, subnav }))));

describe.each(SHAPES)('a page — %o', (shape) => {
  it('has exactly one scroller, and everything below the header is inside it', () => {
    const c = draw(shape);
    const [s, ...rest] = scrollers(c);
    expect(rest).toHaveLength(0);
    expect(s).toHaveAttribute('data-scroll-region');
    expect(s.className).toContain('overflow-x-hidden');
    expect(s.textContent).toContain('body');
    if (shape.metrics) expect(s.textContent).toContain('Tile 4');
    // The header and sub-nav are outside it — they never move.
    expect(s.textContent).not.toContain('Page');
    expect(s.textContent).not.toContain('tabs');
  });

  it('gives the content the gutter on all four sides and centres it at its width', () => {
    const c = draw(shape);
    const region = c.querySelector<HTMLElement>('[data-scroll-region]')!;
    const column = region.firstElementChild!;
    for (const cls of GUTTER.split(' ')) expect(region.className).toContain(cls);
    expect(column.className).toContain(WIDTH[shape.width]);
    expect(column.className).toContain('mx-auto');
    // DELIBERATE: the gutter and the width sit on different elements, in the header as in the
    // body. On one element `max-width` swallows the padding and the cards start a gutter right
    // of the title once the window is wider than the column.
    expect(column.className).not.toMatch(/\bp[xy]?-\d/);
    const header = c.querySelector('header')!;
    expect(header.firstElementChild!.className).toContain(WIDTH[shape.width]);
    expect(header.firstElementChild!.className).not.toMatch(/\bp[xy]?-\d/);
  });
});

describe('Row', () => {
  const SPLITS: Split[] = ['full', '1/2', '2/3', '1/3', '1/4'];

  it.each(SPLITS)('%s stacks to one column on a narrow screen and never lets a card widen it', (split) => {
    const row = render(<Row split={split}><div /><div /></Row>).container.querySelector('[data-split]')!;
    expect(row.className).toContain('grid-cols-1');
    expect(row.className).toContain('[&>*]:min-w-0');
    // Equal height is the grid's default stretch; nothing may opt a row out of it.
    expect(row.className).not.toMatch(/items-(start|center|end)/);
  });

  it('puts the wide share on the side the split names', () => {
    const cls = (s: Split) => render(<Row split={s} />).container.querySelector('[data-split]')!.className;
    expect(cls('2/3')).toContain('lg:[&>*:first-child]:col-span-2');
    expect(cls('1/3')).toContain('lg:[&>*:last-child]:col-span-2');
    expect(cls('1/4')).toContain('@min-[85rem]:grid-cols-4');
  });

  // A tile row counts columns from its own width, so it needs a container to measure.
  it('1/4 sits in a container and the cards stay direct children of the grid', () => {
    const c = render(<Row split="1/4"><div /><div /></Row>).container;
    expect(c.firstElementChild!.className).toContain('@container');
    expect(c.querySelector('[data-split]')!.children).toHaveLength(2);
  });
});
