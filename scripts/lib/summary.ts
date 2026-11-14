/**
 * One run's last line, and its exit: every Tier 1 failure named together, what did not run, what the project declared
 * unrun, and the Tier 2 values past their line — reported, never failed. A run exits non-zero for a Tier 1 failure (or
 * a check that did not run where the command's evidence needs it); a Tier 2 value past its line exits 0.
 */
export type RunSummary = {
  command: string;
  failed: string[];
  notRun: string[];
  declared: string[];
  overBudget: string[];
  files?: number;
  tests?: number;
  /** What this command's passing line may claim; a run that leaves Tier 2 out says so rather than claiming it. */
  covers?: string;
};

export const summaryLine = (s: RunSummary): { line: string; exit: number } => {
  const declaredText = s.declared.length ? `; not run by the project's configuration: ${s.declared.join(', ')}` : '';
  const tier2 = s.overBudget.length ? `; Tier 2 over budget (reported, not failed): ${s.overBudget.length} — ${s.overBudget.join(', ')}` : '';
  const counts = s.files === undefined ? '' : ` (${s.files} test files, ${s.tests ?? 0} tests)`;
  if (s.failed.length) {
    return { line: `${s.command}: FAIL: ${s.failed.length} check${s.failed.length === 1 ? '' : 's'} failed: ${s.failed.join(', ')}${s.notRun.length ? `; not run: ${s.notRun.join(', ')}` : ''}${declaredText}${tier2}${counts}`, exit: 1 };
  }
  if (s.notRun.length) return { line: `${s.command}: every check that ran passed; not run: ${s.notRun.join(', ')}${declaredText}${tier2}${counts}`, exit: 0 };
  if (s.declared.length) return { line: `${s.command}: every check that ran passed${declaredText}${tier2}${counts}`, exit: 0 };
  return { line: `${s.command}: ${s.covers ?? 'every Tier 1 and Tier 2 check'} passed${tier2}${counts}`, exit: 0 };
};
