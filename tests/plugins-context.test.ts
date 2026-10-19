import { fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  requireNeed: async () => { if (!access.allowed) throw new Error('not permitted'); },
}));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { GatewayError } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import type { PluginRow } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { PluginsView } from '@/views/pages/plugins';
import { pluginContext } from '@/views/plugin-context';
import { NO_EVALUATION, pluginsContext, type Catalog, type PluginsRead } from '@/views/plugins-context';
import { skillContext } from '@/views/skill-context';
import { pluginTool } from '@/views/tools/plugin';
import { pluginsTool } from '@/views/tools/plugins';
import { justRead } from '@/views/tools/shared';
import { skillTool } from '@/views/tools/skill';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';

/**
 * What the page and the assistant are both told about Plugins, a plugin and a skill (Task I-111), from the responses
 * their pages read: the Ask in the list's filter bar; `view_plugins`, `view_plugin` and `view_skill` answering the
 * same responses through the pages' own contexts; the prepared queries over `/work/query` and `/platform/query`; and the
 * shared context, which carries the rows in view with each score's protocol, date and comparability, and says nobody
 * starts an evaluation from the console.
 */
const CATALOG = plugins(ME)[1] as Catalog;
const MEMBERS = plugins(MEMBER)[1] as Catalog;
const ASK = /^Ask: /;
const arrival = { updatedAt: '2026-10-17T09:00:00Z', now: '2026-10-17T09:01:00Z' };
const served: PluginsRead = { state: 'ok', path: '/plugins', at: arrival.updatedAt, data: CATALOG };
const row = (name: string, c: Catalog = CATALOG): PluginRow => c.plugins.find((p) => p.plugin === name)!;

function mount(surface: { ask?: (q: string) => void } = {}) {
  return render(createElement(SurfaceOverride, { surface } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, createElement(PluginsView, { served }))));
}

beforeEach(() => {
  gateway.get.mockReset();
  access.allowed = true;
  window.history.replaceState(null, '', '/plugins');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe('the Ask on the list', () => {
  it('sits in the list\'s filter bar with the assistant on, the page\'s one Ask, and is absent with it off', () => {
    const ask = vi.fn();
    const { unmount } = mount({ ask });
    const button = screen.getByRole('button', { name: ASK });
    expect(screen.getAllByRole('button', { name: ASK })).toHaveLength(1);
    // The filter bar is the band above the table, inside the table's card: the card's head, where the agent-side check looks.
    const card = button.closest('.card, section, header') as HTMLElement;
    expect(card.querySelector('input[type="search"]')).not.toBeNull();
    expect(card.closest('[data-protagonist="Every plugin"]')).not.toBeNull();
    expect(button).toHaveAccessibleName('Ask: What is each plugin for, how far can its score be trusted, and which should we install?');
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(ASK, ''));
    unmount();
    mount();
    expect(screen.queryAllByRole('button', { name: ASK })).toEqual([]);
  });

  it('asks about the list the search narrowed', () => {
    window.history.replaceState(null, '', '/plugins?plugin=zz-');
    mount({ ask: vi.fn() });
    expect(screen.getByRole('button', { name: ASK })).toHaveAccessibleName('Ask: What are the plugins in this list for, and which of them should we install?');
  });
});

describe('view_plugins', () => {
  it('answers the catalog its page reads, told through the page\'s context', async () => {
    gateway.get.mockResolvedValue(CATALOG);
    const { data, context } = await pluginsTool.read({});
    expect(gateway.get).toHaveBeenCalledWith('/plugins');
    expect(data).toEqual(CATALOG);
    expect(context).toEqual(pluginsContext(CATALOG.plugins, { filters: { plugin: '' }, ...justRead() }));
    expect(context.address).toBe('/plugins');
  });

  it('narrows to the plugins its one argument names, as the page\'s search does', async () => {
    gateway.get.mockResolvedValue(CATALOG);
    const { context } = await pluginsTool.read({ plugin: 'zz-' });
    expect(context.address).toBe('/plugins?plugin=zz-');
    const shown = CATALOG.plugins.filter((p) => p.plugin.includes('zz-'));
    expect(context.facts.find((f) => f.label === 'Plugins')!.value).toBe(String(shown.length));
    expect(contextText(context)).not.toContain('research-kit:');
  });

  it('takes spec version 8\'s one argument, is the plugins feature\'s at /plugins, and refuses where its page would', async () => {
    expect(Object.keys(pluginsTool.input.shape)).toEqual(['plugin']);
    // The assistant offers a tool's input as JSON Schema, so each of the three must have one.
    for (const t of [pluginsTool, pluginTool, skillTool]) expect(() => z.toJSONSchema(t.input), t.name).not.toThrow();
    expect(pluginsTool).toMatchObject({ name: 'plugins', title: 'Plugins', page: '/plugins', needs: FEATURES.plugins.needs });
    access.allowed = false;
    await expect(pluginsTool.read({})).rejects.toThrow('not permitted');
    expect(gateway.get).not.toHaveBeenCalled();
  });
});

describe('view_plugin and view_skill', () => {
  it('view_plugin answers the catalog\'s row and the evaluation its page reads, told through its context', async () => {
    gateway.get.mockImplementation(async (path: string) => (path === '/plugins' ? CATALOG : pluginEval('sdlc')));
    const { data, context } = await pluginTool.read({ plugin: 'sdlc' });
    expect(gateway.get).toHaveBeenCalledWith('/plugins/sdlc/eval');
    expect(data).toEqual({ plugin: row('sdlc'), evaluation: pluginEval('sdlc') });
    expect(context).toEqual(pluginContext('sdlc', { ...data, ...justRead() }));
    expect(Object.keys(pluginTool.input.shape)).toEqual(['plugin']);
  });

  it('view_plugin withholds the evaluation exactly where the gateway does, and says nothing of it', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/plugins') return MEMBERS;
      throw new GatewayError(403, 'not permitted');
    });
    const { data, context } = await pluginTool.read({ plugin: 'sdlc' });
    expect(data.evaluation).toBeNull();
    const text = contextText(context);
    expect(text).not.toMatch(/Evaluation score|evaluated on|not permitted|never been registered|could not be read/i);
    expect(text).toContain(row('sdlc', MEMBERS).comparability);
  });

  it('view_plugin lets any other failure through, as its page states one', async () => {
    gateway.get.mockImplementation(async (path: string) => {
      if (path === '/plugins') return CATALOG;
      throw new GatewayError(500, 'the gateway could not reach its database');
    });
    await expect(pluginTool.read({ plugin: 'sdlc' })).rejects.toThrow('the gateway could not reach its database');
  });

  it('view_skill answers the four reads its page makes, told through its context', async () => {
    const answers: Record<string, unknown> = {
      '/plugins': CATALOG,
      '/skills?plugin=sdlc': skills(ME, new URLSearchParams('plugin=sdlc'))[1],
      '/skills/sdlc-spec': skillDetail(ME, 'sdlc-spec')[1],
      '/plugins/sdlc/skills/sdlc-spec': skillText('sdlc', 'sdlc-spec'),
    };
    gateway.get.mockImplementation(async (path: string) => answers[path]);
    const { data, context } = await skillTool.read({ plugin: 'sdlc', skill: 'sdlc-spec' });
    expect(gateway.get.mock.calls.map(([p]) => p).sort()).toEqual(Object.keys(answers).sort());
    expect(context).toEqual(skillContext('sdlc', 'sdlc-spec', { ...data, ...justRead() }));
    expect(Object.keys(skillTool.input.shape)).toEqual(['plugin', 'skill']);
    for (const t of [pluginTool, skillTool]) expect(t.needs).toBe(FEATURES.plugins.needs);
  });
});

describe('the prepared queries', () => {
  it('explore_plugins declares skill_calls by plugin and by skill, over /work/query', () => {
    const sources = Object.values(pluginsTool.explore.sources);
    expect(sources.map((s) => s.collection)).toEqual(['skill_calls']);
    const [calls] = sources;
    expect(PREPARED.find((r) => r.name === calls.collection)?.route).toBe('work');
    expect(calls.facets).toEqual(expect.arrayContaining(['plugin', 'skill']));
  });

  it('explore_plugin holds every source to the plugin its page shows, and explore_skill to the skill', async () => {
    expect(Object.values(pluginTool.explore.sources).map((s) => s.collection)).toEqual(['skill_calls', 'findings', 'scores']);
    const plugin = await pluginTool.explore.fixed!({ plugin: 'sdlc' });
    for (const conditions of Object.values(plugin)) expect(conditions).toEqual([{ field: 'plugin', op: 'eq', value: 'sdlc' }]);
    const skill = await skillTool.explore.fixed!({ plugin: 'sdlc', skill: 'sdlc-spec' });
    expect(skill.skillCalls).toEqual([{ field: 'skill', op: 'eq', value: 'sdlc-spec' }, { field: 'plugin', op: 'eq', value: 'sdlc' }]);
    expect(skill.runs).toEqual([{ field: 'skill', op: 'eq', value: 'sdlc-spec' }]);
  });
});

describe('the shared context', () => {
  const list = (c: Catalog = CATALOG): SharedContext => pluginsContext(c.plugins, arrival);

  it('carries every row in view with its score\'s protocol, its date and its comparability, as the gateway answered them', () => {
    const text = contextText(list());
    for (const p of CATALOG.plugins) {
      expect(text).toContain(`${p.plugin}: ${p.required ? 'required' : 'optional'}`);
      expect(text).toContain(p.comparability);
      expect(text).toContain(p.install);
      if (p.score) expect(text).toContain(`protocol ${p.score.protocol.key} v${p.score.protocol.version}, ${formatDate(p.score.scoredAt)}`);
    }
  });

  it('gives a member each protocol\'s version alone, as the gateway sent it', () => {
    const text = contextText(list(MEMBERS));
    const sdlc = row('sdlc', MEMBERS).score!;
    expect(text).toContain(`version ${sdlc.protocol.version} of its protocol, ${formatDate(sdlc.scoredAt)}`);
    expect(text).not.toContain(row('sdlc').score!.protocol.key!);
  });

  it('labels the calls as the team\'s, and says nobody starts an evaluation from the console', () => {
    const c = list();
    expect(contextText(c)).toContain('Your team\'s own calls');
    expect(c.unknowns).toContain(NO_EVALUATION);
    expect(NO_EVALUATION).toMatch(/^Nobody starts an evaluation from the console/);
    expect(pluginContext('sdlc', { plugin: row('sdlc'), evaluation: pluginEval('sdlc'), ...arrival }).unknowns).toContain(NO_EVALUATION);
  });

  it('stays inside its budget on a busy platform, dropping the skills never run, then the team\'s calls, then the last rows', () => {
    const many: Catalog = { plugins: Array.from({ length: 40 }, (_, i) => ({ ...row('sdlc'), plugin: `plugin-${String(i).padStart(2, '0')}-with-a-long-name` })) };
    const c = list(many);
    expect(contextText(c).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(c.insights[0].text).toMatch(/^plugin-00-with-a-long-name: /);
    expect(contextText(c)).not.toContain('Skills your team never ran');
    expect(c.unknowns.at(-1)).toContain('/plugins shows all of it');
    // The figures are never dropped.
    expect(c.facts.find((f) => f.label === 'Plugins')!.value).toBe('40');
  });

  it('fits the fake\'s catalog whole, for both people', () => {
    for (const c of [list(), list(MEMBERS)]) {
      expect(contextText(c).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(c.unknowns.join(' ')).not.toContain('More is on the page');
    }
  });
});
