/**
 * An initiative's gates as its page reads them: the ones it is judged on, and the ones written and waiting on a person.
 *
 * Its state is not decided here: the gateway answers it, on the list and on the initiative alike, by one rule
 * (initiative-list.ts's stateOf), and `src/console/initiative.tsx` draws it in the list's words. These gates only name
 * what a waiting initiative waits on, and what the page offers to Review.
 */
export interface StateOf {
  outcome: string | null;
  /** `written` tells "nobody has drafted it" from "drafted and unsigned". */
  gates: { name: string; passed: boolean; written: boolean; role?: string }[];
}

/** The gates an open initiative is judged on: the handover is written after the close, so it is never one of them. */
export const ownGates = (of: StateOf) => of.gates.filter((g) => g.role !== 'handover');

/** The gates of an initiative that are written and not yet approved, by name. */
export const waitingGates = (of: StateOf): string[] => ownGates(of).filter((g) => g.written && !g.passed).map((g) => g.name);
