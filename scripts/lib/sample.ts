/**
 * Which of the template's own sample surfaces a project still has. The assistant walk-through and the live checks drive
 * these pages beyond what every product shares; a product that removed one has no such flow to walk, and its steps are
 * not applicable rather than not run. Decided from files, never from what a page renders, so a sample page that broke
 * still fails its checks, and Meridian's own repository, which has every surface, always walks all of them.
 *
 * A file is the sample's while it still holds what the walk reads: the roster's people, the invitation's copy, the page's
 * title, the switch's label. A product's first edit is usually its own people and its own words on a page it kept, and a
 * walk that waits for rows and labels no longer drawn fails as though the product were broken.
 */
import fs from 'node:fs';
import path from 'node:path';

export type SampleSurfaces = { home: boolean; now: boolean; members: boolean; keys: boolean; settings: boolean };
/** The sample pages whose prepared query the walk-through asks: each page with the file that declares its query. */
export type ExploreSurfaces = { usage: boolean; tests: boolean };

/** Whether a file is in the project, and whether its console has a page at a route. */
function files(root: string, appDir: string) {
  const has = (p: string) => fs.existsSync(path.join(root, p));
  // The console is the route group at the top of the app folder: `(dashboard)` in the template, any name in a product.
  const groups = has(appDir) ? fs.readdirSync(path.join(root, appDir)).filter((n) => /^\(.+\)$/.test(n)) : [];
  const page = (rest: string) => groups.some((g) => has(`${appDir}/${g}/${rest}/page.tsx`));
  return { has, page };
}

export function sampleSurfaces(root: string, appDir: string): SampleSurfaces {
  const { has, page } = files(root, appDir);
  const holds = (p: string, ...texts: string[]) => has(p) && texts.every((t) => fs.readFileSync(path.join(root, p), 'utf8').includes(t));
  return {
    // The guide's summary preset keeps these file names for a product's own Home, so the sample's is told by the year's
    // card the walk-through reads, which a product's own Home does not draw.
    home: page('(home)') && has('src/logic/home-context.ts') && holds('src/views/home.tsx', 'A year, counted'),
    now: page('engineering') && has('src/views/now.tsx'),
    members: page('members') && holds('src/views/members.tsx', 'Invite member', 'Ana Costa')
      && holds('src/system/fixtures/sample-members.ts', 'Maya Chen', 'Alice Moreno', 'Ravi Patel'),
    keys: page('keys') && holds('src/logic/keys-context.ts', "title: 'API keys',"),
    settings: holds('src/views/settings.tsx', 'Show the assistant'),
  };
}

export function exploreSurfaces(root: string, appDir: string): ExploreSurfaces {
  const { has, page } = files(root, appDir);
  return {
    usage: page('usage') && has('src/logic/usage-explore.ts'),
    tests: page('tests') && has('src/logic/tests-explore.ts'),
  };
}
