/** First-load JS, HTML and prefetch sizes, checked against the budgets. KiB is 1024 bytes. */

/** A KiB is 1024 bytes; a size is printed in whole KiB. */
export const KIB = 1024;
export const kib = (bytes: number): number => Math.round(bytes / KIB);

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

/**
 * What a size check found, kept apart so a summary cannot say one thing twice: `overCap` is a route past its absolute
 * cap, `overAllowance` is a page that grew past its allowance over the baseline, and `growth` says whether growth could
 * be judged at all. A route can be over its cap and inside its allowance, or the other way round (#132).
 */
export type SizeVerdict = { problems: string[]; growth: 'checked' | 'not-configured'; overCap: boolean; overAllowance: boolean };

/**
 * Routes over the cap or past their growth allowance over a baseline; without a baseline growth is not configured.
 * `capUnheldOnly` holds a route the baseline holds to its baseline alone, so the cap binds only a route it does not.
 */
export function firstLoadProblems(
  routes: { route: string; bytes: number }[],
  { capKiB, growthPct, baseline, capUnheldOnly = false }: { capKiB: number; growthPct: number; baseline: Record<string, number> | null; capUnheldOnly?: boolean },
): SizeVerdict {
  const problems: string[] = [];
  let overCap = false, overAllowance = false;
  for (const { route, bytes } of routes) {
    const base = baseline?.[route];
    const held = base !== undefined && base > 0;
    if (!(capUnheldOnly && held) && bytes > capKiB * KIB) {
      overCap = true;
      problems.push(`${route}: first-load JS ${kib(bytes)} KiB over the ${capKiB} KiB cap`);
    }
    if (!held) continue;
    const grew = ((bytes - base) / base) * 100;
    if (grew > growthPct) {
      overAllowance = true;
      problems.push(`${route}: first-load JS grew ${grew.toFixed(1)}% over its baseline (cap ${growthPct}%)`);
    }
  }
  return { problems, growth: baseline ? 'checked' : 'not-configured', overCap, overAllowance };
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
): { problems: string[]; growth: 'checked' | 'not-configured'; overAllowance: boolean } {
  const problems: string[] = [];
  let overAllowance = false;
  for (const [route, base] of Object.entries(baseline ?? {})) {
    const bytes = sizes[route];
    if (bytes === undefined || !(base > 0)) continue;
    const grew = ((bytes - base) / base) * 100;
    if (grew > growthPct) {
      overAllowance = true;
      problems.push(`${route}: HTML grew ${grew.toFixed(1)}% over its baseline (cap ${growthPct}%)`);
    }
  }
  return { problems, growth: baseline ? 'checked' : 'not-configured', overAllowance };
}

/**
 * Why the HTML figures cannot be judged against a baseline, or null when they can. Gzip frames a page's inline flight
 * stream differently on each Node major: one page built by Node 22 and by Node 26 compresses a quarter apart while their
 * bytes differ by 0.3%, and the compressor itself differs a little between majors. A figure recorded under one major
 * says nothing about a build made under another, so the baseline records the major and is judged only under it. A
 * baseline recorded before the field existed is in the same position.
 */
export function htmlNodeMismatch(recorded: number | undefined, current: number): string | null {
  if (recorded === undefined) return `the baseline records no Node major; this build used Node ${current}`;
  return recorded === current ? null : `baseline recorded on Node ${recorded}, this build used Node ${current}`;
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

/**
 * Whether the size baseline is the project's own recording. A project Meridian manages inherits the release's
 * `scripts/verify.baseline.json` until the team records its own, and `--write-baseline` stamps `recordedBy: 'sizes.ts'`:
 * figures the release's build produced are not the project's promise on any Node, so growth is not judged against them
 * and the check is declared unrun rather than left to a Node-major accident. The template's own repository has no
 * manifest, and its baseline is the team's own.
 */
export function sizeBaselineOwned({ baseline, managed }: { baseline: { recordedBy?: string } | null; managed: boolean }): { owned: boolean; reason?: string } {
  if (!managed) return { owned: true };
  if (!baseline) return { owned: false, reason: "the project has no scripts/verify.baseline.json; record the project's own with node scripts/sizes.ts --write-baseline --base <url>" };
  if (baseline.recordedBy !== 'sizes.ts') return { owned: false, reason: "the size baseline is the release's, not the project's; record the project's own with node scripts/sizes.ts --write-baseline --base <url>" };
  return { owned: true };
}

export function prefetchProblems(
  { desktopBytes, phoneClosedBytes }: { desktopBytes: number; phoneClosedBytes: number },
  capsKiB: { desktop: number; phoneClosed: number },
  judge: { desktop?: boolean; phoneClosed?: boolean } = {},
): string[] {
  const problems: string[] = [];
  if (judge.desktop !== false && desktopBytes > capsKiB.desktop * KIB) problems.push(`desktop: prefetch ${kib(desktopBytes)} KiB over its ${capsKiB.desktop} KiB cap`);
  if (judge.phoneClosed !== false && phoneClosedBytes > capsKiB.phoneClosed * KIB) problems.push(`phone with the drawer closed: prefetch ${kib(phoneClosedBytes)} KiB over its ${capsKiB.phoneClosed} KiB cap`);
  return problems;
}
