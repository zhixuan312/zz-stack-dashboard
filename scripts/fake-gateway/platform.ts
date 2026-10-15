/**
 * The fake gateway's platform: the catalog's plugins and the skills each ships, one plugin evaluation, a skill's text,
 * and the overview's figures. What a team made of the catalog (its calls, its runs) is `work-plugins.ts`'s.
 *
 * Five plugins, one per state the plugin pages draw: `sdlc` is a method (stages, gates) with an established evaluation;
 * `zz-core` is the platform, profiled and never scored; `zz-access` is registered and never profiled; `zz-plugin-eval`
 * is scored in public and was never registered here; `research-kit` is vendored from another team, never run, with no
 * release and no evaluation.
 */
import type { Overview, PluginEval, PluginEvalFound, PluginRow, SkillText } from '../../src/lib/api-shapes.ts';
import { ago, now } from './clock.ts';

type SkillSeed = [name: string, plugin: string, position: number | null, calls: number, refusals: number, runs: number];
const SKILL_SEEDS: SkillSeed[] = [
  ['sdlc-flow', 'sdlc', null, 412, 3, 61],
  ['sdlc-method', 'sdlc', null, 380, 0, 58],
  ['sdlc-explore', 'sdlc', 1, 1_204, 12, 40],
  ['sdlc-spec', 'sdlc', 2, 2_696, 81, 52],
  ['sdlc-spec-audit', 'sdlc', 3, 970, 44, 31],
  ['sdlc-plan', 'sdlc', 4, 2_115, 37, 47],
  ['sdlc-plan-audit', 'sdlc', 5, 1_002, 29, 30],
  ['sdlc-execute', 'sdlc', 6, 814, 18, 22],
  ['sdlc-review', 'sdlc', 7, 655, 9, 25],
  ['sdlc-audit-criteria', 'sdlc', null, 1_057, 0, 33],
  ['zz-platform', 'zz-core', null, 3_380, 140, 210],
  ['zz-handover', 'zz-core', null, 290, 6, 41],
  ['zz-access', 'zz-access', null, 96, 5, 30],
  ['zz-plugin-observe', 'zz-plugin-eval', 1, 0, 0, 0],
  ['zz-plugin-evaluate', 'zz-plugin-eval', 2, 0, 0, 0],
  ['research-scan', 'research-kit', null, 0, 0, 0],
  ['research-cite', 'research-kit', null, 0, 0, 0],
];

const describe = (name: string) => `What ${name} is for, in the words its own SKILL.md opens with.`;

/** The skills the catalog ships, by plugin and their place in its method: the same for every team. */
export const CATALOG_SKILLS = SKILL_SEEDS.map(([name, plugin, position]) => ({
  name, plugin, position, version: plugin === 'research-kit' ? '0.3' : '1.14', description: describe(name),
  origin: plugin === 'research-kit' ? 'theirs' as const : 'ours' as const,
  source: plugin === 'research-kit' ? 'github.com/example-labs/research-kit' : null,
}));

/** A plugin as the catalog declares it: the same for every team, with none of a team's use of it. */
type CatalogPlugin = Pick<PluginRow, 'plugin' | 'owner' | 'agentName' | 'version' | 'servers' | 'description' | 'stages' | 'entry' | 'documents' | 'gates' | 'release'>;

export const CATALOG: CatalogPlugin[] = [
  {
    plugin: 'sdlc', owner: 'sdlc', agentName: 'SDLC Agent', version: '0.92.10', servers: ['zz-core'],
    description: 'Software delivery: explore the ground, agree a spec, audit it, plan it, audit that, build it, review it, then close and hand over.',
    stages: SKILL_SEEDS.filter(([, p, pos]) => p === 'sdlc' && pos !== null).map(([n]) => n), entry: 'sdlc-flow',
    documents: [
      { name: 'explore.md', role: 'ground', gate: false, stage: 'sdlc-explore' },
      { name: 'spec.md', role: 'agreement', gate: true, stage: 'sdlc-spec' },
      { name: 'plan.md', role: 'plan', gate: true, stage: 'sdlc-plan' },
      { name: 'review.md', role: 'verification', gate: true, stage: 'sdlc-review' },
    ],
    gates: 3, release: { version: '0.92.10', digest: '2f16e125', evals: 2 },
  },
  {
    plugin: 'zz-core', owner: null, agentName: null, version: '0.92.10', servers: ['zz-core'],
    description: 'The platform itself: documents, gates, initiatives and the knowledge store every flow writes to.',
    stages: [], entry: null, documents: [], gates: 0, release: { version: '0.92.10', digest: '7c01aa94', evals: 0 },
  },
  {
    plugin: 'zz-access', owner: 'zz-access', agentName: 'ZZ Access', version: '0.92.10', servers: ['zz-access'],
    description: 'Your own access: who you are, which team you act for, your tokens and your client setup.',
    stages: [], entry: null, documents: [], gates: 0, release: null,
  },
  {
    plugin: 'zz-plugin-eval', owner: 'zz-plugin-eval', agentName: 'ZZ Plugin Eval', version: '0.92.10', servers: ['zz-plugin-eval', 'zz-core'],
    description: 'Judges a plugin by what its real runs did, against a protocol a person agreed first.',
    stages: SKILL_SEEDS.filter(([, p, pos]) => p === 'zz-plugin-eval' && pos !== null).map(([n]) => n), entry: null, documents: [], gates: 0,
    release: { version: '0.92.10', digest: '91d3be40', evals: 2 },
  },
  {
    plugin: 'research-kit', owner: 'example-labs', agentName: null, version: null, servers: ['web-search', 'zz-core'],
    description: null, stages: [], entry: null, documents: [], gates: 0, release: null,
  },
];

export function skillText(plugin: string, name: string): SkillText | null {
  const s = CATALOG_SKILLS.find((x) => x.name === name && x.plugin === plugin);
  if (!s) return null;
  return {
    skill: name, plugin, isEntry: name === 'sdlc-flow', origin: s.origin, version: s.version, description: s.description, source: s.source,
    whenToUse: `Use ${name} when the stage before it has closed and its document is approved.`,
    body: `# ${name}\n\n${describe(name)}\n\n## Steps\n\n1. Read the approved document this stage starts from.\n2. Do the work, one change at a time, with its check.\n3. Write the result with \`document_write\` and ask for approval.\n\n## When it stops\n\nA gate that is not approved stops the stage; it asks the person named as stakeholder.\n`,
    references: name === 'sdlc-spec' ? [
      { path: 'references/acceptance-criteria.md', content: '# Acceptance criteria\n\nEach criterion is observable, owned and checkable by running something.\n' },
      { path: 'references/decision-table.md', content: '# Decision table\n\n| Decision | Chosen | Rejected because |\n|---|---|---|\n| … | … | … |\n' },
    ] : [],
  };
}

/** A registered plugin's evaluation before anything was scored: the gateway's `base` and its empty sections. */
const NO_RUN = (plugin: string): PluginEvalFound => ({
  plugin, found: true, origin: 'platform', ownerTeam: 'atlas', releaseOwners: ['atlas'], ownershipMode: 'owned',
  subjectVersion: null, run: null, evaluatorTrust: [], findings: { strengths: [], defects: [], unknowns: [] }, candidates: [],
});

/** COUPLED: the gateway's `GET /api/console/plugins/:plugin/eval` (zz-stack, services/gateway/src/console/plugin-eval.ts)
 *  and checks/console-plugin-eval-shape.ts there, which holds this answer's key sets to the gateway's for each branch:
 *  `sdlc` scored, `zz-core` profiled and never scored, `zz-access` registered and never profiled, anything else not
 *  registered. */
export function pluginEval(plugin: string): PluginEval {
  if (plugin === 'zz-core') return { ...NO_RUN(plugin), subjectVersion: { id: 'sv_zzcore_1', declaredVersion: '0.92.10', contentDigest: '7c01aa94', capturedAt: ago(40) } };
  if (plugin === 'zz-access') return NO_RUN(plugin);
  if (plugin !== 'sdlc') return { plugin, found: false };
  const dim = (key: string, kind: string, score: number | null, applicable = true) => ({
    key, canonicalKind: kind, score, applicable, notApplicableReason: applicable ? null : 'no run of this plugin reached the surface this measures',
    weight: 0.25, required: true, measuresScored: applicable ? 2 : 0, measuresTotal: 2,
    measures: [
      { key: `${key}.rate`, evaluatorType: 'deterministic', weight: 0.5, required: true, value: score, excluded: !applicable, excludedReason: applicable ? null : 'not applicable', guardrail: false },
      { key: `${key}.judged`, evaluatorType: 'bounded_semantic', weight: 0.5, required: false, value: score === null ? null : score - 0.04, excluded: !applicable, excludedReason: applicable ? null : 'not applicable', guardrail: false },
    ],
  });
  const completion = dim('completion', 'effectiveness', 0.91);
  // Two guardrails, one with a value and one no run reached; the run's `guardrailStatus` is the one verdict over both.
  completion.measures.push(
    { key: 'refusal-rate', evaluatorType: 'deterministic', weight: 0, required: true, value: 0.031, excluded: false, excludedReason: null, guardrail: true },
    { key: 'abandoned-runs', evaluatorType: 'deterministic', weight: 0, required: false, value: null, excluded: true, excludedReason: 'no run reached the surface this measures', guardrail: true },
  );
  completion.measuresScored = 3;
  completion.measuresTotal = 4;
  const finding = (id: string, pattern: string, decision: string) => ({ id, pattern, ownerKind: 'plugin', ownerRef: 'sdlc', evidenceRefs: 4, expectedEffect: null, decision, decisionNote: decision === 'deferred' ? null : 'Applied in 0.92.10.' });
  return {
    ...NO_RUN(plugin),
    subjectVersion: { id: 'sv_sdlc_7', declaredVersion: '0.92.10', contentDigest: '2f16e125', capturedAt: ago(26) },
    run: {
      id: 'run_sdlc_12', scoreStatus: 'established', overallScore: 8.64, scoreInterval: { lower: 8.1, upper: 9.1 },
      measureCoverage: 0.88, establishmentBlockedBy: [], guardrailStatus: 'pass', scorerVersion: '0.92.10',
      protocol: { key: 'sdlc-protocol', version: 3 }, createdAt: ago(20), scoredAt: ago(19),
      dimensions: [completion, dim('gate-discipline', 'constraint_adherence', 0.88), dim('evidence', 'reliability', 0.79), dim('handover', 'generalization', null, false)],
      coverage: { usableRunCount: 61, totalRunCount: 68, surfaceObserved: 14, surfaceTotal: 16 },
    },
    evaluatorTrust: [{ stableKey: 'judge.evidence.v2', state: 'operationally_qualified', qualifiedAt: ago(200) }, { stableKey: 'judge.handover.v1', state: null, qualifiedAt: null }],
    findings: {
      strengths: [finding('f_1', 'Every approved spec names a checker for each criterion', 'applied')],
      defects: [finding('f_2', 'Plan audit re-reads the whole plan on every round instead of the changed sections', 'deferred'), finding('f_3', 'A refused document_approve is retried without reading the refusal', 'deferred')],
      unknowns: [finding('f_4', 'Whether handover reaches the next initiative at all', 'deferred')],
    },
    // Oldest first, as the gateway orders them.
    candidates: [
      { id: 'cand_2', hypothesis: 'Read the refusal before retrying an approval', status: 'valid', complexityDelta: 1, touchedComponents: ['skills/sdlc-spec'], touchedOwners: ['atlas'], createdAt: ago(130), build: { ok: true, stage: null }, release: { status: 'released', reason: 'Refused approvals fell from 41 to 9 over the next week.', releasedDeclaredVersion: '0.92.10', releaseRef: '2f16e125a0c4b7d9e1f3a5c7b9d1e3f5a7c9b1d3', verdict: 'established', verificationReason: 'Refused approvals fell from 41 to 9 over the next week.', rolledBack: false } },
      { id: 'cand_3', hypothesis: 'Split sdlc-spec into decide and write', status: 'invalid', complexityDelta: 4, touchedComponents: ['skills/sdlc-spec'], touchedOwners: ['atlas'], createdAt: ago(90), build: { ok: false, stage: 'gate' }, release: null },
      { id: 'cand_1', hypothesis: 'Audit only the sections a revision changed', status: 'valid', complexityDelta: -2, touchedComponents: ['skills/sdlc-plan-audit'], touchedOwners: ['atlas'], createdAt: ago(18), build: { ok: true, stage: null }, release: null },
    ],
  };
}

/** A repeatable 0..1 from an integer, so the same hour always draws the same noise. */
const hash = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/**
 * Tool calls in one hour, as a working team makes them: busy in the deployment's working day (UTC+8), quiet at night,
 * a third as much at the weekend, growing about 40% over half a year, with noise. Refusals run near 3%, with two bad
 * days when a release shipped a tool whose arguments every client still had cached.
 */
function hourly(h: number): { calls: number; refused: number } {
  const t = new Date(h * 3_600_000);
  const local = (t.getUTCHours() + 8) % 24, dow = new Date(h * 3_600_000 + 8 * 3_600_000).getUTCDay();
  const day = local >= 9 && local < 19 ? 1 : local >= 7 && local < 23 ? 0.35 : 0.06;
  const week = dow === 0 || dow === 6 ? 0.3 : 1;
  const age = (now() / 3_600_000 - h) / (24 * 182);
  const growth = 1.4 - 0.4 * Math.min(1, Math.max(0, age));
  const calls = Math.round(9 * day * week * growth * (0.6 + 0.8 * hash(h)));
  const daysAgo = Math.floor((now() / 3_600_000 - h) / 24);
  const spike = daysAgo === 12 || daysAgo === 47 ? 0.22 : 0.03;
  return { calls, refused: Math.round(calls * spike * (0.5 + hash(h + 7))) };
}

/** Buckets for one reporting period, in the deployment's zone: hours for a day, days to a month, weeks beyond. */
function trend(period: string): Pick<Overview, 'grain' | 'toolTrend'> {
  const spec: Record<string, [Overview['grain'], number, number]> = { '1d': ['hour', 24, 1], '7d': ['day', 7, 24], '30d': ['day', 30, 24], '90d': ['week', 13, 168], all: ['week', 26, 168] };
  const [grain, n, hours] = spec[period] ?? spec.all;
  const nowH = Math.floor(now() / 3_600_000);
  // Buckets end on the current hour; the reconciler attributes calls to runs every few minutes, so the newest bucket
  // is mostly not yet attributed, as it is on the real platform.
  const end = hours === 1 ? nowH : Math.floor((nowH + 8) / 24) * 24 - 8 + 24;
  return {
    grain,
    toolTrend: Array.from({ length: n }, (_, i) => {
      const from = end - (n - i) * hours;
      let calls = 0, refused = 0;
      for (let h = from; h < from + hours && h <= nowH; h++) { const x = hourly(h); calls += x.calls; refused += x.refused; }
      const ok = calls - refused;
      const share = i === n - 1 && hours === 1 ? 0.25 : 0.7 + 0.1 * hash(from);
      return { bucket: new Date(from * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'), inside: Math.round(ok * share), outside: ok - Math.round(ok * share), refused };
    }),
  };
}

export function overview(period: string): Overview {
  const t = trend(period);
  const calls = t.toolTrend.reduce((n, b) => n + b.inside + b.outside + b.refused, 0);
  const refused = t.toolTrend.reduce((n, b) => n + b.refused, 0);
  return {
    metrics: {
      progressing: { value: 57, active: 5, scoreable: 4, stages: { noflow: 1, notstarted: 1, drafting: 2, agreed: 0, gated: 1, closed: 3 }, waiting: 2, waitingOldestDays: 3, noDeltaBecause: 'approved_at is stored as a date, so how complete an initiative was earlier cannot be reconstructed' },
      knowledge: { value: 82, prev: 76, fromWork: 9, imported: 1, searches: 441, importThresholdPerHour: 50 },
      refusals: { value: calls ? (refused / calls) * 100 : null, prev: 4.8, refused, calls, byDoor: [{ door: 'core', n: Math.ceil(refused * 0.7) }, { door: 'eval', n: Math.floor(refused * 0.3) }] },
      context: { value: 15.7, prev: 18.2, p90: 438.4, runs: SKILL_SEEDS.filter(([, , , c]) => c).map(([skill, , , c]) => ({ skill, kb: 2 + (c % 400) })), unmeasured: 3, capped: false, contextWindowKb: 800 },
    },
    counts: { teams: 6, activeTeams: 5, people: 9, superadmins: 2, documents: 38, initiatives: 8, events: calls + 1_910, failures: refused, unattributedEvents: 12 },
    ...t,
    timezone: 'UTC',
    eventKinds: [
      { kind: 'tool_call', n: calls }, { kind: 'knowledge.search', n: 441 }, { kind: 'document.patch', n: 206 }, { kind: 'document.shown_part', n: 197 },
      { kind: 'skill_read', n: 147 }, { kind: 'document.source_add', n: 117 }, { kind: 'knowledge.add', n: 115 }, { kind: 'document.shown', n: 78 },
      { kind: 'initiative_status', n: 64 }, { kind: 'document.document_approve', n: 60 }, { kind: 'initiative_close', n: 9 },
    ],
    refusals: {
      total: refused,
      byTool: [{ tool: 'core:document_read', n: Math.ceil(refused * 0.4) }, { tool: 'core:document_approve', n: Math.ceil(refused * 0.3) }, { tool: 'eval:finding_record', n: refused - Math.ceil(refused * 0.4) - Math.ceil(refused * 0.3) }],
      byMessage: [
        { message: 'ERROR: document not found: plan.md does not exist in this initiative yet; write it with document_write before reading it', tool: 'core:document_read', tools: 2, n: Math.ceil(refused * 0.4) },
        { message: 'ERROR: approval needs a stakeholder', tool: 'core:document_approve', tools: 1, n: Math.ceil(refused * 0.3) },
      ],
    },
  };
}
