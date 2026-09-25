import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalAutomationTrust, EvalEvolution } from '@/components/PluginEvalEvolution';
import type { PluginEval } from '@/lib/api-shapes';

type Candidate = PluginEval['candidates'][number];
const candidate = (over: Partial<Candidate>): Candidate => ({
  id: 'c1', generation: 1, hypothesis: 'tighten the refusal message', status: 'proof_passed',
  complexityDelta: 12, touchedComponents: [], touchedOwners: ['zz'], createdAt: '2026-09-03T00:00:00Z',
  validation: { meanDelta: 0.4, lower: 0.2, upper: 0.6, verdict: 'improves', guardrails: null },
  proof: 'proof_passed', cost: 1.2345, durationMsAvg: 4200, replayRuns: 3,
  release: null, ...over,
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
  it('never shows a proof number — only one of the fixed pass/fail-shaped words (FR-28)', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [candidate({ proof: 'proof_passed' })] })} />);
    expect(screen.getByText('pass')).toBeInTheDocument();
    // The validation column DOES carry numbers — only proof is sealed to a word.
    expect(screen.getByText(/Δ 0.400/)).toBeInTheDocument();
  });

  it('reduces every proof state to its own word, never a shared "done"', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [
      candidate({ id: 'c1', proof: 'proof_failed' }),
      candidate({ id: 'c2', proof: 'proof_not_established' }),
      candidate({ id: 'c3', proof: 'not_proved', validation: null }),
    ] })} />);
    expect(screen.getByText('fail')).toBeInTheDocument();
    expect(screen.getByText('not established')).toBeInTheDocument();
    expect(screen.getByText('not proved yet')).toBeInTheDocument();
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
      release: { status: 'released', reason: null, releasedDeclaredVersion: '1.1.0',
        releaseRef: 'rel-1', verdict: 'rolled_back', verificationReason: 'regression on capability suite', rolledBack: true },
    })] })} />);
    expect(screen.getByText('rolled back')).toBeInTheDocument();
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
