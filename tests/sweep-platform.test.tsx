import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Review round 1's Platform findings (Task I-171), each found at the layer the console holds it:
 *
 * - R1-C14: a member's bug report is titled exactly as the spec freezes it, `Report concerning <canonical surface>` or
 *   `Platform issue reported`, with its impact, state and dates as their own fields, on the Bugs page and in its context.
 * - R1-C15: Audit names a deleted report by what the record holds of it, the day it was filed, and nothing typed.
 * - R1-C16: the superadmin's Status and Usage answers are labelled `platform-admin`, a member's `platform-public`.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import type { AuditRow } from '@/lib/fleet-shapes';
import type { Bugs, PublicBugRow } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { actSentence } from '@/views/platform-audit-context';
import { BUGS_DEFAULTS, bugsContext, bugsPath, impactOf } from '@/views/platform-bugs-context';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import { REPORTS, bugs, statusFor } from '../scripts/fake-gateway/platform-bugs.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';

const NO_FILTER = { state: null, impact: null, surface: null };
const PUBLIC: Bugs = bugs(false, NO_FILTER, 10, 0);
const rows = (b: Bugs): PublicBugRow[] => (b.queue.state === 'ok' ? b.queue.data.rows : []);
/** The spec's public title for a canonical surface, written here rather than read from the code under test. */
const spec = (surface: string | null) => (surface === null ? 'Platform issue reported' : `Report concerning ${surface}`);
/** Words that belong to a row's own fields and never to its public title. */
const FIELD_WORDS = /blocks work|wrong result|confusing|cosmetic|\bfiled\b|\bopen\b|fixed|not a bug|duplicate|\d/i;

beforeEach(() => {
  window.history.replaceState(null, '', '/platform/bugs');
  // Nothing the browser asks for is answered: the page draws the read its server made.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('R1-C14: a member reads each bug report by the spec\'s title', () => {
  it('every row of every page the fake answers a member is titled by one of the two forms, and says no impact, state or date', () => {
    const all = rows(bugs(false, NO_FILTER, 100, 0));
    expect(all.length).toBe(REPORTS.length);
    for (const r of all) {
      expect(r.title).toBe(spec(r.surface));
      expect(r.title.replace(/^Report concerning /, '')).not.toMatch(FIELD_WORDS);
      expect([r.impact, r.status, r.filedAt].every((v) => typeof v === 'string' && v.length > 0)).toBe(true);
    }
    expect(all.some((r) => r.title === 'Platform issue reported')).toBe(true);
    expect(all.some((r) => r.title.startsWith('Report concerning '))).toBe(true);
  });

  it('the Bugs page draws each title as it is, beside the impact, filed date and status in their own columns', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SurfaceOverride surface={{}}><Tooltip.Provider>
          <PlatformBugsView served={{ state: 'ok', path: bugsPath(BUGS_DEFAULTS), data: PUBLIC }} />
        </Tooltip.Provider></SurfaceOverride>
      </QueryClientProvider>,
    );
    const table = screen.getByRole('table', { name: 'Bug reports, newest filed first' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Report', 'Impact', 'Filed', 'Status']));
    const body = within(table).getAllByRole('row').slice(1);
    expect(body).toHaveLength(rows(PUBLIC).length);
    rows(PUBLIC).forEach((r, i) => {
      const cells = within(body[i]).getAllByRole('cell');
      // The Report cell holds the title and nothing else, drawn once for a wide screen and once for a phone.
      expect(cells[0].textContent).toContain(r.title);
      expect(cells[0].textContent!.replaceAll(r.title, '')).toBe('');
      expect(body[i].textContent).toContain(impactOf(r.impact));
    });
    expect(table.textContent).not.toMatch(/Blocks work:|no surface named, filed/);
    for (const r of REPORTS) expect(document.body.textContent).not.toContain(r.title);
  });

  it('its context gives each row the spec\'s title, then the impact, the filing and the state as facts of their own', () => {
    const text = contextText(bugsContext(PUBLIC, { filters: BUGS_DEFAULTS }));
    for (const r of rows(PUBLIC).slice(0, 4)) {
      expect(text).toContain(`${spec(r.surface)}: ${impactOf(r.impact).toLowerCase()}, filed `);
    }
    expect(text).toContain('by its public title, which names only the surface it concerns');
    expect(text).not.toMatch(/built from its impact|no surface named, filed/);
    for (const r of REPORTS) expect(text).not.toContain(r.title);
  });
});

describe('R1-C15: Audit names a deleted report by the day it was filed', () => {
  it('the act reads `deleted a report filed <day>`, with no impact, surface or title', () => {
    const [status, body] = audit(new URLSearchParams('kind=bug.delete'), { limit: 10, offset: 0 })!;
    expect(status).toBe(200);
    const deleted = (body as { rows: AuditRow[] }).rows.filter((r) => r.kind === 'bug.delete');
    expect(deleted.length).toBeGreaterThan(0);
    for (const r of deleted) {
      expect(r.sentence).toMatch(/ deleted a report filed \d{2} \w+ \d{4}$/);
      expect(actSentence(r)).toContain('deleted a report filed ');
      expect(r.sentence).not.toMatch(/Blocks work|Wrong result|Confusing|Cosmetic|surface|"|payroll/i);
    }
  });
});

describe('R1-C16: Status and Usage label the superadmin\'s answer platform-admin', () => {
  it('the superadmin\'s Status and Usage are platform-admin, a member\'s platform-public', () => {
    expect(statusFor(true, 'atlas').meta.scope).toBe('platform-admin');
    expect(statusFor(false, 'beacon').meta.scope).toBe('platform-public');
    expect(usage(true).meta.scope).toBe('platform-admin');
    expect(usage(false).meta.scope).toBe('platform-public');
  });
});
