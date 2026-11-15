/**
 * What the last-green marker records, and when it may move.
 *
 * The marker is what the next run reads to know which diff it must prove. It used to be written at the end of a run with
 * whatever `HEAD` was then — so a commit made *while* a gate was running was recorded as proven although nothing had
 * tested it, and the next `test:t1` printed "nothing changed since the last green run" and skipped it. Measured on
 * 2026-11-15: seven commits landed during a `test:t2`, the marker named the last of them, and the gate that should have
 * proven them did nothing.
 *
 * A run proves the tree it read when it started. The marker records that, and says when `HEAD` moved underneath it, so
 * the unproven commit is left for the next run rather than covered.
 */
import fs from 'node:fs';
import path from 'node:path';

export type MarkerVerdict = {
  /** The commit to write: the one the run read at its start, never the one that happens to be current at the end. */
  write: string;
  /** The commit `HEAD` moved to while the run ran, or null when it did not move. */
  moved: string | null;
};

export function markerFor(headAtStart: string, headAtEnd: string): MarkerVerdict {
  return { write: headAtStart, moved: headAtEnd === headAtStart ? null : headAtEnd };
}

/** Write the marker a passing run records, and say so in one line when `HEAD` moved while the run was going. */
export function recordMarker(file: string, headAtStart: string, headAtEnd: string): MarkerVerdict {
  const verdict = markerFor(headAtStart, headAtEnd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${verdict.write}\n`);
  if (verdict.moved) console.log(`note: the marker records ${verdict.write.slice(0, 8)}, the tree this run proved; HEAD moved to ${verdict.moved.slice(0, 8)} while it ran, and that commit is the next run's to prove`);
  return verdict;
}
