import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalHeadline, EvalHealth } from '@/console/plugin-eval-overview';
import type { PluginEval } from '@/lib/api-shapes';
import { pluginContext } from '@/views/plugin-context';

/**
 * The plugin evaluation exactly as the gateway's `GET /api/console/plugins/:plugin/eval`
 * (zz-stack, services/gateway/src/console/plugin-eval.ts) answers it for a scored run: `run` is
 * the newest scored run, with no run status, and a guardrail is a measure flagged `guardrail`
 * inside a dimension, with no threshold and no verdict of its own beside the run's
 * `guardrailStatus`.
 */
const evaluation = {
  plugin: 'alpha', found: true, origin: 'platform', ownerTeam: 'atlas', releaseOwners: ['atlas'], ownershipMode: 'owned',
  subjectVersion: { id: 'sv1', declaredVersion: '1.1.0', contentDigest: 'digest-1', capturedAt: '2026-09-26T00:00:00Z' },
  run: {
    id: 'run1', scoreStatus: 'established', overallScore: 7.1,
    scoreInterval: { lower: 6.7, upper: 7.5 }, measureCoverage: 1, establishmentBlockedBy: [],
    guardrailStatus: 'fail', scorerVersion: '0.91.0',
    protocol: { key: 'alpha-protokey', version: 1 },
    createdAt: '2026-09-26T12:00:00Z', scoredAt: '2026-09-26T13:00:00Z',
    dimensions: [{
      key: 'effectiveness', canonicalKind: 'effectiveness', score: 0.71, applicable: true, notApplicableReason: null,
      weight: 1, required: true, measuresScored: 2, measuresTotal: 3,
      measures: [
        { key: 'refusal-rate', evaluatorType: 'deterministic', weight: 0.5, required: true, value: 0.125, excluded: false, excludedReason: null, guardrail: true },
        { key: 'abandoned-runs', evaluatorType: 'deterministic', weight: 0.2, required: false, value: null, excluded: true, excludedReason: 'no run reached it', guardrail: true },
        { key: 'completion', evaluatorType: 'outcome', weight: 0.3, required: true, value: 0.8, excluded: false, excludedReason: null, guardrail: false },
      ],
    }],
    coverage: { usableRunCount: 5, totalRunCount: 5, surfaceObserved: 1, surfaceTotal: 1 },
  },
  evaluatorTrust: [],
  findings: { strengths: [], defects: [], unknowns: [] },
  candidates: [],
} satisfies PluginEval;

describe('a plugin evaluation in the gateway\'s shape', () => {
  it('draws the scored run\'s score, never a run status the gateway does not send', () => {
    render(<EvalHeadline pluginEval={evaluation} />);
    expect(screen.getByText('7.1')).toBeInTheDocument();
    expect(screen.queryByText(/Run undefined/)).not.toBeInTheDocument();
  });

  it('lists the guardrail measures from the dimensions, with their values, under the run\'s guardrail status', () => {
    render(<EvalHealth run={evaluation.run} />);
    expect(screen.queryByText('Nothing to check')).not.toBeInTheDocument();
    expect(screen.getByText('Refusal rate')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('Abandoned runs')).toBeInTheDocument();
    expect(screen.getByText('no run reached it')).toBeInTheDocument();
    expect(screen.queryByText('completion')).not.toBeInTheDocument();
    expect(screen.getByText('A guardrail broke')).toBeInTheDocument();
  });

  it('builds the assistant\'s context and states the guardrail status', () => {
    const context = pluginContext('alpha', { evaluation, updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' });
    const text = context.insights.map((i) => i.text).join(' ');
    expect(text).toContain('guardrails fail');
    expect(text).toContain('refusal-rate');
  });

  it('builds the context for a name nothing registered, which carries nothing but the name', () => {
    const context = pluginContext('nobody', { evaluation: { plugin: 'nobody', found: false }, updatedAt: null, now: '2026-10-12T09:01:00Z' });
    expect(context.unknowns.join(' ')).toContain('never been registered for evaluation');
  });
});
