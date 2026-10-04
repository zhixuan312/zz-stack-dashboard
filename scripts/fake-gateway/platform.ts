/**
 * The fake gateway's platform: plugins and their skills, one plugin evaluation, the overview's
 * figures, the activity feed and the run totals.
 *
 * Four plugins, one per state the plugin pages draw: `sdlc` is a method (stages, gates) with an
 * established evaluation; `zz-core` is the platform, profiled and never scored; `zz-access` is
 * registered and never profiled; `research-kit` is vendored from another team, never run, with
 * no release and no evaluation.
 */
import type {
  ActivityEvent, Overview, PluginEval, PluginRow, Runs, Skill, SkillDetail, SkillText,
} from '../../src/lib/api-shapes.ts';
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
  ['research-scan', 'research-kit', null, 0, 0, 0],
  ['research-cite', 'research-kit', null, 0, 0, 0],
];

const describe = (name: string) => `What ${name} is for, in the words its own SKILL.md opens with.`;

export const SKILLS: Skill[] = [
  ...SKILL_SEEDS.map(([name, plugin, , calls, refusals, runs]): Skill => {
    const timed = runs ? Math.max(1, runs - 3) : 0;
    const avg = runs ? 120 + (calls % 900) : null;
    return {
      name, version: plugin === 'research-kit' ? '0.3' : '1.14', kind: 'plugin_skill', flow: plugin === 'sdlc' ? 'sdlc-flow' : null, retired: false,
      runs, calls, callsAvg: runs ? +(calls / runs).toFixed(1) : 0, callsMax: runs ? Math.ceil((calls / runs) * 3) : 0, refusals, timedRuns: timed,
      durationAvg: avg, durationMedian: avg === null ? null : Math.round(avg * 0.8), durationMax: avg === null ? null : avg * 6, durationTotal: avg === null ? null : avg * timed,
      kbPerRun: runs ? +(4 + (calls % 300) / 7).toFixed(1) : null, mbTotal: runs ? +((runs * (4 + (calls % 300) / 7)) / 1024).toFixed(1) : null,
      logged: runs ? { calls, failed: refusals, tools: 6 + (calls % 9) } : null,
    };
  }),
  { name: 'building-a-block', version: '1.0', kind: 'plugin_skill', flow: null, retired: true, runs: 1, calls: 2, callsAvg: 2, callsMax: 2, timedRuns: 1, refusals: 0, durationAvg: 12.9, durationMedian: 12.9, durationMax: 12.9, durationTotal: 12.9, kbPerRun: 40.2, mbTotal: 0, logged: { calls: 2, failed: 0, tools: 1 } },
];

function pluginSkills(plugin: string): PluginRow['skills'] {
  return SKILL_SEEDS.filter(([, p]) => p === plugin).map(([name, , position, calls]) => ({
    name, position, isEntry: name === 'sdlc-flow', origin: plugin === 'research-kit' ? 'theirs' : 'ours',
    version: plugin === 'research-kit' ? '0.3' : '1.14', description: describe(name),
    source: plugin === 'research-kit' ? 'github.com/example-labs/research-kit' : null,
    versions: plugin === 'research-kit' ? 1 : 3 + (calls % 7), calls, evals: plugin === 'sdlc' ? 2 : 0,
    everRun: calls > 0, lastRun: calls > 0 ? ago(1 + (calls % 40)) : null,
  }));
}

const sum = (plugin: string, i: 3 | 4) => SKILL_SEEDS.filter(([, p]) => p === plugin).reduce((n, s) => n + s[i], 0);

export const PLUGINS: PluginRow[] = [
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
    gates: 3, skills: pluginSkills('sdlc'), calls: sum('sdlc', 3), failed: sum('sdlc', 4), lastRun: ago(1),
    release: { version: '0.92.10', digest: '2f16e125', evals: 2 },
    latestEval: { version: '0.92.10', overallScore: 8.64, scoreStatus: 'established', guardrailStatus: 'pass', openDefects: 2, at: ago(20) },
  },
  {
    plugin: 'zz-core', owner: null, agentName: null, version: '0.92.10', servers: ['zz-core'],
    description: 'The platform itself: documents, gates, initiatives and the knowledge store every flow writes to.',
    stages: [], entry: null, documents: [], gates: 0, skills: pluginSkills('zz-core'), calls: sum('zz-core', 3), failed: sum('zz-core', 4), lastRun: ago(0.5),
    release: { version: '0.92.10', digest: '7c01aa94', evals: 0 }, latestEval: null,
  },
  {
    plugin: 'zz-access', owner: 'zz-access', agentName: 'ZZ Access', version: '0.92.10', servers: ['zz-access'],
    description: 'Your own access: who you are, which team you act for, your tokens and your client setup.',
    stages: [], entry: null, documents: [], gates: 0, skills: pluginSkills('zz-access'), calls: sum('zz-access', 3), failed: sum('zz-access', 4), lastRun: ago(30),
    release: null, latestEval: null,
  },
  {
    plugin: 'research-kit', owner: 'example-labs', agentName: null, version: null, servers: ['web-search', 'zz-core'],
    description: null, stages: [], entry: null, documents: [], gates: 0, skills: pluginSkills('research-kit'), calls: 0, failed: 0, lastRun: null,
    release: null, latestEval: null,
  },
];

export function skillDetail(name: string): SkillDetail | null {
  const s = SKILL_SEEDS.find(([n]) => n === name);
  if (!s) return null;
  const [, , , calls, refusals] = s;
  if (!calls) return { skill: name, surfaces: [], busiestTools: [] };
  const tools = ['document_patch', 'document_revise', 'document_approve', 'document_read', 'skill_read', 'source_add', 'document_write', 'knowledge_search'];
  return {
    skill: name,
    surfaces: [{ surface: 'core', calls: Math.round(calls * 0.92), failed: Math.round(refusals * 0.9), tools: 14 }, { surface: 'eval', calls: Math.round(calls * 0.08), failed: refusals - Math.round(refusals * 0.9), tools: 3 }],
    busiestTools: tools.map((t, i) => ({ tool: `core:${t}`, calls: Math.round(calls / (i + 1.4)), failed: Math.round(refusals / (i + 2)) })),
  };
}

export function skillText(plugin: string, name: string): SkillText | null {
  const s = SKILL_SEEDS.find(([n, p]) => n === name && p === plugin);
  if (!s) return null;
  const theirs = plugin === 'research-kit';
  return {
    skill: name, plugin, isEntry: name === 'sdlc-flow', origin: theirs ? 'theirs' : 'ours',
    version: theirs ? '0.3' : '1.14', description: describe(name), source: theirs ? 'github.com/example-labs/research-kit' : null,
    whenToUse: `Use ${name} when the stage before it has closed and its document is approved.`,
    body: `# ${name}\n\n${describe(name)}\n\n## Steps\n\n1. Read the approved document this stage starts from.\n2. Do the work, one change at a time, with its check.\n3. Write the result with \`document_write\` and ask for approval.\n\n## When it stops\n\nA gate that is not approved stops the stage; it asks the person named as stakeholder.\n`,
    references: name === 'sdlc-spec' ? [
      { path: 'references/acceptance-criteria.md', content: '# Acceptance criteria\n\nEach criterion is observable, owned and checkable by running something.\n' },
      { path: 'references/decision-table.md', content: '# Decision table\n\n| Decision | Chosen | Rejected because |\n|---|---|---|\n| … | … | … |\n' },
    ] : [],
  };
}

const NO_EVAL = (plugin: string, found: boolean): PluginEval => ({
  plugin, found, origin: found ? 'platform' : null, ownerTeam: found ? 'atlas' : null, evolvable: found, releaseOwners: found ? ['atlas'] : [],
  ownershipMode: found ? 'owned' : null, subjectVersion: null, run: null, evaluatorTrust: [],
  findings: { strengths: [], defects: [], unknowns: [] }, candidates: [],
});

export function pluginEval(plugin: string): PluginEval {
  if (plugin === 'zz-core') return { ...NO_EVAL(plugin, true), subjectVersion: { id: 'sv_zzcore_1', declaredVersion: '0.92.10', contentDigest: '7c01aa94', capturedAt: ago(40) } };
  if (plugin === 'zz-access') return NO_EVAL(plugin, true);
  if (plugin !== 'sdlc') return NO_EVAL(plugin, false);
  const dim = (key: string, kind: string, score: number | null, applicable = true) => ({
    key, canonicalKind: kind, score, applicable, notApplicableReason: applicable ? null : 'no run of this plugin reached the surface this measures',
    weight: 0.25, required: true, measuresScored: applicable ? 3 : 0, measuresTotal: 3,
    measures: [
      { key: `${key}.rate`, evaluatorType: 'computed', weight: 0.5, required: true, value: score, excluded: false, excludedReason: null, guardrail: false },
      { key: `${key}.judged`, evaluatorType: 'model', weight: 0.5, required: false, value: score === null ? null : score - 0.4, excluded: !applicable, excludedReason: applicable ? null : 'not applicable', guardrail: false },
    ],
  });
  const finding = (id: string, pattern: string, decision: string) => ({ id, pattern, ownerKind: 'plugin', ownerRef: 'sdlc', evidenceRefs: 4, expectedEffect: null, decision, decisionNote: decision === 'deferred' ? null : 'Applied in 0.92.10.' });
  return {
    plugin, found: true, origin: 'platform', ownerTeam: 'atlas', evolvable: true, releaseOwners: ['atlas'], ownershipMode: 'owned',
    subjectVersion: { id: 'sv_sdlc_7', declaredVersion: '0.92.10', contentDigest: '2f16e125', capturedAt: ago(26) },
    run: {
      id: 'run_sdlc_12', runStatus: 'completed', scoreStatus: 'established', overallScore: 8.64, scoreInterval: null, guardrailStatus: 'pass',
      guardrails: [{ key: 'refusal-rate', threshold: 0.1, value: 0.031, status: 'pass' }, { key: 'abandoned-runs', threshold: 0.2, value: null, status: 'not_established' }],
      protocol: { key: 'sdlc-protocol', version: 3 }, createdAt: ago(20),
      dimensions: [dim('completion', 'outcome', 9.1), dim('gate-discipline', 'process', 8.8), dim('evidence', 'quality', 7.9), dim('handover', 'outcome', null, false)],
      coverage: { usableRunCount: 61, totalRunCount: 68, surfaceObserved: 14, surfaceTotal: 16 },
    },
    evaluatorTrust: [{ stableKey: 'judge.evidence.v2', state: 'qualified', qualifiedAt: ago(200) }, { stableKey: 'judge.handover.v1', state: null, qualifiedAt: null }],
    findings: {
      strengths: [finding('f_1', 'Every approved spec names a checker for each criterion', 'accepted')],
      defects: [finding('f_2', 'Plan audit re-reads the whole plan on every round instead of the changed sections', 'deferred'), finding('f_3', 'A refused document_approve is retried without reading the refusal', 'deferred')],
      unknowns: [finding('f_4', 'Whether handover reaches the next initiative at all', 'deferred')],
    },
    candidates: [
      { id: 'cand_1', hypothesis: 'Audit only the sections a revision changed', status: 'valid', complexityDelta: -2, touchedComponents: null, touchedOwners: ['atlas'], createdAt: ago(18), build: { ok: true, stage: null }, release: null },
      { id: 'cand_2', hypothesis: 'Read the refusal before retrying an approval', status: 'released', complexityDelta: 1, touchedComponents: null, touchedOwners: ['atlas'], createdAt: ago(90), build: { ok: true, stage: null }, release: { status: 'released', reason: null, releasedDeclaredVersion: '0.92.10', releaseRef: 'v0.92.10', verdict: 'better', verificationReason: 'Refused approvals fell from 41 to 9 over the next week.', rolledBack: false } },
      { id: 'cand_3', hypothesis: 'Split sdlc-spec into decide and write', status: 'invalid', complexityDelta: 4, touchedComponents: null, touchedOwners: ['atlas'], createdAt: ago(130), build: { ok: false, stage: 'gate' }, release: null },
    ],
  };
}

/** Buckets for one reporting period, in the deployment's zone: hours for a day, days to a month, weeks, months. */
function trend(period: string): Pick<Overview, 'grain' | 'toolTrend'> {
  const spec: Record<string, [Overview['grain'], number, number]> = { '1d': ['hour', 24, 3_600_000], '7d': ['day', 7, 86_400_000], '30d': ['day', 30, 86_400_000], '90d': ['week', 13, 604_800_000], all: ['week', 26, 604_800_000] };
  const [grain, n, step] = spec[period] ?? spec.all;
  const start = Math.floor(now() / step) * step;
  return {
    grain,
    toolTrend: Array.from({ length: n }, (_, i) => {
      const k = n - 1 - i;
      const wave = Math.round((Math.sin(i * 0.9) + 1.4) * (step / 3_600_000 > 1 ? 40 : 6));
      return { bucket: new Date(start - k * step).toISOString().replace(/\.\d{3}Z$/, 'Z'), inside: wave * 3 + (i % 4) * 5, outside: wave + (i % 3) * 4, refused: i % 5 === 2 ? 0 : Math.round(wave / 6) };
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
    counts: { teams: 4, activeTeams: 3, people: 7, superadmins: 2, documents: 38, initiatives: 8, events: calls + 1_910, failures: refused, unattributedEvents: 12 },
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

const KINDS = ['tool_call', 'document.write', 'document.document_approve', 'knowledge.search', 'skill_read', 'knowledge.add', 'initiative_status'];
const ACTORS = ['noah.okafor@example.com', 'mei.tanaka@example.com', 'jonas.weber@example.com', null];
const TOOLS = ['core:document_read', 'core:document_patch', 'core:knowledge_search', 'core:document_approve', 'eval:finding_record'];

export const ACTIVITY: ActivityEvent[] = Array.from({ length: 120 }, (_, i): ActivityEvent => {
  const kind = KINDS[i % KINDS.length];
  const refused = kind === 'tool_call' && i % 3 === 0;
  return {
    ts: ago(i * 0.7), actor: ACTORS[i % ACTORS.length], team: i % 11 === 0 ? null : ['atlas', 'beacon', 'atlas', 'cinder'][i % 4], kind,
    subject: kind === 'tool_call' ? TOOLS[i % TOOLS.length] : kind === 'knowledge.add' ? String(i % 9 + 1).padStart(4, '0') : null,
    initiative: i % 2 ? '2026-09-28-search-relevance' : null, step: i % 2 ? 'plan' : null,
    ok: kind === 'tool_call' ? !refused : null,
    refusal: refused ? (i % 2 ? 'ERROR: document not found: plan.md does not exist in this initiative yet' : 'ERROR: approval needs a stakeholder') : null,
  };
});

export function runs(period: string): Runs {
  const scale = { '1d': 0.02, '7d': 0.15, '30d': 0.5, '90d': 0.9 }[period] ?? 1;
  return { totals: { runs: Math.round(1_261 * scale), calls: Math.round(12_904 * scale), refusals: Math.round(403 * scale), mb: +(198.7 * scale).toFixed(1) } };
}
