import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { Button } from '@/components/ui/button';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import { formatDate, formatDay } from '@/lib/format-date';
import { contextText } from '@/lib/shared-context';
import type { ApprovalRow, Approvals, InitiativeList } from '@/lib/work-shapes';
import { APPROVALS_DEFAULTS, approvalsContext, approvalsPath, approvedHref } from '@/views/approvals-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { documentContext } from '@/views/document-context';
import { openedVersion, versionOf } from '@/views/document-version';
import { initiativesContext } from '@/views/initiatives-context';
import { INITIATIVES_DEFAULTS, listPath } from '@/views/initiatives-filter';
import { ApprovalsView } from '@/views/pages/approvals';
import { DocumentView } from '@/views/pages/document';
import { InitiativeClose, InitiativeMeta } from '@/views/pages/initiative';
import { InitiativesView } from '@/views/pages/initiatives';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { approvals, documentAsKept } from '../scripts/fake-gateway/work-approvals.ts';
import { initiativeDetail, initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { INITIATIVES, documentDetail, documentRevision } from '../scripts/fake-gateway/work.ts';

/**
 * Phase 7, I-164: the second re-review's findings on Approvals, Initiatives, an initiative and a document (Work M-1,
 * M-5, M-6, M-7 and M-16), each found gone at its cause on the fake gateway's own answers. Where a finding is a layout
 * this reads the classes that decide it; the screenshots of the build show it.
 */
const SLUG = '2026-09-28-search-relevance';
const REVAMP = '2026-09-12-onboarding-revamp';
const query = (path: string) => new URLSearchParams(path.split('?')[1]);
const classes = (el: Element) => (typeof el.className === 'string' ? el.className.split(/\s+/) : []);
const text = () => document.body.textContent ?? '';
const HISTORY = approvalsPath({ ...APPROVALS_DEFAULTS, tab: 'history' });
const historyOf = (who: Me, path = `${HISTORY.replace(/limit=\d+/, 'limit=100')}`) => approvals(who, query(path))[1] as Approvals;
const rowsOf = (a: Approvals): ApprovalRow[] => (a.history.state === 'ok' ? a.history.data.rows : []);
/** The document as the gateway answers it, through the route the console reads. */
const served = (initiative: string, path: string) => documentAsKept(documentDetail('atlas', initiative, path))!;
const at = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

beforeEach(() => {
  // A page draws what its server read handed it; the one read the browser makes here is an earlier version's text.
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const m = url.pathname.match(/^\/api\/console\/document\/([^/]+)\/([^/]+)\/(.+)$/);
    const revision = url.searchParams.get('revision');
    const body = m && revision ? documentRevision(m[1], m[2], m[3], Number(revision)) : null;
    return body ? Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response) : new Promise(() => {});
  }));
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

describe('M-1 · Approvals and a document tell one story of who approved which version when', () => {
  it('reads every history row off the version its document records, signed by that person, after the versions before it', () => {
    for (const who of [ME, MEMBER]) {
      const rows = rowsOf(historyOf(who));
      expect(rows.length, who.email).toBeGreaterThan(0);
      for (const r of rows) {
        const d = served(r.initiative, r.path);
        const v = d.versions.find((x) => x.version === r.version)!;
        expect(v, `${r.initiative}/${r.path} v${r.version}`).toBeDefined();
        // The version approved, or an approval inside it a later row superseded: either way, in this person's name and at this moment.
        const approval = v.status === 'approved' ? { by: v.approved_by, at: v.updated_at } : { by: v.superseded_approved?.approved_by, at: v.superseded_approved?.approved_at };
        expect(approval.by, `${r.initiative}/${r.path} v${r.version}`).toBe(who.email);
        expect(approval.at!.startsWith(r.approvedAt), `${r.initiative}/${r.path} v${r.version}`).toBe(true);
        for (const earlier of d.versions.filter((x) => x.version < r.version)) expect(Date.parse(earlier.updated_at)).toBeLessThanOrEqual(at(r.approvedAt));
        // The document's own approval is the history's, where the version approved is the current one.
        if (v.status === 'approved' && v.version === d.current_version) {
          expect(d.approved_by).toBe(who.email);
          expect(d.approved_at).toBe(v.updated_at);
        }
      }
    }
  });

  it('holds every approval the documents record, once, in its signer\'s history and nobody else\'s', () => {
    const history = new Map([ME, MEMBER].map((who) => [who.email, rowsOf(historyOf(who))]));
    for (const i of INITIATIVES.filter((x) => x.team === 'atlas')) {
      for (const row of initiativeDetail('atlas', i.slug)!.documents.filter((x) => x.gated)) {
        for (const v of served(i.slug, row.path).versions) {
          const by = v.status === 'approved' ? v.approved_by : v.superseded_approved?.approved_by;
          if (!by) continue;
          const named = (rows: ApprovalRow[] | undefined) => (rows ?? []).filter((r) => r.initiative === i.slug && r.path === row.path && r.version === v.version).length;
          expect(named(history.get(by)), `${i.slug}/${row.path} v${v.version} in ${by}'s history`).toBe(1);
          for (const [email, rows] of history) if (email !== by) expect(named(rows), `${i.slug}/${row.path} v${v.version} in ${email}'s`).toBe(0);
        }
      }
    }
  });

  it('names the reviewer\'s case alike on both pages: spec.md v3, approved by Noah when the document says, in no one else\'s', () => {
    const spec = served(SLUG, 'spec.md');
    expect(spec.approved_by).toBe(MEMBER.email);
    expect(rowsOf(historyOf(ME)).filter((r) => r.initiative === SLUG && r.path === 'spec.md')).toEqual([]);
    const noah = rowsOf(historyOf(MEMBER)).filter((r) => r.initiative === SLUG && r.path === 'spec.md');
    expect(noah.map((r) => [r.version, r.approvedAt])).toEqual([[3, spec.approved_at]]);
    // The document's context says the day the history row says.
    expect(contextText(documentContext(spec, { updatedAt: null, now: spec.updated_at }))).toContain(`approved by ${MEMBER.email} on ${formatDate(noah[0].approvedAt)}`);
    // Every version of it was written before that approval.
    for (const v of spec.versions) expect(Date.parse(v.updated_at)).toBeLessThanOrEqual(Date.parse(spec.approved_at!));
  });

  it('keeps what the history pages and counts: more than ten in the superadmin\'s name, the one sealed before the events on page two', () => {
    const ava = historyOf(ME, HISTORY);
    const all = rowsOf(historyOf(ME));
    expect(all.length).toBeGreaterThan(10);
    expect(rowsOf(ava).some((r) => r.approvedAt.length === 10)).toBe(false);
    expect(all.slice(10).some((r) => r.approvedAt.length === 10)).toBe(true);
    // A member's approvals fall one to a week, so their chart counts whole ones.
    const noah = historyOf(MEMBER);
    expect(Math.max(...noah.weeks.map((w) => w.figure.value ?? 0))).toBe(1);
  });

  it('answers each waiting revision as its document stands, the version and snapshot its Review opens', () => {
    const a = approvals(ME, query(approvalsPath(APPROVALS_DEFAULTS)))[1] as Approvals;
    const waiting = a.waiting.state === 'ok' ? a.waiting.data.rows : [];
    expect(waiting.length).toBeGreaterThan(0);
    for (const w of waiting) {
      const d = served(w.initiative, w.path);
      expect([w.version, w.contentRevision], `${w.initiative}/${w.path}`).toEqual([d.current_version, d.content_revision]);
    }
  });
});

describe('M-5 · The history\'s phone card', () => {
  const draw = () => {
    window.history.replaceState(null, '', HISTORY);
    mount(<ApprovalsView served={{ state: 'ok', path: HISTORY, data: historyOf(ME, HISTORY), team: 'atlas' }} />);
  };

  it('gives the initiative, the time approved and how it was shown a line each, none opened by a separator', () => {
    draw();
    const section = column('Approved in your name', 'Document')[0].closest('section')!;
    for (const header of ['Initiative', 'Approved at', 'Presentation']) {
      const cell = column('Approved in your name', header)[0];
      const n = [...cell.parentElement!.children].indexOf(cell) + 1;
      expect(classes(section), header).toContain(`@max-[640px]:[&_tbody_td:nth-child(${n})]:!basis-full`);
      if (cell.querySelector('[data-sep]')) expect(classes(section), header).toContain(`@max-[640px]:[&_tbody_td:nth-child(${n})_[data-sep]]:!hidden`);
    }
    // The time says what it is, rather than standing alone at the start of a line.
    expect(column('Approved in your name', 'Approved at')[0].textContent).toMatch(/Approved \d{2} \w+ \d{4}, \d{2}:\d{2}/);
  });

  it('keeps the version and the decision basis on the card, where their columns give way', () => {
    draw();
    const rows = rowsOf(historyOf(ME, HISTORY));
    column('Approved in your name', 'Document').forEach((cell, i) => {
      const phone = [...cell.querySelectorAll('.hidden')].map((x) => x.textContent ?? '');
      expect(phone.some((t) => t.includes(`v${rows[i].version}`)), rows[i].path).toBe(true);
    });
    const basis = column('Approved in your name', 'Presentation')[0].querySelector('.hidden')!;
    expect(classes(basis)).toContain('@max-[640px]:inline');
    expect(basis.textContent).toMatch(/· (Explicit, recorded|Standing delegation, recorded|Basis unknown)/);
  });
});

describe('M-6 · A history row opens the version it names, and the assistant is told every row', () => {
  it('links each row to its document at that version, with the arrow that says the row opens it', () => {
    window.history.replaceState(null, '', HISTORY);
    const history = historyOf(ME, HISTORY);
    mount(<ApprovalsView served={{ state: 'ok', path: HISTORY, data: history, team: 'atlas' }} />);
    const rows = rowsOf(history);
    column('Approved in your name', 'Document').forEach((cell, i) => {
      const link = cell.querySelector('a')!;
      expect(link.getAttribute('href')).toBe(`/initiatives/atlas/${rows[i].initiative}/${rows[i].path}?version=${rows[i].version}`);
      expect(link.querySelector('[data-goes]'), rows[i].path).not.toBeNull();
    });
    expect(approvedHref('atlas', rows[0])).toBe(`/initiatives/atlas/${rows[0].initiative}/${rows[0].path}?version=${rows[0].version}`);
  });

  it('lists every row of the history page in its context, inside the budget, and says where a row leads', () => {
    for (const who of [ME, MEMBER]) {
      const a = historyOf(who, HISTORY);
      const said = contextText(approvalsContext(a, { tab: 'history', page: 1, updatedAt: a.meta.asOf, now: a.meta.asOf }));
      expect(said.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
      const rows = rowsOf(a);
      expect(said, who.email).toContain(`Rows 1 to ${rows.length} of`);
      for (const r of rows) {
        expect(said, `${r.initiative}/${r.path}`).toContain(`${r.initiative}: `);
        expect(said, `${r.initiative}/${r.path}`).toContain(`${r.path} v${r.version}, ${formatDay(r.approvedAt)}, `);
      }
      expect(said).not.toMatch(/and \d+ more \(on \/approvals/);
      expect(said).toContain('each opening its document at that version (?version=<n>)');
    }
  });

  it('reads the version an address names: the approved snapshot, and whether a later text replaced it', () => {
    expect([versionOf('2'), versionOf(['3', '1']), versionOf('0'), versionOf('x'), versionOf(undefined)]).toEqual([2, 3, null, null, null]);
    const review = served(REVAMP, 'review.md');
    expect(review.current_version).toBe(2);
    expect(openedVersion(review, 1)).toMatchObject({ version: 1, revision: 1, approvedBy: ME.email, earlier: true });
    expect(openedVersion(review, 2)).toMatchObject({ version: 2, earlier: false });
    expect(openedVersion(review, 9)).toBeNull();
    expect(openedVersion(served(SLUG, 'spec.md'), 3)).toMatchObject({ version: 3, revision: 4, approvedBy: MEMBER.email, earlier: false });
  });

  it('draws an earlier version\'s own text on the document\'s page, with the way to the current one and no Approve', async () => {
    const d = served(REVAMP, 'review.md');
    mount(<DocumentView team="atlas" slug={REVAMP} rel="review.md" served={{ state: 'ok', data: d, at: d.updated_at }} teamPage={false} version={1} />);
    expect(screen.getByRole('heading', { name: 'Document at v1' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Read v2, the current text/ })).toHaveAttribute('href', `/initiatives/atlas/${REVAMP}/review.md`);
    expect(text()).toContain(`v1, approved by ${ME.email}`);
    // The body is v1's own text, read by its snapshot, not the current one's.
    const v1 = documentRevision('atlas', REVAMP, 'review.md', 1)!.body!;
    expect(v1).toContain('Settled after one round of review.');
    const card = screen.getByRole('heading', { name: 'Document at v1' }).closest('.card') as HTMLElement;
    await waitFor(() => expect(card.textContent).toContain('Settled after one round of review.'));
    expect(card.textContent).not.toContain('after two rounds of review');
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
  });

  it('draws the current text alone where the version named is the current one', () => {
    const d: DocumentDetail = served(SLUG, 'spec.md');
    mount(<DocumentView team="atlas" slug={SLUG} rel="spec.md" served={{ state: 'ok', data: d, at: d.updated_at }} teamPage={false} version={3} />);
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /the current text/ })).toBeNull();
  });
});

describe('M-7 · An initiative\'s next step is its filled button', () => {
  const read = (slug: string) => ({ state: 'ok' as const, data: initiativeDetail('atlas', slug)!, team: 'atlas', at: '2026-10-19T09:00:00Z' });
  /** The classes the button system gives a variant, read off a rendered button. */
  const variantOf = (variant: 'primary' | 'secondary') => {
    const { container, unmount } = render(<Button variant={variant}>x</Button>);
    const out = classes(container.querySelector('button')!);
    unmount();
    return out;
  };

  it('fills Review while a document waits on the person, and steps Close down beside it', () => {
    const [primary, secondary] = [variantOf('primary'), variantOf('secondary')];
    const only = (mine: string[], other: string[]) => mine.filter((c) => !other.includes(c));
    mount(<><InitiativeMeta team="atlas" slug={SLUG} served={read(SLUG)} /><InitiativeClose team="atlas" slug={SLUG} served={read(SLUG)} /></>);
    const review = classes(screen.getByRole('link', { name: 'Review plan.md' }));
    const close = classes(screen.getByRole('button', { name: 'Close initiative' }));
    for (const c of only(primary, secondary)) expect(review, 'Review is filled').toContain(c);
    for (const c of only(secondary, primary)) expect(close, 'Close is secondary').toContain(c);
  });

  it('fills Close when nothing waits on a person', () => {
    const ready = '2026-10-08-result-explanations';
    const primary = variantOf('primary');
    mount(<><InitiativeMeta team="atlas" slug={ready} served={read(ready)} /><InitiativeClose team="atlas" slug={ready} served={read(ready)} /></>);
    expect(screen.queryByRole('link', { name: /^Review/ })).toBeNull();
    for (const c of primary) expect(classes(screen.getByRole('button', { name: 'Close initiative' }))).toContain(c);
  });
});

describe('M-16 · Every Initiatives tile carries its line', () => {
  const PATH = listPath(INITIATIVES_DEFAULTS);
  const LIST = initiativeList(ME, query(PATH))[1] as InitiativeList;

  it('says what Open and Waiting are each a share of, on the page and to the assistant, the closures still in its budget', () => {
    const { open, waiting, closed } = LIST.tiles;
    const all = open + closed.accepted + closed.delivered + closed.abandoned;
    mount(<InitiativesView served={{ state: 'ok', path: PATH, data: LIST, team: 'atlas' }} />);
    expect(text()).toContain(`of ${all} in the team`);
    expect(text()).toContain(`of the ${open} open`);
    const said = contextText(initiativesContext(LIST, { filters: { q: '', state: 'all', flow: 'all' }, page: 1, updatedAt: LIST.meta.asOf, now: LIST.meta.asOf }));
    expect(said).toContain(`Initiatives: ${all}.`);
    expect(said).toContain(`Open: ${open}.`);
    expect(said).toContain(`Waiting: ${waiting}.`);
    expect(said).toContain('Closures by week and outcome');
  });
});
