import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import type { Audit, People, Teams } from '@/lib/fleet-shapes';
import { formatDateTime } from '@/lib/format-date';
import type { Part } from '@/lib/platform-shapes';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { peopleContext } from '@/views/people-context';
import { AUDIT_DEFAULTS, auditContext } from '@/views/platform-audit-context';
import { BUGS_DEFAULTS, bugContext, bugsContext, isAdminRow } from '@/views/platform-bugs-context';
import { evaluationContext } from '@/views/platform-evaluation-context';
import { knowledgeHealthContext } from '@/views/platform-knowledge-context';
import { RELEASES_DEFAULTS, releaseContext, releasesContext, releasesPath } from '@/views/platform-releases-context';
import { platformStatusContext, statusRead } from '@/views/platform-status-context';
import { usageContext } from '@/views/platform-usage-context';
import { teamContext } from '@/views/team-context';
import { teamsContext } from '@/views/teams-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import { bugReport, bugs, duplicates } from '../scripts/fake-gateway/platform-bugs.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';

/**
 * The findings of "Phase 7, I-129 second re-review: the Platform destinations after I-158 to I-163" (Task I-167), each
 * held at its cause: eight contexts said the time their data arrived in the browser where the page prints the read's
 * own cutoff, so an agent quoted a clock sixteen minutes off the one on screen, in a second shape (M-1); the member's
 * Status context counted the teams approvals wait in without saying why none is named (M-2); two facts ran into one
 * line, titles and names were cut mid-word, and "a unknown" (M-3); People's context left four columns out without
 * saying so (M-4); a share's change was printed as a percentage of itself (M-5); Knowledge health's context named a cell
 * otherwise than its page (M-6); a phone card wrote a capital mid-sentence and the table put a colon beside a word and
 * none beside a figure (N-5); and a waiting finding with no public owner category read "owner not known" where the
 * spec's public projection names it `Evaluation finding awaiting a decision`.
 */
const LIST = releases(10, 0);
const BUGS = bugs(true, { state: null, impact: null, surface: null }, 10, 0);
const OPEN = '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01';
const TEAMS_PAGE = teams(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as Teams;
const PEOPLE_PAGE = people(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as People;
const AUDIT = audit(new URLSearchParams(), { limit: 10, offset: 0 })![1] as Audit;
const ATLAS = teamDetail('atlas')!;
const ADMIN_EVAL = evaluation(true);
const MEMBER_EVAL = evaluation(false);
const ADMIN_USAGE = usage(true);
const ADMIN_KNOWLEDGE = knowledge(true, ME.activeTeam);
const MEMBER_KNOWLEDGE = knowledge(false, MEMBER.activeTeam);

function data<T>(p: Part<T> | null): T {
  if (!p || p.state !== 'ok') throw new Error('not answered');
  return p.data;
}
const mount = (ui: ReactElement) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SurfaceOverride surface={{}}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride>
  </QueryClientProvider>,
);
/** A tile, by the label it starts with. */
const tile = (label: string) => [...document.querySelectorAll<HTMLElement>('[data-split="tiles"] > .card')].find((c) => c.textContent!.startsWith(label))!;
const told = (c: SharedContext) => contextText(c);

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('every platform context keeps the page\'s clock, in one shape (M-1)', () => {
  const asOf = (iso: string) => `As of ${formatDateTime(iso)}.`;
  const lists: [string, () => SharedContext, string][] = [
    ['Status', () => platformStatusContext(statusRead(PLATFORM_STATUS)), PLATFORM_STATUS.meta.asOf],
    ['Releases', () => releasesContext(LIST, { filters: RELEASES_DEFAULTS }), LIST.meta.asOf],
    ['Bugs', () => bugsContext(BUGS, { filters: BUGS_DEFAULTS }), BUGS.meta.asOf],
    ['Evaluation', () => evaluationContext({ state: 'ok', evaluation: ADMIN_EVAL }), ADMIN_EVAL.meta.asOf],
    ['Teams', () => teamsContext(TEAMS_PAGE, { filters: { q: '', status: 'all', page: '1' } }), TEAMS_PAGE.meta.asOf],
    ['A team', () => teamContext('atlas', { team: ATLAS }), ATLAS.meta.asOf],
    ['People', () => peopleContext(PEOPLE_PAGE, { filters: { q: '', state: 'all', page: '1' } }), PEOPLE_PAGE.meta.asOf],
    ['Usage', () => usageContext({ state: 'ok', usage: ADMIN_USAGE }), ADMIN_USAGE.meta.asOf],
    ['Audit', () => auditContext(AUDIT, { filters: AUDIT_DEFAULTS }), AUDIT.meta.asOf],
    ['Knowledge health', () => knowledgeHealthContext({ state: 'ok', health: ADMIN_KNOWLEDGE }), ADMIN_KNOWLEDGE.meta.asOf],
  ];

  it.each(lists)('%s states the read\'s own cutoff, the time its masthead prints, and no arrival time', (_, context, at) => {
    const c = context();
    expect(c.freshness).toBe(asOf(at));
    expect(told(c)).not.toMatch(/Data as of|just now|before now/);
  });

  it('says no second clock on a release or a report, whose pages print no time of their read', () => {
    const release = releaseContext(releaseDetail('0.97.0')!, { asOf: LIST.meta.asOf });
    const report = bugContext(bugReport(OPEN)!, duplicates(OPEN));
    for (const c of [release, report]) {
      expect(c.freshness).toBeUndefined();
      expect(told(c)).not.toMatch(/Data as of|just now|before now/);
    }
  });
});

describe('the member\'s Status says why a team is not named (M-2)', () => {
  it('tells a member, beside the teams approvals wait in, that no team is named, in Usage\'s words', () => {
    const c = platformStatusContext(statusRead(MEMBER_STATUS));
    expect(told(c)).toContain('- Approvals are waiting in 1 team. No team is named here.');
  });

  it('says nothing of the kind to the superadmin, who reads each team', () => {
    expect(told(platformStatusContext(statusRead(PLATFORM_STATUS)))).not.toContain('No team is named here');
  });
});

describe('every context line reads as one fact, whole (M-3)', () => {
  it('gives the days in a row with work and every door\'s tool failures as two facts', () => {
    const c = platformStatusContext(statusRead(PLATFORM_STATUS));
    const days = c.facts.find((f) => f.label === 'Days in a row with work')!;
    expect(days.change).toBeUndefined();
    expect(c.facts.find((f) => f.label === 'Tool failures, every door')?.value).toMatch(/^\d[\d,]* in [\d,]+ calls$/);
  });

  it('names each report of the queue and each possible duplicate by its whole title', () => {
    const titles = data(BUGS.queue).rows.map((r) => (isAdminRow(r) ? r.internalTitle : r.title));
    const text = told(bugsContext(BUGS, { filters: BUGS_DEFAULTS }));
    const named = titles.filter((t) => text.includes(t));
    expect(named.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/\w…/);
    const report = told(bugContext(bugReport(OPEN)!, duplicates(OPEN)));
    for (const d of duplicates(OPEN)!.rows.slice(0, 3)) expect(report).toContain(d.title);
    expect(report).not.toMatch(/\w…/);
  });

  it('names each member of a team whole', () => {
    const text = told(teamContext('atlas', { team: ATLAS }));
    for (const m of ATLAS.members) expect(text).toContain(m.name);
    expect(text).not.toMatch(/\w…/);
  });

  it('writes "an unknown" and gives the findings by decision as the page labels them', () => {
    const text = told(evaluationContext({ state: 'ok', evaluation: ADMIN_EVAL }));
    expect(text).not.toMatch(/\ba unknown\b/);
    expect(text).toContain('an unknown in zz-core');
    const d = data(ADMIN_EVAL.byDecision);
    expect(text).toContain(`Applied ${d.applied}; Rejected ${d.rejected}; Deferred, waiting ${d.deferred}`);
  });
});

describe('People\'s context says what of the table it leaves out (M-4)', () => {
  it('names the role, teams, passkeys and last sign-in as the page\'s, and where an agent counts them', () => {
    const c = peopleContext(PEOPLE_PAGE, { filters: { q: '', state: 'all', page: '1' } });
    const line = c.unknowns.find((u) => u.includes('role'))!;
    for (const w of ['role', 'teams', 'passkeys', 'last sign-in', 'explore_people']) expect(line).toContain(w);
  });
});

describe('a share\'s change is in points (M-5)', () => {
  const pts = (n: number) => `${Math.abs(n).toFixed(1)} pts`;

  it('prints Usage\'s share refused as the points between the two weeks, as Status does', () => {
    const t = data(ADMIN_USAGE.tiles).refusedShare;
    const points = t.last.figure.value! - t.previous.figure.value!;
    mount(<PlatformUsageView read={{ state: 'ok', usage: ADMIN_USAGE }} />);
    const card = tile('Share refused');
    expect(card.textContent).toContain(pts(points));
    expect(card.textContent).not.toContain(`${(Math.abs(points / t.previous.figure.value!) * 100).toFixed(1)}%`);
    expect(told(usageContext({ state: 'ok', usage: ADMIN_USAGE }))).toContain(`Share refused: ${t.last.figure.value!.toFixed(1)}%, up ${pts(points)}`);
  });

  it('prints Knowledge health\'s share with no result the same way', () => {
    const t = data(ADMIN_KNOWLEDGE.tiles).noResult;
    const points = t.last.figure.value! - t.previous.figure.value!;
    mount(<PlatformKnowledgeView read={{ state: 'ok', health: ADMIN_KNOWLEDGE }} />);
    const card = tile('Share with no result');
    expect(card.textContent).toContain(pts(points));
    expect(card.textContent).not.toContain('33.3%');
    expect(told(knowledgeHealthContext({ state: 'ok', health: ADMIN_KNOWLEDGE }))).toContain(`Share with no result: ${t.last.figure.value!.toFixed(1)}%, down ${pts(points)}`);
  });

  it('keeps a count\'s change as a percentage', () => {
    mount(<PlatformUsageView read={{ state: 'ok', usage: ADMIN_USAGE }} />);
    expect(tile('Calls').textContent).not.toContain('pts');
  });
});

describe('Knowledge health\'s context says each cell in the page\'s word (M-6)', () => {
  it.each([['the superadmin', ADMIN_KNOWLEDGE], ['a member', MEMBER_KNOWLEDGE]] as const)('names a shelf with no search and a week with no column as %s\'s page does', (_, health) => {
    const text = told(knowledgeHealthContext({ state: 'ok', health }));
    const shelves = data(health.shelves).rows;
    if (shelves.some((r) => r.noResult.figure.value === null && r.noResult.figure.why === 'no_data')) expect(text).toContain('/No searches');
    const weeks = text.split('\n').find((l) => l.startsWith('- Share of searches with no result by week'))!;
    expect(weeks).not.toContain('Unavailable');
    expect(weeks).toContain('No data');
  });
});

describe('Releases writes a window\'s word as it writes its figure (N-5)', () => {
  const served = { state: 'ok' as const, path: releasesPath(RELEASES_DEFAULTS), data: LIST };
  const rows = () => [...screen.getByRole('table', { name: 'Releases with what was observed either side of each' }).querySelectorAll('tbody tr')];

  it('puts no colon after a side\'s label, a figure or a word', () => {
    mount(<PlatformReleasesView served={served} />);
    const sides = rows().flatMap((r) => [...r.querySelectorAll('td:not([data-mobile="title"]) [data-side]')].map((s) => s.textContent!));
    expect(sides.length).toBeGreaterThan(0);
    for (const s of sides) expect(s).toMatch(/^(Before|After) [^:]/);
    expect(sides).toContain('Before not observed');
  });

  it('writes a phone card\'s word in lower case at the start of its sentence too', () => {
    mount(<PlatformReleasesView served={served} />);
    const lines = rows().flatMap((r) => [...r.querySelectorAll('td[data-mobile="title"] span')].map((s) => s.textContent!)).filter((t) => t.startsWith('Malformed per 1,000:'));
    expect(lines.length).toBe(rows().length);
    for (const l of lines) expect(l).not.toMatch(/: [A-Z]/);
    expect(lines.some((l) => l.includes('not observed before'))).toBe(true);
  });
});

describe('a waiting finding with no public owner category reads as the spec names it', () => {
  const unknownOwner = <F extends { owner: string }>(rows: F[]) => rows.filter((f) => f.owner === 'unknown');

  it('names it `Evaluation finding awaiting a decision` for everybody, and a known category by the template', () => {
    for (const e of [ADMIN_EVAL, MEMBER_EVAL]) {
      const rows = data(e.waiting).rows;
      expect(unknownOwner(rows).length).toBeGreaterThan(0);
      for (const f of rows) {
        expect(f.summary).toBe(f.owner === 'unknown' ? 'Evaluation finding awaiting a decision' : `${f.kind === 'defect' ? 'A defect' : 'An unknown'} in ${f.plugin}, ${({ plugin: 'owned by the plugin', dependency: 'owned by a dependency', platform: 'owned by the platform', environment: 'owned by the environment', user_input: 'owned by user input' } as Record<string, string>)[f.owner]}`);
      }
    }
  });

  it('still tells a member that finding\'s kind and plugin, on the page and in the context', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: MEMBER_EVAL }} />);
    const f = unknownOwner(data(MEMBER_EVAL.waiting).rows)[0];
    const row = within(screen.getByRole('table', { name: 'Findings waiting for a decision, oldest first' })).getAllByRole('row').find((r) => r.textContent!.includes('Evaluation finding awaiting a decision'))!;
    expect(row.textContent).toContain(f.plugin);
    expect(told(evaluationContext({ state: 'ok', evaluation: MEMBER_EVAL }))).toContain(`Evaluation finding awaiting a decision (an unknown in ${f.plugin}`);
  });
});
