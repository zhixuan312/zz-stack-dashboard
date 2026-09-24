/* What a failed child process throws: a bare Error decorated with the child's captured
 * streams and exit status. Node exports no type for that shape, so the fields are narrowed
 * once here rather than with an `any` cast at each call site.
 *
 * `stdout`/`stderr` arrive as Buffers under `stdio: 'pipe'` and as strings when encoding is
 * set, so the conversion cannot be a `String()` at the call site.
 */
// Not exported: the two functions below are the surface, and this is the shape they return.
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
