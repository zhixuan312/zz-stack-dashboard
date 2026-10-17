import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures — and the derived words — the activity page shows are the data's. The sixth page of `standard.md`'s
 * floor, and the second of the table-led kind, after `teams-figures`.
 *
 * `cell()` is the same idea as the teams page's: read the header row for a column's position, then take that cell of the
 * row that carries `needle`. What this page adds is a derived value — the Actor column shows the local part of an
 * address, `jane.doe@example.com` becoming `jane.doe` — a refusal's owner in the words a person reads it in, and a
 * refusal recorded with no message said to have none rather than left blank. Above the log, last week's tiles are the
 * summary's own figures.
 *
 * DELIBERATE: the "When" column is not asserted. It is a relative time ("3 hours ago") and moves with the clock; the
 * page's own `overview-period` test pins a date to its zone instead, which is where that belongs.
 */
import type { ActivityLog, ActivitySummary } from '@/lib/destination-shapes';
import { ActivityView } from '@/views/pages/activity';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };
const META = { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' }, scope: 'active-team' as const, population: 'atlas', coverageFrom: null };

const SUMMARY: ActivitySummary = {
  meta: META,
  tiles: {
    calls: { window: WINDOW, figure: { value: 38, why: null }, numerator: 38, denominator: null },
    refused: { window: WINDOW, figure: { value: 9, why: null }, numerator: 9, denominator: 38, owners: { guardrail: 4, ours: 2, theirs: 2, other: 1 } },
    mostRefused: { tool: 'core:document_edit', count: 4, of: 9 },
  },
  weeks: { state: 'ok', data: [{ window: WINDOW, complete: true, calls: 38, refused: 9, owners: { guardrail: 4, ours: 2, theirs: 2, other: 1 } }] },
  groups: { state: 'ok', data: { rows: [], groups: 0, rest: null } },
  maintenance: { calls: 0, refused: 0 },
};

/* Three events that differ in every column worth reading: a call that answered, a refusal a guardrail held with its
 * message, and a refusal recorded with no message at all. */
const LOG: ActivityLog = {
  meta: META, total: 3, ceiling: 500, kinds: ['document.patch', 'tool_call'], tools: ['core:document_approve', 'core:knowledge_search'],
  rows: [
    { id: 'e1', ts: '2026-10-01T02:00:00Z', kind: 'document.patch', tool: null, initiative: '2026-09-01-search', step: 'sdlc-plan', ok: null, owner: null, message: null, actor: 'jane.doe@example.com' },
    { id: 'e2', ts: '2026-10-02T02:00:00Z', kind: 'tool_call', tool: 'core:document_approve', initiative: null, step: null, ok: false, owner: 'guardrail', message: 'ERROR: approval needs a stakeholder', actor: 'sam@example.com' },
    { id: 'e3', ts: '2026-10-03T02:00:00Z', kind: 'tool_call', tool: 'core:knowledge_search', initiative: null, step: null, ok: false, owner: 'other', message: null, actor: null },
  ],
};

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/me') ? ME : url.includes('/activity/summary') ? SUMMARY : LOG;
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The text of the row carrying `needle`, in the column whose header is `header`. */
function cell(needle: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(needle));
  if (column < 0 || !row) return `no ${header} column or no ${needle} row`;
  // The cell's first child after its separator, not its text: a `DataTable` draws the desktop value and the words a
  // phone card uses for the same cell, one hidden by the stylesheet, and `textContent` reads both; and a fact after the
  // first leads with the dot that separates it on a phone (`data-sep`), inside the fact's own cell.
  const td = [...row.querySelectorAll('td')][column];
  const value = td ? [...td.children].find((e) => !e.hasAttribute('data-sep')) : undefined;
  return (value ?? td)?.textContent?.trim() ?? '';
}

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}

beforeEach(() => {
  window.history.replaceState(null, '', '/activity');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ActivityView /></QueryClientProvider>);
}

describe('the figures on the activity page', () => {
  it('draws last week\'s tiles from the summary, the refusals with their four owners', async () => {
    mount();
    await waitFor(() => expect(figure('Calls last week')).toBe('38'));
    expect(figure('Refused last week')).toBe('9');
    expect(figure('Most refused')).toBe('4');
    expect(document.body.textContent).toContain('4 guardrail, 2 malformed, 2 tool, 1 other');
    expect(document.body.textContent).toContain('core:document_edit, of 9');
  });

  it('names the actor by the local part of the address the data carries', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document.patch'));
    expect(cell('core:document_approve', 'Actor')).toBe('sam');
    // The other row, so the column is read per row rather than once for the page.
    expect(cell('document.patch', 'Actor')).toBe('jane.doe');
  });

  it('shows a result as its own word, and a refusal\'s owner in a person\'s words', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document.patch'));
    expect(cell('core:document_approve', 'Result')).toBe('Refused');
    expect(cell('core:document_approve', 'Why')).toBe('A guardrail held');
    expect(cell('core:knowledge_search', 'Why')).toBe('Other');
    // An event that is not a call has no result to give, and names no tool.
    expect(cell('document.patch', 'Result')).toBe('—');
    expect(cell('document.patch', 'Tool')).toBe('—');
  });

  it('keeps the refusal\'s message, and says when none was recorded', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('document.patch'));
    expect(cell('core:document_approve', 'Message')).toContain('approval needs a stakeholder');
    expect(cell('core:knowledge_search', 'Message')).toBe('No message recorded');
  });
});
