import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace: (to: string) => window.history.replaceState(null, '', to) }),
  redirect: (to: string) => {
    throw new Error(`redirect to ${to}`);
  },
}));
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import type { DimensionScore, Me, PluginEvalFound, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import type { Access, ActivitySummary, Runs } from '@/lib/destination-shapes';
import { contributionsOf } from '@/console/plugin-eval-overview';
import type { ActivityRead } from '@/views/activity-context';
import { AccessView } from '@/views/pages/access';
import { ActivityView } from '@/views/pages/activity';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { RunsView } from '@/views/pages/runs';
import { SkillView } from '@/views/pages/skill';
import { comparedSaid, type HistoryRead } from '@/views/plugin-context';
import type { Catalog, PluginsRead } from '@/views/plugins-context';
import { RUNS_DEFAULTS, runsPath } from '@/views/runs-context';
import type { SkillRead } from '@/views/skill-context';
import MissingAddressPage from '../app/(dash)/[...missing]/page';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * Phase 7, I-160: the re-review's findings on Activity, Runs, Plugins, a plugin, a skill, Access and a retired address,
 * each found gone at its cause on the fake gateway's own answers. Where a finding is a layout this reads the classes
 * that decide it; the screenshots of the build show it.
 */
const AT = '2026-10-17T09:00:00Z';
const ok = <T,>(path: string, data: T) => ({ state: 'ok' as const, path, at: AT, data });
const catalogOf = (who: Me): Catalog => plugins(who)[1] as Catalog;
const listOf = (who: Me): PluginsRead => ok('/plugins', catalogOf(who));
const text = () => document.body.textContent ?? '';
const panel = (title: string) => screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement;
/** The fake's series for a plugin, as the page's server read hands them on. */
const historyOf = (plugin: string, admin: boolean): HistoryRead => {
  const read = evaluation(admin).history;
  const h = read.state === 'ok' ? read.data.find((x) => x.plugin === plugin) : undefined;
  return h ? { state: 'ok', series: h.series } : { state: 'none' };
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const p = url.pathname.replace('/api/console', '');
    const body = p === '/me' ? ME
      : p === '/activity/summary' ? activitySummary(ME)[1]
        : p === '/activity' ? activityLog(ME, url.searchParams)[1]
          : p === '/settings/team/members' ? teamMembers(url.searchParams.get('team') ?? '')
            : p === '/access' ? accessOf(ME)[1] : null;
    return body === null ? new Promise(() => {}) : Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}

describe('F-22: Activity\'s refusal groups keep each tool name on one line', () => {
  it('gives the name no break point, which Chrome takes even inside nowrap', () => {
    mount(<ActivityView read={{ state: 'ok', data: activitySummary(ME)[1] as ActivitySummary, at: AT } satisfies ActivityRead} />);
    const groups = screen.getByRole('region', { name: 'Refusals by owner, tool and message' });
    const tools = [...groups.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[1]);
    expect(tools.length).toBeGreaterThan(0);
    for (const td of tools) {
      expect(td.querySelector('wbr')).toBeNull();
      expect(td.firstElementChild!.className).toContain('whitespace-nowrap');
      expect(td.firstElementChild!.className).not.toContain('whitespace-normal');
    }
  });
});

describe('F-49: Activity says who made a tool call', () => {
  it('says an agent made it, where the platform records no person, never a dash on every call', async () => {
    mount(<ActivityView read={{ state: 'ok', data: activitySummary(ME)[1] as ActivitySummary, at: AT } satisfies ActivityRead} />);
    const log = await screen.findByRole('region', { name: 'Activity' });
    const rows = (await within(log).findAllByRole('row')).slice(1);
    const calls = rows.filter((tr) => tr.textContent!.includes('tool_call'));
    expect(calls.length).toBeGreaterThan(0);
    for (const tr of calls) expect(tr.querySelectorAll('td')[4].textContent).toBe('An agent');
  });
});

describe('F-50, F-53: a mean of calls reads as a number, not "96.0"', () => {
  it('Runs by skill drops a ".0" and keeps one place where there is one', () => {
    const path = runsPath(RUNS_DEFAULTS);
    const data = runs(ME, new URLSearchParams(path.split('?')[1]))[1] as Runs;
    mount(<RunsView served={{ state: 'ok', path, data }} />);
    const table = panel('By skill');
    const cells = [...table.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[2].textContent!);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(c).not.toMatch(/\.0$/);
    expect(cells.some((c) => /^\d+\.\d$/.test(c)) || cells.every((c) => /^\d+$/.test(c))).toBe(true);
  });
});

/** A skill's four reads from the fake. */
function skillRead(): SkillRead {
  return {
    catalog: listOf(ME),
    skills: ok('/skills?plugin=sdlc', skills(ME, new URLSearchParams('plugin=sdlc'))[1] as { skills: Skill[] }),
    detail: ok('/skills/sdlc-spec', skillDetail(ME, 'sdlc-spec')[1] as SkillDetail),
    text: ok('/plugins/sdlc/skills/sdlc-spec', skillText('sdlc', 'sdlc-spec') as SkillText),
  };
}

describe('F-53: a skill leads with one tile and keeps its labels whole', () => {
  it('lights one tile, the refusals with the line they pass, and no figure reads "x.0"', () => {
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} />);
    const lit = [...document.querySelectorAll('[data-value].text-accent-ink')];
    expect(lit).toHaveLength(1);
    expect(panel('Refused').querySelector('[data-value]')!.className).toContain('text-accent-ink');
    expect(panel('Refused').querySelector('[data-finding]')!.textContent).toMatch(/Above the 5% this page flags/);
    expect(panel('Calls per run').querySelector('[data-value]')!.textContent).not.toMatch(/\.0$/);
    expect(panel('Conclusion').textContent).not.toMatch(/\d\.0 calls/);
  });

  it('labels its output with words that fit the list\'s label column', () => {
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} />);
    const labels = [...panel('Calls by door').querySelectorAll('dt')].map((d) => d.textContent!);
    for (const l of labels) expect(l.length, l).toBeLessThanOrEqual(18);
    expect(panel('Calls by door').textContent).toContain('Output is observed output');
  });
});

describe('F-51, F-52: a row that opens a page says so', () => {
  it('ends every plugin\'s name with the arrow that goes to its page', () => {
    mount(<PluginsView served={listOf(ME)} />);
    const rows = [...document.querySelectorAll('[data-protagonist="Every plugin"] tbody tr')];
    expect(rows.length).toBeGreaterThan(0);
    for (const tr of rows) expect(tr.querySelector('td a [data-goes]'), tr.textContent!).not.toBeNull();
  });

  it('ends every skill\'s name on a plugin\'s page with the same arrow', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const rows = [...panel('Its skills').querySelectorAll('tbody tr')];
    expect(rows.length).toBeGreaterThan(0);
    for (const tr of rows) expect(tr.querySelector('td a [data-goes]'), tr.textContent!).not.toBeNull();
  });
});

describe('F-4, N-3: a plugin\'s score is rebuilt from its parts, and compared by name', () => {
  /** A run as `scoreRun` makes one: the overall is 10 × the weighted mean over the dimensions that count. */
  const dims = (scores: (number | null)[]): DimensionScore[] => scores.map((score, i) => ({
    key: `d${i}`, canonicalKind: 'effectiveness', score, applicable: score !== null, notApplicableReason: score === null ? 'no run reached it' : null,
    weight: 0.25, required: true, measuresScored: 1, measuresTotal: 1, measures: [],
  }) as DimensionScore);

  it('shares a not-applicable dimension\'s weight out, so the parts add up to the overall', () => {
    const { parts, counted, declared } = contributionsOf(dims([0.78, 0.7, 0.65, null]));
    expect(counted).toBeCloseTo(0.75);
    expect(declared).toBeCloseTo(1);
    expect(parts.reduce((n, p) => n + p.tenths, 0)).toBe(71);
    expect(parts.map((p) => p.tenths)).toEqual([26, 23, 22]);
  });

  it('draws the sum and says how the left-out weight was treated', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const run = (pluginEval('sdlc') as PluginEvalFound).run!;
    const { parts } = contributionsOf(run.dimensions);
    const sum = (parts.reduce((n, p) => n + p.tenths, 0) / 10).toFixed(1);
    const quality = panel('Quality');
    expect(quality.textContent).toContain(`= ${sum} out of 10`);
    expect(quality.textContent).toMatch(/Handover is left out, as the table says, so its 25% is shared out over the 3 that count/);
    expect(panel('Overall fit for purpose').textContent).toContain(run.overallScore!.toFixed(1));
    expect(panel('Overall fit for purpose').textContent).not.toContain(run.overallScore!.toFixed(2));
  });

  it('names the earlier score it compares with and the one it does not, with their days and protocols', () => {
    const lead = catalogOf(ME).plugins.find((p) => p.plugin === 'sdlc')!.score;
    expect(comparedSaid(lead, historyOf('sdlc', true))).toMatch(/^Comparable with its 6\.4 of \d{1,2} \w+, the same protocol and population; not comparable with its 5\.8 of \d{1,2} \w+, scored against sdlc-flow-quality v1$/);
    const asMember = catalogOf(MEMBER).plugins.find((p) => p.plugin === 'sdlc')!.score;
    expect(comparedSaid(asMember, historyOf('sdlc', false))).toMatch(/scored against version 1 of its protocol$/);
    expect(comparedSaid(lead, { state: 'none' })).toBeNull();
  });

  it('puts that sentence under the lead score, the gateway\'s statement where the series were not read', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')), history: historyOf('sdlc', true) }} />);
    const lead = document.querySelector('[data-protagonist="Its public score"]')!;
    expect(lead.textContent).toMatch(/not comparable with its 5\.8/);
    cleanup();
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    expect(document.querySelector('[data-protagonist="Its public score"]')!.textContent).toContain('Not comparable: a different protocol version');
  });
});

describe('F-35, F-36: a plugin in a person\'s words', () => {
  it('says whose protocol a member\'s score was scored against, and no bare version', () => {
    mount(<PluginsView served={listOf(MEMBER)} />);
    expect(text()).toMatch(/v2 of its own protocol/);
    expect(text()).not.toMatch(/protocol v\d/);
  });

  it('says no count before a phrase, no ampersand heading and no evaluator key', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    expect(text()).not.toMatch(/\d a person approves|Automation & Trust|judge\.\w+\.v\d/);
    expect(panel('The documents it governs').textContent).toMatch(/A person approves 3 of the 4/);
    expect(text()).toContain('Evidence judge, version 2');
  });
});

describe('N-6: Evolution keeps its status pill inside the card at a phone\'s width', () => {
  it('gives Status the card\'s edge padding where the columns after it are hidden', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const table = panel('Evolution').querySelector('table')!;
    expect(table.querySelectorAll('th')[1].className).toContain('@max-[672px]:pr-(--card-pad)');
    for (const tr of table.querySelectorAll('tbody tr')) expect(tr.querySelectorAll('td')[1].className).toContain('@max-[672px]:pr-(--card-pad)');
  });
});

describe('F-54, N-5: Access', () => {
  const draw = () => mount(<AccessView served={{ state: 'ok', access: accessOf(ME)[1] as Access }} />);

  it('draws "Admin" and "This browser" as labels, not in the accent', async () => {
    draw();
    await screen.findByText('This browser');
    expect(document.querySelectorAll('.bg-accent-tint')).toHaveLength(0);
  });

  it('sets the setup\'s steps a level under the section\'s own title', async () => {
    draw();
    const setup = screen.getByRole('heading', { level: 2, name: 'Client setup' }).closest('section') as HTMLElement;
    const step = await within(setup).findByRole('heading', { name: /Get a token/ });
    expect(step.tagName).toBe('H5');
    expect(step.className).not.toMatch(/text-lg|text-xl/);
  });
});

describe('F-55: a retired address says where its page went, to a person whose rail holds it', () => {
  const SUPERADMIN = { email: 'owner@example.com', name: 'Owner Example', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
  const A_MEMBER = { email: 'mei@example.com', name: 'Mei Tanaka', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };
  const as = (who: object) => vi.stubGlobal('fetch', (async () => ({ ok: true, status: 200, json: async () => who })) as unknown as typeof fetch);
  const page = async (segments: string[]) => render((await MissingAddressPage({ params: Promise.resolve({ missing: segments }) })) as ReactElement).container;

  beforeEach(() => {
    for (const k of Object.keys(jar)) delete jar[k];
    jar.zz_console = 'session-1';
    Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  });

  it.each([
    [['teams'], '/platform/teams', 'Open Teams'],
    [['teams', 'atlas'], '/platform/teams/atlas', 'Open atlas in Teams'],
    [['people'], '/platform/people', 'Open People'],
    [['settings'], '/access', 'Open Access'],
  ])('sends the superadmin from /%s to the page it moved to', async (segments, href, label) => {
    as(SUPERADMIN);
    const c = await page(segments);
    expect(c.querySelector('[data-missing-page]')).not.toBeNull();
    expect(c.querySelector(`a[href="${href}"]`)!.textContent!.trim()).toBe(label);
  });

  it('tells a member where Settings went, which their rail holds, and nothing of Teams or People, which it does not', async () => {
    as(A_MEMBER);
    expect((await page(['settings'])).querySelector('a[href="/access"]')).not.toBeNull();
    cleanup();
    for (const segments of [['teams'], ['teams', 'beacon'], ['people']]) {
      const c = await page(segments);
      expect(c.querySelector('[data-moved]')).toBeNull();
      expect(c.textContent).not.toMatch(/Teams|People|Platform|\bmoved\b/);
      cleanup();
    }
  });

  it('answers any other address with the missing page, for the superadmin too', async () => {
    as(SUPERADMIN);
    const c = await page(['nothing', 'lives', 'here']);
    expect(c.querySelector('[data-missing-page]')).not.toBeNull();
    expect(c.querySelector('[data-moved]')).toBeNull();
  });
});
