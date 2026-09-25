import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlowStepper } from '@/components/Flow';
import type { Step } from '@/lib/api-shapes';

/** FR-58 (Task I-27): `skipped` and `waiting` are two of the stepper's states, alongside the
 *  four `sdlc` already drew. Both must render distinctly from every other state, and from each
 *  other — a reader who cannot tell "ruled out" from "not written" has learned nothing new.
 *
 *  The legend lists every phrase unconditionally, whatever steps are passed in — so a bare
 *  `getByText` cannot tell a node's own caption from the legend entry of the same words. Every
 *  assertion below is scoped with `within()` to the one node it is about, found by its `title`
 *  (`FlowStepper` sets it to `stage.what`, which `step()` here derives from the name). */
function step(name: string, state: Step['state'], current = false): Step {
  return { name, what: `about ${name}`, produces: '', state, current };
}

describe('FlowStepper — skipped and waiting', () => {
  it('draws a skipped step with a dash and says it is not on this branch', () => {
    render(<FlowStepper gates={[]} outcome={null} steps={[
      step('open', 'done'), step('spec', 'skipped'), step('closed', 'empty'),
    ]} />);
    const node = within(screen.getByTitle('about spec'));
    expect(node.getByText('not on this branch')).toBeInTheDocument();
    expect(node.queryByText('waiting on the branch')).not.toBeInTheDocument();
  });

  it('draws a waiting step distinctly from a skipped one', () => {
    render(<FlowStepper gates={[]} outcome={null} steps={[
      step('open', 'done'), step('select', 'waiting'), step('closed', 'empty'),
    ]} />);
    const node = within(screen.getByTitle('about select'));
    expect(node.getByText('waiting on the branch')).toBeInTheDocument();
    expect(node.queryByText('not on this branch')).not.toBeInTheDocument();
  });

  it('does not confuse waiting with partial — waiting names the branch, not a person', () => {
    render(<FlowStepper gates={[]} outcome={null} steps={[
      step('open', 'done'), step('plan', 'partial'), step('build', 'waiting'), step('closed', 'empty'),
    ]} />);
    // `partial` carries no caption under its own node — only the ring colour and the legend
    // say "waiting on a person" — so `plan` names neither of the new captions.
    const partialNode = within(screen.getByTitle('about plan'));
    expect(partialNode.queryByText('waiting on the branch')).not.toBeInTheDocument();
    expect(partialNode.queryByText('not on this branch')).not.toBeInTheDocument();
    expect(within(screen.getByTitle('about build')).getByText('waiting on the branch')).toBeInTheDocument();
  });

  it('lists all six node states in the legend', () => {
    render(<FlowStepper gates={[]} outcome={null} steps={[step('open', 'done')]} />);
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(screen.getByText('where it is now')).toBeInTheDocument();
    expect(screen.getByText('written, waiting on a person')).toBeInTheDocument();
    expect(screen.getByText('nothing written')).toBeInTheDocument();
    expect(screen.getByText('no document to leave')).toBeInTheDocument();
    expect(screen.getByText('not on this branch')).toBeInTheDocument();
    expect(screen.getByText('waiting on the branch')).toBeInTheDocument();
  });
});
