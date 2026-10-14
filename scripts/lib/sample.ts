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
  // The console is the route group at the top of the app folder: `(dashboard)` in the template, any name in a product.
  const groups = has(appDir) ? fs.readdirSync(path.join(root, appDir)).filter((n) => /^\(.+\)$/.test(n)) : [];
  const page = (rest: string) => groups.some((g) => has(`${appDir}/${g}/${rest}/page.tsx`));
  return {
    overview: page('(overview)') && has('src/views/overview-context.ts'),
    members: page('members') && has('src/views/members.tsx'),
    keys: page('keys'),
    settings: has('src/views/settings.tsx'),
  };
}
