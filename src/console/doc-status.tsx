import { Badge } from '@/components/ui/badge';

/**
 * Where a document stands with its gate. Approved, a correction of a closed initiative's closing document waiting on a
 * person, delivered (the flow gates nothing here), waiting on a person, or not a flow document at all. The outcome
 * beside it answers a different question: approved is the gate on the document; accepted is the stakeholder's verdict
 * on what was built.
 */
export function DocStatus({ status, outcome, gated, requiredForClose, correction }: { status: string | null; outcome: string | null; gated?: boolean | null; requiredForClose?: boolean; correction?: number | null }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
      {status === 'approved' ? <Badge tone="positive" dot>Approved</Badge>
        : correction ? <Badge tone="warning" dot>Correction v{correction} awaiting approval</Badge>
        : gated === false ? <Badge tone="neutral">Delivered</Badge>
        : gated === true ? <Badge tone="warning" dot>Awaiting approval</Badge>
        : <span className="text-xs text-ink-3">Not a flow document</span>}
      {gated === false && requiredForClose ? <span className="text-2xs text-ink-3">needed to close</span> : null}
      {outcome ? <Badge tone={outcome === 'abandoned' ? 'neutral' : 'positive'} dot>Outcome: {outcome}</Badge> : null}
    </span>
  );
}
