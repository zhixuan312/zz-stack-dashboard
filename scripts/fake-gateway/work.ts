/**
 * The fake gateway's work: initiatives on the sdlc flow, their documents and sources, and the
 * knowledge store they fed.
 *
 * One initiative per state a page draws: drafting, waiting on a person, not started, closed three
 * ways (accepted, delivered, abandoned) and one with no flow at all. `atlas/…-search-relevance`
 * is the rich one: a document with every block a reader meets (a table, code, a task list, a long
 * address), three versions, sources numbered past 9 so their order is tested, and a plan waiting
 * on approval.
 */
import type {
  DocumentDetail, Gate, Initiative, InitiativeDetail, KnowledgeBody, KnowledgeLogEntry, KnowledgeNode, Step,
} from '../../src/lib/api-shapes.ts';
import { ago } from './clock.ts';

const FLOW = 'sdlc-flow';
const STAGES: [name: string, produces: string, what: string][] = [
  ['explore', 'explore.md', 'Ground a raw idea before anyone designs it.'],
  ['spec', 'spec.md', 'Close the option space to confirmed decisions and write the agreement.'],
  ['spec audit', 'a source supporting spec.md', 'Audit spec.md against the prose failure modes and its own contract.'],
  ['plan', 'plan.md', 'Turn an approved spec into a contract-first plan.'],
  ['plan audit', 'a source supporting plan.md', 'Audit plan.md: criteria traceability, task contracts, checks.'],
  ['execute', '', 'Build what the approved plan describes, one wave of tasks at a time.'],
  ['review', 'review.md', 'Verify what was built before it ships.'],
];
const GATE_AFTER: [name: string, role: string, after: number][] = [
  ['approve spec', 'agreement', 3], ['approve plan', 'plan', 5], ['approve review', 'verification', 8], ['approve handover', 'handover', 8],
];

type Seed = {
  team: string; slug: string; at: number; updated: number; stakeholder: string | null;
  /** Gates approved, then gates written but not approved, counting from the first. */
  passed: number; written: number;
  outcome: 'accepted' | 'delivered' | 'abandoned' | null; flow?: false;
};

const SEEDS: Seed[] = [
  { team: 'atlas', slug: '2026-09-28-search-relevance', at: 4, updated: 2, stakeholder: 'noah.okafor@example.com', passed: 1, written: 2, outcome: null },
  { team: 'atlas', slug: '2026-10-02-query-latency', at: 1, updated: 5, stakeholder: null, passed: 0, written: 0, outcome: null },
  { team: 'atlas', slug: '2026-09-12-onboarding-revamp', at: 7, updated: 220, stakeholder: 'ava.lindqvist@example.com', passed: 4, written: 4, outcome: 'accepted' },
  { team: 'atlas', slug: '2026-09-05-research-notes', at: 0, updated: 400, stakeholder: null, passed: 0, written: 0, outcome: null, flow: false },
  { team: 'beacon', slug: '2026-09-30-refund-flow', at: 2, updated: 9, stakeholder: 'jonas.weber@example.com', passed: 0, written: 1, outcome: null },
  { team: 'beacon', slug: '2026-10-01-ledger-migration-to-double-entry-bookkeeping-with-nightly-reconciliation', at: 0, updated: 30, stakeholder: null, passed: 0, written: 0, outcome: null },
  { team: 'beacon', slug: '2026-09-18-chargeback-alerts', at: 7, updated: 300, stakeholder: 'mei.tanaka@example.com', passed: 4, written: 4, outcome: 'delivered' },
  { team: 'cinder', slug: '2026-08-20-incident-runbooks', at: 3, updated: 900, stakeholder: 'leo.santos@example.com', passed: 1, written: 1, outcome: 'abandoned' },
];

function steps(s: Seed): Step[] {
  if (s.flow === false) return [];
  const closed = s.outcome !== null;
  const body = STAGES.map(([name, produces, what], i): Step => {
    const n = i + 1;
    const state: Step['state'] = produces === '' ? (n <= s.at ? 'done' : 'untracked')
      : n < s.at ? 'done' : n === s.at ? (closed ? 'done' : 'partial') : 'empty';
    return { name, produces, what, state, current: !closed && n === s.at };
  });
  return [
    { name: 'open', produces: '', what: 'the initiative exists: its folder was created and it was opened', state: 'done', current: !closed && s.at === 0 },
    ...body,
    { name: 'closed', produces: '', what: 'initiative_close recorded an outcome', state: closed ? 'done' : 'empty', current: false },
  ];
}

const gates = (s: Seed): Gate[] => s.flow === false ? [] : GATE_AFTER.map(([name, role, after], i) => ({ name, role, after, passed: i < s.passed, written: i < s.written }));

function stageOf(s: Seed) {
  if (s.flow === false) return '';
  return s.at === 0 ? 'open' : STAGES[s.at - 1][0];
}

export const INITIATIVES: Initiative[] = SEEDS.map((s) => ({
  team: s.team, slug: s.slug, flow: s.flow === false ? null : FLOW,
  documents: s.flow === false ? 3 : Math.max(1, s.at * 2 + s.written), approvals: s.passed,
  updated: ago(s.updated), stakeholder: s.stakeholder,
  at: s.at, of: s.flow === false ? 0 : 7, stage: stageOf(s), steps: steps(s), gates: gates(s),
  accepted: s.outcome === 'accepted', complete: s.outcome === 'accepted' || s.outcome === 'delivered',
  closed: s.outcome !== null, outcome: s.outcome,
}));

type Doc = InitiativeDetail['documents'][number];
const doc = (path: string, type: string, o: Partial<Doc> & { hours: number; bytes: number }): Doc => ({
  path, type, status: null, outcome: null, approved_by: null, title: null, supports: null, gated: null,
  closing: false, requiredForClose: false, updated_at: ago(o.hours), ...o,
});

/** The documents of one initiative: the rich one by hand, every other one from its stage. */
function documents(s: Seed): Doc[] {
  if (s.slug === '2026-09-28-search-relevance') {
    return [
      doc('explore.md', 'ground', { title: 'Exploration: why search misses what people type', status: '', gated: false, hours: 120, bytes: 14_210 }),
      doc('spec.md', 'agreement', { title: 'Spec: relevance that explains itself', status: 'approved', approved_by: 'noah.okafor@example.com', gated: true, hours: 60, bytes: 38_904 }),
      doc('plan.md', 'plan', { title: 'Plan: relevance that explains itself', status: 'draft', gated: true, hours: 2, bytes: 92_311 }),
      doc('sources/R1-user-interviews.md', 'source', { title: 'R1 user interviews, twelve sessions', supports: 'spec.md', hours: 110, bytes: 22_018 }),
      doc('sources/R2-query-log-sample.md', 'source', { title: 'R2 query log sample', supports: 'spec.md', hours: 108, bytes: 8_400 }),
      doc('sources/R10-competitor-teardown.md', 'source', { title: 'R10 competitor teardown', supports: 'spec.md', hours: 70, bytes: 11_250 }),
      doc('sources/spec-audit-round-1.md', 'source', { title: 'Spec audit round 1: four medium findings, all fixed in v2', supports: 'spec.md', hours: 64, bytes: 16_579 }),
      doc('sources/https-docs-example-com-search-ranking-signals-and-their-weights-explained.md', 'source', { title: null, supports: 'plan.md', hours: 3, bytes: 5_120 }),
    ];
  }
  if (s.flow === false) {
    return [
      doc('notes.md', 'note', { title: 'Reading list', hours: 400, bytes: 2_048 }),
      doc('ideas.md', 'note', { title: 'Ideas not yet worth an initiative', hours: 410, bytes: 1_200 }),
      doc('sources/paper-summary.md', 'source', { title: 'Paper summary', supports: 'notes.md', hours: 415, bytes: 3_300 }),
    ];
  }
  const out: Doc[] = [];
  const add = (path: string, type: string, title: string, gateIndex: number | null, n: number) => {
    const passed = gateIndex !== null && gateIndex < s.passed;
    out.push(doc(path, type, {
      title, gated: gateIndex !== null, status: gateIndex === null ? '' : passed ? 'approved' : 'draft',
      approved_by: passed ? s.stakeholder : null, hours: s.updated + n * 6, bytes: 4_000 + n * 3_100,
      ...(type === 'verification' ? { closing: true, requiredForClose: true, outcome: s.outcome } : {}),
    }));
  };
  if (s.at >= 1) add('explore.md', 'ground', 'Exploration', null, 4);
  if (s.at >= 2 || s.written >= 1) add('spec.md', 'agreement', 'Spec', 0, 3);
  if (s.at >= 4) add('plan.md', 'plan', 'Plan', 1, 2);
  if (s.at >= 7) { add('review.md', 'verification', 'Review', 2, 1); add('handover.md', 'handover', 'Handover', 3, 0); }
  return out;
}

const DECISIONS: InitiativeDetail['decisions'] = [
  { path: 'spec.md', role: 'agreement', key: 'AC-1.1', verdict: 'met', qualifier: null, detail: 'A result names the field that matched, in the row, without a hover.', checker: 'noah.okafor@example.com' },
  { path: 'spec.md', role: 'agreement', key: 'AC-1.2', verdict: null, qualifier: null, detail: 'A query with no match says so and offers the nearest spelling that has one.', checker: null },
  { path: 'spec.md', role: 'agreement', key: 'AC-2.1', verdict: 'partly met', qualifier: 'pending the latency budget', detail: 'Ranking runs in under 120 ms at the 95th percentile on the sample index.', checker: null },
  { path: 'plan.md', role: 'plan', key: 'I-1', verdict: null, qualifier: 'AC-1.1', detail: 'Match reasons travel with each result from the index.', checker: null },
  { path: 'plan.md', role: 'plan', key: 'I-2', verdict: null, qualifier: 'AC-1.2', detail: 'Spelling suggestions from the query log, never from the model.', checker: null },
];

export function initiativeDetail(team: string, slug: string): InitiativeDetail | null {
  const s = SEEDS.find((x) => x.team === team && x.slug === slug);
  const i = INITIATIVES.find((x) => x.team === team && x.slug === slug);
  if (!s || !i) return null;
  const rich = slug === '2026-09-28-search-relevance';
  const decisions = rich ? DECISIONS : [];
  return {
    team, slug, documents: documents(s), decisions,
    decisionCounts: { rows: decisions.length, withVerdict: decisions.filter((d) => d.verdict).length, withQualifier: decisions.filter((d) => d.qualifier).length, withChecker: decisions.filter((d) => d.checker).length },
    at: i.at, of: i.of, stage: i.stage, steps: i.steps, gates: i.gates, accepted: i.accepted, complete: i.complete, closed: i.closed, outcome: i.outcome,
  };
}

const SPEC_BODY = `# Spec: relevance that explains itself

## Context

People search the research archive by the words they remember, and today's ranking rewards the
words the author used. Twelve interviews (R1) and a week of the query log (R2) agree: **a third of
searches end without a click**, and the most common reason given was "I could not tell why these came back".

## Decisions

| Decision | Chosen | Rejected because |
|---|---|---|
| Where match reasons come from | the index, per field | a model's guess cannot be checked |
| Spelling suggestions | the query log | a dictionary does not know our product names |
| Latency budget | 120 ms at p95 | the current p95 is 95 ms; more than 25 ms is felt |

## Acceptance criteria

- [x] AC-1.1 A result names the field that matched, in the row, without a hover.
- [ ] AC-1.2 A query with no match says so and offers the nearest spelling that has one.
- [ ] AC-2.1 Ranking runs in under 120 ms at the 95th percentile on the sample index.

## Interfaces

\`\`\`ts
type Match = { field: 'title' | 'body' | 'tags'; terms: string[]; weight: number };
export function rank(query: string, docs: Doc[]): { doc: Doc; score: number; why: Match[] }[];
\`\`\`

The scoring weights live in \`config/ranking.json\`; see https://docs.example.com/search/ranking-signals-and-their-weights-explained-for-people-who-tune-them for the derivation.

> Out of scope: personalised ranking. Nothing here learns from one person's clicks.
`;

const body = (title: string) => `# ${title}\n\n## Summary\n\nWhat this document settles, in one paragraph a reader can act on.\n\n## Details\n\n- The first point, with the reason it holds.\n- The second point, and what would change it.\n`;

export function documentDetail(team: string, initiative: string, path: string): DocumentDetail | null {
  const d = initiativeDetail(team, initiative);
  const row = d?.documents.find((x) => x.path === path);
  if (!d || !row) return null;
  const isSpec = initiative === '2026-09-28-search-relevance' && path === 'spec.md';
  const text = isSpec ? SPEC_BODY : body(row.title ?? path);
  const versions = isSpec
    ? [1, 2, 3].map((v) => ({ path, version: v, body: v === 3 ? text : text.replace('120 ms', v === 1 ? '200 ms' : '150 ms'), status: v === 3 ? 'approved' : 'draft', approved_by: v === 3 ? row.approved_by : null, updated_at: ago(60 + (3 - v) * 20), bytes: row.bytes - (3 - v) * 900 }))
    : [{ path, version: 1, body: text, status: row.status, approved_by: row.approved_by, updated_at: row.updated_at, bytes: row.bytes }];
  const sources = d.documents.filter((x) => x.supports === path).map((x) => ({ path: x.path, title: x.title, body: body(x.title ?? x.path), supports: path, added: x.updated_at.slice(0, 10), bytes: x.bytes }));
  const decisions = d.decisions.filter((x) => x.path === path).map(({ path: _p, ...rest }) => rest);
  return {
    team, initiative, path, flow: row.type === 'note' ? null : FLOW, type: row.type, status: row.status, outcome: row.outcome,
    approved_by: row.approved_by, approved_at: row.approved_by ? row.updated_at : null, closed_by: null,
    title: row.title, tags: isSpec ? ['search', 'ranking', 'explainability'] : null, evidence: null, superseded_by: null,
    body: text, updated_at: row.updated_at, bytes: row.bytes, gated: row.gated, closing: row.closing, requiredForClose: row.requiredForClose,
    decisions, decisionCounts: { rows: decisions.length, withVerdict: decisions.filter((x) => x.verdict).length, withQualifier: decisions.filter((x) => x.qualifier).length, withChecker: decisions.filter((x) => x.checker).length },
    versions, sources,
  };
}

type NodeSeed = [team: string, num: string, type: string, status: string, title: string, tags: string[], evidence: string | null, hours: number];
const NODE_SEEDS: NodeSeed[] = [
  ['atlas', '0001', 'process', 'adopted', 'Run it, do not read it: a claim about an artifact is evidence only once something executes it', ['flow:sdlc-flow'], '2026-09-12-onboarding-revamp', 500],
  ['atlas', '0002', 'decision', 'adopted', 'Match reasons come from the index, never from a model', ['search'], '2026-09-28-search-relevance', 50],
  ['atlas', '0003', 'process', 'adopted', 'Interview before you instrument', ['research'], '2026-09-12-onboarding-revamp', 480],
  ['atlas', '0004', 'pattern', 'superseded', 'Rank by recency first', ['search'], null, 900],
  ['atlas', '0005', 'pattern', 'adopted', 'Rank by recency only to break a tie', ['search'], '2026-09-28-search-relevance', 52],
  ['atlas', '0006', 'gotcha', 'adopted', 'The query log drops queries longer than 256 characters, so the longest searches never reach an analysis', ['search', 'data'], '2026-09-28-search-relevance', 40],
  ['beacon', '0001', 'decision', 'adopted', 'Refunds are a ledger entry, never an edit', ['payments'], '2026-09-18-chargeback-alerts', 260],
  ['beacon', '0002', 'gotcha', 'adopted', 'Card networks report a chargeback up to 120 days late', ['payments'], '2026-09-18-chargeback-alerts', 250],
  ['beacon', '0003', 'process', 'draft', 'Alert on the trend, not the count', ['alerts'], null, 20],
  ['cinder', '0001', 'process', 'adopted', 'A runbook nobody rehearsed is a guess', ['ops'], '2026-08-20-incident-runbooks', 1000],
];
const nodePath = (num: string, title: string) => `nodes/${num}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/-$/, '')}.md`;

export const KNOWLEDGE: KnowledgeNode[] = NODE_SEEDS.map(([team, num, type, status, title, tags, evidence, hours]) => ({
  key: `${team}/${nodePath(num, title)}`, num, team, path: nodePath(num, title), type, status, title, tags, updated: ago(hours),
  bytes: 1_400 + Number(num) * 230, excerpt: `${title}. The evidence and the reasoning, as the initiative that learned it wrote them down.`,
  evidence: evidence ? [evidence] : null,
  superseded_by: status === 'superseded' ? '0005' : null,
}));

export function knowledgeBody(team: string, path: string): KnowledgeBody | null {
  const n = KNOWLEDGE.find((x) => x.team === team && x.path === path);
  if (!n) return null;
  return {
    team, path, type: n.type, status: n.status, title: n.title, tags: n.tags, updated: n.updated,
    body: `\n${n.title}.\n\n- **What happened.** The initiative found it the slow way, and wrote down how.\n- **What to do.** Check it before you build on it; it takes one command.\n\n\`\`\`sh\npnpm verify\n\`\`\`\n`,
    evidence: n.evidence, superseded_by: n.superseded_by,
    evidence_in: n.evidence?.map((name) => ({ name, team: INITIATIVES.find((i) => i.slug === name)?.team ?? null })) ?? null,
  };
}

const LOG: KnowledgeLogEntry[] = [
  ...KNOWLEDGE.map((n): KnowledgeLogEntry => ({ ts: n.updated, actor: 'noah.okafor@example.com', team: n.team, kind: 'knowledge.add', node: n.num, recorded_title: n.title, superseded_by: null, node_title: n.title, node_status: n.status })),
  { ts: ago(52), actor: 'noah.okafor@example.com', team: 'atlas', kind: 'knowledge.supersede', node: '0004', recorded_title: 'Rank by recency first', superseded_by: '0005', node_title: 'Rank by recency first', node_status: 'superseded' },
  { ts: ago(700), actor: 'leo.santos@example.com', team: 'cinder', kind: 'knowledge.add', node: '0002', recorded_title: 'Page the on-call, not the channel', superseded_by: null, node_title: null, node_status: null },
];
export const KNOWLEDGE_LOG = LOG.sort((a, b) => b.ts.localeCompare(a.ts));

