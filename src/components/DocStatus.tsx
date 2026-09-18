import { Badge } from '@/components/ui';

/**
 * A document's state, said in the flow's own terms.
 *
 * "draft" was shown for anything not approved, including documents the flow
 * NEVER gates — `selection.md` and `guide.md` in ops-flow are ungated by
 * declaration. On those, "draft" reads as "waiting for an approval", and no
 * approval is coming, so it describes a queue that does not exist. Someone
 * reading the initiative could not tell a document that is genuinely waiting
 * from one that is simply finished.
 *
 * The flow's manifest is the authority, so a flow that gates different
 * documents gets a different answer here without this file changing.
 */
export function DocStatus({
  status,
  outcome,
  gated,
  requiredForClose,
}: {
  status: string | null;
  outcome: string | null;
  gated?: boolean | null;
  requiredForClose?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {status === 'approved' ? (
        <Badge variant="sage" dot>approved</Badge>
      ) : gated === false ? (
        // DELIVERED — the finished state for a document the flow never gates.
        // "no approval needed" was the right FACT in the wrong column: it
        // described the gate where the reader was looking for the document's
        // own state, so an ungated document was the only one on the page
        // without a name. It has one now, and the gate fact moved to the
        // approval column, which is the question it actually answers.
        <Badge variant="neutral">delivered</Badge>
      ) : gated === true ? (
        // Gated and not approved. There is no third reading: the flow says this
        // document needs a person, and no person has given it one.
        <Badge variant="amber" dot>awaiting approval</Badge>
      ) : (
        // The flow declares NOTHING about this file — somebody wrote it inside
        // the initiative and it is not one of the flow's documents. Said plainly,
        // because a dash here is the grey area: it reads as "we forgot to check"
        // when the honest answer is "the flow does not govern this".
        <span className="text-xs text-ink-faint">not a flow document</span>
      )}
      {gated === false && requiredForClose ? (
        <span className="text-[11px] text-ink-faint">needed to close</span>
      ) : null}
      {/* The OUTCOME, labelled. It sat beside the status looking like a second
          one, and they answer different questions: approved is the gate on the
          document, accepted is the stakeholder's verdict on what was built. */}
      {outcome ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
          outcome
          {/* ABANDONED IS NOT A SUCCESS COLOUR. All three outcomes mean closed, but only
              two mean the work landed — StateBadge is careful to give Abandoned `neutral`
              and this gave the same word green, an inch from the same reader. */}
          <Badge variant={outcome === 'abandoned' ? 'neutral' : 'sage'} dot>{outcome}</Badge>
        </span>
      ) : null}
    </span>
  );
}
