/**
 * The fake gateway's work: initiatives on the sdlc flow, their documents and sources, and the
 * knowledge store they fed.
 *
 * One initiative per state a page draws: drafting, waiting on a person, not started, ready to close,
 * gone quiet, closed three ways (accepted, delivered, abandoned), closed with a correction awaiting
 * approval (in the signed-in user's own team, where they may sign it, and in another of their
 * teams, where they are told to switch), a document another session revises after every read,
 * one it revises every few seconds, one whose presentation zz-core refuses, and one with no
 * flow at all, and more than ten in atlas, so its list pages. `atlas/…-search-relevance` is the rich one: a document
 * with every block a reader meets (a table, code, a task list, a long address), three public
 * versions over four snapshots (v3 presented, then approved), sources numbered past 9 so their
 * order is tested, and a plan waiting on approval.
 */
import { createHash } from 'node:crypto';
import type {
  DocumentDetail, DocumentRevision, Gate, Initiative, InitiativeDetail, KnowledgeBody, KnowledgeNode, Step,
} from '../../src/lib/api-shapes.ts';
import { ago, now } from './clock.ts';
import { lessonBody, lessonExcerpt } from './lesson-text.ts';

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
  /** Closed, then review.md corrected: the public version of the correction awaiting approval — the next one,
   *  or 1 for a metadata-only correction, which files a later row in the approved version. */
  correction?: number;
  /** A document another session revises a moment after every read: the store is one snapshot ahead
   *  of what a page is served, so recording it as shown is refused as out of date — see `revisionInStore`. */
  moving?: string;
  /** A document another session revises every `DRIFT_MS`: a read serves the snapshot the store holds at that moment,
   *  so a page records the one it loaded, and a focus refetch past the console's staleTime brings a newer one. */
  drifting?: string;
  /** A document whose presentation zz-core refuses outright — not a 409 — so Approve is unavailable. */
  unrecordable?: string;
  /** Who approved a gate's document where it was not the stakeholder, and how many hours ago where it was not the
   *  document's own place in the flow: an approval is the person who signed it, whoever the work was for. */
  approvals?: Record<string, { by: string; hours?: number }>;
};

const SEEDS: Seed[] = [
  { team: 'atlas', slug: '2026-09-28-search-relevance', at: 4, updated: 2, stakeholder: 'noah.okafor@example.com', passed: 1, written: 2, outcome: null },
  { team: 'atlas', slug: '2026-10-02-query-latency', at: 2, updated: 5, stakeholder: null, passed: 0, written: 1, outcome: null, moving: 'spec.md' },
  { team: 'atlas', slug: '2026-10-03-ranking-weights', at: 2, updated: 3, stakeholder: null, passed: 0, written: 1, outcome: null, drifting: 'spec.md' },
  { team: 'atlas', slug: '2026-10-04-index-rebuild', at: 2, updated: 4, stakeholder: null, passed: 0, written: 1, outcome: null, unrecordable: 'spec.md' },
  { team: 'atlas', slug: '2026-09-12-onboarding-revamp', at: 7, updated: 220, stakeholder: 'ava.lindqvist@example.com', passed: 4, written: 4, outcome: 'accepted', correction: 2,
    approvals: { 'spec.md': { by: 'noah.okafor@example.com' } } },
  { team: 'atlas', slug: '2026-09-05-research-notes', at: 0, updated: 400, stakeholder: null, passed: 0, written: 0, outcome: null, flow: false },
  // Enough more of atlas's work that its list pages at ten: open work ready to close (every gate it is judged on
  // passed) and not started, work gone quiet, and closed work of every outcome.
  { team: 'atlas', slug: '2026-10-08-result-explanations', at: 7, updated: 6, stakeholder: 'noah.okafor@example.com', passed: 3, written: 3, outcome: null,
    approvals: { 'spec.md': { by: 'ava.lindqvist@example.com' }, 'plan.md': { by: 'ava.lindqvist@example.com' }, 'review.md': { by: 'ava.lindqvist@example.com' } } },
  { team: 'atlas', slug: '2026-10-06-snippet-quality', at: 1, updated: 30, stakeholder: null, passed: 0, written: 0, outcome: null },
  { team: 'atlas', slug: '2026-09-15-tagging-model', at: 3, updated: 380, stakeholder: null, passed: 1, written: 1, outcome: null,
    approvals: { 'spec.md': { by: 'ava.lindqvist@example.com' } } },
  { team: 'atlas', slug: '2026-08-25-eval-harness', at: 7, updated: 500, stakeholder: 'noah.okafor@example.com', passed: 4, written: 4, outcome: 'delivered',
    approvals: { 'spec.md': { by: 'ava.lindqvist@example.com' }, 'plan.md': { by: 'ava.lindqvist@example.com' }, 'handover.md': { by: 'ava.lindqvist@example.com' } } },
  // Its spec was approved before presentations were recorded, more than six weeks ago, so Approvals dates it by its day.
  { team: 'atlas', slug: '2026-08-14-citation-graph', at: 7, updated: 650, stakeholder: 'ava.lindqvist@example.com', passed: 4, written: 4, outcome: 'accepted',
    approvals: { 'spec.md': { by: 'ava.lindqvist@example.com', hours: 1_100 } } },
  { team: 'atlas', slug: '2026-08-02-ingest-pipeline', at: 2, updated: 160, stakeholder: null, passed: 0, written: 1, outcome: 'abandoned' },
  { team: 'beacon', slug: '2026-09-30-refund-flow', at: 2, updated: 9, stakeholder: 'jonas.weber@example.com', passed: 0, written: 1, outcome: null },
  { team: 'beacon', slug: '2026-10-01-ledger-migration-to-double-entry-bookkeeping-with-nightly-reconciliation', at: 0, updated: 30, stakeholder: null, passed: 0, written: 0, outcome: null },
  // Closed 400 hours ago, before the last whole week on every day of the week and at every hour, so beacon's last week
  // holds no closure whenever the fake starts: 300 hours crossed that week's Monday as the hours of a Saturday passed.
  { team: 'beacon', slug: '2026-09-18-chargeback-alerts', at: 7, updated: 400, stakeholder: 'mei.tanaka@example.com', passed: 4, written: 4, outcome: 'delivered' },
  // A metadata-only correction: it stays in v1, so v1 reads as the correction and names the approval it superseded.
  { team: 'beacon', slug: '2026-09-22-payout-schedule', at: 7, updated: 26, stakeholder: 'jonas.weber@example.com', passed: 4, written: 4, outcome: 'accepted', correction: 1 },
  { team: 'cinder', slug: '2026-08-20-incident-runbooks', at: 3, updated: 900, stakeholder: 'leo.santos@example.com', passed: 1, written: 1, outcome: 'abandoned' },
];

function steps(s: Seed): Step[] {
  if (s.flow === false) return [];
  const closed = s.outcome !== null;
  const body = STAGES.map(([name, produces, what], i): Step => {
    const n = i + 1;
    // A correction is the closing stage's document written and waiting on a person again.
    const state: Step['state'] = produces === '' ? (n <= s.at ? 'done' : 'untracked')
      : n < s.at ? 'done' : n === s.at ? (closed && !s.correction ? 'done' : 'partial') : 'empty';
    return { name, produces, what, state, current: !closed && n === s.at };
  });
  return [
    { name: 'open', produces: '', what: 'the initiative exists: its folder was created and it was opened', state: 'done', current: !closed && s.at === 0 },
    ...body,
    { name: 'closed', produces: '', what: 'initiative_close recorded an outcome', state: closed ? 'done' : 'empty', current: false },
  ];
}

// A correction reopens review.md's gate (the third) while the close stands.
const gates = (s: Seed): Gate[] => s.flow === false ? [] : GATE_AFTER.map(([name, role, after], i) => ({ name, role, after, passed: i < s.passed && !(s.correction && i === 2), written: i < s.written }));

function stageOf(s: Seed) {
  if (s.flow === false) return '';
  return s.at === 0 ? 'open' : STAGES[s.at - 1][0];
}

type Doc = InitiativeDetail['documents'][number];

/** Each flow document's place, counted back from the last: a document is written six hours after the one before it. */
const STEP: Record<string, number> = { 'explore.md': 4, 'spec.md': 3, 'plan.md': 2, 'review.md': 1, 'handover.md': 0 };

/** Who approved `path` of `s`: the person its approval names, the stakeholder where none is named. */
const signerOf = (s: Seed, path: string): string | null => s.approvals?.[path]?.by ?? s.stakeholder;

/** How many hours ago `path` of `s` was approved, or, for a document no gate approved, last written. */
const approvedHours = (s: Seed, path: string): number => s.approvals?.[path]?.hours ?? s.updated + (STEP[path] ?? 0) * 6;
const doc = (path: string, type: string, o: Partial<Doc> & { hours: number; bytes: number }): Doc => ({
  path, type, status: null, outcome: null, approved_by: null, title: null, supports: null, gated: null,
  closing: false, requiredForClose: false, correction: null, updated_at: ago(o.hours), ...o,
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
      // Filed under the web address it was read at, as an agent files a page it found: the title is the address.
      doc('sources/https-docs-example-com-search-ranking-signals-and-their-weights-explained.md', 'source', { title: 'https://docs.example.com/search/ranking-signals-and-their-weights-explained', supports: 'plan.md', hours: 3, bytes: 5_120 }),
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
  const add = (path: string, type: string, title: string, gateIndex: number | null) => {
    const n = STEP[path];
    const corrected = type === 'verification' && !!s.correction;
    const passed = gateIndex !== null && gateIndex < s.passed && !corrected;
    out.push(doc(path, type, {
      title, gated: gateIndex !== null, status: gateIndex === null ? '' : passed ? 'approved' : 'draft',
      approved_by: passed ? signerOf(s, path) : null, hours: approvedHours(s, path), bytes: 4_000 + n * 3_100,
      ...(type === 'verification' ? { closing: true, requiredForClose: true, outcome: s.outcome } : {}),
      ...(corrected ? { correction: s.correction, hours: s.updated - 20 } : {}),
    }));
  };
  if (s.at >= 1) add('explore.md', 'ground', 'Exploration', null);
  if (s.at >= 2 || s.written >= 1) add('spec.md', 'agreement', 'Spec', 0);
  if (s.at >= 4) add('plan.md', 'plan', 'Plan', 1);
  if (s.at >= 7) { add('review.md', 'verification', 'Review', 2); add('handover.md', 'handover', 'Handover', 3); }
  return out;
}

/* The list's own count of each initiative's documents, taken from the documents its detail serves rather than from a
 * second rule: the gateway reads both from the same rows, so a list figure that disagreed with the detail would be a
 * console contradiction no page could resolve. */
export const INITIATIVES: Initiative[] = SEEDS.map((s) => ({
  team: s.team, slug: s.slug, flow: s.flow === false ? null : FLOW,
  documents: documents(s).length, approvals: s.passed,
  updated: ago(s.updated), stakeholder: s.stakeholder,
  at: s.at, of: s.flow === false ? 0 : 7, stage: stageOf(s), steps: steps(s), gates: gates(s),
  accepted: s.outcome === 'accepted', complete: s.outcome === 'accepted' || s.outcome === 'delivered',
  closed: s.outcome !== null, outcome: s.outcome,
  correction: s.correction ? { path: 'review.md', version: s.correction } : null,
}));

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
    correction: i.correction,
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

/**
 * A document's own text, shaped by the role the flow gives it.
 *
 * DELIBERATE, and the register says it plainly: sample data is "realistic data in the person's domain, never lorem
 * ipsum or 'Item 1'". This used to be one generic body — "What this document settles, in one paragraph a reader can
 * act on" — for every document and every source, which is what the craft step reads when it opens a rendered page. A
 * spec that does not read like a spec makes the reading view look like a demonstration of one.
 *
 * Every body carries the clause "after two rounds of review" so `textOf` has something to vary for an earlier
 * snapshot; without it a version chain would show two snapshots with identical text.
 */
/** Evidence attached to a document. A source carries no flow stage and its path is a bare filename, so it is told
 *  apart by what it is rather than by where it sits — it is the one document nothing is gated on. */
function sourceBody(title: string): string {
  return `# ${title}\n\n## What it is\n\nA record of one afternoon's work, kept because a later decision leans on it. It is evidence,\nnever an agreement: nobody signs a source, and nothing is gated on one.\n\n## What it supports\n\nThe claim it was filed against, and the one figure in it that a reader would want to check: the\ncounts are of sessions on the sample index, not of the platform.\n`;
}

function body(title: string, path: string): string {
  const head = `# ${title}\n\n`;
  if (path.startsWith('explore')) {
    return `${head}## What we are deciding\n\nWhether this is worth a spec at all, and which of two ways in we would take. Ground is\nwhat turns a feeling into something a spec can be written against.\n\n## What we found\n\nTwo things, and one of them only after the second look: the slow path is taken by the\nthing we thought was rare. Settled after two rounds of review.\n\n## What would change the answer\n\nA week of figures showing the other path is common, which the sample index cannot say.\n`;
  }
  if (path.startsWith('plan')) {
    return `${head}## Approach\n\nContract first: the criteria below are written before anything is built, and each task\nnames the criterion it answers. Settled after two rounds of review.\n\n## Tasks\n\n- **I-1** The index carries the reason a result matched, so no caller reconstructs it.\n- **I-2** Suggestions come from the query log. A model never invents a spelling.\n- **I-3** The latency budget is measured on the sample index and printed by the gate.\n\n## What is not in this plan\n\nAnything that needs a person to be online while a query runs.\n`;
  }
  if (path.startsWith('review')) {
    return `${head}## What was built\n\nThe plan's three tasks, in the order it named them, with the criteria traced back to\nthe checks that hold them.\n\n## What the evidence shows\n\nEvery acceptance criterion has a check, except one that the sample data cannot reach —\nthat one is written down as unmet rather than as passed. Settled after two rounds of review.\n\n## What is left\n\nTwo things a person has to decide, and neither is a defect: how long to keep the old\nindex beside the new one, and whether the budget moves with the corpus.\n`;
  }
  return `${head}## Summary\n\nWhat this document settles, in one paragraph a reader can act on, with the figure it\nleans on named so a later reader can check it. Settled after two rounds of review.\n\n## Details\n\n- The decision, the alternative it was chosen over, and what ruled that one out.\n- What would change it, and the measurement that would have to move first.\n`;
}

/** The snapshots of one document, oldest first: its public version, whether it was approved, and how many hours ago it
 *  was written, an approval being the write of the snapshot it approves. The rich spec has three versions over four
 *  snapshots — v3 was presented as r3 and approved as r4 — so a version and the snapshot it is read as differ; a
 *  corrected review.md was approved as v1 when its seed approved it, and is a draft of its correction's version since —
 *  v1 itself for a metadata-only one, whose approval the draft supersedes. Every other document is one snapshot, written
 *  when the document last was, which for an approved one is its approval. Approvals (work-approvals.ts) reads its
 *  history off exactly these, so an approval there is the one the document's page names. */
function snapshotsOf(s: Seed, row: Doc): { version: number; approved: boolean; hours: number }[] {
  if (s.slug === '2026-09-28-search-relevance' && row.path === 'spec.md') {
    return [{ version: 1, approved: false, hours: 120 }, { version: 2, approved: false, hours: 100 }, { version: 3, approved: false, hours: 80 }, { version: 3, approved: true, hours: 60 }];
  }
  const written = (now() - Date.parse(row.updated_at)) / 3_600_000;
  if (row.correction) return [{ version: 1, approved: true, hours: approvedHours(s, row.path) }, { version: row.correction, approved: false, hours: written }];
  return [{ version: 1, approved: row.status === 'approved', hours: written }];
}

/** A snapshot's text: the live text for the last one, and an earlier wording for the rest. */
const ROUNDS = ['one', 'two', 'three', 'four'];
function textOf(live: string, revision: number, count: number): string {
  if (revision === count) return live;
  const n = Math.min(revision, ROUNDS.length);
  return live
    .replace('after two rounds of review', `after ${ROUNDS[n - 1]} round${n === 1 ? '' : 's'} of review`)
    .replace('120 ms', `${200 - revision * 25} ms`);
}

/** A snapshot's `content_revision`, shaped as the gateway's: `cr_` and 26 lowercase base32 characters, here of
 *  sha256 of the document's address and its snapshot, so every run names a snapshot alike. */
export function contentRevisionOf(team: string, initiative: string, path: string, revision: number): string {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = createHash('sha256').update(`${team}/${initiative}/${path}:${revision}`).digest();
  let out = '';
  for (let i = 0; out.length < 26; i++) out += ALPHABET[bytes[i] % 32];
  return `cr_${out}`;
}

/** How often another session revises a `drifting` document, and so how often the fake hints `document` (`onDrift`). */
export const DRIFT_MS = 15_000;

/** The revisions another session has made to every `drifting` document since the server started. */
const drifted = () => Math.floor((Date.now() - now()) / DRIFT_MS);

/** Snapshots a `drifting` document has gained since the server started; zero for every other document. */
function drift(team: string, initiative: string, path: string): number {
  const drifting = SEEDS.find((x) => x.team === team && x.slug === initiative)?.drifting === path;
  return drifting ? drifted() : 0;
}

/**
 * Call `revised` each time the drifting documents gain a revision, as the gateway's trigger notifies on every revision
 * a writer makes (zz-stack's services/gateway/migrations/003_console_live.sql). Started by a serving fake alone, never
 * on import, and unref'd, so it holds no process open.
 *
 * Never before the snapshot: a timer can fire a moment short of the boundary it was set for, and a hint that arrived
 * first would send a tab to read the snapshot it already holds. Each firing reads the count again, tells only of one
 * that moved, and sets itself for the next boundary.
 */
export function onDrift(revised: () => void): void {
  let told = drifted();
  const tick = () => {
    if (drifted() > told) { told = drifted(); revised(); }
    setTimeout(tick, DRIFT_MS - ((Date.now() - now()) % DRIFT_MS)).unref();
  };
  setTimeout(tick, DRIFT_MS - ((Date.now() - now()) % DRIFT_MS)).unref();
}

/** Whether zz-core refuses to record a presentation of this document (`unrecordable`). */
export function refusesRecord(team: string, initiative: string, path: string): boolean {
  return SEEDS.find((x) => x.team === team && x.slug === initiative)?.unrecordable === path;
}

export function documentDetail(team: string, initiative: string, path: string): DocumentDetail | null {
  const d = initiativeDetail(team, initiative);
  const row = d?.documents.find((x) => x.path === path);
  if (!d || !row) return null;
  const isSpec = initiative === '2026-09-28-search-relevance' && path === 'spec.md';
  const text = isSpec ? SPEC_BODY : body(row.title ?? path, path);
  const seed = SEEDS.find((x) => x.team === team && x.slug === initiative)!;
  const snaps = snapshotsOf(seed, row);
  const current = snaps.length;
  // Who approved an earlier snapshot of a document that is a draft now: the person its approval names.
  const signer = signerOf(seed, path);
  // Metadata only, like the gateway, one entry per public version: its last retained state, the
  // version's last snapshot, naming the approved one it superseded when it is not approved itself.
  // A snapshot's text is read on its own, through `documentRevision` below.
  const versions = [...new Set(snaps.map((x) => x.version))].map((v) => {
    const mine = snaps.map((x, i) => ({ ...x, revision: i + 1 })).filter((x) => x.version === v);
    const pick = mine[mine.length - 1];
    const sealed = pick.approved ? undefined : mine.filter((x) => x.approved).pop();
    return { path, version: v, revision: pick.revision, hash: `${path}-${pick.revision}`,
             status: pick.approved ? 'approved' : pick.revision === current ? row.status : 'draft',
             approved_by: pick.approved ? (row.approved_by ?? signer) : null,
             updated_at: ago(pick.hours),
             superseded_approved: sealed ? { revision: sealed.revision, approved_by: row.approved_by ?? signer,
                                             content_revision: contentRevisionOf(team, initiative, path, sealed.revision),
                                             approved_at: ago(sealed.hours) } : null };
  });
  const sources = d.documents.filter((x) => x.supports === path).map((x) => ({ path: x.path, title: x.title, body: sourceBody(x.title ?? x.path), supports: path, added: x.updated_at.slice(0, 10), bytes: x.bytes }));
  const decisions = d.decisions.filter((x) => x.path === path).map(({ path: _p, ...rest }) => rest);
  return {
    team, initiative, path, current_revision: current, current_version: snaps[current - 1].version, correction: row.correction,
    content_revision: contentRevisionOf(team, initiative, path, current + drift(team, initiative, path)),
    flow: row.type === 'note' ? null : FLOW, type: row.type, status: row.status, outcome: row.outcome,
    approved_by: row.approved_by, approved_at: row.approved_by ? row.updated_at : null, closed_by: null,
    title: row.title, tags: isSpec ? ['search', 'ranking', 'explainability'] : null, evidence: null, superseded_by: null,
    stakeholder: row.gated ? seed.stakeholder : null, fields: isSpec ? { audience: 'research archive users', risk: 'medium' } : {},
    body: text, updated_at: row.updated_at, bytes: row.bytes, gated: row.gated, closing: row.closing, requiredForClose: row.requiredForClose,
    decisions, decisionCounts: { rows: decisions.length, withVerdict: decisions.filter((x) => x.verdict).length, withQualifier: decisions.filter((x) => x.qualifier).length, withChecker: decisions.filter((x) => x.checker).length },
    versions, sources,
  };
}

/** The `content_revision` the store holds for a document now, which `documents/shown` and
 *  `documents/approve` hold a page's snapshot against: the one a read serves, except for a moving
 *  document, whose store is always one snapshot ahead. Null for a document that does not exist. */
export function revisionInStore(team: string, initiative: string, path: string): string | null {
  const d = documentDetail(team, initiative, path);
  if (!d) return null;
  const moving = SEEDS.find((x) => x.team === team && x.slug === initiative)?.moving === path;
  return moving ? contentRevisionOf(team, initiative, path, d.current_revision + 1) : d.content_revision;
}

/** One snapshot's text, as `/document/:team/:slug/:path?revision=N` serves it, N the snapshot id. */
export function documentRevision(team: string, initiative: string, path: string, revision: number): DocumentRevision | null {
  const d = initiativeDetail(team, initiative);
  const row = d?.documents.find((x) => x.path === path);
  if (!d || !row) return null;
  const isSpec = initiative === '2026-09-28-search-relevance' && path === 'spec.md';
  const text = isSpec ? SPEC_BODY : body(row.title ?? path, path);
  const snaps = snapshotsOf(SEEDS.find((x) => x.team === team && x.slug === initiative)!, row);
  if (!Number.isInteger(revision) || revision < 1 || revision > snaps.length) return null;
  return { version: snaps[revision - 1].version, revision, body: textOf(text, revision, snaps.length) };
}

type NodeSeed = [team: string, num: string, type: string, status: string, title: string, tags: string[], evidence: string | null, hours: number];
/* `type` is one of the six kinds the store allows, which is exactly what the shelf's filter offers: a lesson of any
 * other kind would be served by a shelf that cannot be narrowed to it. */
const NODE_SEEDS: NodeSeed[] = [
  ['atlas', '0001', 'process', 'adopted', 'Run it, do not read it: a claim about an artifact is evidence only once something executes it', ['flow:sdlc-flow'], '2026-09-12-onboarding-revamp', 500],
  ['atlas', '0002', 'decision', 'adopted', 'Match reasons come from the index, never from a model', ['search'], '2026-09-28-search-relevance', 50],
  ['atlas', '0003', 'process', 'adopted', 'Interview before you instrument', ['research'], '2026-09-12-onboarding-revamp', 480],
  ['atlas', '0004', 'design', 'superseded', 'Rank by recency first', ['search'], null, 900],
  ['atlas', '0005', 'design', 'adopted', 'Rank by recency only to break a tie', ['search'], '2026-09-28-search-relevance', 52],
  ['atlas', '0006', 'behavior', 'adopted', 'The query log drops queries longer than 256 characters, so the longest searches never reach an analysis', ['search', 'data'], '2026-09-28-search-relevance', 40],
  ['beacon', '0001', 'decision', 'adopted', 'Refunds are a ledger entry, never an edit', ['payments'], '2026-09-18-chargeback-alerts', 260],
  ['beacon', '0002', 'behavior', 'adopted', 'Card networks report a chargeback up to 120 days late', ['payments'], '2026-09-18-chargeback-alerts', 250],
  ['beacon', '0003', 'process', 'draft', 'Alert on the trend, not the count', ['alerts'], null, 20],
  ['cinder', '0001', 'process', 'adopted', 'A runbook nobody rehearsed is a guess', ['ops'], '2026-08-20-incident-runbooks', 1000],
];
const nodePath = (num: string, title: string) => `nodes/${num}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/-$/, '')}.md`;

/** Each team's lessons. Every one cites an initiative of its own team's, so none counts another's. */
export const KNOWLEDGE: KnowledgeNode[] = NODE_SEEDS.map(([team, num, type, status, title, tags, evidence, hours]) => ({
  key: `${team}/${nodePath(num, title)}`, num, team, path: nodePath(num, title), type, status, title, tags, updated: ago(hours),
  bytes: 1_400 + Number(num) * 230, excerpt: lessonExcerpt(team, num, title),
  evidence: evidence ? [evidence] : null, cited_elsewhere: 0,
  superseded_by: status === 'superseded' ? '0005' : null,
}));

/** One node, whole. `own` is the one team a member is held to: their shelf is that team's, so the node's neighbours,
 *  the shelf's span and the team of each piece of evidence are read from it and from nowhere else. */
export function knowledgeBody(team: string, path: string, own: string | null = null): KnowledgeBody | null {
  const shelf = own ? KNOWLEDGE.filter((x) => x.team === own) : KNOWLEDGE;
  const work = own ? INITIATIVES.filter((i) => i.team === own) : INITIATIVES;
  const n = shelf.find((x) => x.team === team && x.path === path);
  if (!n) return null;
  return {
    team, path, type: n.type, status: n.status, title: n.title, tags: n.tags, updated: n.updated,
    body: lessonBody(n.team, n.num, n.title),
    evidence: n.evidence, cited_elsewhere: n.cited_elsewhere, superseded_by: n.superseded_by, num: n.num,
    evidence_in: n.evidence?.map((name) => ({ name, team: work.find((i) => i.slug === name)?.team ?? null })) ?? null,
    // The neighbours and the shelf's span, served with the node rather than found on the client —
    // see `KnowledgeBody.related`.
    related: shelf.filter((x) => x.key !== n.key && (x.tags ?? []).some((t) => (n.tags ?? []).includes(t))),
    multi_team: new Set(shelf.map((x) => x.team)).size > 1,
    shelf: 'team',
  };
}
