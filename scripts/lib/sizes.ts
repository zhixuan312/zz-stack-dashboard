/** First-load JS, HTML and prefetch sizes, checked against the budgets. KiB is 1024 bytes. */

const KIB = 1024;
const kib = (bytes: number): number => Math.round(bytes / KIB);

/** Each route's first-load bytes, every chunk counted once; a chunk with no known size is an error, never zero. */
export function firstLoad(
  stats: { route: string; firstLoadChunkPaths: string[] }[],
  sizeOf: (chunk: string) => number | null,
): { route: string; bytes: number }[] {
  return stats.map(({ route, firstLoadChunkPaths }) => {
    let bytes = 0;
    for (const chunk of new Set(firstLoadChunkPaths)) {
      const size = sizeOf(chunk);
      if (size === null) throw new Error(`${route}: first-load chunk ${chunk} has no known size`);
      bytes += size;
    }
    return { route, bytes };
  });
}

/** Routes over the cap or past their growth allowance over a baseline; without a baseline growth is not configured. */
export function firstLoadProblems(
  routes: { route: string; bytes: number }[],
  { capKiB, growthPct, baseline }: { capKiB: number; growthPct: number; baseline: Record<string, number> | null },
): { problems: string[]; growth: 'checked' | 'not-configured' } {
  const problems: string[] = [];
  for (const { route, bytes } of routes) {
    if (bytes > capKiB * KIB) problems.push(`${route}: first-load JS ${kib(bytes)} KiB over the ${capKiB} KiB cap`);
    const base = baseline?.[route];
    if (base === undefined || base <= 0) continue;
    const grew = ((bytes - base) / base) * 100;
    if (grew > growthPct) problems.push(`${route}: first-load JS grew ${grew.toFixed(1)}% over its baseline (cap ${growthPct}%)`);
  }
  return { problems, growth: baseline ? 'checked' : 'not-configured' };
}

/**
 * The pages whose HTML is held to a baseline: every page route but an API, one under a dynamic segment (its address
 * needs an id the build does not know) and the not-found screen, which answers 404.
 */
export function htmlRoutes(routes: string[]): string[] {
  return routes.filter((r) => !r.startsWith('/api/') && !r.includes('[') && r !== '/_not-found');
}

/** Pages whose HTML grew past their allowance over the baseline, as first-load JS is held; without one growth is not configured. */
export function htmlGrowthProblems(
  sizes: Record<string, number>,
  { growthPct, baseline }: { growthPct: number; baseline: Record<string, number> | null },
): { problems: string[]; growth: 'checked' | 'not-configured' } {
  const problems: string[] = [];
  for (const [route, base] of Object.entries(baseline ?? {})) {
    const bytes = sizes[route];
    if (bytes === undefined || !(base > 0)) continue;
    const grew = ((bytes - base) / base) * 100;
    if (grew > growthPct) problems.push(`${route}: HTML grew ${grew.toFixed(1)}% over its baseline (cap ${growthPct}%)`);
  }
  return { problems, growth: baseline ? 'checked' : 'not-configured' };
}

/** Pages over an absolute HTML cap, a route a project pins on top of its baseline. */
export function htmlProblems(sizes: Record<string, number>, capsKiB: Record<string, number>): string[] {
  return Object.entries(capsKiB)
    .filter(([route, cap]) => (sizes[route] ?? 0) > cap * KIB)
    .map(([route, cap]) => `${route}: HTML ${kib(sizes[route])} KiB over its ${cap} KiB cap`);
}

/**
 * A router prefetch is a page request carrying `next-router-prefetch` with a positive integer. Next 16's segment cache
 * sends `1` for a segment or loading-boundary prefetch, `3` for a route's runtime shell (every link's default prefetch
 * under partialPrefetching asks for one) and `2` for the URL data a full prefetch (`prefetch={true}`) resolves. Counting
 * only `1` left the desktop cap blind to the other two: on Meridian's Home it read 8.8 KiB where the router fetched
 * 45.3 KiB.
 */
export function isPrefetch(request: { headers: Record<string, string> }): boolean {
  return /^[1-9]\d*$/.test(request.headers['next-router-prefetch'] ?? '');
}

export function prefetchProblems(
  { desktopBytes, phoneClosedBytes }: { desktopBytes: number; phoneClosedBytes: number },
  capsKiB: { desktop: number; phoneClosed: number },
): string[] {
  const problems: string[] = [];
  if (desktopBytes > capsKiB.desktop * KIB) problems.push(`desktop: prefetch ${kib(desktopBytes)} KiB over its ${capsKiB.desktop} KiB cap`);
  if (phoneClosedBytes > capsKiB.phoneClosed * KIB) problems.push(`phone with the drawer closed: prefetch ${kib(phoneClosedBytes)} KiB over its ${capsKiB.phoneClosed} KiB cap`);
  return problems;
}
