import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalAutomationTrust, EvalEvolution } from '@/components/PluginEvalEvolution';
import type { PluginEval } from '@/lib/api-shapes';

type Candidate = PluginEval['candidates'][number];
const candidate = (over: Partial<Candidate>): Candidate => ({
  id: 'c1', hypothesis: 'tighten the refusal message', status: 'valid',
  complexityDelta: 12, touchedComponents: [], touchedOwners: ['zz'], createdAt: '2026-09-03T00:00:00Z',
  build: { ok: true, stage: null }, release: null, ...over,
});
function pluginEval(over: Partial<PluginEval> = {}): PluginEval {
  return {
    plugin: 'zz-core', found: true, origin: 'platform', ownerTeam: 'zz', evolvable: true,
    releaseOwners: ['zz'], ownershipMode: 'owned', subjectVersion: null, run: null,
    evaluatorTrust: [], findings: { strengths: [], defects: [], unknowns: [] }, candidates: [],
    ...over,
  };
}

describe('EvalEvolution', () => {
  it('shows each candidate\'s status by its own word', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [
      candidate({ id: 'c1', status: 'recorded', build: null }),
      candidate({ id: 'c2', status: 'awaiting_build', build: null }),
      candidate({ id: 'c3', status: 'invalid', build: { ok: false, stage: 'gate' } }),
    ] })} />);
    expect(screen.getByText('recorded')).toBeInTheDocument();
    expect(screen.getByText('awaiting build')).toBeInTheDocument();
    expect(screen.getByText('invalid')).toBeInTheDocument();
  });

  it('shows the build result: passed, failed at its stage, or not built', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [
      candidate({ id: 'c1', build: { ok: true, stage: null } }),
      candidate({ id: 'c2', status: 'invalid', build: { ok: false, stage: 'install' } }),
      candidate({ id: 'c3', status: 'recorded', build: null }),
    ] })} />);
    expect(screen.getByText('passed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('at install')).toBeInTheDocument();
    expect(screen.getByText('not built')).toBeInTheDocument();
  });

  it('reads "Evaluation only" on a third-party plugin\'s Evolution', () => {
    render(<EvalEvolution pluginEval={pluginEval({ ownershipMode: 'evaluation_only', candidates: [] })} />);
    expect(screen.getByText('Evaluation only')).toBeInTheDocument();
  });

  it('still lists a proposal for a third-party plugin — evaluation-only is not release-only', () => {
    render(<EvalEvolution pluginEval={pluginEval({
      ownershipMode: 'evaluation_only',
      candidates: [candidate({ release: null })],
    })} />);
    expect(screen.getByText('tighten the refusal message')).toBeInTheDocument();
    expect(screen.getByText('not released')).toBeInTheDocument();
  });

  it('names a rollback, not the plain release status, once one has happened', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [candidate({
      status: 'rolled_back',
      release: { status: 'released', reason: null, releasedDeclaredVersion: '1.1.0',
        releaseRef: 'rel-1', verdict: 'rolled_back', verificationReason: 'regression on capability suite', rolledBack: true },
    })] })} />);
    expect(screen.getAllByText('rolled back')).toHaveLength(2);
    expect(screen.queryByText('released')).not.toBeInTheDocument();
  });
});

describe('EvalAutomationTrust', () => {
  it('shows ownership: origin, owner team, evolvable, and release owners', () => {
    render(<EvalAutomationTrust pluginEval={pluginEval({
      origin: 'third_party', ownerTeam: null, evolvable: false, releaseOwners: [],
    })} />);
    expect(screen.getByText('third_party')).toBeInTheDocument();
    expect(screen.getByText('none recorded')).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();
    expect(screen.getByText('none — cannot be released')).toBeInTheDocument();
  });

  it('names every evaluator by its qualification state', () => {
    render(<EvalAutomationTrust pluginEval={pluginEval({
      evaluatorTrust: [
        { stableKey: 'refusal-quality', state: 'operationally_qualified', qualifiedAt: '2026-09-01T00:00:00Z' },
        { stableKey: 'tone-check', state: null, qualifiedAt: null },
      ],
    })} />);
    expect(screen.getByText('refusal-quality')).toBeInTheDocument();
    expect(screen.getByText('operationally_qualified')).toBeInTheDocument();
    expect(screen.getByText('tone-check')).toBeInTheDocument();
    expect(screen.getByText('never qualified')).toBeInTheDocument();
  });
});
