/**
 * One run's last line, and its exit: every Tier 1 failure named together, what did not run, what the project declared
 * unrun, the Tier 2 values past their line, and the findings a Tier 2 or Tier 3 check reported — reported, never failed.
 * A run exits non-zero for a Tier 1 failure (or a check that did not run where the command's evidence needs it); a
 * Tier 2 value past its line, or a finding a reported check found, exits 0.
 */
export type RunSummary = {
  command: string;
  failed: string[];
  notRun: string[];
  declared: string[];
  overBudget: string[];
  /** What a check ran, found, and no run fails on: Tier 2 findings and the Tier 3 lint and type check. Named here so a
   *  person reads them beside the failures instead of finding them in the log or not at all. */
  reported?: string[];
  files?: number;
  tests?: number;
  /** What this command's passing line may claim; a run that leaves Tier 2 out says so rather than claiming it. */
  covers?: string;
};

/**
 * One check's outcome, counted where its tier says it goes: a Tier 1 failure turns the run red, and a Tier 2 or Tier 3
 * finding is reported and exits nothing. One function decides, so a call site cannot sort a check by the habit of the
 * code around it — which is how lint and the type check came to block, and how contrast and a 24px target did.
 */
export function record(status: number, label: string, tier: 1 | 2 | 3, into: { failed: string[]; reported: string[] }): void {
  if (status === 0) return;
  (tier === 1 ? into.failed : into.reported).push(label);
}

export const summaryLine = (s: RunSummary): { line: string; exit: number } => {
  const declaredText = s.declared.length ? `; not run by the project's configuration: ${s.declared.join(', ')}` : '';
  const tier2 = s.overBudget.length ? `; Tier 2 over budget (reported, not failed): ${s.overBudget.length} — ${s.overBudget.join(', ')}` : '';
  const reported = s.reported?.length ? `; reported, not failed: ${s.reported.join(', ')}` : '';
  const counts = s.files === undefined ? '' : ` (${s.files} test files, ${s.tests ?? 0} tests)`;
  if (s.failed.length) {
    return { line: `${s.command}: FAIL: ${s.failed.length} check${s.failed.length === 1 ? '' : 's'} failed: ${s.failed.join(', ')}${s.notRun.length ? `; not run: ${s.notRun.join(', ')}` : ''}${declaredText}${tier2}${reported}${counts}`, exit: 1 };
  }
  if (s.notRun.length) return { line: `${s.command}: every check that ran passed; not run: ${s.notRun.join(', ')}${declaredText}${tier2}${reported}${counts}`, exit: 0 };
  if (s.declared.length) return { line: `${s.command}: every check that ran passed${declaredText}${tier2}${reported}${counts}`, exit: 0 };
  return { line: `${s.command}: ${s.covers ?? 'every Tier 1 and Tier 2 check'} passed${tier2}${reported}${counts}`, exit: 0 };
};
