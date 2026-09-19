'use client';

import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Gate, Step } from '@/lib/api-shapes';

/**
 * The ops-flow position, drawn two ways.
 *
 * TWO RENDERINGS ON PURPOSE, not one component with a `compact` flag. A
 * seven-node stepper inside a table cell wraps onto a second line and loses its
 * labels, and what is left is a row of anonymous ticks that nobody can read —
 * which is exactly what the first version of this shipped. A table cell gets
 * `FlowMini`: the stage NAMED, plus a seven-segment bar. Only a detail view,
 * where there is room for it, gets `FlowStepper`.
 *
 * NOTHING IS EVER UNLABELLED. Every node carries its stage name and what
 * happens there, and every gate carries the words of the approval it is
 * waiting for. A diagram that needs a key to read is a diagram that has not
 * finished being designed.
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

/** How far through ITS OWN flow, not through ops-flow.
 *
 * The bar was seven segments long and labelled from ops-flow's stage list, whatever the
 * initiative was actually running — so a five-stage skill evaluation was drawn as seven boxes
 * and captioned "S6 · Verify". `of` comes from the flow's manifest; `name` is the API's, which
 * knows the flow. STAGES stays as the fallback for an initiative whose flow the catalog cannot
 * resolve, which is the only case where ops-flow's vocabulary is the best guess available. */
export function FlowMini({ at, of, name }: { at: number; of?: number; name?: string }) {
  const total = of && of > 0 ? of : STAGES.length;
  const label = name?.replace(/^zz-|^ops-/, '').replace(/-/g, ' ')
    ?? STAGES[Math.min(at, STAGES.length) - 1]?.name
    ?? `stage ${at}`;
  return (
    // INLINE-FLEX, NOT FLEX, and the difference is visible in every table that uses this.
    //
    // A block-level flex container fills its table cell, and `text-align` cannot move it —
    // alignment applies to inline content, while a block box takes the full width and hands
    // placement to its own `justify-content`, which defaults to `flex-start`. So the cell
    // was centred, the header above it was centred, and the FIGURE inside sat hard left:
    // "FLOW POSITION" floated over empty space with its own column's content a hundred
    // pixels to its left, in both tables that render this.
    //
    // `inline-flex` makes it an inline-level box that shrinks to its content, so it obeys
    // whatever alignment the cell sets — centre here, and left wherever this is used next —
    // instead of quietly overriding it. Nothing else changes: the row is still a flex row.
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

/** WHERE IT IS NOW is a property of a STEP, not a number this component is given: the API marks
 *  the current one. `at` went with the caption that used it to write a sentence. */
export function FlowStepper({ gates, outcome, steps, complete }: {
  gates: Gate[]; outcome: string | null; steps?: Step[]; complete?: boolean;
}) {
  // THE FLOW'S OWN STAGES, and its own gates placed among them.
  //
  // This drew seven fixed nodes named intent/spec/select/plan/build/verify/close and hung
  // four gates off positions 1, 2, 4 and 6 — ops-flow's shape, rendered over every initiative
  // on the platform. A zz-skill-eval round has five stages and two gates, and came out
  // captioned "Built, waiting on the stakeholder. The verification guide is written" about a
  // skill evaluation that has no build and no guide, while a closed and accepted initiative
  // showed three approvals still waiting on a person.
  //
  // `steps` comes from the flow's manifest by way of the API. STAGES stays as the fallback
  // for an initiative whose flow the catalog cannot resolve, which is the only case where
  // ops-flow's vocabulary is the best guess available.
  // EVERY NODE COMES FROM THE API, bookends included: `open`, the flow's own stages, `closed`.
  // The console places nothing and infers nothing — which stages a flow has, which of them
  // write a document, which of those are gated and what the record shows are all questions the
  // manifest and the store answer, and a second answer here could only drift from them.
  const stages: Step[] = steps?.length
    ? steps
    : STAGES.map((x) => ({ name: x.name, what: x.what, produces: '', state: 'empty' as const, current: false }));
  // Gates spread evenly through the stages, last gate last. A flow declares which DOCUMENTS
  // it gates, not which stage each sits after, so the only honest placement is proportional —
  // and the last gate belongs at the end, which is the one position that carries meaning.
  // WHERE THE MANIFEST PUTS EACH GATE. `after` is the index of the stage that writes the
  // gated document, which the flow declares. A gate the manifest does not place is drawn at
  // the end rather than at a position invented for it — and it is the honest place, because
  // an unplaced gate is one nothing has said comes earlier.
  //
  // A LIST PER POSITION, not one gate. Keyed into a plain Map the last write won, so two
  // gated documents written by one stage — or two the manifest does not place, which both
  // fall back to `stages.length` — drew as a single chip while the Gates column beside it
  // still read "1 of 2". The table and the diagram disagreed with nothing on screen saying
  // why.
  const gateAfter = new Map<number, Gate[]>();
  gates.forEach((g) => {
    const at = g.after && g.after > 0 ? g.after : stages.length;
    gateAfter.set(at, [...(gateAfter.get(at) ?? []), g]);
  });
  // FLAT, not a row of per-stage wrappers.
  //
  // Each stage used to be its own flex box holding its connector, its node and its
  // gate. That made the connectors grandchildren of the row, so nothing they could
  // be given would distribute the row's leftover width — the whole thing sized to
  // its content, sat against the left edge, and left a gap on the right that read
  // as a diagram that failed to finish drawing.
  //
  // Emitting connector / node / gate as SIBLINGS puts the connectors in the row's
  // own flex context, where `flex-1` divides whatever is left between the six of
  // them. The stepper then spans its card at any width, and the spacing stays even
  // because every connector gets the same share.
  //
  // A COLUMN BELOW 920px OF CARD, a row above. Nothing scrolls sideways, and seven
  // labelled nodes plus their gates do not fit a narrower card without crushing the
  // labels — so the same siblings stack top to bottom, each node a line with its name
  // beside it, the connectors turned vertical. A container query, not a breakpoint:
  // it is the card's width that decides, and the card is narrow in a split at any
  // viewport.
  const items: ReactNode[] = [];
  stages.forEach((stage, i) => {
    const n = i + 1;
    // WHAT THE RECORD SHOWS, as the API derived it. `done` is every document this step
    // declares written and every gate on them approved; `partial` is written but still
    // waiting on a person; `empty` is nothing written; `untracked` is a step that declares no
    // document, where nothing could show whether it ran. The console draws those four and
    // decides none of them — it used to tick every stage of a closed initiative, so one
    // abandoned at the plan showed six finished stages and a review nobody wrote.
    // The LAST step is the close, which the API appends to every flow; it is where the outcome
    // belongs. Named rather than indexed off `outcome !== null` so an open initiative's last
    // node is the same node, simply without a word under it.
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
          // `min-w` so it never collapses to nothing on a tight row — a zero-width
          // rule reads as two steps with no relationship at all.
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
            // A step nothing can evidence is drawn as an outline rather than as a state: it is
            // neither reached nor unreached, and saying either would be inventing a fact.
            untracked && !now && 'border-dashed border-line-strong bg-surface text-ink-faint',
            !done && !partial && !now && !untracked && 'border-line-strong bg-surface text-ink-faint',
          )}
        >
          {/* THE NUMBER IS ALWAYS THERE. A tick replaced it on every finished stage, so the
              row read S3, S4 with checks between them and the sequence looked broken — a
              reader counting the stages could not, which is the one thing a numbered
              diagram is for. The tick moves to a corner badge instead. */}
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
          {/* THE OUTCOME UNDER THE NODE THAT CARRIES IT, the way a gate says "approved" below
              itself. It was a paragraph under the whole diagram saying "Done. The stakeholder
              accepted it, and the initiative is closed" — the same fact the green tick on this
              node already carries, in a sentence a reader has to parse to learn one word. */}
          {isClosing && outcome ? (
            <span className="block text-[10px] text-ink-faint">
              {outcome}{complete === false ? ' · stopped short' : ''}
            </span>
          ) : null}
          {/* THE SENTENCE LIVES IN THE TOOLTIP, not under the node. A stepper is read at a
              glance; the name is what it needs, and the description is one hover away. */}
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
                // FROM THE GATE, not from the stage. A stage can hold two gates in
                // different states, and reading the stage painted both the same.
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
        {/* THE FOURTH STATE, now that the API sends it. A stage producing a record or
            nothing cannot leave a document, so "nothing written" was a claim about a stage
            that could never have written anything — and the legend listed three styles
            while the nodes drew four. */}
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
