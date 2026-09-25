import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EvalLearning, EvalUsage } from '@/components/PluginEvalEvidence';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { EvalFinding, PluginEval } from '@/lib/api-shapes';

/** `EvalLearning`'s composition bar is a Radix tooltip — see plugin-eval-overview.test.tsx. */
const render = (ui: ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

type Run = NonNullable<PluginEval['run']>;
const run = (coverage: Run['coverage']): Run => ({
  id: 'r1', runStatus: 'completed', scoreStatus: 'established', overallScore: 7,
  scoreInterval: null, guardrailStatus: 'pass', guardrails: [],
  protocol: { key: 'p', version: 1 }, createdAt: '2026-09-01T00:00:00Z', dimensions: [], coverage,
});
const finding = (over: Partial<EvalFinding>): EvalFinding => ({
  id: 'f1', pattern: 'a refusal leaks the request id', ownerKind: 'plugin', ownerRef: null,
  evidenceRefs: 2, expectedEffect: null, decision: 'open', decisionNote: null, ...over,
});

describe('EvalUsage', () => {
  it('carries a rate with its own denominator, never a bare percentage', () => {
    render(<EvalUsage run={run({ usableRunCount: 40, totalRunCount: 50, surfaceObserved: 3, surfaceTotal: 10 })} />);
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getByText('40 of 50')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('3 of 10')).toBeInTheDocument();
  });

  it('says "not measured" rather than 0% when a count is missing', () => {
    render(<EvalUsage run={run({ usableRunCount: null, totalRunCount: null, surfaceObserved: 3, surfaceTotal: 5 })} />);
    expect(screen.getAllByText('not measured').length).toBeGreaterThan(0);
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });
});

describe('EvalLearning', () => {
  it('classifies every finding by owner — only a plugin-owned defect can seed a candidate', () => {
    render(<EvalLearning findings={{
      strengths: [], unknowns: [],
      defects: [finding({ id: 'd1', ownerKind: 'plugin', pattern: 'plugin defect' }),
                finding({ id: 'd2', ownerKind: 'dependency', pattern: 'dependency defect' })],
    }} />);
    expect(screen.getByText('plugin defect')).toBeInTheDocument();
    expect(screen.getByText('dependency defect')).toBeInTheDocument();
    expect(screen.getByText('plugin')).toBeInTheDocument();
    expect(screen.getByText('dependency')).toBeInTheDocument();
  });

  it('says plainly when a run produced no finding at all', () => {
    render(<EvalLearning findings={{ strengths: [], defects: [], unknowns: [] }} />);
    expect(screen.getByText('No finding recorded')).toBeInTheDocument();
  });

  it('reads as a quiet state, not a mascot, when there is no run to read from', () => {
    render(<EvalLearning findings={null} />);
    expect(screen.getByText('Nothing recorded')).toBeInTheDocument();
  });
});
