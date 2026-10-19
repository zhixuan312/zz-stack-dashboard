import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EvalHeadline, EvalHealth, EvalQuality } from '@/console/plugin-eval-overview';
import { Tooltip } from 'radix-ui';

const TooltipProvider = Tooltip.Provider;
import type { DimensionScore, PluginEvalFound } from '@/lib/api-shapes';

/** `EvalQuality`'s composition bar is a Radix tooltip, which throws outside a provider — the
 *  app mounts one once, in `Providers`; tests/plugin-eval-evidence.test.tsx carries the same wrapper. */
const render = (ui: ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

/** A minimal scored run, overridden per test. FR-55: overall score, status and protocol
 *  version come first, so most tests here are about `EvalHeadline`. */
function pluginEval(over: Partial<PluginEvalFound> = {}): PluginEvalFound {
  return {
    plugin: 'zz-core', found: true, origin: 'platform', ownerTeam: 'zz',
    releaseOwners: ['zz'], ownershipMode: 'owned',
    subjectVersion: { id: 's1', declaredVersion: '1.0.0', contentDigest: 'abc', capturedAt: '2026-09-01T00:00:00Z' },
    run: {
      id: 'r1', scoreStatus: 'established', overallScore: 7.42,
      scoreInterval: { lower: 7, upper: 7.8 }, measureCoverage: 1, establishmentBlockedBy: [],
      guardrailStatus: 'pass', scorerVersion: '0.91.0',
      protocol: { key: 'zz-core-protocol', version: 3 }, createdAt: '2026-09-02T00:00:00Z', scoredAt: '2026-09-02T01:00:00Z',
      dimensions: [], coverage: { usableRunCount: 40, totalRunCount: 50, surfaceObserved: 8, surfaceTotal: 10 },
    },
    evaluatorTrust: [], findings: { strengths: [], defects: [], unknowns: [] }, candidates: [],
    ...over,
  };
}
const dim = (over: Partial<DimensionScore>): DimensionScore => ({
  key: 'effectiveness', canonicalKind: 'effectiveness', score: 0.8, applicable: true,
  notApplicableReason: null, weight: 0.3, required: true, measuresScored: 2, measuresTotal: 2,
  measures: [], ...over,
});

describe('EvalHeadline', () => {
  it('shows the number when the score is established', () => {
    render(<EvalHeadline pluginEval={pluginEval()} />);
    expect(screen.getByText('7.42')).toBeInTheDocument();
    expect(screen.getByText('Established')).toBeInTheDocument();
    expect(screen.getByText('zz-core-protocol')).toBeInTheDocument();
    expect(screen.getByText('zz-core-protocol').parentElement?.textContent).toContain('v3');
  });

  it('never shows a number when the score is not established — the status word stands alone', () => {
    const base = pluginEval();
    const pe = pluginEval({
      run: {
        ...base.run!, scoreStatus: 'not_established', overallScore: null,
        scoreInterval: { lower: null, upper: null }, guardrailStatus: 'not_established',
        establishmentBlockedBy: ['effectiveness'],
      },
    });
    render(<EvalHeadline pluginEval={pe} />);
    expect(screen.queryByText(/^\d+\.\d+$/)).not.toBeInTheDocument();
    // "Not established" is the status in words and appears both as the score slot and the
    // status badge — the point is that no digit is rendered anywhere on the panel.
    expect(screen.getAllByText('Not established').length).toBeGreaterThan(0);
  });

  it('says "not evaluated yet" only when there is truly no run', () => {
    render(<EvalHeadline pluginEval={pluginEval({ run: null })} />);
    expect(screen.getByText('Not evaluated yet')).toBeInTheDocument();
  });

  it('says a third-party subject is not registered without guessing a score', () => {
    render(<EvalHeadline pluginEval={{ plugin: 'zz-core', found: false }} />);
    expect(screen.getByText(/is not registered/)).toBeInTheDocument();
  });
});

describe('EvalHealth', () => {
  it('shows each guardrail measure from its dimension with its value, and the run\'s one verdict over them', () => {
    const pe = pluginEval();
    const measure = { evaluatorType: 'deterministic', weight: 0, required: true, excluded: false, excludedReason: null };
    render(<EvalHealth run={{ ...pe.run!, guardrailStatus: 'fail', dimensions: [dim({ measures: [
      { ...measure, key: 'refusal_rate', value: 0.62, guardrail: true },
      { ...measure, key: 'latency_p50', value: 0.3, guardrail: true },
      { ...measure, key: 'completion', value: 0.9, guardrail: false },
    ] })] }} />);
    // A measure's value is a share in [0, 1], so it reads as a percent, and each guardrail by its name in words.
    expect(screen.getByText('62.0%')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('Refusal rate')).toBeInTheDocument();
    expect(screen.queryByText('Completion')).not.toBeInTheDocument();
    expect(screen.getByText('A guardrail broke')).toBeInTheDocument();
    expect(screen.getByText('2 guardrails, each a share of what it measures')).toBeInTheDocument();
  });

  it('reads as a quiet state rather than a table when nothing has been scored', () => {
    render(<EvalHealth run={null} />);
    expect(screen.getByText('Nothing to check')).toBeInTheDocument();
  });
});

describe('EvalQuality', () => {
  it('shows not-applicable dimensions with their reason instead of a score', () => {
    const pe = pluginEval();
    render(<EvalQuality run={{ ...pe.run!, dimensions: [
      dim({ key: 'generalization', applicable: false, notApplicableReason: 'no cross-plugin evidence yet', score: null }),
    ] }} />);
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
    expect(screen.getByText(/no cross-plugin evidence yet/)).toBeInTheDocument();
  });

  it('carries every rate with its own denominator', () => {
    const pe = pluginEval();
    render(<EvalQuality run={{ ...pe.run!, dimensions: [dim({ measuresScored: 2, measuresTotal: 3 })] }} />);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });
});
