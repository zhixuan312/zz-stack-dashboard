import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivitySummary } from '@/lib/destination-shapes';
import { contextText } from '@/lib/shared-context';
import { activityContext, type ActivityRead } from '@/views/activity-context';
import { ActivityView } from '@/views/pages/activity';
import { ME } from '../scripts/fake-gateway/people.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';

/**
 * Review round 1's R1-C4 and R1-C13: Activity never states a failed read as none (FR-13). The gateway reads the tiles'
 * calls and refused, the refused's four owners and the maintenance with the weekly refusals, and the tool refused most
 * on its own, from last week's refusals by tool; each answers unavailable when its read failed. The page and the context
 * the assistant is handed say so, and never `None`, `nothing refused` or a zero for a figure nobody read, while the
 * figures whose read stood are still drawn beside it. The summaries are the fake gateway's answer for atlas, with the
 * parts a failed read leaves unavailable, as `checks/console-work-activity.ts` finds the gateway answering them.
 */
const SUMMARY = activitySummary(ME)[1] as ActivitySummary;
const UNREAD = { state: 'unavailable', reason: 'query_failed' } as const;
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };

/** Last week's refusals by tool failing: the tool refused most unavailable, everything else read. */
const BY_TOOL_FAILED: ActivitySummary = { ...SUMMARY, tiles: { ...SUMMARY.tiles, mostRefused: UNREAD } };
/** The weekly refusals failing: the calls, the refused, its owners, the weeks and the maintenance unavailable, the tool
 *  refused most still read. */
const unread = { value: null, why: 'unavailable' } as const;
const WEEKLY_FAILED: ActivitySummary = {
  ...SUMMARY,
  tiles: {
    calls: { ...SUMMARY.tiles.calls, figure: unread, numerator: null },
    refused: { ...SUMMARY.tiles.refused, figure: unread, numerator: null, denominator: null, owners: UNREAD },
    mostRefused: SUMMARY.tiles.mostRefused,
  },
  weeks: UNREAD,
  maintenance: UNREAD,
};

beforeEach(() => {
  window.history.replaceState(null, '', '/activity');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const body = url.pathname.endsWith('/me') ? ME : activityLog(ME, url.searchParams)[1];
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

function draw(summary: ActivitySummary): void {
  const read: ActivityRead = { state: 'ok', data: summary, at: arrival.updatedAt };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tooltip.Provider><ActivityView read={read} /></Tooltip.Provider></QueryClientProvider>);
}

const tile = (label: string) => screen.getByRole('heading', { name: label, level: 2 }).closest('.card') as HTMLElement;
const figureOf = (label: string) => tile(label).querySelector('[data-value]')!.textContent;
const said = (summary: ActivitySummary) => contextText(activityContext({ summary, ...arrival }));

describe('Activity when last week\'s refusals by tool could not be read', () => {
  it('draws Most refused unavailable, not None, beside the refused count that was read', () => {
    draw(BY_TOOL_FAILED);
    expect(figureOf('Most refused')).toBe('Unavailable');
    expect(tile('Most refused')).not.toHaveTextContent(/None|Nothing refused/);
    expect(figureOf('Refused last week')).toBe(String(SUMMARY.tiles.refused.figure.value));
  });

  it('tells the assistant the tool refused most is unavailable, never that nothing was refused', () => {
    const text = said(BY_TOOL_FAILED);
    expect(text).toContain('- Most refused: unavailable.');
    expect(text).toContain('the tool refused most is unavailable; it is not that nothing was refused');
    expect(text).not.toMatch(/nothing refused/);
  });
});

describe('Activity when the weekly refusals could not be read', () => {
  it('draws the refused unavailable with no owners, and Most refused as it was read', () => {
    draw(WEEKLY_FAILED);
    expect(figureOf('Refused last week')).toBe('Unavailable');
    expect(tile('Refused last week')).not.toHaveTextContent(/guardrail|malformed/);
    const most = SUMMARY.tiles.mostRefused.state === 'ok' ? SUMMARY.tiles.mostRefused.data : null;
    expect(figureOf('Most refused')).toBe(String(most!.count));
  });

  it('tells the assistant the maintenance counts are unavailable, never zero', () => {
    const text = said(WEEKLY_FAILED);
    expect(text).toContain('The platform\'s own maintenance calls and refusals are unavailable');
    expect(text).not.toMatch(/maintenance made 0|0 refused|0 guardrail/);
    expect(text).toContain('- Refused last week: unavailable.');
    // The tiles were read with the weeks, so nothing says they stand.
    expect(text).toContain('The refusals by week could not be read.');
    expect(text).not.toContain('the tiles stand');
  });

  it('says the maintenance it read, and nothing unavailable, when every read stood', () => {
    const text = said(SUMMARY);
    const m = SUMMARY.maintenance.state === 'ok' ? SUMMARY.maintenance.data : null;
    expect(text).toContain(`The platform's own maintenance made ${m!.calls} calls, ${m!.refused} refused`);
    expect(text).not.toMatch(/unavailable/);
  });
});
