import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ subs: new Set<() => void>() }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
    replace(url: string) { window.history.replaceState(null, '', url); nav.subs.forEach((f) => f()); },
  }),
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); },
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
const access = vi.hoisted(() => ({ denied: null as ReactElement | null }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  gate: async () => access.denied,
  gatedMetadata: async (_feature: string, metadata: object) => metadata,
}));

import PluginsLoading from '../app/(dash)/plugins/loading';
import PluginsPage from '../app/(dash)/plugins/page';
import PluginPage from '../app/(dash)/plugins/[plugin]/page';
import SkillPage from '../app/(dash)/plugins/[plugin]/[skill]/page';
import { GatewayError } from '@/data/gateway';
import type { Me, PluginEval, PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { PluginView } from '@/views/pages/plugin';
import { PluginsView } from '@/views/pages/plugins';
import { SkillView } from '@/views/pages/skill';
import type { EvalRead, PluginRead } from '@/views/plugin-context';
import type { Catalog, PluginsRead } from '@/views/plugins-context';
import type { SkillRead } from '@/views/skill-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';

/**
 * Plugins, a plugin and a skill (Task I-111), as a person meets them: the Records template's table with each plugin's
 * Copy control for its install command; a plugin's page with its install command, its public score and the
 * comparability statement as the gateway answered it, its skills with the team's use labelled as the team's, and the
 * owning team's evaluation drawn only when the gateway answered it; no control anywhere that starts an evaluation; and
 * every state each draws. The reads are the fake gateway's own answers, the ones `pnpm verify` serves.
 */
const AT = '2026-10-17T09:00:00Z';
const catalogOf = (who: Me): Catalog => plugins(who)[1] as Catalog;
const ok = <T,>(path: string, data: T) => ({ state: 'ok' as const, path, at: AT, data });
const listOf = (who: Me): PluginsRead => ok('/plugins', catalogOf(who));
const evaluated = (name: string): EvalRead => ok(`/plugins/${name}/eval`, pluginEval(name));
const withheld = (name: string): EvalRead => ({ state: 'withheld', path: `/plugins/${name}/eval` });
const failed = (path: string) => ({ state: 'failed' as const, path, reason: 'the gateway could not reach its database' });
const plugin = (who: Me, name: string): PluginRow => catalogOf(who).plugins.find((p) => p.plugin === name)!;

function skillRead(who: Me, name: string, skill: string): SkillRead {
  return {
    catalog: listOf(who),
    skills: ok(`/skills?plugin=${name}`, skills(who, new URLSearchParams(`plugin=${name}`))[1] as { skills: Skill[] }),
    detail: ok(`/skills/${skill}`, skillDetail(who, skill)[1] as SkillDetail),
    text: ok(`/plugins/${name}/skills/${skill}`, skillText(name, skill) as SkillText),
  };
}

const asked: string[] = [];
beforeEach(() => {
  asked.length = 0;
  access.denied = null;
  gateway.get.mockReset();
  window.history.replaceState(null, '', '/plugins');
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    asked.push(String(input));
    return new Promise(() => {});
  }));
});
afterEach(() => vi.unstubAllGlobals());

const mount = (ui: ReactElement) => render(<Tooltip.Provider>{ui}</Tooltip.Provider>);

/** A server page's tree as Next hands it to the browser: every async component it places awaited where it stands. */
async function settled(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(settled));
  if (!isValidElement(node)) return node;
  const { type, props } = node as { type: unknown; props: Record<string, unknown> };
  if (typeof type === 'function' && type.constructor.name === 'AsyncFunction') return settled(await (type as (p: unknown) => Promise<ReactNode>)(props));
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) next[k] = isValidElement(v) || Array.isArray(v) ? await settled(v as ReactNode) : v;
  return cloneElement(node, next);
}
const text = () => document.body.textContent ?? '';

/** Every control a person can press or follow, by its accessible name: none of them may start an evaluation. */
function noEvaluationStarts() {
  const names = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')].map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '');
  for (const name of names) expect(name).not.toMatch(/evaluat|score (it|now)|re-?score|start|run (it|now)/i);
}

describe('Plugins, the list', () => {
  it('is the Records template: no tiles, then the table with its search in the filter bar', () => {
    mount(<PluginsView served={listOf(ME)} />);
    const records = document.querySelector('[data-template="records"]')!;
    expect(records).not.toBeNull();
    expect(records.querySelector('[data-split="tiles"]')).toBeNull();
    expect(within(records as HTMLElement).getByRole('searchbox')).toBeInTheDocument();
    expect(records.querySelector('[data-protagonist="Every plugin"] table')).not.toBeNull();
  });

  it('offers a Copy control for every plugin\'s install command, and nothing that starts an evaluation', () => {
    mount(<PluginsView served={listOf(ME)} />);
    for (const p of catalogOf(ME).plugins) expect(screen.getAllByRole('button', { name: `Copy the command that installs ${p.plugin}` }).length).toBeGreaterThan(0);
    noEvaluationStarts();
  });

  it('copies the command itself, and says so only once the clipboard took it', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mount(<PluginsView served={listOf(ME)} />);
    const sdlc = plugin(ME, 'sdlc');
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Copy the command that installs sdlc' })[0]); });
    expect(writeText).toHaveBeenCalledWith(sdlc.install);
    expect(screen.getAllByRole('button', { name: 'Copied' }).length).toBeGreaterThan(0);
  });

  it('reads nothing in the browser beside the server\'s read', async () => {
    mount(<PluginsView served={listOf(ME)} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(asked.filter((a) => a.includes('/api/console/plugins'))).toEqual([]);
  });

  it('narrows to the plugins whose name holds the search, from the address, and says when none does', () => {
    window.history.replaceState(null, '', '/plugins?plugin=zz-');
    const { unmount } = mount(<PluginsView served={listOf(ME)} />);
    const zz = catalogOf(ME).plugins.filter((p) => p.plugin.includes('zz-'));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(zz.length);
    expect(screen.getByText(`${zz.length} plugins`)).toBeInTheDocument();
    unmount();
    window.history.replaceState(null, '', '/plugins?plugin=nothing-like-it');
    mount(<PluginsView served={listOf(ME)} />);
    expect(screen.getByText('No plugins match these filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('says the catalog is empty when it holds no plugin', () => {
    mount(<PluginsView served={ok('/plugins', { plugins: [] })} />);
    expect(screen.getByText('No plugin in the catalog')).toBeInTheDocument();
    expect(screen.getByText('0 plugins')).toBeInTheDocument();
  });

  it('states a failed read in the gateway\'s words, with Retry that reads again in the browser', async () => {
    mount(<PluginsView served={failed('/plugins')} />);
    expect(screen.getByText('The plugins did not load')).toBeInTheDocument();
    expect(text()).toContain('the gateway could not reach its database');
    expect(text()).not.toContain('…');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(asked.some((a) => a.includes('/api/console/plugins'))).toBe(true));
  });

  it('says a read that took too long did, and never draws an endless skeleton', () => {
    mount(<PluginsView served={{ state: 'slow', path: '/plugins' }} />);
    expect(text()).toContain('The read did not answer within 4.5 seconds.');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('draws its loading state as the page it stands in for: the table and its filter bar, no tiles, naming nothing', () => {
    render(<PluginsLoading />);
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
    expect(document.querySelector('[data-split="tiles"]')).toBeNull();
    expect(text()).not.toContain('Plugins');
  });

  it('reads the catalog once, on the server, as the person, and draws it under the masthead', async () => {
    gateway.get.mockResolvedValue(catalogOf(ME));
    mount(<>{await settled(await PluginsPage())}</>);
    expect(document.querySelectorAll('tbody tr').length).toBe(catalogOf(ME).plugins.length);
    expect(gateway.get).toHaveBeenCalledTimes(1);
    expect(gateway.get).toHaveBeenCalledWith('/plugins');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Plugins');
  });

  it('reads nothing for a person the gate refuses', async () => {
    access.denied = <div data-missing-page="">No such page</div>;
    const tree = await PluginsPage();
    mount(<>{tree}</>);
    expect(document.querySelector('[data-missing-page]')).not.toBeNull();
    expect(gateway.get).not.toHaveBeenCalled();
  });
});

describe('a plugin\'s page', () => {
  const read = (who: Me, name: string, evaluation: EvalRead): PluginRead => ({ catalog: listOf(who), evaluation });

  it('draws its install command, its public score with the comparability statement as the gateway answered it, and its skills as your team\'s', () => {
    mount(<PluginView name="sdlc" served={read(ME, 'sdlc', evaluated('sdlc'))} />);
    const sdlc = plugin(ME, 'sdlc');
    expect(screen.getByLabelText('the command that installs sdlc')).toHaveTextContent(sdlc.install);
    expect(screen.getByRole('button', { name: 'Copy the command that installs sdlc' })).toBeInTheDocument();
    expect(document.querySelector('[data-comparability]')).toHaveTextContent(sdlc.comparability);
    expect(text()).toContain(`${sdlc.score!.value.toFixed(1)} / 10`);
    expect(text()).toContain(`${sdlc.score!.protocol.key} v${sdlc.score!.protocol.version}`);
    const table = screen.getByRole('table', { name: 'sdlc\'s skills' });
    expect([...table.querySelectorAll('th')].map((h) => h.textContent?.trim())).toEqual(['Skill', 'Whose', 'Versions', 'Your team\'s calls', 'Your team\'s last run']);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(sdlc.skills.length);
    expect(text()).toContain('Your team');
  });

  it('draws the owning team\'s evaluation where the gateway answered it', () => {
    mount(<PluginView name="sdlc" served={read(ME, 'sdlc', evaluated('sdlc'))} />);
    expect(screen.getByRole('region', { name: 'Its evaluation' })).toBeInTheDocument();
    expect(text()).toContain('Overall fit for purpose');
    expect(text()).toContain('sdlc-protocol');
    noEvaluationStarts();
  });

  it('draws nothing of it where the gateway withheld it: no heading, no empty state, no error, and the public score stands', () => {
    mount(<PluginView name="sdlc" served={read(MEMBER, 'sdlc', withheld('sdlc'))} />);
    expect(screen.queryByRole('region', { name: 'Its evaluation' })).toBeNull();
    expect(text()).not.toMatch(/Overall fit for purpose|did not load|not permitted|owning team/);
    expect(document.querySelector('[data-comparability]')).toHaveTextContent(plugin(MEMBER, 'sdlc').comparability);
    expect(text()).toContain('Its public score');
    noEvaluationStarts();
  });

  it('takes a 403 from the browser\'s own read as the same absence', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/eval')) return { ok: false, status: 403, json: async () => ({ error: 'not permitted' }) } as unknown as Response;
      return { ok: true, status: 200, json: async () => catalogOf(MEMBER) } as unknown as Response;
    }));
    mount(<PluginView name="sdlc" served={read(MEMBER, 'sdlc', failed('/plugins/sdlc/eval'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(text()).not.toContain('The evaluation did not load'));
    expect(screen.queryByRole('region', { name: 'Its evaluation' })).toBeNull();
  });

  it('says a plugin nothing scored was never scored, in the gateway\'s words', () => {
    mount(<PluginView name="research-kit" served={read(ME, 'research-kit', evaluated('research-kit'))} />);
    expect(text()).toContain('Never scored');
    expect(document.querySelector('[data-comparability]')).toHaveTextContent('No score to compare');
  });

  it('says an evaluation that failed failed, with Retry, and the rest of the page stands', () => {
    mount(<PluginView name="sdlc" served={read(ME, 'sdlc', failed('/plugins/sdlc/eval'))} />);
    expect(screen.getByText('The evaluation did not load')).toBeInTheDocument();
    expect(screen.getByText('About this plugin')).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('says the catalog did not load when it did not, never that the plugin is gone', () => {
    mount(<PluginView name="sdlc" served={{ catalog: failed('/plugins'), evaluation: evaluated('sdlc') }} />);
    expect(screen.getByText('The plugin did not load')).toBeInTheDocument();
    expect(text()).toContain('the gateway could not reach its database');
  });

  it('shows a third-party subject\'s evaluation with no manifest above it', () => {
    const subject: PluginEval = { ...pluginEval('zz-core'), plugin: 'outside-kit', origin: 'third_party', ownershipMode: 'evaluation_only' } as PluginEval;
    mount(<PluginView name="outside-kit" served={read(ME, 'outside-kit', ok('/plugins/outside-kit/eval', subject))} />);
    expect(text()).toContain('third-party subject');
    expect(text()).toContain('Overall fit for purpose');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('answers a name the catalog does not list and nothing registered as the missing page, reading as the person', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/plugins') return catalogOf(MEMBER);
      throw new GatewayError(403, 'not permitted');
    });
    const tree = await PluginPage({ params: Promise.resolve({ plugin: 'no-such-plugin' }) });
    mount(<>{tree}</>);
    expect(document.querySelector('[data-missing-page]')).not.toBeNull();
    expect(gateway.get).toHaveBeenCalledWith('/plugins/no-such-plugin/eval');
  });

  it('draws a listed plugin whose evaluation is withheld, its masthead the plugin\'s name', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/plugins') return catalogOf(MEMBER);
      throw new GatewayError(403, 'not permitted');
    });
    const tree = await PluginPage({ params: Promise.resolve({ plugin: 'sdlc' }) });
    mount(<>{tree}</>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('sdlc');
    expect(document.querySelector('[data-missing-page]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Its evaluation' })).toBeNull();
  });
});

describe('a skill\'s page', () => {
  it('draws the team\'s runs of it and what it is, on its runs view', () => {
    window.history.replaceState(null, '', '/plugins/sdlc/sdlc-spec');
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={skillRead(ME, 'sdlc', 'sdlc-spec')} />);
    expect(document.querySelector('[data-split="tiles"]')).not.toBeNull();
    expect(text()).toContain('About this skill');
    expect(text()).toContain('Calls by door');
    noEvaluationStarts();
  });

  it('draws its text on the view the address named, from the server\'s first paint', () => {
    window.history.replaceState(null, '', '/plugins/sdlc/sdlc-spec?view=read');
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="read" served={skillRead(ME, 'sdlc', 'sdlc-spec')} />);
    expect(text()).toContain('The skill');
    expect(text()).toContain('Read the approved document this stage starts from.');
    expect(document.querySelector('[data-split="tiles"]')).toBeNull();
  });

  it('says a skill the team never ran was never run, and still reads what it is', () => {
    window.history.replaceState(null, '', '/plugins/research-kit/research-scan');
    mount(<SkillView plugin="research-kit" skill="research-scan" view="cost" served={skillRead(ME, 'research-kit', 'research-scan')} />);
    expect(document.querySelector('[data-never-run]')).not.toBeNull();
    expect(text()).toContain('Never run by your team');
  });

  it('says a failed read failed, with Retry', () => {
    const read = { ...skillRead(ME, 'sdlc', 'sdlc-spec'), catalog: failed('/plugins') };
    mount(<SkillView plugin="sdlc" skill="sdlc-spec" view="cost" served={read} />);
    expect(screen.getByText('This skill could not be read')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('answers a skill its plugin does not ship as the missing page', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/plugins/sdlc/skills/')) throw new GatewayError(404, "plugin 'sdlc' ships no skill 'nope'");
      if (path === '/plugins') return catalogOf(ME);
      if (path.startsWith('/skills?')) return { skills: [] };
      return { skill: 'nope', surfaces: [], busiestTools: [] };
    });
    const tree = await SkillPage({ params: Promise.resolve({ plugin: 'sdlc', skill: 'nope' }), searchParams: Promise.resolve({}) });
    mount(<>{tree}</>);
    expect(document.querySelector('[data-missing-page]')).not.toBeNull();
  });
});
