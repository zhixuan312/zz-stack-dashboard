// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PluginRow, SearchAnswer, Skill, SkillDetail } from '@/lib/api-shapes';
import type { ActivityLog, ActivitySummary, KnowledgeList, KnowledgeSummary, Runs } from '@/lib/destination-shapes';
import type { People, Teams } from '@/lib/fleet-shapes';
import type { InitiativeList } from '@/lib/work-shapes';
import { contextText, type SharedContext } from '@/lib/shared-context';
import { activityContext } from '@/views/activity-context';
import { addressOf, pendingContext } from '@/views/context';
import { documentContext } from '@/views/document-context';
import { homeContext } from '@/views/home-context';
import { initiativeContext } from '@/views/initiative-context';
import { initiativesContext, nextOf } from '@/views/initiatives-context';
import { knowledgeContext } from '@/views/knowledge-context';
import { knowledgeLogContext } from '@/views/knowledge-log-context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';
import { peopleContext } from '@/views/people-context';
import { BUGS_DEFAULTS, bugContext, bugsContext } from '@/views/platform-bugs-context';
import { releaseContext, releasesContext } from '@/views/platform-releases-context';
import { platformStatusContext, statusRead } from '@/views/platform-status-context';
import { pluginContext } from '@/views/plugin-context';
import { pluginsContext } from '@/views/plugins-context';
import { skillContext } from '@/views/skill-context';
import { RUNS_DEFAULTS, runsContext } from '@/views/runs-context';
import { hitAddress, searchContext } from '@/views/search-context';
import { settingsContext } from '@/views/settings-context';
import { teamContext } from '@/views/team-context';
import { teamsContext } from '@/views/teams-context';
import { ME, MY_TEAMS, MY_TOKENS } from '../scripts/fake-gateway/people.ts';
import { bugReport, bugs, duplicates } from '../scripts/fake-gateway/platform-bugs.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { pluginEval, skillText } from '../scripts/fake-gateway/platform.ts';
import { search } from '../scripts/fake-gateway/search.ts';
import { extreme } from '../scripts/fake-gateway/states.ts';
import { INITIATIVES, KNOWLEDGE, KNOWLEDGE_LOG, documentDetail, initiativeDetail, knowledgeBody } from '../scripts/fake-gateway/work.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeList, knowledgeSummary } from '../scripts/fake-gateway/work-knowledge.ts';
import { plugins, skillDetail, skills } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';

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

const big = <T,>(seg: string[], body: T): T => extreme(seg, body) as T;
/** People as the fixture answers the superadmin: one page of ten, the tiles over everybody. */
const PEOPLE_PAGE = people(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as People;
/** Teams as the fixture answers the superadmin: one page of ten, the tiles over every team. */
const TEAMS_PAGE = teams(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as Teams;
/** The initiatives list the fake answers the superadmin for `query`. */
const listOf = (query = ''): InitiativeList => initiativeList(ME, new URLSearchParams(query))[1] as InitiativeList;
const ALL = { q: '', state: 'all', flow: 'all' };
/** The body of an answer the fake gave, without its status. */
const as = <T,>(answer: [number, unknown]): T => answer[1] as T;
const q = (query = '') => new URLSearchParams(query);
const SUMMARY = as<ActivitySummary>(activitySummary(ME));
const LOG = as<ActivityLog>(activityLog(ME, q()));
const SHELF = as<KnowledgeList>(knowledgeList(ME, q()));
const LEARNED = as<KnowledgeSummary>(knowledgeSummary(ME));
const RUNS = as<Runs>(runs(ME, q()));
const PLUGINS = as<{ plugins: PluginRow[] }>(plugins(ME)).plugins;
const SKILLS = as<{ skills: Skill[] }>(skills(ME, q('plugin=sdlc'))).skills;
const NO_FILTER = { kind: 'all', tool: 'all', initiative: 'all', refused: 'all' };

const LONG_NAME = '2026-10-01-a-name-somebody-typed-in-full-because-the-platform-keeps-what-it-is-given-and-never-renames-it';
/** A search answer at its worst for a budget: full-length excerpts whose match is at the very end, and long names. */
const longest = (a: SearchAnswer): SearchAnswer => ({
  ...a, query: 'review '.repeat(28).trim(),
  results: a.results.map((r) => ({ ...r, title: `${r.title} ${LONG_NAME}`, initiative: r.initiative && LONG_NAME, excerpt: `${'word '.repeat(118)}**review**` })),
});

const contexts: Record<string, () => SharedContext> = {
  teams: () => teamsContext(TEAMS_PAGE, { filters: { q: '', status: 'all', page: '1' }, ...arrival }),
  team: () => teamContext('atlas', { team: teamDetail('atlas')!, ...arrival }),
  releases: () => releasesContext(releases(10, 0), { filters: { page: '1' }, ...arrival }),
  release: () => releaseContext(releaseDetail('0.97.0')!, { asOf: arrival.now, ...arrival }),
  bugs: () => bugsContext(bugs(true, { state: null, impact: null, surface: null }, 10, 0), { filters: BUGS_DEFAULTS, ...arrival }),
  bug: () => bugContext(bugReport('0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01')!, duplicates('0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01'), arrival),
  initiatives: () => initiativesContext(listOf(), { filters: ALL, page: 1, ...arrival }),
  initiative: () => initiativeContext(initiativeDetail('atlas', '2026-09-28-search-relevance')!, arrival),
  document: () => documentContext(documentDetail('atlas', '2026-09-28-search-relevance', 'spec.md')!, arrival),
  knowledge: () => knowledgeContext({ summary: LEARNED, list: SHELF, filters: { q: '', kind: 'all' }, page: 1, ...arrival }),
  knowledge_node: () => knowledgeNodeContext(knowledgeBody(KNOWLEDGE[0].team, KNOWLEDGE[0].path)!, arrival),
  knowledge_log: () => knowledgeLogContext(KNOWLEDGE_LOG, { mode: 'platform', ...arrival }),
  search: () => searchContext(search('latency budget', 5, null), { ...arrival }),
  people: () => peopleContext(PEOPLE_PAGE, { filters: { q: '', state: 'all', page: '1' }, ...arrival }),
  plugins: () => pluginsContext(PLUGINS, arrival),
  plugin: () => pluginContext('sdlc', { plugin: PLUGINS.find((p) => p.plugin === 'sdlc'), evaluation: pluginEval('sdlc'), ...arrival }),
  skill: () => skillContext('sdlc', 'sdlc-spec', { plugin: PLUGINS.find((p) => p.plugin === 'sdlc'), skill: SKILLS.find((s) => s.name === 'sdlc-spec'), detail: as<SkillDetail>(skillDetail(ME, 'sdlc-spec')), text: skillText('sdlc', 'sdlc-spec') ?? undefined, ...arrival }),
  runs: () => runsContext(RUNS, { filters: RUNS_DEFAULTS, ...arrival }),
  activity: () => activityContext({ summary: SUMMARY, log: LOG, filters: NO_FILTER, page: 1, ...arrival }),
  settings: () => settingsContext({ me: ME, teams: MY_TEAMS, tokens: MY_TOKENS, mode: 'platform', ...arrival }),
};

const busy: Record<string, () => SharedContext> = {
  teams: () => teamsContext(big(['teams'], TEAMS_PAGE), { filters: { q: '', status: 'all', page: '1' }, ...arrival }),
  initiatives: () => initiativesContext(big(['initiatives'], listOf()), { filters: ALL, page: 1, ...arrival }),
  knowledge: () => knowledgeContext({ summary: big(['knowledge', 'summary'], LEARNED), list: big(['knowledge'], SHELF), filters: { q: '', kind: 'all' }, page: 1, ...arrival }),
  // The most the tool asks for, every excerpt at its 600 characters and every name as long as a name gets.
  search: () => searchContext(longest(search('review', 8, null)), { initiative: LONG_NAME, ...arrival }),
  people: () => peopleContext(big(['people'], PEOPLE_PAGE), { filters: { q: '', state: 'all', page: '1' }, ...arrival }),
  plugins: () => pluginsContext(big(['plugins'], { plugins: PLUGINS }).plugins, arrival),
  activity: () => activityContext({ summary: big(['activity', 'summary'], SUMMARY), log: big(['activity'], LOG), filters: NO_FILTER, page: 1, ...arrival }),
  runs: () => runsContext(big(['runs'], RUNS), { filters: RUNS_DEFAULTS, ...arrival }),
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

/**
 * Status says how fresh it is with the read's own cutoff ("As of …", `tests/platform-status.test.tsx`), not with the
 * console's freshness words, so it is held to the rest of the shape here rather than in the table above.
 */
describe('the platform\'s Status shares a context', () => {
  const status = () => platformStatusContext(statusRead(PLATFORM_STATUS));

  it('names itself as its tool does, its address and its scope, says its cutoff, and quotes the figure', () => {
    const c = status();
    expect(c.view).toBe('platform_status');
    expect(c.address).toBe('/platform');
    expect(c.scope).not.toBe('');
    expect(c.freshness).toMatch(/^As of /);
    expect(c.facts.map((f) => f.label)).toContain('Malformed calls per 1,000');
  });

  it('stays inside the budget', () => {
    expect(contextText(status()).length).toBeLessThanOrEqual(BUDGET);
  });
});

/**
 * Home says how fresh it is with the read's own cutoff, as Status does (`tests/home-context.test.ts` holds the rest), so
 * it is held to the shape here.
 */
describe('Home shares a context', () => {
  const home = () => homeContext({ state: 'ok', home: homeOf('atlas', ME.email), team: 'atlas' });

  it('names itself as its tool does, its address and its scope, says its cutoff, and quotes the title', () => {
    const c = home();
    expect(c).toMatchObject({ view: 'home', address: '/' });
    expect(c.scope).not.toBe('');
    expect(c.freshness).toMatch(/^As of /);
    expect(fact(c, 'Title')).toBe(homeOf('atlas', ME.email).title.sentence);
    for (const f of c.facts) expect(typeof f.value === 'string' && f.value !== '' && !/undefined|NaN|\[object/.test(f.value)).toBe(true);
  });

  it('stays inside the budget', () => {
    expect(contextText(home()).length).toBeLessThanOrEqual(BUDGET);
  });
});

describe('the figures a context quotes are the data\'s', () => {
  it('releases count what the read counted', () => {
    expect(fact(contexts.releases(), 'Releases')).toBe(String(releases(10, 0).tiles.releases));
    expect(fact(contexts.releases(), 'Migrations applied')).toBe(String(releases(10, 0).tiles.migrations.applied));
    expect(fact(contexts.release(), 'Console')).toBe(releaseDetail('0.97.0')!.consoleVersion);
  });

  it('teams and people count their rows', () => {
    expect(fact(contexts.teams(), 'Teams')).toBe(String(TEAMS_PAGE.tiles.teams));
    expect(fact(contexts.people(), 'People')).toBe(String(PEOPLE_PAGE.tiles.people));
    expect(fact(contexts.people(), 'With a passkey')).toBe(String(PEOPLE_PAGE.tiles.withPasskey));
  });

  it('initiatives count the whole list the gateway summarised, and say each row in view with its next move', () => {
    const list = listOf();
    const c = contexts.initiatives();
    expect(fact(c, 'Initiatives')).toBe(String(list.total));
    expect(fact(c, 'Open')).toBe(String(list.tiles.open));
    expect(fact(c, 'Waiting')).toBe(String(list.tiles.waiting));
    const text = contextText(c);
    for (const r of list.rows) expect(text).toContain(r.slug.slice(0, 40));
    expect(text).toContain(`next: ${nextOf(list.rows[0])}`);
    expect(text).not.toContain(`next: ${list.rows[0].nextMove!.action}`);
    // Ten rows in view of more than ten: the context says which page, never counts one page as the whole.
    expect(list.total).toBeGreaterThan(list.rows.length);
    expect(text).toContain(`Rows 1 to ${list.rows.length} of ${list.total}`);
  });

  it('a filter and a page are the server\'s: the context reads what the gateway answered for them, and they are in the address', () => {
    const quiet = listOf('state=quiet');
    const c = initiativesContext(quiet, { filters: { ...ALL, state: 'quiet' }, page: 1, ...arrival });
    expect(fact(c, 'Initiatives')).toBe(String(quiet.total));
    expect(c.address).toBe('/initiatives?state=quiet');
    expect(c.scope).toContain('state quiet');
    expect(initiativesContext(listOf('offset=10'), { filters: ALL, page: 2, ...arrival }).address).toBe('/initiatives?page=2');
  });

  it('a team reports its own tiles alone, and names none of its initiatives', () => {
    const detail = teamDetail('atlas')!;
    const c = contexts.team();
    expect(fact(c, 'Open work')).toBe(String(detail.tiles.openWork));
    expect(fact(c, 'Waiting')).toBe(String(detail.tiles.waiting));
    const text = contextText(c);
    for (const i of INITIATIVES.filter((x) => x.team === 'atlas')) expect(text).not.toContain(i.slug);
  });

  it('the knowledge shelf counts standing and superseded apart as the summary does, and a node carries its own lesson', () => {
    const c = contexts.knowledge();
    expect(fact(c, 'Lessons')).toBe(String(SHELF.total));
    expect(fact(c, 'Lessons adopted')).toBe(String(LEARNED.tiles.standing.value));
    expect(fact(c, 'Superseded')).toBe(String(LEARNED.tiles.superseded.value));
    expect(fact(c, 'Searches last week')).toBe(String(LEARNED.tiles.searches.figure.value));
    // The team's own question asked most, and the page in view of more than one page.
    const text = contextText(c);
    expect(text).toContain('"how do we rotate the signing key" 3×');
    expect(text).toContain(`Lessons 1 to ${SHELF.rows.length} of ${SHELF.total}`);
    const body = knowledgeBody(KNOWLEDGE[0].team, KNOWLEDGE[0].path)!;
    expect(contexts.knowledge_node().insights[0].text).toContain(body.body.trim().replace(/\s+/g, ' ').slice(0, 60));
  });

  it('a knowledge filter and page are the server\'s, and in the address', () => {
    const decisions = as<KnowledgeList>(knowledgeList(ME, q('kind=decision')));
    const c = knowledgeContext({ summary: LEARNED, list: decisions, filters: { q: '', kind: 'decision' }, page: 1, ...arrival });
    expect(fact(c, 'Lessons')).toBe(String(decisions.total));
    expect(c.address).toBe('/knowledge?kind=decision');
    expect(c.scope).toContain('kind decision');
  });

  it('activity counts each refusal once under one owner, and quotes the team\'s own messages alone', () => {
    const c = contexts.activity();
    expect(fact(c, 'Calls last week')).toBe(String(SUMMARY.tiles.calls.figure.value));
    expect(fact(c, 'Refused last week')).toBe(String(SUMMARY.tiles.refused.figure.value));
    expect(c.facts.find((f) => f.label === 'Refused last week')?.change).toBe('3 guardrail, 2 malformed, 1 tool failure, 1 other');
    expect(fact(c, 'Events')).toBe(String(LOG.total));
    const text = contextText(c);
    expect(text).toContain('No message recorded');
    // Another team's refusal sentences, and the platform's own maintenance, are never in atlas's context.
    expect(text).not.toMatch(/beacon|chargeback|reindex/);
    // The summary alone, as `view_activity` reads it, still says the week.
    const alone = activityContext({ summary: SUMMARY, ...arrival });
    expect(fact(alone, 'Refused last week')).toBe(fact(c, 'Refused last week'));
    expect(fact(alone, 'Events')).toBeUndefined();
  });

  it('runs, a skill and activity call bytes observed output, and never a payload, a context or a cost', () => {
    for (const c of [contexts.runs(), contexts.skill(), contexts.activity(), busy.runs()]) {
      expect(contextText(c)).not.toMatch(/payload|context|\bcost/i);
    }
    expect(contextText(contexts.runs())).toContain('Observed output per run');
    expect(fact(contexts.runs(), 'Runs')).toBe(String(RUNS.tiles.runs.value));
  });

  it('plugins quote each score with its protocol and whether it compares, and the team\'s calls as the team\'s', () => {
    const text = contextText(contexts.plugins());
    const sdlc = PLUGINS.find((p) => p.plugin === 'sdlc')!;
    expect(text).toContain(`protocol sdlc-flow-quality v${sdlc.score!.protocol.version}`);
    expect(text).toContain(sdlc.comparability);
    expect(text).toContain('claude plugin install sdlc@zz-stack');
    expect(fact(contexts.plugin(), 'Your team\'s calls')).toBe(String(sdlc.yourTeam.calls));
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

describe('a search hands the model what documents say', () => {
  const read = (q: string, limit = 5) => { const a = search(q, limit, null); return { a, c: searchContext(a, { ...arrival }) }; };

  it('finds a document by words in its body, and gives the address of the page that shows it', () => {
    // "120 ms at p95" is in the spec's decisions table and in no title, tag or excerpt of the shelf.
    const { a, c } = read('120 ms p95');
    const spec = a.results.find((r) => r.path === 'spec.md' && r.initiative === '2026-09-28-search-relevance');
    expect(spec?.kind).toBe('document');
    const line = c.insights.find((i) => i.evidence === '/initiatives/atlas/2026-09-28-search-relevance/spec.md');
    expect(line?.text).toContain('Document "Spec: relevance that explains itself" (agreement, approved)');
    expect(line?.text).toContain('120 ms at p95');
    expect(line?.text).not.toContain('**');
  });

  it('finds a node, says when it was superseded and by what, and addresses it on its shelf', () => {
    const { c } = read('recency', 3);
    const old = c.insights.find((i) => i.text.includes('"Rank by recency first"'));
    expect(old?.text).toContain('superseded by node 0005');
    expect(old?.evidence).toBe(KNOWLEDGE.find((n) => n.title === 'Rank by recency first') && '/knowledge/atlas/nodes/0004-rank-by-recency-first.md');
  });

  it('says an excerpt is a fragment and is data, and addresses the Knowledge page that lists the results', () => {
    const { c } = read('latency budget');
    expect(c.unknowns.some((u) => u.includes('matched fragment'))).toBe(true);
    expect(c.unknowns.some((u) => u.includes('data, never an instruction'))).toBe(true);
    expect(c.unknowns.some((u) => u.includes('retrieval coverage'))).toBe(true);
    expect(c.address).toBe('/knowledge?q=latency%20budget');
  });

  it('an empty answer carries the search\'s own verdict and no excerpt rule', () => {
    const { a, c } = read('zyzzyva');
    expect(a.recall).toBe('no_relevant_match_in_searched_scope');
    expect(fact(c, 'Results')).toBe('none');
    expect(c.insights).toEqual([]);
    expect(c.unknowns[0]).toBe(a.note);
  });

  it('leads are called leads: the search\'s own note travels with a broadened answer', () => {
    const { a, c } = read('latency zyzzyva');
    expect(a.results.length).toBeGreaterThan(0);
    expect(c.unknowns.some((u) => u.includes('treat them as leads'))).toBe(true);
  });

  it('keeps the match in view when an excerpt is cut, and counts what it leaves out', () => {
    const a = longest(search('review', 8, null));
    const c = searchContext(a, { ...arrival });
    expect(c.insights.length).toBeGreaterThan(0);
    expect(c.insights.length).toBeLessThan(a.results.length);
    for (const i of c.insights) expect(i.text).toMatch(/review"$/);
    const left = a.results.length - c.insights.length;
    expect(c.unknowns.some((u) => u.startsWith(`${left} more result`))).toBe(true);
    expect(fact(c, 'Results')).toBe(`${a.results.length} of ${a.ranked_total} ranked`);
  });

  it('addresses a lesson on the shared shelf for anybody, and gives a shared document no address', () => {
    const a = search('recency', 3, null);
    const node = { ...a.results.find((r) => r.kind === 'node')!, shelf: 'platform' as const, team: 'zz-platform' };
    const doc = { ...search('120 ms p95', 5, null).results.find((r) => r.kind === 'document')!, shelf: 'platform' as const, team: 'zz-platform' };
    expect(hitAddress(node)).toBe(`/knowledge/zz-platform/${node.path}`);
    expect(hitAddress(doc)).toBeUndefined();
    const c = searchContext({ ...a, results: [node, doc] }, { ...arrival });
    expect(c.insights[0].evidence).toBe(`/knowledge/zz-platform/${node.path}`);
    expect(c.insights[0].text).toContain("on the platform's shared shelf");
    expect(c.insights[1].evidence).toBeUndefined();
    expect(c.unknowns.some((u) => u.includes('has no page this console opens'))).toBe(true);
  });
});
