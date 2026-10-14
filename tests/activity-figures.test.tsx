import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures — and the derived words — the activity feed shows are the data's. The sixth page of `standard.md`'s
 * floor, and the second of the table-led kind, after `teams-figures`.
 *
 * `cell()` is the same idea as the teams page's: read the header row for a column's position, then take that cell of the
 * row that carries `needle`. What this page adds is a derived value — the Actor column shows the local part of an
 * address, `jane.doe@example.com` becoming `jane.doe` — and three states that are not figures at all: a null team reads
 * as a dash rather than blank, and a result is "Refused", "OK" or a dash.
 *
 * DELIBERATE: the "When" column is not asserted. It is a relative time ("3 hours ago") and moves with the clock; the
 * page's own `overview-period` test pins a date to its zone instead, which is where that belongs.
 */
import type { ActivityEvent } from '@/lib/api-shapes';
import { ActivityView } from '@/views/pages/activity';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/* Two events that differ in every column worth reading, and the second one is the row a person is looking for: a
 * refusal, on no team's business, by somebody whose address is not the one the first row carries. */
const EVENTS: ActivityEvent[] = [
  { ts: '2026-10-01T02:00:00Z', actor: 'jane.doe@example.com', team: 'atlas', kind: 'tool_call',
    subject: 'core:knowledge_search', initiative: 'atlas/2026-09-01-search', step: 'zz-core', ok: true, refusal: null },
  { ts: '2026-10-02T02:00:00Z', actor: 'sam@example.com', team: null, kind: 'document_approve',
    subject: 'atlas/spec.md', initiative: null, step: null, ok: false, refusal: 'ACCESS_DENIED — not a member' },
];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : { events: EVENTS, limit: 200 };
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The text of the row carrying `needle`, in the column whose header is `header`. */
function cell(needle: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(needle));
  if (column < 0 || !row) return `no ${header} column or no ${needle} row`;
  // The cell's FIRST child, not its text: a `DataTable` draws the desktop value and the words a phone card uses for the
  // same cell, one hidden by the stylesheet, and `textContent` reads both.
  const td = [...row.querySelectorAll('td')][column];
  return (td?.firstElementChild ?? td)?.textContent?.trim() ?? '';
}

beforeEach(() => {
  window.history.replaceState(null, '', '/activity');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ActivityView /></QueryClientProvider>);
}

describe('the figures on the activity feed', () => {
  it('names the actor by the local part of the address the data carries', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document_approve'));
    expect(cell('document_approve', 'Actor')).toBe('sam');
    // The other row, so the column is read per row rather than once for the page.
    expect(cell('core:knowledge_search', 'Actor')).toBe('jane.doe');
  });

  it('shows a result as its own word, and a team nobody acted for as a dash', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document_approve'));
    expect(cell('document_approve', 'Result')).toBe('Refused');
    expect(cell('core:knowledge_search', 'Result')).toBe('OK');
    // A token issued is a thing a person did, not a thing a team did: the gateway reads the team through its foreign
    // key, so a null one is a dash and never a blank the reader has to interpret.
    expect(cell('document_approve', 'Team')).toBe('—');
    expect(cell('core:knowledge_search', 'Team')).toBe('atlas');
  });

  it('keeps the refusal sentence, which is the whole reason the row is coloured', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document_approve'));
    expect(cell('document_approve', 'Refusal')).toContain('ACCESS_DENIED');
    expect(cell('document_approve', 'Kind')).toBe('document_approve');
  });
});
