/**
 * A share of a list of routes, for the 20-sample protocol that runs split by route on separate runners.
 * Shard `i` of `n` takes the routes at positions `k` (from 0) with `k % n === i - 1`, so shards 1/n to n/n partition
 * the list.
 */
export type Shard = { index: number; count: number };

export function parseShard(text: string): Shard {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  const index = m ? Number(m[1]) : 0;
  const count = m ? Number(m[2]) : 0;
  if (!m || index < 1 || index > count) throw new Error(`--shard must be <i>/<n> with 1 ≤ i ≤ n, got ${text}`);
  return { index, count };
}

export function shardOf<T>(routes: T[], { index, count }: Shard): T[] {
  return routes.filter((_, k) => k % count === index - 1);
}

/** What a run of the whole protocol is told where `CI` is not `true`; the caller puts its own name in front. */
export const WHOLE_PROTOCOL_REFUSAL =
  'the whole 20-sample protocol runs only in CI, split by route with --shard <i>/<n> (docs/testing.md). '
  + 'On this machine, narrow it: node scripts/perf.ts --base <url> --routes <route>';
