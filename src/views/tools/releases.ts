/**
 * Releases' view tools. `view_releases`, at `/platform/releases`, takes spec version 8's arguments, `limit` and
 * `offset`, the route's own, so it reads `GET /platform/releases` as the route pages it, newest first; its context is the
 * page's, at the page of ten the offset falls in. `view_release`, at `/platform/releases/[version]`, reads one release's
 * own response, as its page does. Both offer the one prepared query (`src/views/releases-explore.ts`).
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { ReleaseDetail, Releases } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { PAGE_SIZE, RELEASES_DEFAULTS, pageAt, releaseContext, releasePath, releasesContext, releasesPath } from '../platform-releases-context';
import { releasesExplore } from '../releases-explore';
import { justRead, segment } from './shared';

export const releasesTool = defineViewTool({
  name: 'releases',
  title: 'Releases',
  description: 'Every recorded release, newest first: the releases and the migrations applied, releases and malformed calls per 1,000 by week, and each release\'s malformed calls, tool failures and p95 in the 72 hours either side of it, with what clients must do.',
  needs: FEATURES.releases.needs,
  page: '/platform/releases',
  input: z.object({
    limit: z.number().int().min(1).max(100).optional().describe('How many releases, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many releases to skip, newest first; 0 when not given.'),
  }),
  async read({ limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.releases.needs);
    const read = { limit, offset };
    const data = await gatewayGet<Releases>(releasesPath(RELEASES_DEFAULTS, read));
    return { context: releasesContext(data, { filters: pageAt(offset), read, ...justRead() }), data };
  },
  explore: releasesExplore,
});

export const releaseTool = defineViewTool({
  name: 'release',
  title: 'Release',
  description: 'One release: when its tag was made, its published changelog and upgrade notes, what clients must do, and what was observed in the 72 hours either side of it.',
  needs: FEATURES.releases.needs,
  page: '/platform/releases/[version]',
  input: z.object({ version: segment('The release\'s version, as Releases lists it: 0.97.1.') }),
  async read({ version }) {
    await requireNeed(FEATURES.releases.needs);
    const release = await gatewayGet<ReleaseDetail>(releasePath(version));
    const arrival = justRead();
    return { context: releaseContext(release, { asOf: new Date(arrival.now).toISOString(), ...arrival }), data: release };
  },
  explore: releasesExplore,
});
