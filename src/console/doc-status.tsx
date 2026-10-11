import { Badge } from '@/components/ui/badge';

/**
 * Where a document stands with its gate. Approved, a correction of a closed initiative's closing document waiting on a
 * person, delivered (the flow gates nothing here), waiting on a person, or not a flow document at all. The outcome
 * beside it answers a different question: approved is the gate on the document; accepted is the stakeholder's verdict
 * on what was built.
 *
 * `compact` is the verdict alone, for the phone card. A card puts this at the end of the title line, where the slot is
 * one short badge wide and the cell that holds it is `shrink-0` (Meridian's own rule, `data-table`'s PHONE_ROLES), so it
 * cannot shrink to fit: the full set — a correction badge AND an outcome badge, each `whitespace-nowrap` — measured
 * 348px in the 336px a 390px card has left after its padding, and pushed the row 12px past its frame. The two extras
 * are read elsewhere on the same page: the stepper above the table carries the outcome, and "needed to close" is a
 * qualifier on the badge beside it in the table. `mobileCell` is the designed hook for exactly this — the cell as a
 * card shows it (see the document and updated columns).
 */
export function DocStatus({ status, outcome, gated, requiredForClose, correction, compact }: { status: string | null; outcome: string | null; gated?: boolean | null; requiredForClose?: boolean; correction?: number | null; compact?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
      {status === 'approved' ? <Badge tone="positive" dot>Approved</Badge>
        : correction ? <Badge tone="warning" dot>{compact ? `Correction v${correction}` : `Correction v${correction} awaiting approval`}</Badge>
        : gated === false ? <Badge tone="neutral">Delivered</Badge>
        : gated === true ? <Badge tone="warning" dot>Awaiting approval</Badge>
        : <span className="text-xs text-ink-3">Not a flow document</span>}
      {!compact && gated === false && requiredForClose ? <span className="text-2xs text-ink-3">needed to close</span> : null}
      {!compact && outcome ? <Badge tone={outcome === 'abandoned' ? 'neutral' : 'positive'} dot>Outcome: {outcome}</Badge> : null}
    </span>
  );
}
