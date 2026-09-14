/* WHAT A FAILED CHILD PROCESS ACTUALLY THROWS.
 *
 * Half the checks here run a sibling script with `execFileSync`/`execSync` and read the
 * child's output back off the thrown value — that output IS the diagnosis, and swallowing
 * it for "command failed" is how somebody spends an afternoon rerunning it by hand.
 *
 * Node raises a bare Error decorated with the child's captured streams and exit status.
 * There is no exported type for that shape, so this is the honest version of it: a
 * `catch` binding is `unknown`, and the fields are narrowed once, here, rather than with
 * an `any` cast at each of the eight places that read them.
 *
 * `stdout`/`stderr` arrive as Buffers under `stdio: 'pipe'` and as strings when encoding
 * is set, which is why the conversion is not a `String()` at the call site either.
 */
// Not exported: the two functions below are the surface, and this is the shape they
// return. Exporting it would publish a name nothing imports.
interface ExecError {
  message: string;
  status?: number;
  stdout?: string;
  stderr?: string;
}

export function asExecError(err: unknown): ExecError {
  const message = err instanceof Error ? err.message : String(err);
  if (!err || typeof err !== 'object') return { message };
  const r = err as Record<string, unknown>;
  const text = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : Buffer.isBuffer(v) ? v.toString('utf8') : undefined;
  return {
    message,
    status: typeof r.status === 'number' ? r.status : undefined,
    stdout: text(r.stdout),
    stderr: text(r.stderr),
  };
}

/** Both streams of a failed child, joined — the form every caller here wants. */
export const execOutput = (err: unknown): string => {
  const e = asExecError(err);
  return `${e.stdout ?? ''}${e.stderr ?? ''}`;
};
