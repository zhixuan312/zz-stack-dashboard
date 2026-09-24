import { Badge } from '@/components/ui';

/**
 * A document's state, said in the flow's own terms.
 *
 * "draft" on a document the flow never gates reads as "waiting for an approval" when no approval
 * is coming — `selection.md` and `guide.md` in ops-flow are ungated by declaration. A reader
 * could not tell a document that is genuinely waiting from one that is simply finished.
 *
 * The flow's manifest is the authority, so a flow that gates different documents gets a
 * different answer here without this file changing.
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
        // Delivered — the finished state for a document the flow never gates. The gate fact
        // lives in the approval column, which is the question it answers.
        <Badge variant="neutral">delivered</Badge>
      ) : gated === true ? (
        // Gated and not approved: the flow says this document needs a person, and no person
        // has given it one.
        <Badge variant="amber" dot>awaiting approval</Badge>
      ) : (
        // The flow declares nothing about this file — somebody wrote it inside the initiative
        // and it is not one of the flow's documents. Said plainly, because a dash reads as "we
        // forgot to check".
        <span className="text-xs text-ink-faint">not a flow document</span>
      )}
      {gated === false && requiredForClose ? (
        <span className="text-[11px] text-ink-faint">needed to close</span>
      ) : null}
      {/* The outcome, labelled, because it answers a different question from the
          status beside it: approved is the gate on the document, accepted is the
          stakeholder's verdict on what was built. */}
      {outcome ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
          outcome
          {/* COUPLED: abandoned is neutral, matching StateBadge. All three outcomes mean
              closed, but only two mean the work landed, and the two components sit an inch
              apart on the same page. */}
          <Badge variant={outcome === 'abandoned' ? 'neutral' : 'sage'} dot>{outcome}</Badge>
        </span>
      ) : null}
    </span>
  );
}
