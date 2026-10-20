import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace: (to: string) => window.history.replaceState(null, '', to) }),
  redirect: (to: string) => {
    throw new Error(`redirect to ${to}`);
  },
}));

import type { PluginEvalFound, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import type { Access, ActivitySummary, Runs } from '@/lib/destination-shapes';
import { contextText } from '@/lib/shared-context';
import { SurfaceOverride } from '@/components/base/surface';
import { SkillWorkPanel } from '@/console/skill-work';
import type { ActivityRead } from '@/views/activity-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { AccessView } from '@/views/pages/access';
import { ActivityView } from '@/views/pages/activity';
import { PluginView } from '@/views/pages/plugin';
import { SkillView } from '@/views/pages/skill';
import { comparedSaid, pluginContext } from '@/views/plugin-context';
import type { Catalog, PluginsRead } from '@/views/plugins-context';
import { RUNS_DEFAULTS, runsContext, runsPath, skillPagesOf } from '@/views/runs-context';
import { skillContext, type SkillRead } from '@/views/skill-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { teamMembers } from '../scripts/fake-gateway/platform-people.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * Phase 7, I-165: the second re-review's findings on Activity, Runs, a plugin, a skill and Access (M-2, M-3, M-4 with
 * F-17's and F-53's remainders, M-10, M-12, M-13, M-17), each found gone at its cause on the fake gateway's own answers.
 * Where a finding is a layout this reads the classes that decide it; the screenshots of the build show it.
 */
const AT = '2026-10-17T09:00:00Z';
const arrival = { updatedAt: AT, now: '2026-10-17T09:01:00Z' };
const ok = <T,>(path: string, data: T) => ({ state: 'ok' as const, path, at: AT, data });
const catalogOf = (who = ME): Catalog => plugins(who)[1] as Catalog;
const listOf = (who = ME): PluginsRead => ok('/plugins', catalogOf(who));
const panel = (title: string) => screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement;
const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
const sdlc = (who = ME) => catalogOf(who).plugins.find((p) => p.plugin === 'sdlc')!;
const specOf = (who = ME) => (skills(who, new URLSearchParams('plugin=sdlc'))[1] as { skills: Skill[] }).skills.find((s) => s.name === 'sdlc-spec')!;
const detailOf = () => skillDetail(ME, 'sdlc-spec')[1] as SkillDetail;

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

describe('M-2: a plugin\'s context gives the page\'s scores and rates in the page\'s scale', () => {
  /** As the page hands it: with the sentence naming the earlier scores it compares with, the longest public score. */
  const said = (who = ME) => {
    const read = evaluation(who === ME).history;
    const h = read.state === 'ok' ? read.data.find((x) => x.plugin === 'sdlc') : undefined;
    const compared = comparedSaid(sdlc(who).score, h ? { state: 'ok', series: h.series } : { state: 'none' });
    return contextText(pluginContext('sdlc', { plugin: sdlc(who), evaluation: pluginEval('sdlc'), compared, ...arrival }));
  };

  it('quotes each dimension out of 10 as the Quality table prints it, with the sentence that rebuilds 7.1', () => {
    for (const who of [ME, MEMBER]) {
      const text = said(who);
      expect(text).toContain('By dimension, out of 10: Completion 7.8, Gate discipline 7.0, Evidence 6.5.');
      expect(text).toContain('2.6 + 2.3 + 2.2 = 7.1 out of 10.');
      expect(text).toMatch(/Handover is left out, as the table says, so its 25% is shared out over the 3 that count/);
      expect(text).not.toMatch(/completion 0\.8|evidence 0\.7/);
    }
  });

  it('quotes a guardrail as the share Health prints, never the scorer\'s fraction', () => {
    const text = said();
    expect(text).toContain('Refusal rate 3.1%');
    expect(text).not.toContain('0.031');
  });

  it('carries the findings, the candidates and the judges inside its budget, the evaluation before the catalog\'s declarations', () => {
    const text = said();
    expect(text).toMatch(/Comparable with its 6\.4/);
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(text).toMatch(/Findings: 1 strength, 2 defects, 1 unknown\./);
    expect(text).toMatch(/Candidates: "Read the refusal before retrying an approval" released as 0\.92\.10/);
    expect(text).toContain('Its judges: Evidence judge, version 2, qualified for use');
  });

  it('says the same rebuilding sentence the Quality card prints', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const caption = panel('Quality').querySelector('p.t-caption.mt-3')!.textContent!;
    expect(said()).toContain(caption);
  });
});

describe('M-13: a reason recorded at release names whose runs it counts', () => {
  it('says above the Evolution rows that a release is judged on every team\'s runs of it', () => {
    mount(<PluginView name="sdlc" served={{ catalog: listOf(), evaluation: ok('/plugins/sdlc/eval', pluginEval('sdlc')) }} />);
    const evolution = panel('Evolution');
    expect(evolution.textContent).toContain('Refused approvals fell from 41 to 9');
    expect(evolution.textContent).toMatch(/judged on every team's runs of the released version, not one team's/);
  });

  it('says it only of a release the verification judged, never of a refusal\'s reason', () => {
    const e = pluginEval('sdlc') as PluginEvalFound;
    const refused = { ...e, candidates: e.candidates.map((c) => (c.release ? { ...c, release: { ...c.release, status: 'refused', verdict: null, reason: 'Not approved by atlas' } } : c)) };
    mount(<PluginView name="sdlc" served={{ catalog: listOf(), evaluation: ok('/plugins/sdlc/eval', refused) }} />);
    expect(panel('Evolution').textContent).not.toMatch(/judged on every team's runs/);
    expect(contextText(pluginContext('sdlc', { plugin: sdlc(), evaluation: refused, ...arrival }))).toContain('(recorded at release: "Not approved by atlas")');
  });

  it('tells the assistant the same beside the reason', () => {
    const text = contextText(pluginContext('sdlc', { plugin: sdlc(), evaluation: pluginEval('sdlc'), ...arrival }));
    expect(text).toMatch(/judged on every team's runs of it: "Refused approvals fell from 41 to 9/);
  });
});

/** A skill's four reads from the fake. */
function skillRead(): SkillRead {
  return {
    catalog: listOf(),
    skills: ok('/skills?plugin=sdlc', skills(ME, new URLSearchParams('plugin=sdlc'))[1] as { skills: Skill[] }),
    detail: ok('/skills/sdlc-spec', detailOf()),
    text: ok('/plugins/sdlc/skills/sdlc-spec', skillText('sdlc', 'sdlc-spec') as SkillText),
  };
}

describe('M-3: a skill\'s context states its purpose or says it has none, and counts what it leaves out', () => {
  const said = (detail: SkillDetail, text: SkillText | undefined) => contextText(skillContext('sdlc', 'sdlc-spec', { plugin: sdlc(), skill: specOf(), detail, text, ...arrival }));

  it('lists every busiest tool the page draws, so the tools sum to the log\'s whole', () => {
    const detail = detailOf();
    const text = said(detail, skillText('sdlc', 'sdlc-spec') as SkillText);
    for (const t of detail.busiestTools) expect(text).toContain(`${t.tool} ${t.calls}`);
    expect(text).toContain('eval:protocol_read 7 (1 refused)');
    expect(detail.busiestTools.reduce((n, t) => n + t.calls, 0)).toBe(specOf().logged!.calls);
  });

  it('counts the tools past the busiest as one remainder, as the page\'s bars do', () => {
    const detail = detailOf();
    const short = { ...detail, busiestTools: detail.busiestTools.slice(0, 5) };
    const rest = detail.busiestTools.slice(5);
    const text = said(short, skillText('sdlc', 'sdlc-spec') as SkillText);
    expect(text).toContain(`and ${rest.length} other tools ${rest.reduce((n, t) => n + t.calls, 0)} (${rest.reduce((n, t) => n + t.failed, 0)} refused)`);
  });

  it('says where its purpose comes from, and that it is not read here when the text did not load', () => {
    expect(said(detailOf(), skillText('sdlc', 'sdlc-spec') as SkillText)).toMatch(/What it is for, as its SKILL\.md describes it: /);
    expect(said(detailOf(), undefined)).toContain('What it is for is not read here');
    expect(said(detailOf(), { ...(skillText('sdlc', 'sdlc-spec') as SkillText), description: null as unknown as string })).toContain('declares no description');
  });

  // The fake's description was once a sentence about a description, which the context then stated as the skill's
  // purpose; this holds it to a purpose.
  it('is handed a purpose that is a purpose, not a template sentence about one', () => {
    expect((skillText('sdlc', 'sdlc-spec') as SkillText).description).not.toMatch(/in the words its own SKILL\.md opens with/);
  });
});

describe('M-4, F-17, F-53: a skill leads with one figure, in ink, with its amber flag', () => {
  it('leads the runs view with one featured figure, the refused share, and no figure in the accent', () => {
    mount(<SurfaceOverride surface={{ ask: () => {} }}><SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} /></SurfaceOverride>);
    expect(document.querySelectorAll('.text-accent-ink[data-value], [data-value] .text-accent-ink, [data-line] .text-accent-ink')).toHaveLength(0);
    const lead = document.querySelector('[data-protagonist="Its runs"]') as HTMLElement;
    const figures = document.querySelectorAll('[data-figure]');
    expect(figures).toHaveLength(1);
    expect(lead.contains(figures[0])).toBe(true);
    expect(figures[0].querySelector('[data-value]')!.textContent).toBe('8.2%');
    expect(figures[0].querySelector('[data-value]')!.className).not.toMatch(/accent|critical/);
    expect(figures[0].textContent).toMatch(/Above the 5% this page flags: 11 of 134 calls in the log were refused/);
    expect(figures[0].querySelector('.bg-warning')).not.toBeNull();
    expect(within(lead).getByRole('button', { name: /^Ask/ })).toBeInTheDocument();
  });

  it('steps the other three figures back as ink tiles', () => {
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} />);
    const tiles = [...document.querySelectorAll('[data-split="tiles"] h2')].map((h) => h.textContent);
    expect(tiles).toEqual(['Runs', 'Calls per run', 'Median run']);
  });

  it('sets the Conclusion\'s refused share in the same ink as the lead', () => {
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead()} />);
    const figure = [...panel('Conclusion').querySelectorAll('b')].find((b) => b.textContent === '8.2%')!;
    expect(figure.className).toBe('text-ink');
  });

  it('leads with the runs where the refusals pass no line, and keeps About as the lead of the skill\'s text', () => {
    const read = skillRead();
    const quiet = { ...specOf(), logged: { ...specOf().logged!, failed: 1 } };
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={{ ...read, skills: ok('/skills?plugin=sdlc', { skills: [quiet] }) }} />);
    expect(document.querySelector('[data-figure] [data-value]')!.textContent).toBe(String(quiet.runs));
    expect([...document.querySelectorAll('[data-split="tiles"] h2')].map((h) => h.textContent)).toEqual(['Calls per run', 'Median run', 'Refused']);
  });
});

describe('M-10: Runs opens a skill\'s page, and its context writes units as the page does', () => {
  it('ends each skill the catalog ships with the arrow to its page, and links it there', () => {
    const data = runs(ME, new URLSearchParams(runsPath(RUNS_DEFAULTS).split('?')[1]))[1] as Runs;
    const rows = data.bySkill.state === 'ok' ? data.bySkill.data.rows : [];
    mount(<SkillWorkPanel skills={rows} oneCall={0} pages={skillPagesOf(catalogOf())} />);
    const shown = rows.slice(0, 10);
    expect(shown.length).toBeGreaterThan(1);
    for (const k of shown) {
      const link = screen.getByRole('link', { name: k.skill });
      expect(link.getAttribute('href')).toMatch(new RegExp(`^/plugins/[^/]+/${k.skill}$`));
      expect(link.querySelector('[data-goes]')).not.toBeNull();
    }
    expect(screen.getByRole('link', { name: 'sdlc-spec' })).toHaveAttribute('href', '/plugins/sdlc/sdlc-spec');
  });

  it('says KB and MB in the context, never kb or mb', () => {
    const path = runsPath(RUNS_DEFAULTS);
    const data = runs(ME, new URLSearchParams(path.split('?')[1]))[1] as Runs;
    const text = contextText(runsContext(data, { filters: RUNS_DEFAULTS, ...arrival }));
    expect(text).toMatch(/\d KB/);
    expect(text).not.toMatch(/\d(\.\d)? (kb|mb)\b/);
    expect(text).not.toMatch(/ (jan|feb|mar|apr|may|jun|jul|aug|sept|oct|nov|dec) \d{4}/);
  });
});

describe('M-12: Activity names a person by their email, as every other page does', () => {
  it('prints the whole address in the log\'s Actor column', async () => {
    mount(<ActivityView read={{ state: 'ok', data: activitySummary(ME)[1] as ActivitySummary, at: AT } satisfies ActivityRead} />);
    const log = await screen.findByRole('region', { name: 'Activity' });
    const rows = (await within(log).findAllByRole('row')).slice(1);
    const people = rows.map((tr) => tr.querySelectorAll('td')[4].textContent!).filter((t) => t !== 'An agent' && t !== '—');
    expect(people.length).toBeGreaterThan(0);
    for (const p of people) expect(p).toMatch(/^[^@\s]+@[^@\s]+$/);
  });
});

// Access's tokens and passkeys panels and the client setup's steps once said "ONCE" in capitals; this holds them to the
// word, and a short cell to one line.
describe('M-17: Access keeps short cells on one line and says "once" in words', () => {
  const draw = () => mount(<AccessView served={{ state: 'ok', access: accessOf(ME)[1] as Access }} />);

  it('keeps a token\'s application and a passkey\'s reach on one line at a desktop width', async () => {
    draw();
    await screen.findByText('This browser');
    const tokens = section('Tokens').querySelector('table')!;
    const application = [...tokens.querySelectorAll('th')].findIndex((th) => th.textContent === 'Application');
    for (const tr of tokens.querySelectorAll('tbody tr')) expect(tr.querySelectorAll('td')[application].className).toMatch(/whitespace-nowrap|truncate/);
    const passkeys = section('Passkeys').querySelector('table')!;
    const reach = [...passkeys.querySelectorAll('th')].findIndex((th) => th.textContent === 'Reached by');
    for (const tr of passkeys.querySelectorAll('tbody tr')) expect(tr.querySelectorAll('td')[reach].className).toContain('whitespace-nowrap');
  });

  it('says a token is shown once without capitals', async () => {
    draw();
    await screen.findByText('This browser');
    expect(document.body.textContent).not.toContain('ONCE');
  });
});
