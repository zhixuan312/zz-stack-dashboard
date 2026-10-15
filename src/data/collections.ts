/**
 * The records the assistant looks up: one collection per list the console shows, each read from the same gateway route
 * its page reads (`src/data/gateway.ts`), as the person asking.
 *
 * A row here is the gateway's row made flat: every field is a string, a number, a boolean or nothing, because a query
 * compares scalars. A list a page shows as chips (tags, teams, stages) is one comma-separated string, so `contains`
 * finds a member of it. Nothing is computed that a page does not show, and every count keeps the meaning its page
 * gives it.
 *
 * What the assistant may change: nothing. Every change this console makes is made on a page, by the person, so the
 * operations that exist at all are declared with `onPage` (`src/data/gateway-collection.ts`).
 */
import { z } from 'zod';
import { gatewayCollection, routeCollection } from '@/data/gateway-collection';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeLogEntry, MyAccessToken, Person, PluginRow, Skill, Team } from '@/lib/api-shapes';
import type { AnyCollection } from '@/lib/collection';
import type { ActivityLog, KnowledgeList, KnowledgeRow, RefusalOwner } from '@/lib/destination-shapes';
import type { InitiativeList } from '@/lib/work-shapes';
import { NO_FILTER, activityPath } from '@/views/activity-context';
import { LIST_STATES, listPath } from '@/views/initiatives-filter';
import { knowledgePath } from '@/views/knowledge-context';

/** The data's clock. The console reads a live deployment, so it is the wall clock. */
export const clock = (): Date => new Date();

const text = z.string();
const maybeText = z.string().nullable();
const count = z.number();
const maybeCount = z.number().nullable();
const when = (what: string) => z.string().describe(`${what}, as an ISO 8601 instant in UTC.`);
const maybeWhen = (what: string) => z.string().nullable().describe(`${what}, as an ISO 8601 instant in UTC; nothing when it never happened.`);
const joined = (items: readonly string[] | null | undefined) => (items?.length ? items.join(', ') : null);

/** An interface as a plain record, which is what a collection's row is: an interface has no index signature of its own. */
type Flat<T> = { [K in keyof T]: T[K] };

/** Where every change to people, teams and tokens is made. */
const SETTINGS = { ops: ['create' as const, 'remove' as const], where: 'the Settings page' };

const teams = gatewayCollection<Flat<Team>, 'slug'>({
  name: 'teams',
  label: 'Teams',
  description: 'Every team on the platform, with what it holds. The key is the team\'s slug. A team is added or archived on the Settings page.',
  key: 'slug',
  title: (t) => t.slug,
  fields: z.object({
    name: text, status: z.enum(['active', 'archived']), created: when('When the team was created'),
    members: count.describe('People in the team.'), initiatives: count, documents: count.describe('Written documents, sources not counted.'),
    sources: count, knowledge: count.describe('Knowledge nodes on the team\'s shelf.'),
  }),
  // The gateway pages the list at 10 rows unless asked; a query counts over every team, so it asks for all of them. A
  // row also carries the team's figures by week, which are not scalars, so it is cut to the fields above.
  load: async () => (await gatewayGet<{ teams: Team[] }>('/teams?limit=100')).teams.map((t) => ({
    slug: t.slug, name: t.name, status: t.status, created: t.created,
    members: t.members, initiatives: t.initiatives, documents: t.documents, sources: t.sources, knowledge: t.knowledge,
  })),
  onPage: SETTINGS,
});

type InitiativeRow = {
  slug: string; flow: string | null; state: string; next: string | null; nextDocument: string | null; waitingOn: string | null;
  why: string | null; gatesPassed: number; gates: number; lastTouched: string; opened: string; closed: string | null;
};

/* The active team's work, read a page at a time from the route that filters it: its state, its flow and text in its
 * slug are the route's parameters, and its total is the route's, so a count is never of one page. */
const initiatives = routeCollection<InitiativeRow, 'slug'>({
  name: 'initiatives',
  label: 'Initiatives',
  description: 'The active team\'s work, open or closed, and where each goes next, as zz-core\'s next_move says. The key is the slug, and /initiatives/<team>/<slug> opens it with the active team\'s slug. The gateway filters and pages it: filter by state eq, flow eq and slug contains, page with limit, and read total for how many match.',
  key: 'slug',
  title: (i) => i.slug,
  fields: z.object({
    flow: maybeText.describe('The flow it runs, such as sdlc-flow; nothing when it declares none.'),
    state: z.enum(LIST_STATES).describe('waiting: a revision presented and not yet approved. quiet: open, and nothing of it written for 14 days or more.'),
    next: maybeText.describe('zz-core\'s next_move action, as initiative_status answers it: write_document, await_approval, add_source, decide, fix, run_experiment, run_stage, resolve_branch, close, closed, or none for an open initiative with no flow; nothing when zz-core did not answer.'),
    nextDocument: maybeText.describe('The document the next move is about.'), waitingOn: maybeText.describe('Who the next move waits on, as zz-core says it: stakeholder (a person), agent, or nobody.'),
    why: maybeText.describe('zz-core\'s reason for the next move.'),
    gatesPassed: count.describe('Gates approved, the handover left out.'), gates: count.describe('Gated documents the flow declares, the handover left out.'),
    lastTouched: when('When anything of it was last written'), opened: when('When it was opened'), closed: maybeWhen('When it was closed'),
  }),
  conditions: { state: { op: 'eq', param: 'state' }, flow: { op: 'eq', param: 'flow' }, slug: { op: 'contains', param: 'q' } },
  read: async ({ state = 'all', flow = 'all', q = '' }, page) => {
    const list = await gatewayGet<InitiativeList>(listPath({ state, flow, q }, page));
    return {
      total: list.total,
      rows: list.rows.map((i) => ({
        slug: i.slug, flow: i.flow, state: i.state, next: i.nextMove?.action ?? null, nextDocument: i.nextMove?.document ?? null,
        waitingOn: i.nextMove?.waitingOn ?? null, why: i.nextMove?.why ?? null, gatesPassed: i.gates.passed, gates: i.gates.of,
        lastTouched: i.lastTouched, opened: i.opened, closed: i.closed,
      })),
    };
  },
});

type KnowledgeCollectionRow = Omit<KnowledgeRow, 'tags' | 'evidence'> & { tags: string | null; evidence: string | null };

/* The active team's shelf, read a page at a time from the route that filters it: text in a lesson's title, tags or text
 * and its kind are the route's parameters, and its total is the route's, so a count is never of one page. */
const knowledge = routeCollection<KnowledgeCollectionRow, 'key'>({
  name: 'knowledge',
  label: 'Knowledge',
  description: 'The lessons on the active team\'s shelf: what its earlier initiatives settled. The key is "<team>/<path>", and /knowledge/<team>/<path> opens a lesson with its full text. The gateway filters and pages it: title contains finds the text in a lesson\'s title, tags or text, type eq narrows to one kind (decision, design, process, knowledge, behavior or style); page with limit, and read total for how many match. The platform\'s shared shelf is not here: view_search reads it beside the team\'s.',
  key: 'key',
  title: (n) => n.title,
  fields: z.object({
    num: text.describe('The lesson\'s number within its own team; two teams both have a lesson 1.'), team: text, path: text,
    type: text.describe('Its kind.'), status: text.describe('adopted, or superseded once a later lesson replaced it.'), title: text,
    tags: maybeText.describe('The lesson\'s subjects, comma-separated.'), updated: when('When the lesson last changed'),
    bytes: count, excerpt: text.describe('The opening of the lesson\'s text.'),
    evidence: maybeText.describe('The initiatives the lesson came out of, comma-separated.'),
    superseded_by: maybeText.describe('The lesson that replaced this one.'),
  }),
  conditions: { title: { op: 'contains', param: 'q' }, type: { op: 'eq', param: 'kind' } },
  read: async ({ q = '', kind = 'all' }, page) => {
    const list = await gatewayGet<KnowledgeList>(knowledgePath({ q, kind }, page));
    return { total: list.total, rows: list.rows.map((n) => ({ ...n, tags: joined(n.tags), evidence: joined(n.evidence) })) };
  },
});

type KnowledgeLogRow = Flat<KnowledgeLogEntry> & { id: string };

const knowledgeLog = gatewayCollection<KnowledgeLogRow, 'id'>({
  name: 'knowledge_log',
  label: 'Knowledge log',
  description: 'Every node added to the shelf and every node superseded, as the knowledge base logged it.',
  key: 'id',
  title: (e) => e.node_title ?? e.recorded_title ?? e.node,
  fields: z.object({
    ts: when('When it was logged'), actor: text, team: maybeText, kind: z.enum(['knowledge.add', 'knowledge.supersede']), node: text,
    recorded_title: maybeText.describe('The title as typed at the time.'), superseded_by: maybeText,
    node_title: maybeText.describe('The node\'s title today; nothing when it is no longer on the shelf.'), node_status: maybeText,
  }),
  load: async () => (await gatewayGet<{ entries: KnowledgeLogEntry[] }>('/knowledge/log')).entries.map((e, i) => ({ ...e, id: `${e.ts}#${i}` })),
});

type PersonRow = Omit<Person, 'teams'> & { teams: string | null };

const people = gatewayCollection<PersonRow, 'email'>({
  name: 'people',
  label: 'People',
  description: 'Everyone on the platform. Tokens are counted, never shown. A person is added or deactivated on the Settings page.',
  key: 'email',
  title: (p) => p.name || p.email,
  fields: z.object({
    name: text, role: z.enum(['superadmin', 'member']), status: text.describe('active, or deactivated.'), created: when('When they were added'),
    activeTeam: maybeText.describe('The team they act for.'), teams: maybeText.describe('Their memberships as "<team> (<role>)", comma-separated.'),
    tokens: count.describe('Live platform tokens they hold.'), last_used: maybeWhen('When one of their tokens last made a platform call'),
  }),
  load: async () => (await gatewayGet<{ people: Person[] }>('/people?limit=100')).people.map((p) => ({ ...p, teams: joined(p.teams) })),
  onPage: SETTINGS,
});

type PluginCollectionRow = {
  plugin: string; owner: string | null; description: string | null; version: string | null; servers: string | null; stages: string | null;
  gates: number; skills: number; releasedVersion: string | null; required: boolean; install: string;
  score: number | null; scoreLower: number | null; scoreUpper: number | null; standing: string | null; protocolKey: string | null; protocolVersion: number | null;
  scoredAt: string | null; comparability: string; teamCalls: number; teamFailed: number; teamLastRun: string | null;
};

const plugins = gatewayCollection<PluginCollectionRow, 'plugin'>({
  name: 'plugins',
  label: 'Plugins',
  description: 'Every plugin in the catalog: a package\'s skills and the MCP servers they call, under one declared version, whether every client installs it, the command that does, and its latest public score. The calls are the active team\'s own; the catalog and the scores are the platform\'s. /plugins/<plugin> opens one. Nobody starts an evaluation from the console.',
  key: 'plugin',
  title: (p) => p.plugin,
  fields: z.object({
    owner: maybeText, description: maybeText, version: maybeText.describe('The version the plugin declares.'),
    servers: maybeText.describe('The MCP servers its skills reach, comma-separated.'), stages: maybeText.describe('Its method\'s stages in running order, comma-separated; nothing for a toolbox.'),
    gates: count.describe('Documents a person must approve.'), skills: count, releasedVersion: maybeText.describe('The version a release vouched for; nothing when none has.'),
    required: z.boolean().describe('Every client installs it: zz-core and the shelved catalog entries.'), install: text.describe('The command that installs it.'),
    score: maybeCount.describe('Its latest public score, 0 to 10; nothing when it was never scored or the score is not established.'),
    scoreLower: maybeCount, scoreUpper: maybeCount, standing: maybeText.describe('established, provisional or not_established.'),
    protocolKey: maybeText.describe('The protocol it was scored against; nothing unless the person is a superadmin.'), protocolVersion: maybeCount.describe('That protocol\'s version.'),
    scoredAt: maybeWhen('When it was scored'), comparability: text.describe('Whether its scores compare: one protocol version and one population, or not.'),
    teamCalls: count.describe('The active team\'s tool calls across its skills, all time.'), teamFailed: count.describe('Of those, refused.'),
    teamLastRun: maybeWhen('The active team\'s most recent call of it'),
  }),
  load: async () => (await gatewayGet<{ plugins: PluginRow[] }>('/plugins')).plugins.map((p) => ({
    plugin: p.plugin, owner: p.owner, description: p.description, version: p.version, servers: joined(p.servers), stages: joined(p.stages),
    gates: p.gates, skills: p.skills.length, releasedVersion: p.release?.version ?? null, required: p.required, install: p.install,
    score: p.score && p.score.standing !== 'not_established' ? p.score.value : null, scoreLower: p.score?.lower ?? null, scoreUpper: p.score?.upper ?? null,
    standing: p.score?.standing ?? null, protocolKey: p.score?.protocol.key ?? null, protocolVersion: p.score?.protocol.version ?? null,
    scoredAt: p.score?.scoredAt ?? null, comparability: p.comparability,
    teamCalls: p.yourTeam.calls, teamFailed: p.yourTeam.failed, teamLastRun: p.yourTeam.lastRun,
  })),
});

type SkillRow = Omit<Skill, 'logged'> & { plugin: string | null };

/* The active team's runs of each skill, from the route that narrows them to one plugin's. The route answers every skill
 * the team ran, unpaged, so its total is the count of what it answered and a page is taken from that. */
const skills = routeCollection<SkillRow, 'name'>({
  name: 'skills',
  label: 'Skills',
  description: 'Every skill the active team has run, all time: how many runs, the calls and refusals in them, how long they took and their observed output, the response bytes of their calls. The gateway narrows it to one plugin\'s skills with plugin eq; page with limit, and read total for how many there are.',
  key: 'name',
  title: (s) => s.name,
  fields: z.object({
    plugin: maybeText.describe('The plugin that ships it; nothing for a skill no plugin in the catalog ships now.'),
    version: text, kind: text, flow: maybeText, retired: z.boolean().describe('No longer served; kept because it owns these runs.'),
    runs: count, calls: count.describe('Tool calls inside its runs.'), callsAvg: count.describe('Calls per run, mean.'), callsMax: count, refusals: count,
    timedRuns: count.describe('Runs with more than one call, so a duration could be measured.'),
    durationAvg: maybeCount.describe('Seconds, mean over timed runs.'), durationMedian: maybeCount.describe('Seconds.'), durationMax: maybeCount.describe('Seconds.'),
    durationTotal: maybeCount.describe('Seconds, summed over timed runs.'),
    kbPerRun: maybeCount.describe('KB of observed output per run; nothing when no run was measured.'), mbTotal: maybeCount.describe('MB of observed output across its runs.'),
  }),
  conditions: { plugin: { op: 'eq', param: 'plugin' } },
  read: async ({ plugin }, { limit, offset }) => {
    const [answer, catalog] = await Promise.all([
      gatewayGet<{ skills: Skill[] }>(plugin ? `/skills?plugin=${encodeURIComponent(plugin)}` : '/skills'),
      gatewayGet<{ plugins: PluginRow[] }>('/plugins'),
    ]);
    const shipper = (name: string) => catalog.plugins.find((p) => p.skills.some((k) => k.name === name))?.plugin ?? null;
    const rows = answer.skills.map(({ logged, ...s }) => { void logged; return { ...s, plugin: shipper(s.name) }; });
    return { total: rows.length, rows: rows.slice(offset, offset + limit) };
  },
});

type ActivityCollectionRow = Flat<ActivityLog['rows'][number]> & { refused: boolean };

/* The active team's real-work events, read a page at a time from the route that filters them: a kind, a tool, an
 * initiative and refused calls alone are the route's parameters, applied before its latest 500 are taken, and its total
 * is the route's, so a count is never of one page. */
const activity = routeCollection<ActivityCollectionRow, 'id'>({
  name: 'activity',
  label: 'Activity',
  description: 'The active team\'s real-work events, newest first: every tool call, gate and lesson, page views and the platform\'s own maintenance left out. A refused call carries its owner (guardrail: a guardrail held; ours: a malformed call; theirs: a tool failure; other) and the message the platform stored. The gateway filters and pages it: kind eq, tool eq, initiative eq (a slug of the active team) and refused eq true; page with limit, and read total for how many match, up to the latest 500.',
  key: 'id',
  title: (e) => `${e.kind}${e.tool ? ` ${e.tool}` : ''}`,
  fields: z.object({
    ts: when('When it happened'), kind: text, tool: maybeText.describe('The tool called, as door:tool; nothing for an event that is not a call.'),
    initiative: maybeText.describe('The initiative it was for, by its slug.'), step: maybeText.describe('The skill the caller was following.'),
    ok: z.boolean().nullable().describe('false when the call was refused; nothing for an event that is not a call.'),
    refused: z.boolean().describe('Whether it was a refused call.'),
    owner: z.enum(['guardrail', 'ours', 'theirs', 'other'] satisfies RefusalOwner[]).nullable().describe('Who a refusal is put down to.'),
    message: maybeText.describe('A refusal\'s message, as the platform stored it; nothing when none was recorded.'),
    actor: maybeText.describe('Who did it, by email; nothing for a tool call.'),
  }),
  conditions: { kind: { op: 'eq', param: 'kind' }, tool: { op: 'eq', param: 'tool' }, initiative: { op: 'eq', param: 'initiative' }, refused: { op: 'eq', param: 'refused' } },
  read: async (params, page) => {
    const log = await gatewayGet<ActivityLog>(activityPath({ ...NO_FILTER, ...params }, page));
    return { total: log.total, rows: log.rows.map((e) => ({ ...e, refused: e.ok === false })) };
  },
});

const tokens = gatewayCollection<Flat<MyAccessToken>, 'id'>({
  name: 'tokens',
  label: 'Your tokens',
  description: 'The person\'s own platform tokens: label and dates only. A token\'s value is shown once, when it is issued, and is stored nowhere it can be read again.',
  key: 'id',
  title: (t) => t.label,
  fields: z.object({
    label: text, created_at: when('When it was issued'), last_used_at: maybeWhen('When it last made a platform call'),
    revoked_at: maybeWhen('When it was revoked'),
  }),
  load: () => gatewayGet<MyAccessToken[]>('/settings/me/tokens'),
  onPage: SETTINGS,
});

export const collections: AnyCollection[] = [teams, initiatives, knowledge, knowledgeLog, people, plugins, skills, activity, tokens];
