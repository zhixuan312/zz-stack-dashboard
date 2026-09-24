'use client';

import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Gate, Step } from '@/lib/api-shapes';

/**
 * An initiative's position in its flow, drawn two ways.
 *
 * DELIBERATE: two components, not one with a `compact` flag. A seven-node stepper inside a
 * table cell wraps onto a second line and loses its labels. A table cell gets `FlowMini` —
 * the stage named, plus a segment bar; a detail view gets `FlowStepper`.
 *
 * Every node carries its stage name and what happens there, and every gate carries the words
 * of the approval it is waiting for.
 */
const STAGES = [
  { name: 'Intent', what: 'what they want' },
  { name: 'Spec', what: 'what it must do' },
  { name: 'Select', what: 'which blocks' },
  { name: 'Plan', what: 'how to build it' },
  { name: 'Build', what: 'build it' },
  { name: 'Verify', what: 'check it' },
  { name: 'Close', what: 'close it' },
] as const;

/** How far through its own flow. `of` comes from the flow's manifest and `name` from the API,
 * which knows the flow. STAGES is the fallback for an initiative whose flow the catalog cannot
 * resolve, which is an initiative of a retired flow. */
export function FlowMini({ at, of, name }: { at: number; of?: number; name?: string }) {
  const total = of && of > 0 ? of : STAGES.length;
  const label = name?.replace(/^zz-|^ops-/, '').replace(/-/g, ' ')
    ?? STAGES[Math.min(at, STAGES.length) - 1]?.name
    ?? `stage ${at}`;
  return (
    // DELIBERATE: `inline-flex`, not `flex`. A block-level flex container fills its table cell
    // and `text-align` cannot move it, so the figure sits hard left whatever the cell's
    // alignment. `inline-flex` shrinks to its content and obeys the cell's alignment; the row
    // inside is still a flex row.
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span className="min-w-[5.25rem] text-xs font-medium text-ink">
        S{at} · {label}
      </span>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'block h-1.5 w-3 rounded-[2px]',
              i + 1 < at ? 'bg-[var(--green)]' : i + 1 === at ? 'bg-accent' : 'bg-line',
            )}
          />
        ))}
      </span>
      <span className="sr-only">Step {at} of {total}: {label}</span>
    </div>
  );
}

/** Where it is now is a property of a step, not a number this component is given: the API
 *  marks the current one. */
export function FlowStepper({ gates, outcome, steps, complete }: {
  gates: Gate[]; outcome: string | null; steps?: Step[]; complete?: boolean;
}) {
  // Every node comes from the API, bookends included: `open`, the flow's own stages, `closed`.
  // Which stages a flow has, which write a document, which of those are gated and what the
  // record shows are all answered by the manifest and the store; this component places and
  // infers nothing. STAGES is the fallback for an initiative whose flow the catalog cannot
  // resolve.
  const stages: Step[] = steps?.length
    ? steps
    : STAGES.map((x) => ({ name: x.name, what: x.what, produces: '', state: 'empty' as const, current: false }));
  // `after` is the index of the stage that writes the gated document, which the flow
  // declares. A gate the manifest does not place is drawn at the end rather than at an
  // invented position.
  //
  // DELIBERATE: a list per position, not one gate. Two gated documents written by one stage,
  // or two the manifest does not place and which both fall back to `stages.length`, would
  // otherwise draw as a single chip while the Gates column beside it read "1 of 2".
  const gateAfter = new Map<number, Gate[]>();
  gates.forEach((g) => {
    const at = g.after && g.after > 0 ? g.after : stages.length;
    gateAfter.set(at, [...(gateAfter.get(at) ?? []), g]);
  });
  // DELIBERATE: flat, not a row of per-stage wrappers. Emitting connector / node / gate as
  // siblings puts the connectors in the row's own flex context, where `flex-1` divides the
  // leftover width between them. Wrapping each stage makes the connectors grandchildren of
  // the row, so nothing distributes that width and the stepper sits against the left edge.
  //
  // A column below 920px of card, a row above: the same siblings stack top to bottom with
  // the connectors turned vertical. A container query, not a breakpoint — the card's width
  // decides, and the card is narrow in a split at any viewport.
  const items: ReactNode[] = [];
  stages.forEach((stage, i) => {
    const n = i + 1;
    // What the record shows, as the API derived it. `done` is every document this step
    // declares written and every gate on them approved; `partial` is written but still
    // waiting on a person; `empty` is nothing written; `untracked` is a step that declares no
    // document. The console draws those four and decides none of them.
    //
    // The last step is the close, which the API appends to every flow, and where the outcome
    // belongs. Identified by position rather than by `outcome !== null`, so an open
    // initiative's last node is the same node without a word under it.
    const isClosing = i === stages.length - 1;
    const done = stage.state === 'done';
    const partial = stage.state === 'partial';
    const untracked = stage.state === 'untracked';
    const now = stage.current;
    const here = gateAfter.get(n) ?? [];

    if (n > 1) {
      items.push(
        <span
          key={`c${n}`}
          aria-hidden
          // `min-w` so it never collapses to nothing on a tight row.
          className={cn('ml-[12px] h-3 w-[1.5px] @min-[920px]:mt-[13px] @min-[920px]:ml-0 @min-[920px]:h-[1.5px] @min-[920px]:w-auto @min-[920px]:min-w-[14px] @min-[920px]:flex-1',
            stages[i - 1].state === 'done' ? 'bg-[var(--green)]' : 'bg-line')}
        />,
      );
    }

    items.push(
      <div key={`s${n}-${stage.name}`} title={stage.what}
           className="flex items-center gap-2.5 @min-[920px]:w-[92px] @min-[920px]:shrink-0 @min-[920px]:flex-col @min-[920px]:gap-[7px]">
        <span
          className={cn(
            'relative grid size-[26px] shrink-0 place-items-center rounded-full border text-[10px] font-semibold',
            done && 'border-[var(--green)] bg-[var(--green-tint)] text-[var(--green-text)]',
            partial && 'border-[var(--amber)] bg-[var(--amber-tint)] text-[var(--amber-text)]',
            now && !done && 'border-accent bg-accent text-[var(--on-accent)] ring-[3px] ring-accent-tint',
            // A step nothing can evidence is drawn as an outline rather than as a state: it
            // is neither reached nor unreached.
            untracked && !now && 'border-dashed border-line-strong bg-surface text-ink-faint',
            !done && !partial && !now && !untracked && 'border-line-strong bg-surface text-ink-faint',
          )}
        >
          {/* DELIBERATE: the number renders on every node, done or not, and the tick is a
              corner badge beside it. Replacing the number with a tick breaks the sequence a
              reader counts along. */}
          {n}
          {done && (
            <span className="absolute -right-1 -top-1 grid size-[13px] place-items-center rounded-full bg-[var(--green)]"
                  aria-hidden>
              <Check className="size-2.5 text-white" strokeWidth={3.5} />
            </span>
          )}
        </span>
        <span className={cn('text-[11px] leading-tight @min-[920px]:text-center',
          done ? 'text-ink-soft' : now ? 'font-semibold text-ink' : 'text-ink-faint')}>
          {stage.name}
          {/* The outcome sits under the node that carries it, the way a gate says "approved"
              below itself, rather than as a sentence under the whole diagram. */}
          {isClosing && outcome ? (
            <span className="block text-[10px] text-ink-faint">
              {outcome}{complete === false ? ' · stopped short' : ''}
            </span>
          ) : null}
          {/* `stage.what` is the node's `title`, not a line under it: a stepper is read at a
              glance, so the name shows and the description is one hover away. */}
        </span>
      </div>,
    );

    for (const gate of here) {
      items.push(
        <div key={`g${n}-${gate.name}`} className="my-1 flex items-center gap-2 @min-[920px]:mx-[3px] @min-[920px]:my-0 @min-[920px]:shrink-0 @min-[920px]:flex-col @min-[920px]:gap-[7px]">
          <span
            className={cn(
              'inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[10px] font-medium',
              gate.passed
                ? 'border-[var(--green)] bg-[var(--green-tint)] text-[var(--green-text)]'
                // From the gate, not from the stage: a stage can hold two gates in
                // different states.
                : gate.written
                  ? 'border-[var(--amber)] bg-[var(--amber-tint)] text-[var(--amber-text)]'
                  : 'border-dashed border-line-strong bg-surface text-ink-faint',
            )}
          >
            {gate.passed
              ? <Check className="size-3" strokeWidth={2.6} aria-hidden />
              : <Lock className="size-3" aria-hidden />}
            {gate.name}
          </span>
          <span className="text-[10px] leading-tight text-ink-faint @min-[920px]:max-w-[78px] @min-[920px]:text-center">
            {gate.passed ? 'approved' : gate.written ? 'waiting on a person' : 'not written yet'}
          </span>
        </div>,
      );
    }
  });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="@container pb-1.5">
        <div className="flex flex-col @min-[920px]:flex-row @min-[920px]:items-start">{items}</div>
      </div>
      <div className="flex flex-wrap gap-4 text-[11.5px] text-ink-faint">
        <Legend className="border-[var(--green)] bg-[var(--green-tint)]">done</Legend>
        <Legend className="border-accent bg-accent">where it is now</Legend>
        <Legend className="border-[var(--amber)] bg-[var(--amber-tint)]">written, waiting on a person</Legend>
        <Legend className="border-line-strong bg-surface">nothing written</Legend>
        {/* The fourth state. A stage that produces a record or nothing cannot leave a
            document, so "nothing written" would be a claim about a stage that never could
            have written one. COUPLED: the nodes above draw four states; this legend lists
            all four. */}
        <Legend className="border-dashed border-line-strong bg-surface">no document to leave</Legend>
      </div>
    </div>
  );
}

function Legend({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('inline-block size-3.5 shrink-0 rounded-full border', className)} />
      {children}
    </span>
  );
}
