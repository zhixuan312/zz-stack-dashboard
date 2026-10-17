import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { createElement, Fragment, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ subs: new Set<() => void>() }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    push() {}, refresh() {}, back() {}, forward() {}, prefetch() {},
    replace(url: string) { window.history.replaceState(null, '', url); nav.subs.forEach((f) => f()); },
  }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  requireNeed: async () => { if (!access.allowed) throw new Error('not permitted'); },
}));

import { SurfaceOverride } from '@/components/base/surface';
import { BY_SKILL_TITLE } from '@/console/skill-work';
import { FEATURES } from '@/data/features';
import { PREPARED } from '@/data/prepared';
import type { Runs } from '@/lib/destination-shapes';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { RunsActions, RunsView } from '@/views/pages/runs';
import { RUNS_DEFAULTS, TILES, runsContext, runsPath, stateOf, type RunsRead } from '@/views/runs-context';
import { runsTool } from '@/views/tools/runs';
import { justRead } from '@/views/tools/shared';
import { ME } from '../scripts/fake-gateway/people.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

/**
 * What the page and the assistant are both told about Runs (Task I-110), from the one response its page reads: the
 * Ask on the runs by skill, `view_runs(skill, limit, offset)` answering the same `Runs` with the page's own context,
 * `explore_runs`' measures over `/work/query`, and the shared context, which carries the tiles, the skills in view, the
 * recent runs and what observed output does not measure.
 */
const answer = (path: string) => runs(ME, new URLSearchParams(path.split('?')[1]))[1] as Runs;
const PATH = runsPath(RUNS_DEFAULTS);
const ALL = answer(PATH);
const PLAN = runsPath({ skill: 'sdlc-plan', page: '1' });
const ASK = /^Ask: /;
const arrival = { updatedAt: '2026-10-17T09:00:00Z', now: '2026-10-17T09:01:00Z' };
const fact = (c: SharedContext, label: string) => c.facts.find((f) => f.label === label);
const ok = (data: Runs, path = PATH): RunsRead => ({ state: 'ok', path, data });

/** The page's control over its body, in the console's providers, with an assistant listening when `ask` is given. */
function mount(served: RunsRead, surface: { ask?: (q: string) => void } = {}) {
  const ui = createElement(Fragment, null, createElement(RunsActions, { served }), createElement(RunsView, { served }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(SurfaceOverride, { surface } as ComponentProps<typeof SurfaceOverride>, createElement(Tooltip.Provider, null, ui))));
}
const bySkillCard = () => screen.getByRole('heading', { name: BY_SKILL_TITLE }).closest('.card') as HTMLElement;

beforeEach(() => {
  gateway.get.mockReset();
  access.allowed = true;
  window.history.replaceState(null, '', '/runs');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe('the Ask on the runs by skill', () => {
  it('sits in the by-skill card\'s head with the assistant on, the page\'s one Ask, and is absent with it off', () => {
    const ask = vi.fn();
    const { unmount } = mount(ok(ALL), { ask });
    const card = bySkillCard();
    const button = within(card).getByRole('button', { name: ASK });
    // The frame the console's agent-side check finds for it is the card itself, and the button is in its head.
    expect(button.closest('.card, section, header')).toBe(card);
    expect(card.firstElementChild!.contains(button)).toBe(true);
    expect(card.closest(`[data-protagonist="${BY_SKILL_TITLE}"]`)).not.toBeNull();
    expect(screen.getAllByRole('button', { name: ASK })).toHaveLength(1);
    expect(button).toHaveAccessibleName('Ask: Which skill\'s runs answer the most observed output, and how long does a typical run of it take?');
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith(button.getAttribute('aria-label')!.replace(ASK, ''));
    unmount();
    mount(ok(ALL));
    expect(screen.queryAllByRole('button', { name: ASK })).toEqual([]);
  });

  it('asks about the skill the page is narrowed to', () => {
    window.history.replaceState(null, '', '/runs?skill=sdlc-plan');
    mount(ok(answer(PLAN), PLAN), { ask: vi.fn() });
    expect(within(bySkillCard()).getByRole('button', { name: ASK })).toHaveAccessibleName('Ask: What do the runs of sdlc-plan show, and what is their observed output?');
  });
});

describe('view_runs', () => {
  it('answers the same Runs its page reads, told through the same context', async () => {
    gateway.get.mockResolvedValue(ALL);
    const { data, context } = await runsTool.read({});
    expect(gateway.get).toHaveBeenCalledWith(PATH);
    expect(data).toEqual(ALL);
    expect(context).toEqual(runsContext(ALL, { filters: RUNS_DEFAULTS, read: { limit: 10, offset: 0 }, ...justRead() }));
    expect(context.address).toBe('/runs');
  });

  it('reads the skill and the recent runs its arguments name, at the page of ten the offset falls in', async () => {
    const plan = answer(runsPath({ skill: 'sdlc-plan', page: '2' }));
    gateway.get.mockResolvedValue(plan);
    const { context } = await runsTool.read({ skill: 'sdlc-plan', offset: 10 });
    expect(gateway.get).toHaveBeenCalledWith('/runs?skill=sdlc-plan&limit=10&offset=10');
    expect(context.address).toBe('/runs?skill=sdlc-plan&page=2');
    expect(context.scope).toContain('runs of sdlc-plan');
    // Rows off the page's grid are said to be so.
    gateway.get.mockResolvedValue(ALL);
    const off = await runsTool.read({ limit: 5, offset: 3 });
    expect(gateway.get).toHaveBeenLastCalledWith('/runs?limit=5&offset=3');
    expect(off.context.unknowns.join(' ')).toContain('does not show exactly these rows');
  });

  it('takes the skill, limit and offset, is the runs feature\'s at /runs, and refuses where its page would', async () => {
    expect(Object.keys(runsTool.input.shape)).toEqual(['skill', 'limit', 'offset']);
    expect(runsTool.input.safeParse({ limit: 101 }).success).toBe(false);
    expect(runsTool.input.safeParse({ offset: -1 }).success).toBe(false);
    expect(runsTool).toMatchObject({ name: 'runs', title: 'Runs', page: '/runs', needs: FEATURES.runs.needs });
    access.allowed = false;
    await expect(runsTool.read({})).rejects.toThrow('not permitted');
    expect(gateway.get).not.toHaveBeenCalled();
  });
});

describe('explore_runs', () => {
  it('declares the runs and their observed output, by skill, each over /work/query', () => {
    const sources = runsTool.explore.sources;
    expect(Object.keys(sources)).toEqual(['runs', 'output']);
    for (const s of Object.values(sources)) {
      expect(PREPARED.find((r) => r.name === s.collection)?.route, s.collection).toBe('work');
      expect(s.facets, s.collection).toContain('skill');
    }
  });
});

describe('the shared context', () => {
  it('carries the tiles, the skills in view and the recent runs, within its budget', () => {
    const c = runsContext(ALL, { filters: RUNS_DEFAULTS, ...arrival });
    expect(c).toMatchObject({ view: 'runs', title: 'Runs', address: '/runs' });
    expect(c.facts.map((f) => f.label)).toEqual([TILES.runs.label, TILES.outputPerRun.label, TILES.largest.label]);
    expect(fact(c, 'Runs')!.value).toBe(String(ALL.tiles.runs.value));
    expect(fact(c, TILES.outputPerRun.label)!.change).toBe(`${ALL.tiles.outputPerRun.unmeasured} not measured`);
    expect(fact(c, TILES.largest.label)!.value).toContain(ALL.tiles.largest!.skill);
    const text = contextText(c);
    const skills = ALL.bySkill.state === 'ok' ? ALL.bySkill.data.rows : [];
    expect(text).toContain(`By skill, the most observed output per run first: ${skills[0].skill}`);
    const recent = ALL.recent.state === 'ok' ? ALL.recent.data : null;
    expect(text).toContain(`rows 1 to 10 of ${recent!.total}`);
    expect(text).toContain(stateOf(recent!.rows[0]).toLowerCase());
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('says what observed output does not measure, and which part could not be read', () => {
    const c = runsContext(ALL, { filters: RUNS_DEFAULTS, ...arrival });
    expect(c.unknowns).toContain('Observed output is the bytes a run\'s calls answered: it is not what a model read, and not anything paid for.');
    expect(c.unknowns.join(' ')).toContain('unknown, not zero');
    const gone = runsContext({ ...ALL, bySkill: { state: 'unavailable', reason: 'query_failed' }, recent: { state: 'unavailable', reason: 'query_failed' } }, { filters: RUNS_DEFAULTS, ...arrival });
    expect(gone.unknowns).toEqual(expect.arrayContaining(['The runs by skill could not be read: query_failed', 'The recent runs could not be read: query_failed']));
  });

  it('narrows its scope and address to the skill chosen', () => {
    const c = runsContext(answer(PLAN), { filters: { skill: 'sdlc-plan', page: '1' }, ...arrival });
    expect(c.address).toBe('/runs?skill=sdlc-plan');
    expect(c.scope).toContain('runs of sdlc-plan');
  });
});
