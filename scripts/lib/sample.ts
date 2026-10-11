/**
 * Which of the template's own sample surfaces a project still has. The assistant walk-through and the live checks drive
 * these pages beyond what every product shares; a product that removed one has no such flow to walk, and its steps are
 * not applicable rather than not run. Decided from files, never from what a page renders, so a sample page that broke
 * still fails its checks, and Meridian's own repository, which has every surface, always walks all of them.
 */
import fs from 'node:fs';
import path from 'node:path';

export type SampleSurfaces = { overview: boolean; members: boolean; keys: boolean; settings: boolean };

export function sampleSurfaces(root: string, appDir: string): SampleSurfaces {
  const has = (p: string) => fs.existsSync(path.join(root, p));
  return {
    overview: has(`${appDir}/(dashboard)/(overview)/page.tsx`) && has('src/views/overview-context.ts'),
    members: has(`${appDir}/(dashboard)/members/page.tsx`) && has('src/views/members.tsx'),
    keys: has(`${appDir}/(dashboard)/keys/page.tsx`),
    settings: has('src/views/settings.tsx'),
  };
}
