import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

import { PeriodProvider } from '@/console/period';
import type { Me, PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import type { ActivityLog, ActivitySummary } from '@/lib/destination-shapes';
import { ActivityView } from '@/views/pages/activity';
import { InitiativesView } from '@/views/pages/initiatives';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { SkillView } from '@/views/pages/skill';

const TooltipProvider = Tooltip.Provider;

/**
 * A read that failed must not look like one still on its way, and a figure nobody read must not print as a figure.
 *
 * `tests/failed-read-tiles.test.tsx` settled this for Runs: the mark is a fact about the read — `…` is coming, `—` is
 * not — and the gateway's own sentence says why. Every other destination page kept a habit of its own: a filter bar
 * that printed `…` for a failure for ever, a tile note that printed a measured `0 superadmins` under a value that was a
 * dash, a count of a capped page stated as the whole population. This file is that floor for the rest of them, one case
 * per page whose behaviour changed.
 *
 * The reads are real reads: `fetch` answers 500 with the gateway's own sentence for every route a page asks for, so
 * what is asserted is what a person would meet rather than a component handed an error prop. `/me` answers, because it
 * is the console's own mode read and not the page's content — a page's failure is what is under test here.
 */
const REASON = 'the gateway could not reach its database';

const ME: Me = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/** Every read 500s with the gateway's sentence, apart from the ones a case answers, in the order given. */
function onlyMe(answers: [part: string, body: unknown][] = []) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/me')) return { ok: true, status: 200, json: async () => ME } as unknown as Response;
    for (const [part, body] of answers) {
      if (url.includes(part)) return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }
    return { ok: false, status: 500, json: async () => ({ error: REASON }) } as unknown as Response;
  }));
}

/** The page in the providers it needs: a client that never retries, the period the masthead reads, the tooltip Ask. */
function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

/** A record page suspends on its params until they resolve, so it is rendered inside an awaited `act`. */
async function mountRecord(ui: ReactElement) {
  await act(async () => { mount(<Suspense fallback={null}>{ui}</Suspense>); });
}

const text = () => document.body.textContent ?? '';

/** What a read that failed must never wear: the mark of one still coming. */
function expectNoEllipsis() {
  expect(screen.queryByText('…')).toBeNull();
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('the Activity page, every read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/activity');
    onlyMe();
  });

  it('draws a dash in the bar and says the figures failed, as the page\'s own spec says it must', async () => {
    mount(<ActivityView read={{ state: 'failed', reason: REASON }} />);
    // The figures are the server's read, failed before the page drew; the events are the browser's, still to fail.
    await waitFor(() => expect(text()).toContain('The events did not load'));
    expect(text()).toContain('The week\'s figures did not load');
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(1);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expectNoEllipsis();
  });
});

describe('the Knowledge page, every read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/knowledge');
    onlyMe();
  });

  it('draws a dash in the bar and says the shelf\'s figures failed', async () => {
    mount(<KnowledgeView read={{ state: 'failed', reason: REASON }} />);
    // The figures are the server's read, failed before the page drew; the lessons are the browser's, still to fail.
    await waitFor(() => expect(text()).toContain('The lessons did not load'));
    expect(text()).toContain('The shelf\'s figures did not load');
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(1);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expectNoEllipsis();
  });
});

describe('the Initiatives page, its read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/initiatives');
    onlyMe();
  });

  it('draws a dash in the bar, never the mark of a read still coming', async () => {
    mount(<InitiativesView />);
    await waitFor(() => expect(text()).toContain('The initiatives did not load'));
    expect(text()).toContain(REASON);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expectNoEllipsis();
  });
});

const SKILL: Skill = {
  name: 'spec', version: '1.0.0', kind: 'stage', flow: 'sdlc', retired: false,
  runs: 12, calls: 40, callsAvg: 3.3, callsMax: 9, refusals: 2, timedRuns: 10,
  durationAvg: 30, durationMedian: 25, durationMax: 90, durationTotal: 300,
  kbPerRun: 2048, mbTotal: 0.1,
  // The platform's log of this skill's calls was not read, which the shape spells as null.
  logged: null,
};

const DETAIL: SkillDetail = { skill: 'spec', surfaces: [{ surface: 'core', calls: 40, failed: 2, tools: 5 }], busiestTools: [] };

const TEXT: SkillText = {
  skill: 'spec', plugin: 'sdlc', isEntry: true, origin: 'ours', version: '1.0.0', description: null,
  source: null, whenToUse: null, body: 'The skill itself.', references: [],
};

/** A plugin that ships the skill under test, so the page takes the shipped branch rather than "not shipped". */
const PLUGIN: PluginRow = {
  plugin: 'sdlc', owner: null, agentName: null, description: null, version: '1.0.0', servers: [],
  flow: true, stages: ['spec'], entry: 'spec', documents: [], gates: 1,
  skills: [{
    name: 'spec', position: 1, isEntry: true, origin: 'ours', version: '1.0.0', description: null, source: null,
    versions: 1, calls: 40, everRun: true, lastRun: '2026-10-01T00:00:00Z',
  }],
  release: null, required: true, install: 'npx zz-sdlc', score: null, comparability: 'none',
  yourTeam: { calls: 40, failed: 2, lastRun: '2026-10-01T00:00:00Z' },
};

describe('a skill whose log of calls was not read', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/plugins/sdlc/spec');
    // The longest prefix first: `/plugins/sdlc/skills/spec` is a different read from `/plugins`, and the text read
    // answers the shape the page destructures rather than the catalog's.
    onlyMe([
      ['/plugins/sdlc/skills/spec', TEXT],
      ['/skills?plugin=', { skills: [SKILL] }],
      ['/skills/spec', DETAIL],
      ['/plugins', { plugins: [PLUGIN] }],
    ]);
  });

  it('says the figures were not measured instead of printing three measured zeros', async () => {
    await mountRecord(<SkillView params={Promise.resolve({ plugin: 'sdlc', skill: 'spec' })} />);
    await waitFor(() => expect(text()).toContain('tools not measured'));
    // Both counts in the log are the same absence, and both say so: `?? 0` printed "0" for each of them.
    expect(screen.getAllByText('Not measured').length).toBe(2);
    expect(text()).not.toContain('0 distinct');
  });
});

describe('the Knowledge log page, its read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/knowledge/log');
    onlyMe();
  });

  it('does not say nothing was recorded over a read that failed', async () => {
    mount(<KnowledgeLogView read={{ state: 'failed', reason: REASON }} mode="platform" />);
    await waitFor(() => expect(text()).toContain('The entries did not load'));
    expect(text()).toContain(REASON);
    // "Nothing yet" over a failed read is the all-clear a failure must never wear.
    expect(text()).not.toContain('Nothing yet');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expectNoEllipsis();
  });
});

/**
 * The other shape of the same lie: a read that SUCCEEDED and took one page of a longer list. The answer carries the
 * population its page was cut from, and the list below asks for the largest page the gateway takes — so a bar that
 * printed only the rows it holds would state a truncated population as a measured whole.
 */
const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };
const META = {
  asOf: '2026-10-15T00:00:00Z', timezone: 'UTC',
  period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' },
  scope: 'active-team' as const, population: 'atlas', coverageFrom: null,
};

describe('the activity log read stops at its own ceiling', () => {
  const SUMMARY: ActivitySummary = {
    meta: META,
    tiles: {
      calls: { window: WINDOW, figure: { value: 120, why: null }, numerator: 120, denominator: null },
      refused: { window: WINDOW, figure: { value: 4, why: null }, numerator: 4, denominator: 120, owners: { guardrail: 1, ours: 1, theirs: 1, other: 1 } },
      mostRefused: { tool: 'zz_search', count: 2, of: 4 },
    },
    weeks: { state: 'ok', data: [] },
    groups: { state: 'ok', data: { rows: [], groups: 0, rest: null } },
    maintenance: { calls: 0, refused: 0 },
  };

  // The gateway's total is the matches UP TO the ceiling, so this is the boundary the wording has to survive: 500
  // against a ceiling of 500 is as far as the read reached, and the clause must not report a truncation it cannot
  // know about.
  const LOG: ActivityLog = { meta: META, rows: [], total: 500, ceiling: 500, kinds: ['tool_call'], tools: ['zz_search'] };

  it('the count says how far the read reached, and claims no more than that', async () => {
    window.history.replaceState(null, '', '/activity');
    // The summary is the console's server's read, handed to the page; the browser reads the log alone.
    onlyMe([['/activity', LOG]]);
    mount(<ActivityView read={{ state: 'ok', data: SUMMARY, at: META.asOf }} />);
    await waitFor(() => expect(text()).toContain('500 events, the latest 500 read'));
    expect(text()).not.toContain('of the latest');
  });
});
