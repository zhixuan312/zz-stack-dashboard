import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { app, workspaces } from '@/app.config';
import type { DocumentDetail } from '@/lib/api-shapes';
import type { Approvals, InitiativeList } from '@/lib/work-shapes';
import { APPROVALS_DEFAULTS, approvalsPath } from '@/views/approvals-context';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { documentContext } from '@/views/document-context';
import { nextOf } from '@/views/initiatives-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { initiativeName, sourceName } from '@/views/initiative-name';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { InitiativeLead, InitiativeMeta, InitiativeTitle, InitiativeView } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { initiativeDetail, initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';

/**
 * Phase 7, I-159: the re-review's findings on Initiatives, an initiative, a document and Approvals (Work F-42 to F-45
 * and N-7), each found gone at its cause, on the fake gateway's own answers. Where a finding is an arrangement (which
 * card leads, what a cell is set as) this reads the markup that decides it; the screenshots of the build show it.
 */
const AT = '2026-10-19T09:00:00Z';
const SLUG = '2026-09-28-search-relevance';
const query = (path: string) => new URLSearchParams(path.split('?')[1]);
const classes = (el: Element) => (typeof el.className === 'string' ? el.className.split(/\s+/) : []);
const text = () => document.body.textContent ?? '';
/** Whether `a` comes before `b` in the page's order. */
const before = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
  // Every page here draws what its server read handed it; a read the browser would make is never answered.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}

/** The table captioned `caption`, and the cells of its column headed `header`. */
function column(caption: string, header: string) {
  const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption')?.textContent === caption);
  if (!t) throw new Error(`no table captioned "${caption}"`);
  const i = [...t.querySelectorAll('thead th')].findIndex((th) => th.textContent?.trim() === header);
  if (i < 0) throw new Error(`no column "${header}" in "${caption}"`);
  return [...t.querySelectorAll('tbody tr')].map((tr) => tr.children[i] as HTMLElement);
}

const served = (slug: string) => ({ state: 'ok' as const, data: initiativeDetail('atlas', slug)!, team: 'atlas', at: AT });

describe('F-42 · Initiatives', () => {
  const PATH = listPath(INITIATIVES_DEFAULTS);
  const LIST = initiativeList(ME, query(PATH))[1] as InitiativeList;
  const draw = () => mount(<InitiativesView served={{ state: 'ok', path: PATH, data: LIST, team: 'atlas' }} />);

  it('leads with the table, the protagonist, straight under the tiles, and the closures follow it', () => {
    const { container } = draw();
    const table = container.querySelector('section[aria-label="Initiatives"]')!;
    const chart = screen.getByRole('heading', { name: /^Closures by/ });
    expect(table).not.toBeNull();
    expect(before(table, chart), 'the table before the chart').toBe(true);
  });

  it('ends each initiative\'s name, the link that opens its record, with the arrow that says so', () => {
    draw();
    const cells = column('Initiatives', 'Initiative');
    expect(cells.length).toBeGreaterThan(0);
    LIST.rows.slice(0, cells.length).forEach((r, i) => {
      const link = cells[i].querySelector('a')!;
      expect(link.getAttribute('href')).toBe(`/initiatives/atlas/${r.slug}`);
      expect(link.querySelector('[title] [data-goes]'), r.slug).not.toBeNull();
    });
  });

  it('says a closed initiative waits on a person for its correction, not for an approval of closed work', () => {
    const revamp = LIST.rows.find((r) => r.slug === '2026-09-12-onboarding-revamp')!;
    expect(revamp.state).toBe('accepted');
    expect(revamp.nextMove?.action).toBe('await_approval');
    expect(nextOf(revamp)).toBe('Approve the correction to review.md, waiting on a person');
    draw();
    const at = LIST.rows.indexOf(revamp);
    expect(column('Initiatives', 'Flow position')[at].textContent).toBe('Approve the correction to review.md, waiting on a person');
    // An open one waiting on its gate reads as before.
    expect(nextOf(LIST.rows.find((r) => r.slug === SLUG)!)).toBe('Approve plan.md, waiting on a person');
  });
});

describe('F-43 · An initiative', () => {
  it('is titled by the work\'s name, as its documents name it, with the slug beside it', () => {
    expect(initiativeName(served(SLUG).data.documents)).toBe('Relevance that explains itself');
    mount(<><h1><InitiativeTitle team="atlas" slug={SLUG} served={served(SLUG)} /></h1><p><InitiativeLead team="atlas" slug={SLUG} served={served(SLUG)} /></p></>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Relevance that explains itself');
    const lead = document.querySelector('p')!;
    expect(within(lead).getByText(SLUG).className).toContain('font-mono');
  });

  it('keeps the slug as its title where no document names the work, and says it once', () => {
    const plain = '2026-10-06-snippet-quality';
    expect(initiativeName(served(plain).data.documents)).toBeNull();
    mount(<><h1><InitiativeTitle team="atlas" slug={plain} served={served(plain)} /></h1><p><InitiativeLead team="atlas" slug={plain} served={served(plain)} /></p></>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(plain);
    expect(document.querySelector('p')!.textContent).not.toContain(plain);
    expect(initiativeName([{ path: 'notes.md', title: 'Reading list' }, { path: 'sources/a.md', title: 'Paper: one' }])).toBeNull();
  });

  it('offers Review beside "Waiting", opening the document the person is waited on for', () => {
    mount(<InitiativeMeta team="atlas" slug={SLUG} served={served(SLUG)} />);
    expect(screen.getByText('Waiting').closest('[title]')).toHaveAttribute('title', 'Waiting on: approve plan');
    expect(screen.getByRole('link', { name: 'Review plan.md' })).toHaveAttribute('href', `/initiatives/atlas/${SLUG}/plan.md`);
  });

  it('offers a closed initiative\'s correction for review, and nothing where nobody is waited on', () => {
    const { unmount } = mount(<InitiativeMeta team="atlas" slug="2026-09-12-onboarding-revamp" served={served('2026-09-12-onboarding-revamp')} />);
    expect(screen.getByRole('link', { name: 'Review review.md' })).toHaveAttribute('href', '/initiatives/atlas/2026-09-12-onboarding-revamp/review.md');
    unmount();
    mount(<InitiativeMeta team="atlas" slug="2026-10-08-result-explanations" served={served('2026-10-08-result-explanations')} />);
    expect(screen.queryByRole('link', { name: /^Review/ })).toBeNull();
  });
});

describe('N-7 · A source titled by its web address', () => {
  it('reads as the page\'s own name, with its host as a note, never as the slugged address', () => {
    mount(<InitiativeView team="atlas" slug={SLUG} served={served(SLUG)} />);
    const cells = column('Sources', 'Source');
    const cell = cells.find((td) => td.textContent?.includes('docs.example.com'))!;
    expect(cell, 'the source filed under a web address').toBeDefined();
    expect(cell.querySelector('.font-medium')!.textContent).toBe('Ranking signals and their weights explained');
    expect(cell.querySelector('.t-caption')!.textContent).toBe('docs.example.com');
    expect(text()).not.toContain('https-docs-example-com');
    // A source with a title of its own reads as filed, with no note.
    const r2 = cells.find((td) => td.querySelector('.font-medium')?.textContent === 'R2 query log sample')!;
    expect(r2).toBeDefined();
    expect(r2.querySelector('.t-caption')).toBeNull();
  });

  it('names a source by its file only where it has no title, and a title that is not an address as it is', () => {
    expect(sourceName('https://www.example.org/guides/rank_fusion.html', 'sources/x.md')).toEqual({ name: 'Rank fusion', host: 'example.org' });
    expect(sourceName('https://docs.example.com/', 'sources/x.md')).toEqual({ name: 'docs.example.com', host: 'docs.example.com' });
    expect(sourceName('Spec audit round 1: four medium findings', 'sources/x.md')).toEqual({ name: 'Spec audit round 1: four medium findings', host: null });
    expect(sourceName(null, 'sources/R1-user-interviews.md')).toEqual({ name: 'R1-user-interviews.md', host: null });
  });
});

describe('F-44 · A document', () => {
  async function draw(rel: string) {
    const data = documentDetail('atlas', SLUG, rel) as DocumentDetail;
    await act(async () => { mount(<DocumentView team="atlas" slug={SLUG} rel={rel} served={{ state: 'ok', data, at: AT }} teamPage={false} />); });
    return data;
  }

  it('opens its breadcrumb at the workspace, as every other page\'s kicker does', async () => {
    await draw('spec.md');
    const crumbs = screen.getByRole('link', { name: 'Initiatives' }).parentElement!;
    expect(crumbs.textContent?.startsWith(`${app.name} · ${workspaces.main.label}/Initiatives/atlas/${SLUG}`)).toBe(true);
  });

  it('says when the document last changed in a word of its own, apart from the page\'s Updated stamp', async () => {
    await draw('spec.md');
    const colophon = screen.getByRole('heading', { name: 'This document' }).closest('section, .card')!;
    expect(within(colophon as HTMLElement).getByText('Last changed')).toBeTruthy();
    expect(within(colophon as HTMLElement).queryByText('Updated')).toBeNull();
  });

  it('counts the claims as claims, and a plan\'s rows as tasks', async () => {
    const spec = await draw('spec.md');
    expect(text()).toContain(`${spec.decisionCounts.rows} claims`);
    expect(text()).not.toMatch(/\d rows\b/);
  });

  it('titles a source filed under a web address by the page\'s name', async () => {
    await draw('sources/https-docs-example-com-search-ranking-signals-and-their-weights-explained.md');
    expect(screen.getAllByText('Ranking signals and their weights explained').length).toBeGreaterThan(0);
  });
});

describe('A document\'s shared context', () => {
  const arrival = { updatedAt: '2026-10-19T09:00:00Z', now: '2026-10-19T09:01:00Z' };
  const unknownsOf = (said: string) => said.split('Unknown:\n')[1] ?? '';

  it('always says what the page draws that it does not carry, inside its budget', () => {
    for (const rel of ['spec.md', 'plan.md']) {
      const d = documentDetail('atlas', SLUG, rel) as DocumentDetail;
      const said = contextText(documentContext(d, arrival));
      expect(said.length, rel).toBeLessThanOrEqual(CONTEXT_BUDGET);
      const unknown = unknownsOf(said);
      expect(unknown, rel).toMatch(d.versions.length > 1
        ? /Earlier versions' text, and what changed between two, are read one version at a time on the page/
        : /This carries the current text alone; the page reads any other version by its number/);
      if ((d.body ?? '').trim().replace(/\s+/g, ' ').length > 1200) expect(unknown, rel).toContain('Only the first 1,200 characters of the text are here');
      if (d.decisionCounts.rows) expect(unknown, rel).toContain('The claims\' own words are in the page\'s claims table');
      if (d.sources.length) expect(unknown, rel).toContain('A source\'s own text is on its page');
    }
    const spec = documentDetail('atlas', SLUG, 'spec.md') as DocumentDetail;
    expect(spec.versions.length).toBeGreaterThan(1);
    expect(unknownsOf(contextText(documentContext(spec, arrival)))).toContain('Its tags and its flow\'s fields are on the page');
  });

  it('says a document with no body has none, and nothing about text it does not have', () => {
    const spec = documentDetail('atlas', SLUG, 'spec.md') as DocumentDetail;
    const unknown = unknownsOf(contextText(documentContext({ ...spec, body: null }, arrival)));
    expect(unknown).toContain('This document has no body in the store.');
    expect(unknown).not.toMatch(/characters of the text|Earlier versions/);
  });
});

describe('F-45 · Approvals', () => {
  const WAITING = approvalsPath(APPROVALS_DEFAULTS);
  const answer = approvals(ME, query(WAITING))[1] as Approvals;
  const draw = () => mount(<ApprovalsView served={{ state: 'ok', path: WAITING, data: answer, team: 'atlas' }} />);

  it('leads with the queue, the protagonist, straight under the tiles, and the weeks follow it', () => {
    const { container } = draw();
    const queue = container.querySelector('section[aria-label="Team approvals"]')!;
    const chart = screen.getByRole('heading', { name: 'Approvals in your name by week' });
    expect(queue).not.toBeNull();
    expect(before(queue, chart), 'the queue before the chart').toBe(true);
  });

  it('says what the no-presentation count is taken over, so it adds up to the approvals in your name beside it', () => {
    draw();
    const { inYourName, noPresentation } = answer.tiles;
    const unknown = inYourName! - noPresentation!.of;
    expect(unknown).toBeGreaterThan(0);
    const tile = screen.getByText('No presentation recorded').closest('.card')!;
    expect(tile.textContent).toContain(`of ${noPresentation!.of} known, ${unknown} unknown`);
  });

  it('draws History with each class the gateway gave an approval on one line, beside the initiative taking the rest', () => {
    const HISTORY = approvalsPath({ ...APPROVALS_DEFAULTS, tab: 'history' });
    window.history.replaceState(null, '', HISTORY);
    const history = approvals(ME, query(HISTORY))[1] as Approvals;
    mount(<ApprovalsView served={{ state: 'ok', path: HISTORY, data: history, team: 'atlas' }} />);
    for (const header of ['Presentation', 'Decision basis']) {
      const cells = column('Approved in your name', header);
      expect(cells.length).toBeGreaterThan(0);
      // The class's own span, after the phone card's separator dot where the cell carries one.
      for (const td of cells) expect(classes([...td.children].find((c) => !c.hasAttribute('data-sep'))!)).toContain('whitespace-nowrap');
    }
    // On a phone's card the presentation takes a line of its own, and its dot does not lead it.
    const presentation = column('Approved in your name', 'Presentation')[0];
    const n = [...presentation.parentElement!.children].indexOf(presentation) + 1;
    expect(presentation.querySelector('[data-sep]')).not.toBeNull();
    const section = presentation.closest('section')!;
    expect(classes(section)).toContain(`@max-[640px]:[&_tbody_td:nth-child(${n})]:!basis-full`);
    expect(classes(section)).toContain(`@max-[640px]:[&_tbody_td:nth-child(${n})_[data-sep]]:!hidden`);
  });

  it('counts a member\'s approvals by week in whole numbers, never a half', () => {
    const member = approvals(MEMBER, query(WAITING))[1] as Approvals;
    expect(Math.max(...member.weeks.map((w) => w.figure.value ?? 0))).toBe(1);
    mount(<ApprovalsView served={{ state: 'ok', path: WAITING, data: member, team: 'atlas' }} />);
    const chart = screen.getByRole('heading', { name: 'Approvals in your name by week' }).closest('section, .card')!;
    expect(chart.textContent).not.toMatch(/0\.5/);
  });
});
