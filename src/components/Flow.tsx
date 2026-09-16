'use client';

import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Gate, Step } from '@/lib/api';

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

/** The position in plain words.
 *
 * This sentence is what makes the diagram legible, not the other way round: a
 * reader who is told "a plan is drafted but nobody has approved it" can then
 * look at the stepper and see it. The stepper alone only ever confirmed
 * something the reader had to work out first. */
function flowCaption(
  at: number, outcome: string | null, gates?: Gate[], stage?: string, of?: number,
): string {
  // SAID FROM WHAT IS KNOWN, not from a position in ops-flow.
  //
  // These sentences were a switch on `at`: 6 meant "Built, waiting on the stakeholder. The
  // verification guide is written" — printed over a skill evaluation, which has no build and
  // no guide. A caption that names documents the flow does not have is worse than no caption,
  // because a reader believes it.
  // ALL THREE OUTCOMES MEAN CLOSED, and they do not mean the same thing. This tested
  // `accepted` alone, so a `delivered` initiative — finished, closed, just never signed —
  // was captioned as though it were still running, and an `abandoned` one the same. The
  // ledger is read by counting these three words; a caption that knows only one of them
  // cannot describe two thirds of the vocabulary.
  if (outcome === 'accepted') return 'Done. The stakeholder accepted it, and the initiative is closed.';
  if (outcome === 'delivered') return 'Done. The work finished and the initiative is closed. Nobody signed it off.';
  if (outcome === 'abandoned') return 'Closed without finishing. The work stopped, and the record says so on purpose.';
  const open = gates?.filter((g) => !g.passed) ?? [];
  const where = stage ? `At ${stage}` : `At stage ${at}${of ? ` of ${of}` : ''}`;
  if (!gates?.length) return `${where}. This flow declares no gate, so nothing is waiting on a person.`;
  if (!open.length) return `${where}. Every gate is passed; the initiative has not been closed yet.`;
  const next = open[0].name;
  return open.length === 1
    ? `${where}. One gate is open: ${next}. It is waiting on a person.`
    : `${where}. ${open.length} gates are open. The next is ${next}, waiting on a person.`;
}

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
    <div className="flex items-center gap-2.5 whitespace-nowrap">
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

export function FlowStepper({ at, gates, outcome, steps }: {
  at: number; gates: Gate[]; outcome: string | null; steps?: Step[];
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
  const stages: Step[] = steps?.length ? steps : STAGES.map((x) => ({ name: x.name, what: x.what, produces: '' }));
  // Gates spread evenly through the stages, last gate last. A flow declares which DOCUMENTS
  // it gates, not which stage each sits after, so the only honest placement is proportional —
  // and the last gate belongs at the end, which is the one position that carries meaning.
  // WHERE THE MANIFEST PUTS EACH GATE. `after` is the index of the stage that writes the
  // gated document, which the flow declares. A gate the manifest does not place is drawn at
  // the end rather than at a position invented for it — and it is the honest place, because
  // an unplaced gate is one nothing has said comes earlier.
  const closed = outcome !== null;
  const gateAfter = new Map<number, Gate>();
  gates.forEach((g) => gateAfter.set(g.after && g.after > 0 ? g.after : stages.length, g));
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
    // FINISHED MEANS EVERY STAGE IS DONE. This read `n < at || (n === last && accepted)`,
    // which drew a closed round with its stages half-ticked: on a five-stage evaluation the
    // position came back as 3, so 1 and 2 were done, 5 was done because it was last and
    // accepted, 4 was "not reached yet" and 3 was "where it is now" — on an initiative that
    // finished a week ago. The position bug is fixed in the console; this is the other half,
    // because a closed initiative is not anywhere any more.
    const done = closed || n < at;
    const now = !closed && n === at;
    const gate = gateAfter.get(n) ?? null;

    if (n > 1) {
      items.push(
        <span
          key={`c${n}`}
          aria-hidden
          // `min-w` so it never collapses to nothing on a tight row — a zero-width
          // rule reads as two steps with no relationship at all.
          className={cn('ml-[12px] h-3 w-[1.5px] @min-[920px]:mt-[13px] @min-[920px]:ml-0 @min-[920px]:h-[1.5px] @min-[920px]:w-auto @min-[920px]:min-w-[14px] @min-[920px]:flex-1',
            n <= at ? 'bg-[var(--green)]' : 'bg-line')}
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
            now && 'border-accent bg-accent text-[var(--on-accent)] ring-[3px] ring-accent-tint',
            !done && !now && 'border-line-strong bg-surface text-ink-faint',
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
          {/* FOUR WORDS UNDER A 74px NODE. The manifest's description is a sentence, and a
              sentence here wraps to five lines and breaks the row — so the node carries the
              short form and the full text sits in the tooltip. */}
          {/* THE SENTENCE LIVES IN THE TOOLTIP, not under the node.
              First it was four sliced words, which produced captions like "Stage 1 of skill"
              — the least useful part of every description. Then it was the whole sentence
              with `block line-clamp-2`, and `block` overrides the display that makes
              line-clamp work, so nothing clamped and every node grew a six-line paragraph
              under a 92px circle. A stepper is read at a glance; the name is what it needs,
              and the description is one hover away. */}
        </span>
      </div>,
    );

    if (gate) {
      items.push(
        <div key={`g${n}`} className="my-1 flex items-center gap-2 @min-[920px]:mx-[3px] @min-[920px]:my-0 @min-[920px]:shrink-0 @min-[920px]:flex-col @min-[920px]:gap-[7px]">
          <span
            className={cn(
              'inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[10px] font-medium',
              gate.passed
                ? 'border-[var(--green)] bg-[var(--green-tint)] text-[var(--green-text)]'
                : at >= n
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
            {gate.passed ? 'approved' : at >= n ? 'waiting on a person' : 'a person must approve'}
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
      <p className="rounded-[var(--r)] bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
        {flowCaption(at, outcome ?? null, gates, stages[at - 1]?.name, stages.length)}
      </p>
      <div className="flex flex-wrap gap-4 text-[11.5px] text-ink-faint">
        <Legend className="border-[var(--green)] bg-[var(--green-tint)]">done</Legend>
        <Legend className="border-accent bg-accent">where it is now</Legend>
        <Legend className="border-line-strong bg-surface">not reached yet</Legend>
        <Legend className="w-[22px] rounded-full border-dashed border-line-strong bg-surface">
          a person must approve before the next step
        </Legend>
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
