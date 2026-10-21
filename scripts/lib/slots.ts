/**
 * A ceiling on how many browsers one verify run holds at once (#77). Each suite asks for the browsers it will open and
 * starts when that many are free; one that asks for more than the ceiling is given the whole ceiling. Without it the
 * browser suites all started together, and a product check that pools its own browsers added its pool on top.
 */
import os from 'node:os';

/** What a machine can hold: one browser for every two CPUs and every 4 GiB of memory, whichever is fewer, and at least one. */
export function browserCeiling(cpus = os.availableParallelism(), memory = os.totalmem()) {
  return Math.max(1, Math.min(Math.floor(cpus / 2), Math.floor(memory / 2 ** 32)));
}

export function slots(ceiling: number) {
  let free = ceiling;
  const waiting: { want: number; go: () => void }[] = [];
  const next = () => {
    while (waiting.length && waiting[0].want <= free) {
      const w = waiting.shift()!;
      free -= w.want;
      w.go();
    }
  };
  /** Run `job` once `want` browsers are free, and free them when it ends, however it ends. */
  return async function hold<T>(want: number, job: () => Promise<T>): Promise<T> {
    const n = Math.max(1, Math.min(want, ceiling));
    await new Promise<void>((go) => { waiting.push({ want: n, go }); next(); });
    try {
      return await job();
    } finally {
      free += n;
      next();
    }
  };
}
