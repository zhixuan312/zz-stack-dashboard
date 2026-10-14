/**
 * The fake gateway's evaluation: what `GET /api/console/platform/evaluation` answers.
 *
 * One fixture, the scores and findings as the superadmin reads them. A member's answer is derived from it by the
 * gateway's projection rules and never written by hand: a protocol's key and a measure's key are the owning team's
 * words, so a member reads them as null, and a waiting finding reaches them as its fixed summary without its pattern.
 *
 * The scores cover the states the page draws: a plugin whose two latest scores share a protocol version and a
 * population (a trend) after an older one under another protocol version, a plugin scored under two populations, a
 * plugin whose latest score is not established after a provisional one in the same series, and findings waiting, one
 * of them with no public owner category.
 *
 * COUPLED: zz-stack's `checks/console-platform-evaluation.ts` imports this file with plain `node` and compares its key
 * sets with the real route's answer. So nothing here is imported through the console's path alias, and every part is
 * `ok`.
 */
import type { Evaluation, SafeFinding } from '../../src/lib/platform-shapes.ts';
import { ago } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';

type Protocol = { key: string; version: number };
type Run = { plugin: string; protocol: Protocol; population: string; hoursAgo: number; score: number | null; lower: number | null;
  upper: number | null; standing: 'established' | 'provisional' | 'not_established'; guardrails: 'pass' | 'fail' | 'not_established' };

const SDLC_V1: Protocol = { key: 'sdlc-flow-quality', version: 1 };
const SDLC_V2: Protocol = { key: 'sdlc-flow-quality', version: 2 };
const CORE: Protocol = { key: 'core-door-reliability', version: 1 };
const EVAL: Protocol = { key: 'eval-scoring-honesty', version: 1 };
const RECORDED = 'the surface recorded at that version';

/** Oldest first within each plugin. */
const RUNS: Run[] = [
  { plugin: 'sdlc', protocol: SDLC_V1, population: RECORDED, hoursAgo: 640, score: 0.58, lower: 0.49, upper: 0.66, standing: 'provisional', guardrails: 'pass' },
  { plugin: 'sdlc', protocol: SDLC_V2, population: RECORDED, hoursAgo: 330, score: 0.64, lower: 0.57, upper: 0.71, standing: 'established', guardrails: 'pass' },
  { plugin: 'sdlc', protocol: SDLC_V2, population: RECORDED, hoursAgo: 70, score: 0.71, lower: 0.65, upper: 0.77, standing: 'established', guardrails: 'pass' },
  { plugin: 'zz-core', protocol: CORE, population: "the nearest recorded version's surface", hoursAgo: 500, score: 0.82, lower: 0.78, upper: 0.86, standing: 'established', guardrails: 'pass' },
  { plugin: 'zz-core', protocol: CORE, population: RECORDED, hoursAgo: 90, score: 0.79, lower: 0.74, upper: 0.84, standing: 'established', guardrails: 'fail' },
  { plugin: 'zz-plugin-eval', protocol: EVAL, population: 'no door of its own', hoursAgo: 420, score: 0.47, lower: 0.31, upper: 0.63, standing: 'provisional', guardrails: 'pass' },
  { plugin: 'zz-plugin-eval', protocol: EVAL, population: 'no door of its own', hoursAgo: 150, score: null, lower: null, upper: null, standing: 'not_established', guardrails: 'not_established' },
];

/** A defect or an unknown awaiting a decision, with the owner category the finding blames and the measure it was found
 *  on. Decided findings and strengths are counted, not listed. */
type Finding = { id: string; plugin: string; kind: 'defect' | 'unknown' | 'strength'; owner: string; measure: string;
  decision: 'applied' | 'rejected' | 'deferred' | null; hoursAgo: number; pattern: string };

const FINDINGS: Finding[] = [
  { id: 'f1c0e7a2-5b3d-4e8f-a1c2-7d9e0b4f6a01', plugin: 'sdlc', kind: 'defect', owner: 'plugin', measure: 'plan_audit_rounds', decision: 'deferred', hoursAgo: 410,
    pattern: 'A plan audit is dispatched a fourth round after the third found nothing high.' },
  { id: 'f1c0e7a2-5b3d-4e8f-a1c2-7d9e0b4f6a02', plugin: 'zz-core', kind: 'unknown', owner: 'unknown', measure: 'tool_failure_rate', decision: 'deferred', hoursAgo: 85,
    pattern: 'Three document_write calls failed with no refusal recorded.' },
  { id: 'f1c0e7a2-5b3d-4e8f-a1c2-7d9e0b4f6a03', plugin: 'sdlc', kind: 'defect', owner: 'platform', measure: 'spec_audit_findings', decision: 'applied', hoursAgo: 600,
    pattern: 'The spec audit cited a section heading rather than a file.' },
  { id: 'f1c0e7a2-5b3d-4e8f-a1c2-7d9e0b4f6a04', plugin: 'zz-core', kind: 'defect', owner: 'dependency', measure: 'tool_failure_rate', decision: 'rejected', hoursAgo: 480,
    pattern: 'A client cached an old schema and retried with it.' },
  { id: 'f1c0e7a2-5b3d-4e8f-a1c2-7d9e0b4f6a05', plugin: 'sdlc', kind: 'strength', owner: 'plugin', measure: 'plan_audit_rounds', decision: null, hoursAgo: 320,
    pattern: 'Every executed plan traced each task to an acceptance criterion.' },
];

/** The fixed summary a waiting finding is read by: its plugin and owner category, or nothing at all when it has none. */
const summary = (f: Finding) => (f.owner === 'unknown' ? 'Evaluation finding awaiting a decision' : `A finding on ${f.plugin}, owned by ${f.owner}, awaiting a decision`);

/** `GET /platform/evaluation`. The superadmin's answer carries the protocol's and the measure's keys and each waiting
 *  finding's pattern; a member's carries none of them. */
export function evaluation(admin: boolean): Evaluation {
  const asOf = ago(0);
  const key = (p: Protocol) => ({ key: admin ? p.key : null, version: p.version });
  const plugins = [...new Set(RUNS.map((r) => r.plugin))];
  const latest = plugins.map((p) => RUNS.filter((r) => r.plugin === p).at(-1)!);
  const waiting = FINDINGS.filter((f) => f.decision === 'deferred' && f.kind !== 'strength').sort((a, b) => b.hoursAgo - a.hoursAgo);
  const decided = FINDINGS.filter((f) => f.kind !== 'strength');
  const tally = (d: Finding['decision']) => decided.filter((f) => f.decision === d).length;
  const days = new Set(RUNS.map((r) => ago(r.hoursAgo).slice(0, 10)));
  return {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: PLATFORM_STATUS.meta.coverageFrom!, to: asOf },
      scope: admin ? 'platform-admin' : 'platform-public', population: 'scored evaluation runs' },
    tiles: {
      waiting: waiting.length, established: latest.filter((r) => r.standing === 'established').length,
      lastScored: ago(Math.min(...RUNS.map((r) => r.hoursAgo))), daysScored: days.size,
    },
    plugins: { state: 'ok', data: latest.map((r) => ({
      plugin: r.plugin, score: r.score === null ? { value: null, why: 'no_data' } : { value: r.score, why: null }, lower: r.lower, upper: r.upper,
      standing: r.standing, guardrails: r.guardrails, protocol: key(r.protocol), scoredAt: ago(r.hoursAgo),
    })) },
    // A series is one protocol version and one population; two series of one plugin are not comparable, and say why.
    history: { state: 'ok', data: plugins.map((p) => {
      const runs = RUNS.filter((r) => r.plugin === p);
      const series = [...new Map(runs.map((r) => [`${r.protocol.key}@${r.protocol.version}|${r.population}`, r])).values()].map((s) => ({
        protocol: key(s.protocol), population: s.population,
        runs: runs.filter((r) => r.protocol === s.protocol && r.population === s.population)
          .map((r) => ({ scoredAt: ago(r.hoursAgo), score: r.score, lower: r.lower, upper: r.upper, standing: r.standing })),
      }));
      const versions = new Set(runs.map((r) => r.protocol.version)).size;
      const statement = series.length === 1 ? 'Comparable: one protocol version and population'
        : versions > 1 ? 'Not comparable: a different protocol version' : 'Not comparable: a different population';
      return { plugin: p, series, statement };
    }) },
    byDecision: { state: 'ok', data: { applied: tally('applied'), rejected: tally('rejected'), deferred: tally('deferred') } },
    byOwner: { state: 'ok', data: Object.fromEntries([...new Set(decided.map((f) => f.owner))].map((o) => [o, decided.filter((f) => f.owner === o).length])) },
    waiting: { state: 'ok', data: { total: waiting.length, rows: waiting.map((f): SafeFinding => ({
      id: f.id, plugin: f.plugin, kind: f.kind as SafeFinding['kind'], owner: f.owner, measure: admin ? f.measure : null,
      waitingSince: ago(f.hoursAgo), summary: summary(f), ...(admin ? { pattern: f.pattern } : {}),
    })) } },
  };
}
