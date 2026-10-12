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
import { gatewayCollection } from '@/data/gateway-collection';
import { gatewayGet } from '@/data/gateway';
import { initiativeState } from '@/console/initiative-state';
import type {
  ActivityEvent, Initiative, KnowledgeLogEntry, KnowledgeNode, MyAccessToken, Person, PluginRow, Skill, Team,
} from '@/lib/api-shapes';
import type { AnyCollection } from '@/lib/collection';

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
  description: 'Every team the person may read, with what it holds. The key is the team\'s slug. A superadmin adds or archives a team on the Settings page.',
  key: 'slug',
  title: (t) => t.slug,
  fields: z.object({
    name: text, status: z.enum(['active', 'archived']), created: when('When the team was created'),
    members: count.describe('People in the team.'), initiatives: count, documents: count.describe('Written documents, sources not counted.'),
    sources: count, knowledge: count.describe('Knowledge nodes on the team\'s shelf.'),
  }),
  load: async () => (await gatewayGet<{ teams: Team[] }>('/teams')).teams,
  onPage: SETTINGS,
});

type InitiativeRow = {
  id: string; team: string; slug: string; flow: string | null; state: string; stage: string; at: number; of: number;
  documents: number; approvals: number; gatesPassed: number; gates: number; waitingOn: string | null;
  updated: string; stakeholder: string | null; closed: boolean; outcome: string | null; correction: string | null;
};

const initiatives = gatewayCollection<InitiativeRow, 'id'>({
  name: 'initiatives',
  label: 'Initiatives',
  description: 'Every piece of work the person may read, open or closed, and how far through its flow it got. The key is "<team>/<slug>", and /initiatives/<team>/<slug> opens it.',
  key: 'id',
  title: (i) => i.id,
  fields: z.object({
    team: text, slug: text, flow: maybeText.describe('The flow it runs, such as sdlc; nothing when it declares none.'),
    state: z.enum(['Accepted', 'Delivered', 'Abandoned', 'Waiting on you', 'Ready to close', 'In progress']).describe('Waiting on you: a gate document is written and nobody has approved it. Ready to close: every gate is approved and no outcome is recorded.'),
    stage: text.describe('The name of the flow stage it is at.'), at: count.describe('The position of that stage in its flow, from 1.'), of: count.describe('How many stages the flow has; 0 with no flow.'),
    documents: count, approvals: count,
    gatesPassed: count.describe('Gates approved, the handover left out.'), gates: count.describe('Gates the flow declares, the handover left out.'),
    waitingOn: maybeText.describe('The gates written and not yet approved, comma-separated. A closed initiative has one when its closing document was corrected after the close.'),
    updated: when('When it was last touched'), stakeholder: maybeText,
    closed: z.boolean(), outcome: maybeText.describe('accepted, delivered or abandoned once closed.'),
    correction: maybeText.describe('On a closed initiative, the closing document changed after the close and awaiting approval again.'),
  }),
  load: async () => (await gatewayGet<{ initiatives: Initiative[] }>('/initiatives')).initiatives.map((i) => {
    const own = i.gates.filter((g) => g.role !== 'handover');
    return {
      id: `${i.team}/${i.slug}`, team: i.team, slug: i.slug, flow: i.flow, state: initiativeState(i), stage: i.stage, at: i.at, of: i.of,
      documents: i.documents, approvals: i.approvals, gatesPassed: own.filter((g) => g.passed).length, gates: own.length,
      waitingOn: joined(own.filter((g) => g.written && !g.passed).map((g) => g.name)),
      updated: i.updated, stakeholder: i.stakeholder, closed: i.closed, outcome: i.outcome, correction: i.correction?.path ?? null,
    };
  }),
});

type KnowledgeRow = Omit<KnowledgeNode, 'tags' | 'evidence'> & { tags: string | null; evidence: string | null };

const knowledge = gatewayCollection<KnowledgeRow, 'key'>({
  name: 'knowledge',
  label: 'Knowledge',
  description: 'The knowledge nodes on the shelf the person may read: what earlier initiatives settled. The key is "<team>/<path>", and /knowledge/<team>/<path> opens a node with its full text. Search the title, the excerpt and the tags.',
  key: 'key',
  title: (n) => n.title,
  fields: z.object({
    num: text.describe('The node\'s number within its own team; two teams both have a node 1.'), team: text, path: text,
    type: text, status: text.describe('adopted, or superseded once a later node replaced it.'), title: text,
    tags: maybeText.describe('The node\'s subjects, comma-separated.'), updated: when('When the node last changed'),
    bytes: count, excerpt: text.describe('The opening of the node\'s text.'),
    evidence: maybeText.describe('The initiatives the lesson came out of, comma-separated.'),
    superseded_by: maybeText.describe('The node that replaced this one.'),
  }),
  load: async () => (await gatewayGet<{ nodes: KnowledgeNode[] }>('/knowledge')).nodes.map((n) => ({ ...n, tags: joined(n.tags), evidence: joined(n.evidence) })),
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
  description: 'Everyone the person may read: a superadmin everyone on the platform, a member their own team. Tokens are counted, never shown. A superadmin adds or deactivates a person on the Settings page.',
  key: 'email',
  title: (p) => p.name || p.email,
  fields: z.object({
    name: text, role: z.enum(['superadmin', 'member']), status: text.describe('active, or deactivated.'), created: when('When they were added'),
    activeTeam: maybeText.describe('The team they act for.'), teams: maybeText.describe('Their memberships as "<team> (<role>)", comma-separated.'),
    tokens: count.describe('Live platform tokens they hold.'), last_used: maybeWhen('When one of their tokens last made a platform call'),
  }),
  load: async () => (await gatewayGet<{ people: Person[] }>('/people')).people.map((p) => ({ ...p, teams: joined(p.teams) })),
  onPage: SETTINGS,
});

type PluginCollectionRow = {
  plugin: string; owner: string | null; description: string | null; version: string | null; servers: string | null; stages: string | null;
  gates: number; skills: number; calls: number; failed: number; lastRun: string | null; releasedVersion: string | null;
  evalVersion: string | null; evalScore: number | null; evalScoreStatus: string | null; evalGuardrails: string | null; openDefects: number | null; evalAt: string | null;
};

const plugins = gatewayCollection<PluginCollectionRow, 'plugin'>({
  name: 'plugins',
  label: 'Plugins',
  description: 'Every plugin on the platform: a package\'s skills and the MCP servers they call, under one declared version, with its newest evaluation. /plugins/<plugin> opens one.',
  key: 'plugin',
  title: (p) => p.plugin,
  fields: z.object({
    owner: maybeText, description: maybeText, version: maybeText.describe('The version the plugin declares.'),
    servers: maybeText.describe('The MCP servers its skills reach, comma-separated.'), stages: maybeText.describe('Its method\'s stages in running order, comma-separated; nothing for a toolbox.'),
    gates: count.describe('Documents a person must approve.'), skills: count, calls: count.describe('Tool calls across its skills, all time.'), failed: count.describe('Of those, refused.'),
    lastRun: maybeWhen('Its most recent call'), releasedVersion: maybeText.describe('The version a release vouched for; nothing when none has.'),
    evalVersion: maybeText.describe('The version its newest evaluation measured.'), evalScore: maybeCount.describe('That evaluation\'s overall score, 0 to 10; nothing when not established.'),
    evalScoreStatus: maybeText.describe('established, provisional or not_established.'), evalGuardrails: maybeText.describe('pass, fail or not_established.'),
    openDefects: maybeCount.describe('Defect findings of that evaluation still deferred.'), evalAt: maybeWhen('When that evaluation ran'),
  }),
  load: async () => (await gatewayGet<{ plugins: PluginRow[] }>('/plugins')).plugins.map((p) => ({
    plugin: p.plugin, owner: p.owner, description: p.description, version: p.version, servers: joined(p.servers), stages: joined(p.stages),
    gates: p.gates, skills: p.skills.length, calls: p.calls, failed: p.failed, lastRun: p.lastRun, releasedVersion: p.release?.version ?? null,
    evalVersion: p.latestEval?.version ?? null,
    evalScore: p.latestEval && p.latestEval.scoreStatus !== 'not_established' ? p.latestEval.overallScore : null,
    evalScoreStatus: p.latestEval?.scoreStatus ?? null, evalGuardrails: p.latestEval?.guardrailStatus ?? null,
    openDefects: p.latestEval?.openDefects ?? null, evalAt: p.latestEval?.at ?? null,
  })),
});

type SkillRow = Omit<Skill, 'logged'>;

const skills = gatewayCollection<SkillRow, 'name'>({
  name: 'skills',
  label: 'Skills',
  description: 'Every skill that has driven a run, all time: how many runs, the calls and refusals in them, how long they took and how much tool output they moved.',
  key: 'name',
  title: (s) => s.name,
  fields: z.object({
    version: text, kind: text, flow: maybeText, retired: z.boolean().describe('No longer served; kept because it owns these runs.'),
    runs: count, calls: count.describe('Tool calls inside its runs.'), callsAvg: count.describe('Calls per run, mean.'), callsMax: count, refusals: count,
    timedRuns: count.describe('Runs with more than one call, so a duration could be measured.'),
    durationAvg: maybeCount.describe('Seconds, mean over timed runs.'), durationMedian: maybeCount.describe('Seconds.'), durationMax: maybeCount.describe('Seconds.'),
    durationTotal: maybeCount.describe('Seconds, summed over timed runs.'),
    kbPerRun: maybeCount.describe('KB of tool output per run; nothing when no run was measured.'), mbTotal: maybeCount.describe('MB of tool output across its runs.'),
  }),
  load: async () => (await gatewayGet<{ skills: Skill[] }>('/skills')).skills.map(({ logged, ...s }) => { void logged; return s; }),
});

/** How many events the gateway answers at most; the page asks for the same number. */
const ACTIVITY_LIMIT = 200;

type ActivityRow = Flat<ActivityEvent> & { id: string };

const activity = gatewayCollection<ActivityRow, 'id'>({
  name: 'activity',
  label: 'Activity',
  description: `The latest ${ACTIVITY_LIMIT} events the person may read, newest first: every tool call, gate and admin act. Older events are not here, so a count over this list is a count of the latest ${ACTIVITY_LIMIT}, never of all time.`,
  key: 'id',
  title: (e) => `${e.kind}${e.subject ? ` ${e.subject}` : ''}`,
  fields: z.object({
    ts: when('When it happened'), actor: maybeText.describe('Who did it, by email.'), team: maybeText.describe('Nothing when no team was involved.'),
    kind: text, subject: maybeText.describe('What it was done to, such as the tool called.'), initiative: maybeText, step: maybeText,
    ok: z.boolean().nullable().describe('false when the call was refused.'), refusal: maybeText.describe('The refusal\'s own sentence.'),
  }),
  load: async () => (await gatewayGet<{ events: ActivityEvent[] }>(`/activity?limit=${ACTIVITY_LIMIT}`)).events.map((e, i) => ({ ...e, id: `${e.ts}#${i}` })),
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
