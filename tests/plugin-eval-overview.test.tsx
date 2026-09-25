import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EvalHeadline, EvalHealth, EvalQuality } from '@/components/PluginEvalOverview';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DimensionScore, PluginEval } from '@/lib/api-shapes';

/** `EvalQuality`'s composition bar is a Radix tooltip, which throws outside a provider — the
 *  app mounts one once, in `Providers`; tests/charts.test.tsx carries the same wrapper. */
const render = (ui: ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

/** A minimal completed run, overridden per test. FR-55: overall score, status and protocol
 *  version come first, so most tests here are about `EvalHeadline`. */
function pluginEval(over: Partial<PluginEval> = {}): PluginEval {
  return {
    plugin: 'zz-core', found: true, origin: 'platform', ownerTeam: 'zz', evolvable: true,
    releaseOwners: ['zz'], ownershipMode: 'owned',
    subjectVersion: { id: 's1', declaredVersion: '1.0.0', contentDigest: 'abc', capturedAt: '2026-09-01T00:00:00Z' },
    run: {
      id: 'r1', runStatus: 'completed', scoreStatus: 'established', overallScore: 7.42,
      scoreInterval: null, guardrailStatus: 'pass', guardrails: [],
      protocol: { key: 'zz-core-protocol', version: 3 }, createdAt: '2026-09-02T00:00:00Z',
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
    expect(screen.getByText('established')).toBeInTheDocument();
    expect(screen.getByText('zz-core-protocol')).toBeInTheDocument();
    expect(screen.getByText('zz-core-protocol').parentElement?.textContent).toContain('v3');
  });

  it('never shows a number when the score is not established — the status word stands alone', () => {
    const pe = pluginEval({
      run: {
        id: 'r1', runStatus: 'completed', scoreStatus: 'not_established', overallScore: null,
        scoreInterval: null, guardrailStatus: 'not_established', guardrails: [],
        protocol: { key: 'zz-core-protocol', version: 1 }, createdAt: '2026-09-02T00:00:00Z',
        dimensions: [], coverage: null,
      },
    });
    render(<EvalHeadline pluginEval={pe} />);
    expect(screen.queryByText(/^\d+\.\d+$/)).not.toBeInTheDocument();
    // "not_established" is the status word itself and appears both as the score slot and the
    // status badge — the point is that no digit is rendered anywhere on the panel.
    expect(screen.getAllByText('not_established').length).toBeGreaterThan(0);
  });

  it('reports run_status, not "not evaluated yet", for a run that has not finished', () => {
    const pe = pluginEval({
      run: {
        id: 'r1', runStatus: 'running', scoreStatus: null, overallScore: null,
        scoreInterval: null, guardrailStatus: null, guardrails: [],
        protocol: { key: 'zz-core-protocol', version: 1 }, createdAt: '2026-09-02T00:00:00Z',
        dimensions: [], coverage: null,
      },
    });
    render(<EvalHeadline pluginEval={pe} />);
    expect(screen.getByText('Run running')).toBeInTheDocument();
    expect(screen.queryByText(/not evaluated yet/i)).not.toBeInTheDocument();
  });

  it('says "not evaluated yet" only when there is truly no run', () => {
    render(<EvalHeadline pluginEval={pluginEval({ run: null })} />);
    expect(screen.getByText('Not evaluated yet')).toBeInTheDocument();
  });

  it('says a third-party subject is not registered without guessing a score', () => {
    render(<EvalHeadline pluginEval={pluginEval({ found: false, run: null, subjectVersion: null })} />);
    expect(screen.getByText(/is not registered/)).toBeInTheDocument();
  });
});

describe('EvalHealth', () => {
  it('shows each guardrail with its value against its threshold, and pass/fail', () => {
    const pe = pluginEval();
    render(<EvalHealth run={{ ...pe.run!, guardrails: [
      { key: 'refusal_rate', threshold: 0.5, value: 0.62, status: 'pass' },
      { key: 'latency_p50', threshold: 0.9, value: 0.3, status: 'fail' },
    ] }} />);
    expect(screen.getByText('0.6200 / 0.50')).toBeInTheDocument();
    expect(screen.getByText('pass')).toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();
  });

  it('reads as a quiet state rather than a table when nothing has completed', () => {
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
    expect(screen.getByText('not applicable')).toBeInTheDocument();
    expect(screen.getByText(/no cross-plugin evidence yet/)).toBeInTheDocument();
  });

  it('carries every rate with its own denominator', () => {
    const pe = pluginEval();
    render(<EvalQuality run={{ ...pe.run!, dimensions: [dim({ measuresScored: 2, measuresTotal: 3 })] }} />);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });
});
