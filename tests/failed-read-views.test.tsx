import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

import { PeriodProvider } from '@/console/period';
import type { Me, Person, PluginRow, Skill, SkillDetail, SkillText, Team } from '@/lib/api-shapes';
import type { ActivityLog, ActivitySummary } from '@/lib/destination-shapes';
import { ActivityView } from '@/views/pages/activity';
import { InitiativesView } from '@/views/pages/initiatives';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { PeopleView } from '@/views/pages/people';
import { SkillView } from '@/views/pages/skill';
import { TeamView } from '@/views/pages/team';
import { TeamsView } from '@/views/pages/teams';

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
    mount(<ActivityView />);
    await waitFor(() => expect(text()).toContain('The week\'s figures did not load'));
    // The tiles are the summary read and the table is the log read: both failed, and both say so.
    expect(text()).toContain('The events did not load');
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
    mount(<KnowledgeView />);
    await waitFor(() => expect(text()).toContain('The shelf\'s figures did not load'));
    expect(text()).toContain('The lessons did not load');
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

describe('the People page, its read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/people');
    onlyMe();
  });

  it('reports no counts at all: a note that counted nobody would be a zero nobody measured', async () => {
    mount(<PeopleView />);
    await waitFor(() => expect(text()).toContain('The people did not load'));
    expect(text()).toContain(REASON);
    // The values are dashes and the notes that used to count over an unread page are gone with them.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(text()).not.toContain('0 superadmin');
    expect(text()).not.toContain('Held by 0');
    // The bar counted a population of nothing beside the error that explained it.
    expect(text()).not.toContain('0 of 0');
    expectNoEllipsis();
  });
});

describe('the Teams page, its read failing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/teams');
    onlyMe();
  });

  it('does not count zero teams beside the error that says the read failed', async () => {
    mount(<TeamsView />);
    await waitFor(() => expect(text()).toContain('The teams did not load'));
    expect(text()).toContain(REASON);
    expect(text()).not.toContain('0 of 0');
    expectNoEllipsis();
  });
});

describe('a team page for a team that is not there', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/teams/nonesuch');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/me')) return { ok: true, status: 200, json: async () => ME } as unknown as Response;
      return { ok: false, status: 404, json: async () => ({ error: 'no team by this name' }) } as unknown as Response;
    }));
  });

  it('offers the way back to the list rather than rendering a dead end', async () => {
    await mountRecord(<TeamView params={Promise.resolve({ slug: 'nonesuch' })} />);
    await waitFor(() => expect(text()).toContain('No team called nonesuch'));
    expect(text()).toContain('No team by this name exists on the platform.');
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/teams');
    // The page owes the reader nothing it cannot read: no tile, and no dash standing in for one.
    expect(screen.queryByText('Initiatives')).toBeNull();
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
    mount(<KnowledgeLogView />);
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
 * population its page was cut from, and the two lists below ask for the largest page the gateway takes — so a bar that
 * printed only the rows it holds would state a truncated population as a measured whole, and a search would look like
 * it had covered everybody.
 */
const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };
const META = {
  asOf: '2026-10-15T00:00:00Z', timezone: 'UTC',
  period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' },
  scope: 'active-team' as const, population: 'atlas', coverageFrom: null,
};

const PEOPLE: Person[] = [
  { email: 'one@example.com', name: 'One', role: 'superadmin', status: 'active', created: '2026-08-01',
    activeTeam: 'atlas', teams: ['atlas (admin)'], tokens: 2, last_used: '2026-10-01T00:00:00Z' },
  { email: 'two@example.com', name: 'Two', role: 'member', status: 'active', created: '2026-08-02',
    activeTeam: 'beacon', teams: ['beacon (member)'], tokens: 0, last_used: null },
  { email: 'three@example.com', name: 'Three', role: 'member', status: 'active', created: '2026-08-03',
    activeTeam: 'beacon', teams: ['beacon (admin)'], tokens: 4, last_used: '2026-10-02T00:00:00Z' },
];

const TEAMS: Team[] = [
  { slug: 'atlas', name: 'Atlas', status: 'active', created: '2026-08-01', members: 3, initiatives: 5, documents: 7, sources: 11, knowledge: 13 },
  { slug: 'beacon', name: 'Beacon', status: 'active', created: '2026-08-02', members: 2, initiatives: 1, documents: 2, sources: 3, knowledge: 4 },
];

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}

describe('a page of a longer list says it is a page', () => {
  it('people: the population is the answer\'s total, and the bar says how much of it was read', async () => {
    window.history.replaceState(null, '', '/people');
    onlyMe([['/people', { people: PEOPLE, total: 250 }]]);
    mount(<PeopleView />);
    await waitFor(() => expect(figure('People')).toBe('250'));
    expect(text()).toContain('the first 3 of 250, 3 matching');
    // The notes count the rows read, so they say which rows they counted.
    expect(text()).toContain('of the first 3 read');
  });

  it('teams: the same, for the list whose total the page used to discard', async () => {
    window.history.replaceState(null, '', '/teams');
    onlyMe([['/teams', { teams: TEAMS, total: 140 }]]);
    mount(<TeamsView />);
    await waitFor(() => expect(text()).toContain('the first 2 of 140, 2 matching'));
  });
});

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

  const LOG: ActivityLog = { meta: META, rows: [], total: 700, ceiling: 500, kinds: ['tool_call'], tools: ['zz_search'] };

  it('the count says how far the read reached, not just what it held', async () => {
    window.history.replaceState(null, '', '/activity');
    // The summary first: `/activity` is a prefix of both reads.
    onlyMe([['/activity/summary', SUMMARY], ['/activity', LOG]]);
    mount(<ActivityView />);
    await waitFor(() => expect(text()).toContain('700 events, of the latest 500 read'));
  });
});
