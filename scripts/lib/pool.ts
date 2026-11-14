/**
 * How many browsers the run may hold open at once, and the scheduler that keeps the suite to it.
 *
 * A browser is not one core's worth of work: each instance runs a driver process and its own renderers, and a page
 * under load competes for the same cores as the check watching it. A suite that starts a dozen of them on eight cores
 * makes every wall-clock window in every check judge the machine instead of the product — measured, a page that
 * settled in 12.5 s with its check alone took 25.4 s inside a full run, and the checks that watch a fixed window went
 * red on a product that was fine. One browser per two cores leaves the headroom that measurement is missing, and the
 * run's `--browsers` flag overrides it where a machine is known to carry more or less.
 */

/** The ceiling for a machine of `cores` cores: one browser per two cores, and never fewer than one. */
export function ceilingOf(cores: number): number {
  return Math.max(1, Math.floor(cores / 2));
}

/**
 * The ceiling a run uses: `--browsers <n>` when it is a number, the machine's own when it is absent or not one. A
 * number below one is still a request to hold as few browsers as possible, so it takes the smallest ceiling that
 * runs anything rather than being treated as no request at all.
 */
export function capacityFrom(value: string | undefined, cores: number): number {
  const wanted = Number(value);
  return value !== undefined && value.trim() !== '' && Number.isFinite(wanted) ? Math.max(1, Math.floor(wanted)) : ceilingOf(cores);
}

/** One thing to run, and how many browsers it holds open while it runs. */
export type Pooled<T> = { weight?: number; start: () => Promise<T> };

/**
 * Run every job so that the browsers they hold never exceed `capacity`, and return their results in the order they
 * were given, however they interleave. A job is started only when its own weight fits what is left, so a heavy job
 * waits for the light ones to finish rather than pushing the suite over; a job heavier than the whole ceiling runs
 * alone, because nothing smaller can be done with it. A job that throws does not stop the others: every job runs, and
 * the first failure is rethrown once they have, since a suite that hides the checks after a red one reports less than
 * it measured.
 */
export async function pool<T>(jobs: readonly Pooled<T>[], capacity: number): Promise<T[]> {
  const ceiling = Math.max(1, Math.floor(capacity));
  const held = jobs.map((j) => Math.min(ceiling, Math.max(1, Math.floor(j.weight ?? 1))));
  const out: T[] = new Array(jobs.length);
  const running = new Map<number, { weight: number; done: Promise<number> }>();
  const errors: unknown[] = [];
  let open = 0;
  let next = 0;

  const launch = (i: number): void => {
    const weight = held[i];
    open += weight;
    const done = jobs[i].start().then(
      (value) => { out[i] = value; return i; },
      (error: unknown) => { errors.push(error); return i; },
    );
    running.set(i, { weight, done });
  };

  while (next < jobs.length || running.size) {
    while (next < jobs.length && open + held[next] <= ceiling) launch(next++);
    if (!running.size) break;
    const i = await Promise.race([...running.values()].map((r) => r.done));
    open -= running.get(i)!.weight;
    running.delete(i);
  }

  if (errors.length) throw errors[0];
  return out;
}
