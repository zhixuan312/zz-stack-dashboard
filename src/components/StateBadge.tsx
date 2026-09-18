import { Badge } from '@/components/ui';

/**
 * WHAT IS HAPPENING TO AN INITIATIVE, in one closed vocabulary, on every page that shows one.
 *
 * The initiatives list and a team's page both list initiatives and said different things
 * about them: one showed an outcome for closed rows and a STAGE NAME for open ones, the other
 * showed no state at all. A stage name answers "where is it", which the flow-position column
 * already answers; this column answers "what is happening", and the two are not
 * interchangeable.
 *
 * THE THREE CLOSED VALUES ARE THE PLATFORM'S OWN. `close()` records exactly one of
 * `accepted`, `delivered` or `abandoned` (see OUTCOMES in @zz/contracts) and all three mean
 * closed: accepted is a person saying it is what they wanted, delivered is work that finished
 * without that signature, abandoned is work that stopped.
 *
 * One rule per colour, so the column can be read without a key: green is closed and signed,
 * amber ALWAYS means a person must act, grey never means a problem.
 */
export interface StateOf {
  outcome: string | null;
  /** `written` tells "nobody has drafted it" from "drafted and unsigned" — see api.ts's
   *  Gate. Without it this function read the first as the second. */
  gates: { name: string; passed: boolean; written: boolean; role?: string }[];
}

/** The six words this column can say, most-closed first — the order a facet lists them in. */
export const INITIATIVE_STATES = [
  'Accepted', 'Delivered', 'Abandoned', 'Waiting on you', 'Ready to close', 'In progress',
] as const;
type InitiativeState = (typeof INITIATIVE_STATES)[number];

/**
 * The rule, extracted from the badge so a FILTER can ask the same question the column
 * answers.
 *
 * Filtering by state is the thing this list is opened to do — "what is waiting on me" — and
 * writing that predicate a second time in the page would be two spellings of one vocabulary,
 * free to disagree the day a fourth outcome is added. The badge renders what this returns;
 * the facet groups by it. There is one definition.
 */
export function initiativeState(of: StateOf): InitiativeState {
  if (of.outcome === 'accepted') return 'Accepted';
  if (of.outcome === 'delivered') return 'Delivered';
  if (of.outcome === 'abandoned') return 'Abandoned';
  // EVERY BRANCH BELOW IS ABOUT AN OPEN INITIATIVE, so the handover is not one of its gates:
  // it is written after the close. Counting it made `Ready to close` unreachable — the one
  // state that says "the work is done and nobody has closed it" — because the handover gate
  // is unwritten on every initiative that has not closed.
  const gates = of.gates.filter((g) => g.role !== 'handover');
  // WRITTEN AND UNSIGNED, not merely unsigned. A gate whose document nobody has drafted is
  // waiting on the AGENT — there is nothing for a person to read — so counting it here put
  // "Waiting on you: 3" on a team whose three gate documents had not been started, while the
  // Overview tile beside it said none were awaiting anybody. Same rule, one place apart.
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
