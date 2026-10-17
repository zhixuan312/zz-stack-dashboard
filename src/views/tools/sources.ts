/**
 * The prepared query's sources the view tools declare, one per prepared collection a view reads (`src/data/prepared.ts`),
 * so two views that read one measure declare it once. Each names only what the gateway's prepared query answers: its
 * dimensions as filters (equality alone) and facets, its buckets, a count or the sum the route adds up, and the drill of
 * the rows its page draws, each with the console address that shows it. A view narrows a source to its record with
 * `fixed`, which the page's own input gives.
 *
 * Work's route keys a missing value `none` (no flow, no initiative), which a label names; Platform's keys it null, which
 * `none` names and a condition asks for as null.
 *
 * A measure the route lists no rows for still declares the drill ZZ Meridian requires: its key and its figure, the page's
 * own address, and a `cannot` that names the page counting it, which is what the collection answers a drill with.
 */
import type { Measure, Source } from '@/lib/explore';

type Row = Record<string, unknown>;

const count = (label: string, unit: string, definition: string): Measure => ({ label, unit, definition, agg: 'count' });
/** A page's address with the parameters it reads, left out where a row has no value for one. */
const at = (path: string, params: Record<string, unknown> = {}) => {
  const p = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v]] : [])));
  return p.size ? `${path}?${p}` : path;
};
const eq = { ops: ['eq' as const] };
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';
const ACTIVE = 'It is the active team\'s alone, a superadmin\'s as a member\'s.';

export const closures: Source = {
  collection: 'closures', date: 'closed',
  filters: { outcome: { ...eq, values: ['accepted', 'delivered', 'abandoned'] }, flow: eq, initiative: eq },
  facets: ['outcome', 'flow', 'initiative'], buckets: ['day', 'week', 'month'],
  measures: { closures: count('Closures', 'initiatives', 'Initiatives closed in the window, whatever their outcome.') },
  drill: { columns: ['slug', 'state', 'flow', 'closed'], address: (r: Row) => at('/initiatives', { q: r.slug }) },
  labels: { flow: { none: 'no flow' } },
  cannot: `Nothing here says why an initiative closed as it did; its page does. ${ACTIVE} ${WINDOW}`,
};

export const opened: Source = {
  collection: 'opened', date: 'opened',
  filters: { flow: eq }, facets: ['flow'], buckets: ['day', 'week', 'month'],
  measures: { opened: count('Opened', 'initiatives', 'Initiatives opened in the window, open or closed since.') },
  drill: { columns: ['slug', 'state', 'flow', 'opened'], address: (r: Row) => at('/initiatives', { q: r.slug }) },
  cannot: `An initiative opened and abandoned the same day still counts as opened. ${ACTIVE} ${WINDOW}`,
};

export const words: Source = {
  collection: 'words', date: 'at',
  filters: { document: eq, initiative: eq }, facets: ['document', 'initiative'], buckets: ['day', 'week', 'month'],
  measures: { words: { label: 'Words written', unit: 'words', definition: 'The words the documents and the lessons gained in the window, a lesson\'s grouped as lessons.', agg: 'sum', field: 'added' } },
  drill: { columns: ['document', 'initiative', 'path', 'added'], address: (r: Row) => (r.initiative ? at('/initiatives', { q: r.initiative }) : '/knowledge') },
  cannot: `Words are what a revision added, not what a document holds now; a drilled row carries no date. ${ACTIVE} ${WINDOW}`,
};

export const approvals: Source = {
  collection: 'approvals', date: 'approvedAt',
  filters: {
    presentation: { ...eq, values: ['console_revision_shown', 'agent_context_covered', 'not_recorded', 'unknown'] },
    decision_basis: { ...eq, values: ['explicit_recorded', 'standing_delegation_recorded', 'unknown'] },
    initiative: eq,
  },
  facets: ['presentation', 'decision_basis', 'initiative'], buckets: ['day', 'week', 'month'],
  measures: { approvals: count('Approvals', 'approvals', 'Revisions approved in the window in the caller\'s own name.') },
  drill: { columns: ['contentRevision', 'initiative', 'path', 'version', 'presentation', 'decisionBasis', 'approvedAt'], address: (r: Row) => at('/initiatives', { q: r.initiative }) },
  cannot: `Only the caller's own approvals are counted, never a teammate's; what waits for a decision is not an approval. ${WINDOW}`,
};

export const lessons: Source = {
  collection: 'lessons', date: 'at',
  filters: { kind: eq }, facets: ['kind'], buckets: ['day', 'week', 'month'],
  measures: { lessons: count('Lessons made', 'lessons', 'Lessons the team made in the window, an import\'s left out.') },
  drill: { columns: ['at', 'kind'], address: () => '/knowledge' },
  cannot: `A lesson superseded since still counts as made; the shelf counts what stands. ${ACTIVE} ${WINDOW}`,
};

export const shelf: Source = {
  collection: 'shelf', date: 'updated',
  filters: { kind: eq, standing: { ...eq, values: ['standing', 'superseded'] } }, facets: ['kind', 'standing'],
  measures: { lessons: count('Lessons on the shelf', 'lessons', 'The team\'s lessons as of the window\'s last day, standing or superseded as they stand now.') },
  drill: { columns: ['key', 'title', 'type', 'status', 'updated'], address: (r: Row) => `/knowledge/${String(r.team)}/${String(r.path)}` },
  cannot: `The shelf is a stock: a window's start changes nothing, and nothing records when a lesson was superseded. ${ACTIVE}`,
};

export const searches: Source = {
  collection: 'searches', date: 'at',
  filters: { found: { ...eq, values: ['found', 'none'] } }, facets: ['found'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: {
    searches: count('Searches', 'searches', 'Work searches completed in the window.'),
    empty: { label: 'Found nothing', unit: 'searches', definition: 'Work searches in the window that found nothing.', agg: 'count', where: [{ field: 'found', op: 'eq', value: 'none' }] },
  },
  drill: { columns: ['at', 'found', 'question'], address: () => '/knowledge' },
  labels: { found: { found: 'found something', none: 'found nothing' } },
  cannot: `A search that found something is retrieval, not an answer; only one that found nothing carries its question. ${ACTIVE} ${WINDOW}`,
};

export const runs: Source = {
  collection: 'runs', date: 'startedAt',
  filters: { skill: eq, initiative: eq, weekday: eq, hour: eq }, facets: ['skill', 'initiative', 'weekday', 'hour'], buckets: ['day', 'week', 'month'],
  measures: { runs: count('Runs', 'runs', 'Runs whose first call is in the window, however long each ran.') },
  drill: { columns: ['startedAt', 'skill', 'initiative', 'lengthMs'], address: (r: Row) => at('/runs', { skill: r.skill }) },
  cannot: `A run is a skill's calls from its first to its last; nothing here says what a model read or what it cost. ${ACTIVE} ${WINDOW}`,
};

export const output: Source = {
  collection: 'output', date: 'startedAt',
  filters: { skill: eq, initiative: eq }, facets: ['skill', 'initiative'], buckets: ['day', 'week', 'month'],
  measures: { output: { label: 'Observed output', unit: 'bytes', definition: 'The response bytes the runs\' own calls answered, over the runs that measured any.', agg: 'sum', field: 'bytes' } },
  drill: { columns: ['id', 'skill', 'initiative', 'startedAt', 'bytes', 'calls'], address: (r: Row) => at('/runs', { skill: r.skill }) },
  cannot: `Observed output is what the calls answered, not what a model read and not a cost; a run that measured none is no figure. ${ACTIVE} ${WINDOW}`,
};

export const calls: Source = {
  collection: 'calls', date: 'ts',
  filters: { tool: eq, initiative: eq, refused: { ...eq, values: ['refused', 'answered'] } }, facets: ['tool', 'initiative', 'refused'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { calls: count('Tool calls', 'calls', 'Real-work tool calls in the window, refused or answered.') },
  drill: { columns: ['id', 'ts', 'tool', 'initiative', 'ok'], address: (r: Row) => at('/activity', { tool: r.tool }) },
  labels: { tool: { none: 'no tool' }, initiative: { none: 'no initiative' } },
  cannot: `Page views and the platform's own maintenance are not calls. ${ACTIVE} ${WINDOW}`,
};

export const refusals: Source = {
  collection: 'refusals', date: 'ts',
  filters: { owner: { ...eq, values: ['guardrail', 'ours', 'theirs', 'other'] }, tool: eq, initiative: eq }, facets: ['owner', 'tool', 'initiative'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { refusals: count('Refusals', 'calls', 'Real-work tool calls refused in the window, each under one of four owners that sum to the total.') },
  drill: { columns: ['id', 'ts', 'tool', 'owner', 'message'], address: (r: Row) => at('/activity', { tool: r.tool, refused: 'true' }) },
  labels: { owner: { guardrail: 'a guardrail held', ours: 'a malformed call', theirs: 'a tool failure', other: 'other' } },
  cannot: `A refusal's owner is who it is put down to, not who caused it. ${ACTIVE} ${WINDOW}`,
};

export const skillCalls: Source = {
  collection: 'skill_calls', date: 'at',
  filters: { plugin: eq, skill: eq }, facets: ['plugin', 'skill'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { calls: count('Calls of a shipped skill', 'calls', 'Real-work tool calls of a skill a shipped plugin ships, in the window.') },
  drill: { columns: ['skill', 'calls'], address: () => '/plugins' },
  cannot: `Calls of a skill are counted, never listed: Plugins (/plugins) shows each plugin's skills with their calls. ${ACTIVE} ${WINDOW}`,
};

export const tokens: Source = {
  collection: 'tokens', date: 'createdAt',
  filters: { state: { ...eq, values: ['live', 'revoked'] }, application: eq }, facets: ['state', 'application'], buckets: ['month'],
  measures: { tokens: count('Tokens', 'tokens', 'The caller\'s own platform tokens issued in the window, live or revoked.') },
  drill: { columns: ['id', 'label', 'state', 'application', 'createdAt', 'lastUsedAt'], address: () => '/settings' },
  none: { application: 'issued on the console or by an agent' },
  cannot: 'Only the caller\'s own tokens, by label and date: a token\'s value is shown once, when it is issued, and is read nowhere again.',
};

const PLATFORM = 'As the platform\'s pages answer the caller: a member reads no team\'s name but their own.';

export const platformCalls = (team: boolean): Source => ({
  collection: 'platform_calls', date: 'at',
  filters: { tool: eq, refused: { ...eq, values: ['refused', 'answered'] }, ...(team ? { team: eq } : {}) },
  facets: ['tool', 'refused', ...(team ? ['team'] : [])], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { calls: count('Calls', 'calls', 'Real-work tool calls on the platform in the window, refused or answered.') },
  drill: { columns: ['tool', 'calls', 'at'], address: (r: Row) => String(r.address) },
  none: { tool: 'a tool no door registers' },
  cannot: `A drilled row is a tool with its calls, the latest called first. ${PLATFORM} ${WINDOW}`,
});

export const platformRefusals: Source = {
  collection: 'platform_refusals', date: 'at',
  filters: { owner: { ...eq, values: ['guardrail', 'ours', 'theirs', 'other'] }, tool: eq }, facets: ['owner', 'tool'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { refusals: count('Refusals', 'calls', 'Real-work tool calls refused in the window, under the four owners that sum to the total.') },
  drill: { columns: ['owner', 'refusals'], address: () => '/platform' },
  labels: { owner: { guardrail: 'a guardrail held', ours: 'a malformed call', theirs: 'a tool failure', other: 'other' } },
  cannot: `Refusals are counted, never listed: Status (/platform) and Usage count them and list none. ${PLATFORM} ${WINDOW}`,
};

export const malformed: Source = {
  collection: 'malformed', date: 'at',
  filters: { tool: eq }, facets: ['tool'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: {
    malformed: count('Malformed calls', 'calls', 'Real-work tool calls refused for their shape, put down to the platform.'),
    per1000: { label: 'Malformed per 1,000 calls', unit: 'per 1,000 calls', definition: 'Malformed calls for each 1,000 real-work tool calls in the same window.', derive: 'ratio', of: ['malformed', 'calls.calls'], scale: 0.001 },
  },
  drill: { columns: ['tool', 'malformed'], address: () => '/platform' },
  cannot: `Malformed calls are counted, never listed: Status (/platform) and Releases count them and list none. ${PLATFORM} ${WINDOW}`,
};

export const findings: Source = {
  collection: 'findings', date: 'at',
  filters: { decision: { ...eq, values: ['applied', 'rejected', 'deferred'] }, owner: eq, plugin: eq }, facets: ['decision', 'owner', 'plugin'], buckets: ['week', 'month'],
  measures: { findings: count('Findings', 'findings', 'Evaluation findings made in the window, each counted once, strengths left out.') },
  drill: { columns: ['id', 'plugin', 'kind', 'owner', 'summary', 'waitingSince'], address: (r: Row) => String(r.address) },
  cannot: `A drilled row is a finding still waiting for a decision, in the form the caller may read. ${PLATFORM} ${WINDOW}`,
};

export const scores: Source = {
  collection: 'scores', date: 'at',
  filters: { plugin: eq }, facets: ['plugin'], buckets: ['month'],
  measures: { scores: count('Scores established', 'plugins', 'Plugins whose latest scoring by the window\'s end is established and inside the window.') },
  drill: { columns: ['plugin', 'score', 'standing', 'scoredAt'], address: (r: Row) => String(r.address) },
  cannot: `A score below established is not counted, and scores of two protocol versions do not compare. ${PLATFORM} ${WINDOW}`,
};
