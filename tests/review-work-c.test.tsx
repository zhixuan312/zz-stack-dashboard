import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace: (to: string) => window.history.replaceState(null, '', to) }),
}));
vi.mock('@/app.config', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/app.config')>()), refusal: 'absent' }));

import type { Me, PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import type { Access, ActivityLog, ActivitySummary, Runs } from '@/lib/destination-shapes';
import type { ActivityRead } from '@/views/activity-context';
import { ActivityView } from '@/views/pages/activity';
import { AccessView } from '@/views/pages/access';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { RunsView } from '@/views/pages/runs';
import { SkillView } from '@/views/pages/skill';
import type { Catalog, PluginsRead } from '@/views/plugins-context';
import { RUNS_DEFAULTS, runsPath } from '@/views/runs-context';
import type { SkillRead } from '@/views/skill-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * Phase 7, I-154: each Weak finding the non-builder's review gave Activity, Runs, Plugins, a plugin, a skill and Access,
 * found gone at its cause, on the fake gateway's own answers. A browser is what saw them, so where a finding is a
 * layout (a column wrapping, a phone card) this reads the classes that decide it; the screenshots of the build show it.
 */
const AT = '2026-10-17T09:00:00Z';
const ok = <T,>(path: string, data: T) => ({ state: 'ok' as const, path, at: AT, data });
const catalogOf = (who: Me): Catalog => plugins(who)[1] as Catalog;
const listOf = (who: Me): PluginsRead => ok('/plugins', catalogOf(who));
const text = () => document.body.textContent ?? '';
/** The phone card's own words for a cell, where it has any: the wide cell's are first, the phone's second. */
const phoneOf = (td: Element) => (td.querySelector(':scope > .hidden') ?? td).textContent ?? '';

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

/** A skill's four reads, with its runs' figures set apart from its log's, as production's are. */
function skillRead(change: (s: Skill, d: SkillDetail) => void = () => {}): SkillRead {
  const list = structuredClone(skills(ME, new URLSearchParams('plugin=sdlc'))[1] as { skills: Skill[] });
  const detail = structuredClone(skillDetail(ME, 'sdlc-spec')[1] as SkillDetail);
  change(list.skills.find((s) => s.name === 'sdlc-spec')!, detail);
  return {
    catalog: listOf(ME),
    skills: ok('/skills?plugin=sdlc', list),
    detail: ok('/skills/sdlc-spec', detail),
    text: ok('/plugins/sdlc/skills/sdlc-spec', skillText('sdlc', 'sdlc-spec') as SkillText),
  };
}
/** The skill's whole in the log, as the read handed it. */
const loggedOf = (served: SkillRead) => (served.skills.state === 'ok' ? served.skills.data.skills.find((s) => s.name === 'sdlc-spec')!.logged! : null)!;
const panel = (title: string) => screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement;
const bars = () => [...document.querySelectorAll('[aria-label="Busiest tools"] li')];

describe('F-1: a skill\'s parts sum to the whole they sit beside', () => {
  /** Production's shape: the runs count fewer calls and refusals than the log, and the log has more tools than eight. */
  const apart = () => skillRead((s, d) => {
    s.calls = 100;
    s.refusals = 3;
    s.logged = { calls: d.surfaces.reduce((n, x) => n + x.calls, 0), failed: d.surfaces.reduce((n, x) => n + x.failed, 0), tools: d.busiestTools.length + 2 };
    d.busiestTools.pop();
  });

  it('says the door split\'s whole, from the log its doors count', () => {
    const served = apart();
    const logged = loggedOf(served);
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={served} />);
    expect(panel('Calls by door').textContent).toContain(`${logged.calls} calls by your team in the log, ${logged.failed} refused`);
  });

  it('draws the busiest tools as parts that sum to that whole, the tools past them one row of their own', () => {
    const served = apart();
    const logged = loggedOf(served);
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={served} />);
    const values = bars().map((li) => Number(li.querySelector('.t-num')!.textContent!.replace(/,/g, '')));
    expect(values.reduce((a, b) => a + b, 0)).toBe(logged.calls);
    expect(bars().at(-1)!.textContent).toMatch(/other tools/);
  });

  it('puts the refused share on the same whole, and words the runs\' total as the runs\'', () => {
    const served = apart();
    const logged = loggedOf(served);
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={served} />);
    expect(panel('Refused').textContent).toContain(`${logged.failed} of ${logged.calls} calls in the log`);
    expect(panel('Calls per run').textContent).toContain('100 in its runs');
  });
});

describe('F-32: the busiest tools say their refusals at every width', () => {
  it('carries each tool\'s refused count in its label, which a phone draws, never in the meta a phone hides', () => {
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} />);
    const detail = skillDetail(ME, 'sdlc-spec')[1] as SkillDetail;
    for (const t of detail.busiestTools.filter((x) => x.failed)) {
      const row = bars().find((li) => li.textContent!.includes(t.tool))!;
      const said = [...row.querySelectorAll('span')].find((s) => s.textContent === `${t.failed} refused`)!;
      expect(said.closest('.hidden'), t.tool).toBeNull();
    }
  });
});

describe('F-4, F-5: a plugin leads with one score', () => {
  const read = (who: Me) => ({ catalog: listOf(who), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) });

  it('has one protagonist, the public score with its install command, and no second figure at its size', () => {
    mount(<PluginView name="sdlc" served={read(ME)} />);
    const lead = document.querySelector('[data-protagonist="Its public score"]')!;
    expect(lead.querySelector('[data-value]')!.textContent).toBe(catalogOf(ME).plugins.find((p) => p.plugin === 'sdlc')!.score!.value.toFixed(1));
    expect(within(lead as HTMLElement).getByRole('button', { name: 'Copy the command that installs sdlc' })).toBeInTheDocument();
    expect(document.querySelectorAll('.t-hero, .t-figure')).toHaveLength(1);
  });

  it('names the owning team\'s score for what it is beside the one that leads', () => {
    mount(<PluginView name="sdlc" served={read(ME)} />);
    expect(panel('Overall fit for purpose').textContent).toMatch(/The owning team's evaluation of version [\d.]+\. (The same scoring as|A different scoring from) the public score above/);
  });
});

describe('F-17: the accent is on actions only', () => {
  it('draws Plugins\' required label in no accent', () => {
    mount(<PluginsView served={listOf(ME)} />);
    expect(document.querySelectorAll('table .bg-accent-tint')).toHaveLength(0);
  });

  it('draws a plugin\'s finding owners and its gated documents in no accent', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    expect(document.querySelectorAll('.bg-accent-tint')).toHaveLength(0);
  });
});

describe('F-24, F-30: Plugins\' score and install command', () => {
  const rows = () => [...document.querySelectorAll('[data-protagonist="Every plugin"] tbody tr')];

  it('sets the score and its day on one line and the protocol on a second, each whole, the protocol once', () => {
    mount(<PluginsView served={listOf(ME)} />);
    for (const tr of rows()) {
      const cell = tr.querySelectorAll('td')[5];
      const score = cell.firstElementChild as HTMLElement;
      if (score.textContent === 'Never scored') continue;
      const [figure, protocol] = [...score.children] as HTMLElement[];
      expect(figure.className).toContain('whitespace-nowrap');
      // Whole at a wide table's width; under 896px, where the version and the counts are gone, it may wrap.
      expect(protocol.className).toMatch(/(^| )whitespace-nowrap .*@max-\[896px\]:whitespace-normal/);
      expect(score.textContent).not.toMatch(/protocol protocol|protocol sdlc/);
    }
  });

  it('cuts a command too long for its field at the front, so the plugin\'s name shows', () => {
    mount(<PluginsView served={listOf(ME)} />);
    for (const field of document.querySelectorAll('[data-protagonist="Every plugin"] code')) expect(field.parentElement!.className).toContain('[&_code]:[direction:rtl]');
  });

  it('gives a phone card one fact, so no separator stands before the command', () => {
    mount(<PluginsView served={listOf(ME)} />);
    for (const tr of rows()) {
      expect(tr.querySelectorAll('td[data-mobile="fact"]')).toHaveLength(1);
      expect(tr.querySelector('[data-sep]')).toBeNull();
    }
  });
});

describe('F-35: the member\'s score names its protocol in words', () => {
  it('never says a bare "protocol v2"', () => {
    mount(<PluginsView served={listOf(MEMBER)} />);
    const scored = catalogOf(MEMBER).plugins.filter((p: PluginRow) => p.score);
    expect(scored.length).toBeGreaterThan(0);
    expect(text()).not.toMatch(/protocol v\d/);
    expect(text()).toMatch(/version \d+ of its protocol/);
  });
});

describe('F-31, F-36: a plugin\'s page in a person\'s words', () => {
  it('says no machine word: no enum, no key, no four-place fraction, no unexplained mark', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    expect(text()).not.toMatch(/operationally_qualified|constraint_adherence|\bnot_established\b|\d\.\d{4}\b| \*/);
    expect(text()).not.toMatch(/what the evidence behind this run|Automation & Trust(owned|evaluation only)/);
    expect(text()).toContain('Qualified for use');
  });

  it('holds a guardrail\'s name together, and its install command shows the plugin\'s name', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(ME), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const name = screen.getByText('Abandoned runs');
    expect(name.className).toContain('whitespace-nowrap');
    expect(document.querySelector('[data-protagonist="Its public score"] code')!.parentElement!.className).toContain('[&_code]:[direction:rtl]');
  });
});

describe('F-16, F-22, F-29: Activity', () => {
  const draw = () => mount(<ActivityView read={{ state: 'ok', data: activitySummary(ME)[1] as ActivitySummary, at: AT } satisfies ActivityRead} />);

  it('sets each refusal group\'s tool whole on one line', () => {
    draw();
    const groups = screen.getByRole('region', { name: 'Refusals by owner, tool and message' });
    const tools = [...groups.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[1].firstElementChild as HTMLElement);
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t.className).toContain('whitespace-nowrap');
      expect(t.className).not.toContain('overflow-wrap:anywhere');
    }
  });

  it('titles each phone card of the log by its tool, or its kind where it called none', async () => {
    draw();
    const log = await screen.findByRole('region', { name: 'Activity' });
    const rows = await within(log).findAllByRole('row');
    const answered = (activityLog(ME, new URLSearchParams())[1] as ActivityLog).rows;
    const titles = rows.slice(1).map((tr) => phoneOf(tr.querySelector('td[data-mobile="title"]')!));
    expect(titles).toEqual(answered.map((e) => e.tool ?? e.kind));
    // Ten cards that differ by what they say.
    expect(new Set(titles).size).toBeGreaterThan(1);
  });
});

describe('F-23: a run\'s state on one line', () => {
  it('says the last call\'s time beside the day the Started column gives, whole on one line', () => {
    const path = runsPath(RUNS_DEFAULTS);
    const data = runs(ME, new URLSearchParams(path.split('?')[1]))[1] as Runs;
    mount(<RunsView served={{ state: 'ok', path, data }} />);
    const table = screen.getByRole('heading', { name: 'Recent runs' }).closest('.card') as HTMLElement;
    const ended = [...table.querySelectorAll('[title^="Last call at"]')] as HTMLElement[];
    expect(ended.length).toBeGreaterThan(0);
    for (const s of ended) {
      expect(s.className).toContain('whitespace-nowrap');
      expect(s.firstElementChild!.textContent).toMatch(/^Last call (\d{2}:\d{2}|\d{1,2} \w{3,4}, \d{2}:\d{2})$/);
    }
  });
});

describe('F-33, F-37: Access', () => {
  const draw = () => mount(<AccessView served={{ state: 'ok', access: accessOf(ME)[1] as Access }} />);

  it('breaks a member\'s address only at its parts, and lays each member out as a card on a phone', async () => {
    draw();
    const members = (await screen.findByRole('heading', { level: 2, name: 'atlas\'s members' })).closest('section') as HTMLElement;
    const cells = await within(members).findAllByRole('cell');
    const addresses = cells.filter((c) => c.textContent!.includes('@'));
    expect(addresses.length).toBeGreaterThan(0);
    for (const c of addresses) {
      expect(c.className).not.toMatch(/break-all|overflow-wrap:anywhere/);
      expect(c.querySelector('wbr')).not.toBeNull();
    }
    expect(within(members).getByRole('table').className).toContain('@max-[512px]:[&_tr]:flex');
  });

  it('breaks a token\'s label only between words and an address\'s parts', () => {
    draw();
    const tokens = screen.getByRole('heading', { level: 2, name: 'Tokens' }).closest('section') as HTMLElement;
    expect(tokens.innerHTML).not.toContain('overflow-wrap:anywhere');
    expect(within(tokens).getByRole('table').className).toContain('@max-[512px]:[&_tr]:flex');
  });

  it('renders the client setup\'s steps, with each block of commands its own Copy, in a person\'s words', async () => {
    draw();
    const setup = screen.getByRole('heading', { level: 2, name: 'Client setup' }).closest('section') as HTMLElement;
    await within(setup).findByRole('heading', { name: /Get a token/ });
    expect(setup.textContent).not.toMatch(/^#|##|\*\*|```/m);
    expect(within(setup).getByRole('button', { name: 'Copy the commands' })).toBeInTheDocument();
    expect(text()).not.toMatch(/team_switch|\/manage door/);
  });
});
