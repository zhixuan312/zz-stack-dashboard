/**
 * Every collection the assistant reads, as one table: a row per measure of the gateway's prepared queries (Work's
 * `/work/query`, Platform's `/platform/query`) and one for the caller's own tokens, read from their Access answer on the
 * console's server. `src/data/prepared-aggregate.ts` makes each row a `Collection`, and `src/data/collections.ts` lists
 * them; a page task that needs another measure adds a row here, never a collection of its own.
 *
 * A row names its route and the route's own name for the measure; its dimensions, which the route groups and filters it
 * by; the field its window is cut on; its key; its fields (the dimensions, the date and the columns of the row its page
 * draws, as the route answers them); whether the route answers rows for it, or the sentence that names the page listing
 * them; and the grant of the page that shows it, by reference. Nothing here is a figure: each is the route's.
 *
 * Data only: the field shapes in `zod` and the grants by reference to `FEATURES`, both pure.
 */
import { z } from 'zod';
import { FEATURES, FLEET } from '@/data/features';
import type { ConsoleNeed } from '@/data/roles';
import type { AnyCollection } from '@/lib/collection';

type Bucket = 'day' | 'week' | 'month' | 'weekday';
type Row = Record<string, unknown>;

export type PreparedRow = {
  name: string;
  label: string;
  /** What a row is and whose rows these are, for the model. */
  description: string;
  /** Where the figures come from: Work's prepared query, Platform's, or the caller's own Access answer. */
  route: 'work' | 'platform' | 'access';
  /** The route's own name for the measure. */
  measure: string;
  /** The dimensions the route groups and filters the measure by, equality alone. */
  dimensions: string[];
  /** The dimensions only a superadmin may name: the route refuses anyone else, so the assistant offers them nobody else. */
  fleet?: string[];
  /** The buckets of its days the route groups it by; none for a stock, counted as of its window's end. */
  buckets: Bucket[];
  /** The field its window is cut on and its drilled rows are ordered by, newest first. */
  date: string;
  /** The field the route sums, for a measure that adds a quantity up rather than counting what happened. */
  sums?: string;
  key: string;
  /** Every field a query may name: the dimensions, the date and the drilled row's columns. */
  fields: z.ZodObject;
  /**
   * The drill: the rows the route answers, made flat where they hold an object, and the need of a drill only some may
   * make; or, for a measure the route answers no rows for, the sentence that names the page listing them.
   */
  drill: { flat?: (row: Row) => Row; needs?: ConsoleNeed } | { none: string };
  /** What the page that shows the measure needs. */
  needs: ConsoleNeed;
  /**
   * The changes a page makes to it with a control of its own, which the assistant is told are the person's, made there:
   * left out, its prompt says nobody can make them. A control that takes a record out of use (Revoke, Archive,
   * Deactivate) is its `remove`. Never a write tool: no row has an operation the assistant could call.
   */
  pageOnly?: AnyCollection['pageOnly'];
  /**
   * Who has the control `pageOnly` names, when not everybody who reads the row does: the assistant route tells anybody
   * else that nobody can make the change here, rather than sending them to a page that has no control for them.
   */
  pageOnlyNeeds?: ConsoleNeed;
};

const text = z.string();
const maybe = z.string().nullable();
const count = z.number();
const DAYS: Bucket[] = ['day', 'week', 'month', 'weekday'];

/** Work's initiative row, as Initiatives draws it: the next move made flat. */
const initiativeFields = {
  slug: text, flow: maybe, state: text, next: maybe, nextDocument: maybe, gatesPassed: count, gates: count,
  lastTouched: text, opened: text, closed: maybe,
};
const initiativeRow = (r: Row): Row => {
  const next = r.nextMove as { action?: string; document?: string | null } | null;
  const gates = r.gates as { passed: number; of: number };
  return {
    slug: r.slug, flow: r.flow, state: r.state, next: next?.action ?? null, nextDocument: next?.document ?? null,
    gatesPassed: gates.passed, gates: gates.of, lastTouched: r.lastTouched, opened: r.opened, closed: r.closed,
  };
};
/** Activity's event row. */
const eventFields = { id: text, ts: text, kind: text, step: maybe, ok: z.boolean().nullable(), message: maybe, actor: maybe };
/** Runs' run row. */
const runFields = { id: text, startedAt: text, lastCallAt: text, calls: count, refusals: count, bytes: count.nullable(), lengthMs: count, state: text };

export const PREPARED: PreparedRow[] = [
  // Work, over /work/query: the active team's, the approvals the caller's own.
  {
    name: 'closures', label: 'Closures', route: 'work', measure: 'closures',
    description: 'The active team\'s initiatives closed in a window, by the outcome each closed with.',
    dimensions: ['outcome', 'flow', 'initiative'], buckets: DAYS, date: 'closed', key: 'slug',
    fields: z.object({ outcome: text, initiative: text, ...initiativeFields }),
    // Close initiative, in the dialog on an initiative's own page.
    drill: { flat: initiativeRow }, needs: FEATURES.record.needs, pageOnly: ['create'],
  },
  {
    name: 'opened', label: 'Initiatives opened', route: 'work', measure: 'opened',
    description: 'The active team\'s initiatives opened in a window.',
    dimensions: ['flow'], buckets: DAYS, date: 'opened', key: 'slug',
    fields: z.object(initiativeFields), drill: { flat: initiativeRow }, needs: FEATURES.initiatives.needs,
  },
  {
    name: 'words', label: 'Words written', route: 'work', measure: 'words', sums: 'added',
    description: 'The words the active team\'s documents and lessons gained in a window; a lesson is no document, so its words are grouped as lessons.',
    dimensions: ['document', 'initiative'], buckets: DAYS, date: 'at', key: 'document',
    fields: z.object({ initiative: maybe, document: text, path: maybe, added: count, at: text }),
    drill: { flat: (r) => ({ ...r, document: r.path ? `${String(r.initiative)}/${String(r.path)}` : 'lessons' }) },
    needs: FEATURES.record.needs,
  },
  {
    name: 'approvals', label: 'Approvals', route: 'work', measure: 'approvals',
    description: 'The approvals signed in the caller\'s own name for the active team, with where the revision was shown and the basis it was decided on.',
    dimensions: ['presentation', 'decision_basis', 'initiative'], buckets: DAYS, date: 'approvedAt', key: 'contentRevision',
    fields: z.object({
      presentation: text, decision_basis: text, initiative: text, path: text, version: count, contentRevision: text, approvedAt: text, decisionBasis: text,
    }),
    // Approve, on the document's own page.
    drill: {}, needs: FEATURES.approvals.needs, pageOnly: ['create'],
  },
  {
    name: 'lessons', label: 'Lessons made', route: 'work', measure: 'lessons',
    description: 'The lessons the active team made in a window, an import\'s left out.',
    dimensions: ['kind'], buckets: DAYS, date: 'at', key: 'at',
    fields: z.object({ kind: text, at: text }), drill: {}, needs: FEATURES.knowledge.needs,
  },
  {
    name: 'runs', label: 'Runs', route: 'work', measure: 'runs',
    description: 'The active team\'s runs of a skill, each counted in the window its first call is in; weekday and hour are the reporting time zone\'s.',
    dimensions: ['skill', 'initiative', 'weekday', 'hour'], buckets: ['day', 'week', 'month'], date: 'startedAt', key: 'startedAt',
    fields: z.object({ skill: text, initiative: maybe, weekday: text, hour: text, startedAt: text, lengthMs: count }),
    drill: {}, needs: FEATURES.runs.needs,
  },
  {
    name: 'searches', label: 'Searches', route: 'work', measure: 'searches',
    description: 'The active team\'s completed work searches, by whether each found something; a drilled search that found nothing carries its question.',
    dimensions: ['found'], buckets: DAYS, date: 'at', key: 'at',
    fields: z.object({ found: text, at: text, question: maybe }), drill: {}, needs: FEATURES.knowledge.needs,
  },
  {
    name: 'calls', label: 'Tool calls', route: 'work', measure: 'calls',
    description: 'The active team\'s real-work tool calls, as Activity\'s log holds them, by tool, initiative and whether each was refused.',
    dimensions: ['tool', 'initiative', 'refused'], buckets: DAYS, date: 'ts', key: 'id',
    fields: z.object({ tool: maybe, initiative: maybe, refused: text, owner: maybe, ...eventFields }),
    drill: {}, needs: FEATURES.activity.needs,
  },
  {
    name: 'refusals', label: 'Refusals', route: 'work', measure: 'refusals',
    description: 'The active team\'s refused tool calls, each under one of four owners that sum to the total.',
    dimensions: ['owner', 'tool', 'initiative'], buckets: DAYS, date: 'ts', key: 'id',
    fields: z.object({ owner: text, tool: maybe, initiative: maybe, refused: text, ...eventFields }),
    drill: {}, needs: FEATURES.activity.needs,
  },
  {
    name: 'output', label: 'Observed output', route: 'work', measure: 'output', sums: 'bytes',
    description: 'The response bytes the active team\'s runs\' own calls answered, summed over the runs that measured any; not what a model read, and not a cost.',
    dimensions: ['skill', 'initiative'], buckets: DAYS, date: 'startedAt', key: 'id',
    fields: z.object({ skill: text, initiative: maybe, ...runFields }), drill: {}, needs: FEATURES.runs.needs,
  },
  {
    name: 'skill_calls', label: 'Calls of a shipped skill', route: 'work', measure: 'skill_calls',
    description: 'The active team\'s real-work tool calls of a skill a shipped plugin ships, under the plugin that ships it.',
    dimensions: ['plugin', 'skill'], buckets: DAYS, date: 'at', key: 'skill',
    fields: z.object({ plugin: text, skill: text, calls: count, at: text }),
    drill: { none: 'Calls of a skill are counted, never listed: Plugins (/plugins) shows each plugin\'s skills with their calls.' },
    needs: FEATURES.plugins.needs,
  },
  {
    name: 'shelf', label: 'The shelf', route: 'work', measure: 'shelf',
    description: 'The active team\'s lessons as of a window\'s end, standing or superseded as they stand now: a stock, so the window\'s start changes nothing.',
    dimensions: ['kind', 'standing'], buckets: [], date: 'updated', key: 'key',
    fields: z.object({ kind: text, standing: text, key: text, team: text, path: text, type: text, status: text, title: text, updated: text }),
    drill: {}, needs: FEATURES.knowledge.needs,
  },

  // Platform, over /platform/query: as the page that draws each figure answers the caller.
  {
    name: 'platform_calls', label: 'Platform calls', route: 'platform', measure: 'calls',
    description: 'The platform\'s real-work tool calls, by tool and whether each was refused; by team for a superadmin alone.',
    dimensions: ['tool', 'refused', 'team'], fleet: ['team'], buckets: DAYS, date: 'at', key: 'tool',
    fields: z.object({ tool: maybe, refused: text, team: maybe, calls: count, at: text, address: text }),
    drill: {}, needs: FEATURES.usage.needs,
  },
  {
    name: 'platform_refusals', label: 'Platform refusals', route: 'platform', measure: 'refusals',
    description: 'The platform\'s refused real-work tool calls, under the four owners that sum to the total.',
    dimensions: ['owner', 'tool', 'team'], fleet: ['team'], buckets: DAYS, date: 'at', key: 'owner',
    fields: z.object({ owner: text, tool: maybe, team: maybe, refusals: count, at: text }),
    drill: { none: 'Refusals are counted, never listed: Status (/platform) and Usage count them and list none.' },
    needs: FEATURES.usage.needs,
  },
  {
    name: 'malformed', label: 'Malformed calls', route: 'platform', measure: 'malformed',
    description: 'The platform\'s real-work tool calls refused for their shape, the ones put down to the platform.',
    dimensions: ['tool'], buckets: DAYS, date: 'at', key: 'tool',
    fields: z.object({ tool: maybe, malformed: count, at: text }),
    drill: { none: 'Malformed calls are counted, never listed: Status (/platform) and Releases count them and list none.' },
    needs: FEATURES['platform-status'].needs,
  },
  {
    name: 'releases', label: 'Releases', route: 'platform', measure: 'releases',
    description: 'The platform\'s recorded releases, by the day each went out.',
    dimensions: [], buckets: DAYS, date: 'at', key: 'version',
    fields: z.object({ version: text, consoleVersion: maybe, releasedAt: text, summary: text, clientAction: maybe, at: text, address: text }),
    drill: { flat: ({ before: _b, after: _a, ...r }) => r }, needs: FEATURES.releases.needs,
  },
  {
    name: 'migrations', label: 'Migrations', route: 'platform', measure: 'migrations',
    description: 'The migrations applied to the platform\'s database, by the day each was applied.',
    dimensions: [], buckets: DAYS, date: 'at', key: 'at',
    fields: z.object({ migrations: count, at: text }),
    drill: { none: 'Migrations are counted, never listed: Releases (/platform/releases) counts them and lists none.' },
    needs: FEATURES.releases.needs,
  },
  {
    name: 'bugs_filed', label: 'Bugs filed', route: 'platform', measure: 'bugs_filed',
    description: 'The real bug reports filed, by the day each was filed, in the form the caller reads them.',
    dimensions: ['impact', 'state', 'surface'], buckets: DAYS, date: 'at', key: 'id',
    fields: z.object({ impact: text, state: text, surface: maybe, id: text, title: text, filedAt: text, platformVersion: maybe, status: text, resolvedAt: maybe, at: text, address: text }),
    drill: {}, needs: FEATURES.bugs.needs,
  },
  {
    name: 'bugs_resolved', label: 'Bugs resolved', route: 'platform', measure: 'bugs_resolved',
    description: 'The real bug reports resolved, dated by the day each was filed.',
    dimensions: ['outcome', 'impact'], buckets: DAYS, date: 'at', key: 'id',
    fields: z.object({ outcome: text, impact: text, id: text, title: text, surface: maybe, filedAt: text, status: text, resolvedAt: maybe, at: text, address: text }),
    // Resolve report, on an open report's own page, which only a superadmin opens though a member reads this too:
    // told it was made on its page, a member was sent to Bugs to resolve one.
    drill: {}, needs: FEATURES.bugs.needs, pageOnly: ['create'], pageOnlyNeeds: FEATURES.bug.needs,
  },
  {
    name: 'findings', label: 'Findings', route: 'platform', measure: 'findings',
    description: 'Evaluation findings, each counted once, strengths left out; a drilled row is one still waiting for a decision.',
    dimensions: ['decision', 'owner', 'plugin'], buckets: DAYS, date: 'at', key: 'id',
    fields: z.object({ decision: text, owner: text, plugin: maybe, id: text, kind: text, measure: maybe, waitingSince: text, summary: text, at: text, address: text }),
    drill: {}, needs: FEATURES.evaluation.needs,
  },
  {
    name: 'scores', label: 'Scores established', route: 'platform', measure: 'scores',
    description: 'The plugins whose latest scoring by a window\'s end is established and inside the window.',
    dimensions: ['plugin'], buckets: DAYS, date: 'at', key: 'plugin',
    fields: z.object({ plugin: text, score: count.nullable(), lower: count.nullable(), upper: count.nullable(), standing: text, guardrails: text, scoredAt: text, at: text, address: text }),
    drill: { flat: ({ protocol: _p, ...r }) => ({ ...r, score: (r.score as { value: number | null } | null)?.value ?? null }) },
    needs: FEATURES.evaluation.needs,
  },
  {
    name: 'platform_lessons', label: 'Lessons made, every shelf', route: 'platform', measure: 'lessons',
    description: 'The lessons made on every shelf, imports told apart; a member reads their own team\'s shelf and the shared one by name, and the rest unnamed.',
    dimensions: ['shelf', 'kind', 'imported'], buckets: DAYS, date: 'at', key: 'kind',
    fields: z.object({ shelf: maybe, kind: text, imported: text, lessons: count, at: text }),
    drill: { none: 'Lessons are counted here, never listed: Knowledge health (/platform/knowledge) counts them and lists none.' },
    needs: FEATURES['knowledge-health'].needs,
  },
  {
    name: 'platform_searches', label: 'Searches, every shelf', route: 'platform', measure: 'searches',
    description: 'The platform\'s real-work searches that recorded their results, by whether each found something and was widened; the questions those that found nothing asked are a superadmin\'s alone.',
    dimensions: ['found', 'widened'], buckets: DAYS, date: 'at', key: 'question',
    fields: z.object({ found: text, widened: maybe, question: text, shelf: text, asked: count, lastAskedAt: text, at: text, address: text }),
    drill: { needs: FLEET }, needs: FEATURES['knowledge-health'].needs,
  },
  {
    name: 'model_calls', label: 'Model calls', route: 'platform', measure: 'model_calls',
    description: 'The platform\'s own model calls, by model.',
    dimensions: ['model'], buckets: DAYS, date: 'at', key: 'model',
    fields: z.object({ model: maybe, calls: count, at: text }),
    drill: { none: 'Model calls are counted, never listed: Usage (/platform/usage) counts them and lists none.' },
    needs: FEATURES.usage.needs,
  },
  {
    name: 'teams', label: 'Teams', route: 'platform', measure: 'teams',
    description: 'Every team made by a window\'s end, by its status: a stock.',
    dimensions: ['status'], buckets: [], date: 'at', key: 'slug',
    fields: z.object({ status: text, slug: text, name: text, created: text, people: count, openWork: count, waiting: count, lessons: count, lastActive: maybe, at: text, address: text }),
    // Create a team on Teams, and Archive on a team's own page.
    drill: { flat: ({ sessions: _s, calls: _c, ...r }) => r }, needs: FEATURES.teams.needs, pageOnly: ['create', 'remove'],
  },
  {
    name: 'people', label: 'People', route: 'platform', measure: 'people',
    description: 'Every person added by a window\'s end, by role and state: a stock. A person\'s tokens and enrolment links are never shown.',
    dimensions: ['role', 'state'], buckets: [], date: 'at', key: 'email',
    fields: z.object({ role: text, state: text, email: text, name: text, created: text, passkeys: count, lastSignIn: maybe, at: text, address: text }),
    // Add a person, and Deactivate in a person's row, on People.
    drill: { flat: ({ teams: _t, ...r }) => r }, needs: FEATURES.people.needs, pageOnly: ['create', 'remove'],
  },
  {
    name: 'sign_ins', label: 'Sign-ins', route: 'platform', measure: 'sign_ins',
    description: 'The recorded console sign-ins, by role; a drilled row is a person who signed in, the latest first.',
    dimensions: ['role'], buckets: DAYS, date: 'at', key: 'email',
    fields: z.object({ role: text, email: text, name: text, state: text, at: text, address: text }),
    drill: { flat: ({ teams: _t, ...r }) => r }, needs: FEATURES.people.needs,
  },
  {
    name: 'audit', label: 'Audit events', route: 'platform', measure: 'audit',
    description: 'The platform\'s recorded events, page views left out, by kind and team: metadata only.',
    dimensions: ['kind', 'team'], buckets: DAYS, date: 'at', key: 'id',
    fields: z.object({ kind: text, team: maybe, id: text, actor: maybe, subject: maybe, ok: z.boolean().nullable(), refusalOwner: maybe, at: text, address: text }),
    drill: {}, needs: FEATURES.audit.needs,
  },

  // The caller's own, over their Access answer.
  {
    name: 'tokens', label: 'Your tokens', route: 'access', measure: 'issued',
    description: 'The caller\'s own platform tokens by label, state and the application each was minted for, with their dates. A token\'s value is shown once, when it is issued, and is stored nowhere it can be read again.',
    dimensions: ['state', 'application'], buckets: DAYS, date: 'createdAt', key: 'id',
    fields: z.object({ state: z.enum(['live', 'revoked']), application: maybe, label: text, createdAt: text, lastUsedAt: maybe, revokedAt: maybe }),
    // Issue token, and Revoke in a token's row, under Tokens on Access.
    drill: {}, needs: FEATURES.access.needs, pageOnly: ['create', 'remove'],
  },
];

/** Each collection's dimensions only a superadmin may name, by its name. */
export const FLEET_FIELDS: Record<string, readonly string[]> = Object.fromEntries(PREPARED.flatMap((r) => (r.fleet ? [[r.name, r.fleet]] : [])));
