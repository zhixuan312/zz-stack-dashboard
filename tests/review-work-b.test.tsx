import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The address as a page reads it: a tab is in the address, as a navigation leaves it. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import type { DocumentDetail } from '@/lib/api-shapes';
import type { Approvals, InitiativeList, WaitingRow } from '@/lib/work-shapes';
import { APPROVALS_DEFAULTS, approvalsPath } from '@/views/approvals-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { InitiativeView, SlugTitle } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { ME } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { initiativeDetail, initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';

/**
 * Phase 7, I-153: the Work review's findings on Initiatives, an initiative, a document and Approvals, each found gone
 * at its cause. A reviewer who never read the code saw them in the screenshots (F-10, F-14, F-17, F-19, F-20, F-25,
 * F-27, F-28, F-34, F-38); what is pinned here is the markup that made each one, read as `table-columns.test.tsx` reads
 * a table's breakpoints, since jsdom lays nothing out: the class a width rule hangs on, the column that takes the
 * slack, the cell a phone card drops a dot from. The screenshots of the built pages are the layout evidence.
 */
const AT = '2026-10-19T09:00:00Z';
const query = (path: string) => new URLSearchParams(path.split('?')[1]);
/** Under 1152px: the breakpoint that dropped a column from a table in a 1440px window, whose content is narrower. */
const XL = '@max-[1152px]:hidden';
const classes = (el: Element) => (typeof el.className === 'string' ? el.className.split(/\s+/) : []);

beforeEach(() => {
  // Every page here draws what its server read handed it; a read the browser would make is never answered.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function mount(ui: ReactElement, ask?: (q: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>
    </QueryClientProvider>,
  );
}

/** The table captioned `caption`: its section, its header cells and, by a header's words, that column's cells. */
function table(caption: string) {
  const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption')?.textContent === caption);
  if (!t) throw new Error(`no table captioned "${caption}"`);
  const heads = [...t.querySelectorAll('thead th')];
  const rows = [...t.querySelectorAll('tbody tr')];
  const at = (header: string) => {
    const i = heads.findIndex((th) => th.textContent?.trim() === header);
    if (i < 0) throw new Error(`no column "${header}" in "${caption}": ${heads.map((th) => th.textContent?.trim()).join(' | ')}`);
    return { th: heads[i], cells: rows.map((tr) => tr.children[i] as HTMLElement), index: i };
  };
  return { t, section: t.closest('section')!, rows, at };
}

/** Every tile figure on the page wears the ink, never the accent the console keeps for what a person presses. */
function figuresInInk() {
  const figures = [...document.querySelectorAll('[data-value]')];
  expect(figures.length).toBeGreaterThan(0);
  for (const f of figures) expect(classes(f), `the figure "${f.textContent}"`).not.toContain('text-accent-ink');
}

describe('Initiatives', () => {
  const PATH = listPath(INITIATIVES_DEFAULTS);
  const LIST = initiativeList(ME, query(PATH))[1] as InitiativeList;
  const draw = () => mount(<InitiativesView served={{ state: 'ok', path: PATH, data: LIST, team: 'atlas' }} />);

  it('F-10: draws gates passed as a column at 1440 and as a fact on a phone\'s card', () => {
    draw();
    const { th, cells } = table('Initiatives').at('Gates passed');
    expect(classes(th)).not.toContain(XL);
    expect(cells.length).toBeGreaterThan(0);
    LIST.rows.slice(0, cells.length).forEach((r, i) => {
      expect(classes(cells[i])).not.toContain(XL);
      expect(cells[i].dataset.mobile).toBe('fact');
      expect(cells[i].textContent).toContain(r.gates.of ? `${r.gates.passed} of ${r.gates.of} gates` : 'No gates');
    });
  });

  it('F-19: sizes each column to what it holds, the slug on one line and the flow position taking the rest', () => {
    draw();
    const { at } = table('Initiatives');
    const slug = at('Initiative'), next = at('Flow position');
    expect(classes(next.th)).toContain('w-full');
    expect(classes(slug.th)).not.toContain('w-full');
    for (const td of slug.cells) expect(classes(td.querySelector('[title]')!)).toContain('whitespace-nowrap');
    for (const td of next.cells) expect(td.querySelector('[class*="overflow-wrap:anywhere"]')).toBeNull();
  });

  it('F-17: sets the Waiting figure in ink, not the accent', () => {
    draw();
    figuresInInk();
  });

  it('F-27: leaves no separator at the head of a phone card\'s line', () => {
    draw();
    const { section, rows, at } = table('Initiatives');
    const next = at('Flow position').index + 1, gates = at('Gates passed').index + 1;
    // The flow position, the first fact, takes a line of its own and carries no dot; the gates open the next line, and
    // the rule that hides their dot names their cell by the position it really has.
    for (const tr of rows) {
      expect(tr.querySelector(`td:nth-child(${next}) [data-sep]`)).toBeNull();
      expect(tr.querySelector(`td:nth-child(${gates}) [data-sep]`)).not.toBeNull();
    }
    expect(classes(section)).toContain(`@max-[640px]:[&_tbody_td:nth-child(${next})]:!basis-full`);
    expect(classes(section)).toContain(`@max-[640px]:[&_tbody_td:nth-child(${gates})_[data-sep]]:!hidden`);
  });
});

describe('An initiative', () => {
  const SLUG = '2026-09-28-search-relevance';

  it('F-14: titles the page by its slug held together on one line, sized to the masthead\'s width', () => {
    render(<h1><SlugTitle slug={SLUG} /></h1>);
    const held = [...document.querySelectorAll('h1 span')].find((s) => s.textContent === SLUG && classes(s).includes('whitespace-nowrap'));
    expect(held, 'a span holding the whole slug on one line').toBeDefined();
    // The masthead's width over the slug's: jsdom folds the division into one `cqi` length.
    expect(held!.getAttribute('style')).toMatch(/font-size:\s*min\(1em,\s*[\d.]+cqi\)/);
    expect(classes(held!.parentElement!)).toContain('[h1_&]:[container-type:inline-size]');
  });

  it('F-25: stands its cards a row gap apart', () => {
    const data = initiativeDetail('atlas', SLUG)!;
    const { container } = mount(<InitiativeView team="atlas" slug={SLUG} served={{ state: 'ok', data, team: 'atlas', at: AT }} />);
    const body = container.querySelector('[data-protagonist="Documents"]')!.parentElement!;
    expect(classes(body)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'gap-(--stack-gap)']));
    expect(within(body).getByText('Progress')).toBeTruthy();
    expect(body.querySelectorAll('section').length).toBeGreaterThan(1);
  });
});

describe('A document', () => {
  it('F-28: lays a table the document carries out as cards in a phone\'s column', async () => {
    const data = documentDetail('atlas', '2026-09-28-search-relevance', 'spec.md') as DocumentDetail;
    expect(data.body).toMatch(/\n\|.+\|\n\|\s*-/);
    await act(async () => { mount(<DocumentView team="atlas" slug="2026-09-28-search-relevance" rel="spec.md" served={{ state: 'ok', data, at: AT }} teamPage={false} />); });
    // The renderer is a chunk of its own, so the table is there once it has landed.
    const carried = (await screen.findByText('Where match reasons come from', {}, { timeout: 5000 })).closest('table');
    expect(carried, 'the document\'s own table').not.toBeNull();
    // Prose's `stack` (ZZ Meridian 0.23.0): the table's own frame is the container, and the rows become cards under 480px.
    expect(classes(carried!.parentElement!)).toContain('@container');
    expect(classes(carried!)).toEqual(expect.arrayContaining([
      '@max-[480px]:block', '@max-[480px]:[&_tr]:block', '@max-[480px]:[&_td]:block', '@max-[480px]:[&_td:first-child]:font-medium',
    ]));
  });
});

describe('Approvals', () => {
  const WAITING = approvalsPath(APPROVALS_DEFAULTS);
  const answer = approvals(ME, query(WAITING))[1] as Approvals;
  const draw = (ask?: (q: string) => void) => mount(<ApprovalsView served={{ state: 'ok', path: WAITING, data: answer, team: 'atlas' }} />, ask);
  const queue = () => (answer.waiting.state === 'ok' ? answer.waiting.data.rows : []) as WaitingRow[];

  it('F-20: holds the initiative on one line and keeps the document column as wide as a file name', () => {
    draw();
    const { at } = table('Team approvals');
    const doc = at('Document'), initiative = at('Initiative');
    expect(classes(initiative.th)).toContain('w-full');
    expect(classes(doc.th)).not.toContain('w-full');
    for (const td of [...doc.cells, ...initiative.cells]) {
      const value = td.querySelector('[title]')!;
      expect(classes(value)).toContain('whitespace-nowrap');
      expect(classes(value)).not.toContain('[overflow-wrap:anywhere]');
    }
  });

  it('F-34: names a version\'s snapshot by a short hash, the whole token in the title, never drawn under it', () => {
    draw();
    const { cells } = table('Team approvals').at('Version');
    expect(cells).toHaveLength(queue().length);
    queue().forEach((r, i) => {
      expect(cells[i].textContent).toBe(`v${r.version}${r.contentRevision.slice(3, 11)}`);
      expect(cells[i].textContent).not.toContain('cr_');
      expect(cells[i].title).toBe(`v${r.version}, ${r.contentRevision}`);
    });
  });

  it('F-17: sets the Waiting now figure in ink, not the accent', () => {
    draw();
    figuresInInk();
  });

  it('F-38: labels the queue\'s Ask and keeps it inside the card, out of a zero-width container', () => {
    const asked: string[] = [];
    draw((q) => asked.push(q));
    const { section } = table('Team approvals');
    const ask = within(section).getByRole('button', { name: /^Ask: / });
    expect(ask.textContent?.trim()).toBe('Ask');
    // A container is as wide as it is given: a `shrink-0` one is given nothing, and its Ask spills past the padding.
    for (let n = ask.parentElement; n && n !== section; n = n.parentElement) expect(classes(n), 'an ancestor of the Ask').not.toContain('@container');
    ask.click();
    expect(asked).toHaveLength(1);
  });
});
