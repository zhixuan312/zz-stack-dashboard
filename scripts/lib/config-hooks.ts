/** The fake-model steps verify.config.ts hands the run, validated and passed on the model's command line. */

/** One question a project names, the tool of its own the fake model then calls, and the input of that call. */
export type FakeModelStep = { when: string; tool: string; input: Record<string, unknown> };

/** One `fakeModel[<i>].when: <the compile error>` per step whose pattern is not a regular expression. */
export function fakeModelProblems(steps: readonly FakeModelStep[]): string[] {
  return steps.flatMap((step, i) => {
    try { new RegExp(step.when, 'i'); return []; } catch (e) {
      return [`fakeModel[${i}].when: ${(e as Error).message}`];
    }
  });
}

/** The fake model's arguments for the steps: `--steps <json>`, or nothing for no steps. */
export const fakeModelArgs = (steps: readonly FakeModelStep[]): string[] =>
  (steps.length ? ['--steps', JSON.stringify(steps)] : []);
