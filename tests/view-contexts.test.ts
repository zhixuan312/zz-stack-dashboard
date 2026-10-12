// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { waitingOnYou } from '@/console/initiative-state';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { activityContext } from '@/views/activity-context';
import { addressOf, pendingContext } from '@/views/context';
import { documentContext } from '@/views/document-context';
import { initiativeContext } from '@/views/initiative-context';
import { initiativesContext } from '@/views/initiatives-context';
import { knowledgeContext } from '@/views/knowledge-context';
import { knowledgeLogContext } from '@/views/knowledge-log-context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';
import { overviewContext } from '@/views/overview-context';
import { peopleContext } from '@/views/people-context';
import { pluginContext } from '@/views/plugin-context';
import { pluginsContext } from '@/views/plugins-context';
import { skillContext } from '@/views/skill-context';
import { runsContext } from '@/views/runs-context';
import { settingsContext } from '@/views/settings-context';
import { teamContext } from '@/views/team-context';
import { teamsContext } from '@/views/teams-context';
import { ME, MY_TEAMS, MY_TOKENS, PEOPLE, TEAMS, teamDetail } from '../scripts/fake-gateway/people.ts';
import { ACTIVITY, PLUGINS, SKILLS, overview, pluginEval, runs, skillDetail, skillText } from '../scripts/fake-gateway/platform.ts';
import { extreme } from '../scripts/fake-gateway/states.ts';
import { INITIATIVES, KNOWLEDGE, KNOWLEDGE_LOG, documentDetail, initiativeDetail, knowledgeBody } from '../scripts/fake-gateway/work.ts';

/**
 * What every view tells the assistant is the data's (decision 0011): each context is built from the fake gateway's own
 * fixtures, the ones `pnpm verify` serves the pages, and its figures are checked against those rows. A context whose
 * number disagreed with its page would have the assistant quote a figure the person cannot find on the screen.
 *
 * Every context is also held to its budget. A view's context is the whole state every turn, so it may not grow with
 * the data: lists are cut and counted, and the text the model reads stays inside Meridian's 2,400 characters whatever
 * the platform holds. `extreme` is the fake gateway's busy platform: hundreds of rows and names longer than any layout
 * planned for.
 */
const BUDGET = 2400;
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const fact = (c: SharedContext, label: string) => c.facts.find((f) => f.label === label)?.value;
const NO = { q: '', team: 'all' } as const;

const big = <T,>(seg: string[], body: T): T => extreme(seg, body) as T;

const contexts: Record<string, () => SharedContext> = {
  overview: () => overviewContext(overview('30d'), { period: '30d', mode: 'platform', ...arrival }),
  teams: () => teamsContext(TEAMS, { filters: { q: '', status: 'all' }, ...arrival }),
  team: () => teamContext('atlas', { team: teamDetail('atlas')!, initiatives: INITIATIVES.filter((i) => i.team === 'atlas'), held: TEAMS.find((t) => t.slug === 'atlas'), ...arrival }),
  initiatives: () => initiativesContext(INITIATIVES, { filters: { ...NO, flow: 'all', state: 'all', show: 'all' }, period: 'all', mode: 'platform', ...arrival }),
  initiative: () => initiativeContext(initiativeDetail('atlas', '2026-09-28-search-relevance')!, arrival),
  document: () => documentContext(documentDetail('atlas', '2026-09-28-search-relevance', 'spec.md')!, arrival),
  knowledge: () => knowledgeContext(KNOWLEDGE, { filters: { ...NO, tag: 'all' }, mode: 'platform', ...arrival }),
  knowledge_node: () => knowledgeNodeContext(knowledgeBody(KNOWLEDGE[0].team, KNOWLEDGE[0].path)!, arrival),
  knowledge_log: () => knowledgeLogContext(KNOWLEDGE_LOG, { mode: 'platform', ...arrival }),
  people: () => peopleContext(PEOPLE, { filters: NO, mode: 'platform', ...arrival }),
  plugins: () => pluginsContext(PLUGINS, arrival),
  plugin: () => pluginContext('sdlc', { plugin: PLUGINS.find((p) => p.plugin === 'sdlc'), evaluation: pluginEval('sdlc'), ...arrival }),
  skill: () => skillContext('sdlc', 'sdlc-spec', { plugin: PLUGINS.find((p) => p.plugin === 'sdlc'), skill: SKILLS.find((s) => s.name === 'sdlc-spec'), detail: skillDetail('sdlc-spec') ?? undefined, text: skillText('sdlc', 'sdlc-spec') ?? undefined, ...arrival }),
  runs: () => runsContext({ totals: runs('all').totals, skills: SKILLS, period: 'all', ...arrival }),
  activity: () => activityContext(ACTIVITY, { show: 'all', limit: 200, mode: 'platform', ...arrival }),
  settings: () => settingsContext({ me: ME, teams: MY_TEAMS, tokens: MY_TOKENS, mode: 'platform', ...arrival }),
};

const busy: Record<string, () => SharedContext> = {
  overview: () => overviewContext(big(['overview'], overview('all')), { period: 'all', mode: 'platform', ...arrival }),
  teams: () => teamsContext(big(['teams'], { teams: TEAMS }).teams, { filters: { q: '', status: 'all' }, ...arrival }),
  initiatives: () => initiativesContext(big(['initiatives'], { initiatives: INITIATIVES }).initiatives, { filters: { ...NO, flow: 'all', state: 'all', show: 'all' }, period: 'all', mode: 'platform', ...arrival }),
  knowledge: () => knowledgeContext(big(['knowledge'], { nodes: KNOWLEDGE }).nodes, { filters: { ...NO, tag: 'all' }, mode: 'platform', ...arrival }),
  people: () => peopleContext(big(['people'], { people: PEOPLE }).people, { filters: NO, mode: 'platform', ...arrival }),
  plugins: () => pluginsContext(big(['plugins'], { plugins: PLUGINS }).plugins, arrival),
  activity: () => activityContext(big(['activity'], { events: ACTIVITY, limit: 200 }).events, { show: 'all', limit: 200, mode: 'platform', ...arrival }),
  runs: () => runsContext({ totals: big(['runs'], runs('all')).totals, skills: big(['skills'], { skills: SKILLS }).skills, period: 'all', ...arrival }),
};

describe('every view shares a context', () => {
  it.each(Object.keys(contexts))('%s names itself, its address, its scope and how fresh it is', (name) => {
    const c = contexts[name]();
    expect(c.view).toBe(name);
    expect(c.address.startsWith('/')).toBe(true);
    expect(c.scope).not.toBe('');
    expect(c.freshness).toContain('fresh');
    expect(c.facts.length).toBeGreaterThan(0);
    // A figure with no unit or definition is a number the model has to guess the meaning of; every fact is a string
    // the screen could show, never `undefined` or a raw object.
    for (const f of c.facts) expect(typeof f.value === 'string' && f.value !== '' && !/undefined|NaN|\[object/.test(f.value)).toBe(true);
    for (const line of [...c.insights.map((i) => i.text), ...c.unknowns]) expect(line).not.toMatch(/undefined|NaN|\[object/);
  });

  it.each(Object.keys(contexts))('%s stays inside the budget', (name) => {
    expect(contextText(contexts[name]()).length).toBeLessThanOrEqual(BUDGET);
  });

  it.each(Object.keys(busy))('%s stays inside the budget on a busy platform', (name) => {
    expect(contextText(busy[name]()).length).toBeLessThanOrEqual(BUDGET);
  });
});

describe('the figures a context quotes are the data\'s', () => {
  it('the overview counts every call in the trend, and its refusal insight names the tool the panel leads with', () => {
    const d = overview('30d');
    const calls = d.toolTrend.reduce((a, b) => a + b.inside + b.outside + b.refused, 0);
    const c = contexts.overview();
    expect(fact(c, 'Tool calls')).toBe(`${calls.toLocaleString('en-US')} calls`);
    expect(c.insights.some((i) => i.text.includes(d.refusals.byTool[0].tool))).toBe(true);
    expect(c.address).toBe('/?period=30d');
  });

  it('the overview says which bucket the chart points at, with that bucket\'s own split', () => {
    const d = overview('30d');
    const at = d.toolTrend[5];
    const total = at.inside + at.outside + at.refused;
    const pointed = overviewContext(d, { period: '30d', mode: 'platform', index: 5, ...arrival });
    expect(pointed.focus).toContain(`${total.toLocaleString('en-US')} calls`);
    expect(pointed.focus).toContain(`${at.refused.toLocaleString('en-US')} refused`);
    expect(contextText(pointed)).toContain('The person is pointing at: the day of');
    expect(contexts.overview().focus).toBeUndefined();
    expect(contextText(pointed).length).toBeLessThanOrEqual(BUDGET);
  });

  it('teams and people count their rows', () => {
    expect(fact(contexts.teams(), 'Teams')).toBe(String(TEAMS.length));
    expect(fact(contexts.people(), 'People')).toBe(String(PEOPLE.length));
    expect(fact(contexts.people(), 'Live tokens')).toBe(String(PEOPLE.reduce((a, p) => a + p.tokens, 0)));
  });

  it('initiatives count what waits on a person by the rule the State column and the filter use', () => {
    const c = contexts.initiatives();
    expect(fact(c, 'Waiting on you')).toBe(String(INITIATIVES.filter(waitingOnYou).length));
    expect(fact(c, 'Open')).toBe(String(INITIATIVES.filter((i) => !i.closed).length));
  });

  it('a filter narrows the context exactly as it narrows the page, and is in the address', () => {
    const c = initiativesContext(INITIATIVES, { filters: { q: '', team: 'beacon', flow: 'all', state: 'all', show: 'all' }, period: 'all', mode: 'platform', ...arrival });
    const beacon = INITIATIVES.filter((i) => i.team === 'beacon').length;
    expect(fact(c, 'Initiatives')).toBe(`${beacon} of ${INITIATIVES.length}`);
    expect(c.address).toBe('/initiatives?team=beacon');
    expect(c.scope).toContain('team beacon');
  });

  it('the knowledge shelf counts adopted and superseded apart, and a node carries its own lesson', () => {
    const c = contexts.knowledge();
    expect(fact(c, 'Adopted')).toBe(String(KNOWLEDGE.filter((n) => n.status === 'adopted').length));
    expect(fact(c, 'Superseded')).toBe(String(KNOWLEDGE.filter((n) => n.status === 'superseded').length));
    const body = knowledgeBody(KNOWLEDGE[0].team, KNOWLEDGE[0].path)!;
    expect(contexts.knowledge_node().insights[0].text).toContain(body.body.trim().replace(/\s+/g, ' ').slice(0, 60));
  });

  it('activity says its counts are of the latest events only, once the list is full', () => {
    const full = activityContext(ACTIVITY.slice(0, 50), { show: 'all', limit: 50, mode: 'platform', ...arrival });
    expect(full.unknowns.some((u) => u.includes('Only the latest 50'))).toBe(true);
    expect(fact(full, 'Refused')).toBe(String(ACTIVITY.slice(0, 50).filter((e) => e.ok === false).length));
  });

  it('settings names the person and never a token\'s value', () => {
    const text = contextText(contexts.settings());
    expect(text).toContain(ME.email);
    // The live ones by label; a revoked token is not one the person can still use.
    for (const t of MY_TOKENS.filter((x) => !x.revoked_at)) expect(text).toContain(t.label);
    expect(text).not.toMatch(/zz_pat_|zzp_/);
  });
});

describe('a view with nothing to say yet', () => {
  it('says the data has not arrived, or why it could not be read, and quotes no figure', () => {
    const view = { view: 'teams', title: 'Teams', address: '/teams', scope: 'every team on the platform' };
    expect(pendingContext(view).facts).toEqual([]);
    expect(pendingContext(view).unknowns[0]).toContain('has not arrived');
    expect(pendingContext(view, 'the gateway could not reach its database').unknowns[0]).toContain('could not be read: the gateway could not reach its database');
  });

  it('an address leaves out every parameter still at its default', () => {
    expect(addressOf('/initiatives', { period: 'all', team: 'all', q: '' }, { period: 'all', team: 'all' })).toBe('/initiatives');
    expect(addressOf('/initiatives', { period: '7d', q: 'search relevance' }, { period: 'all' })).toBe('/initiatives?period=7d&q=search%20relevance');
  });
});
