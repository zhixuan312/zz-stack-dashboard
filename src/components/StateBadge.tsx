import { Badge } from '@/components/ui';

/**
 * What is happening to an initiative, in one closed vocabulary, on every page that shows one.
 * Not a stage name — the flow-position column answers where it is.
 *
 * The three closed values are the platform's own: `close()` records exactly one of `accepted`,
 * `delivered` or `abandoned` (OUTCOMES in @zz/contracts), and all three mean closed. Accepted
 * is a person saying it is what they wanted, delivered is work that finished without that
 * signature, abandoned is work that stopped.
 *
 * One rule per colour, so the column reads without a key: green is closed and signed, amber
 * always means a person must act, grey never means a problem.
 */
export interface StateOf {
  outcome: string | null;
  /** `written` tells "nobody has drafted it" from "drafted and unsigned" — see api.ts's
   *  Gate. */
  gates: { name: string; passed: boolean; written: boolean; role?: string }[];
}

/** The six words this column can say, most-closed first — the order a facet lists them in. */
export const INITIATIVE_STATES = [
  'Accepted', 'Delivered', 'Abandoned', 'Waiting on you', 'Ready to close', 'In progress',
] as const;
type InitiativeState = (typeof INITIATIVE_STATES)[number];

/**
 * The rule, extracted from the badge so a filter can ask the same question the column answers.
 * The badge renders what this returns and the facet groups by it — one definition.
 */
export function initiativeState(of: StateOf): InitiativeState {
  if (of.outcome === 'accepted') return 'Accepted';
  if (of.outcome === 'delivered') return 'Delivered';
  if (of.outcome === 'abandoned') return 'Abandoned';
  // Every branch below is about an open initiative, so the handover is not one of its gates:
  // it is written after the close. Counting it makes `Ready to close` unreachable, because
  // the handover gate is unwritten on every initiative that has not closed.
  const gates = of.gates.filter((g) => g.role !== 'handover');
  // Written and unsigned, not merely unsigned. A gate whose document nobody has drafted is
  // waiting on the agent — there is nothing for a person to read. COUPLED: the Overview
  // tile counts the same way.
  if (gates.some((g) => g.written && !g.passed)) return 'Waiting on you';
  if (gates.some((g) => !g.written)) return 'In progress';
  // Every gate passed and no outcome recorded. Not the same as in progress, and the
  // difference is actionable: the work is done and nobody has closed it.
  if (gates.length) return 'Ready to close';
  return 'In progress';
}

export function StateBadge({ of }: { of: StateOf }) {
  const state = initiativeState(of);
  if (state === 'Waiting on you') {
    // The same rule the badge was decided by: only a gate somebody could actually sign.
    const open = of.gates.filter((g) => g.role !== 'handover' && g.written && !g.passed);
    return (
      <Badge variant="amber" dot title={`Waiting on: ${open.map((g) => g.name).join(', ')}`}>
        Waiting on you
      </Badge>
    );
  }
  const variant =
    state === 'Accepted' || state === 'Delivered' ? 'sage'
    : state === 'Ready to close' ? 'accent'
    : 'neutral';
  return <Badge variant={variant} dot>{state}</Badge>;
}
