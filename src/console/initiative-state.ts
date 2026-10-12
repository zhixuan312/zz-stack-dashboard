/**
 * The rule for an initiative's state, apart from the components that draw it (`src/console/initiative.tsx`), so the
 * server can ask the same question the State column answers: the assistant's `initiatives` collection and the views'
 * shared contexts both do.
 */
/**
 * What is happening to an initiative, in one closed vocabulary, on every page that shows one. Not a stage name: the
 * flow position answers where it is.
 *
 * The three closed values are the platform's own: `close()` records exactly one of `accepted`, `delivered` or
 * `abandoned`, and all three mean closed. One rule per colour, so the column reads without a key: positive is closed
 * with what was asked for, warning always means a person must act, neutral never means a problem.
 */
export interface StateOf {
  outcome: string | null;
  /** `written` tells "nobody has drafted it" from "drafted and unsigned". */
  gates: { name: string; passed: boolean; written: boolean; role?: string }[];
}

/** The six words the state can say, most-closed first: the order a filter lists them in. */
export const INITIATIVE_STATES = ['Accepted', 'Delivered', 'Abandoned', 'Waiting on you', 'Ready to close', 'In progress'] as const;
type InitiativeState = (typeof INITIATIVE_STATES)[number];

/** The gates an open initiative is judged on: the handover is written after the close, so it is never one of them. */
export const ownGates = (of: StateOf) => of.gates.filter((g) => g.role !== 'handover');

/** The rule, apart from the badge, so a filter can ask the same question the column answers. */
export function initiativeState(of: StateOf): InitiativeState {
  if (of.outcome === 'accepted') return 'Accepted';
  if (of.outcome === 'delivered') return 'Delivered';
  if (of.outcome === 'abandoned') return 'Abandoned';
  const gates = ownGates(of);
  // Written and unsigned, not merely unsigned: a gate nobody has drafted waits on the agent, not a person.
  if (gates.some((g) => g.written && !g.passed)) return 'Waiting on you';
  if (gates.some((g) => !g.written)) return 'In progress';
  // Every gate passed and no outcome recorded: the work is done and nobody has closed it.
  if (gates.length) return 'Ready to close';
  return 'In progress';
}

/** The gates of an initiative that are written and not yet approved, by name. */
export const waitingGates = (of: StateOf): string[] => ownGates(of).filter((g) => g.written && !g.passed).map((g) => g.name);

/** Written and unsigned: a gate document a person can read and sign today. */
export const waitingOnYou = (of: StateOf) => ownGates(of).some((g) => g.written && !g.passed);
