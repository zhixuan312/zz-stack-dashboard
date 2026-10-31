/**
 * The gate's rule for a sub page: a nav item that names its parent with `under`. The rail draws one list nested under
 * the parent, so a navigation it cannot draw is refused here. Pure, and reads no project state, so a test can feed it
 * navigations of its own.
 */
import { entryFor } from '../../src/components/patterns/rail/trail.ts';

type Item = { href: string; workspace?: string; under?: string };
type Group = { label?: string; items: Item[] };

const MAX_SUB_PAGES = 7;

/** One line per refused item in item order, then per group the parents with too many sub pages. */
export function navUnderProblems(groups: Group[]): string[] {
  const out: string[] = [];
  const at = (href: string) => `src/app.config.ts: nav item ${href}`;
  for (const g of groups) {
    const byHref = new Map(g.items.map((it) => [it.href, it]));
    for (const it of g.items) {
      const under = it.under;
      if (under === undefined) continue;
      const parent = byHref.get(under);
      if (under === it.href) out.push(`${at(it.href)} is under itself`);
      else if (!parent) out.push(`${at(it.href)} is under ${under}, which is no item of its group`);
      else if (parent.under !== undefined) out.push(`${at(it.href)} is under ${under}, which is itself under ${parent.under}; the rail has three levels, never four`);
      else if (it.workspace !== parent.workspace) out.push(`${at(it.href)} is in workspace ${it.workspace ?? 'none'} under ${under}, which is in workspace ${parent.workspace ?? 'none'}`);
    }
    for (const it of g.items) {
      const n = g.items.filter((s) => s.under === it.href).length;
      if (n > MAX_SUB_PAGES) out.push(`${at(it.href)} has ${n} sub pages; at most ${MAX_SUB_PAGES}, past that the item is a group of its own`);
    }
  }
  return out;
}

/**
 * A page or loading file whose masthead trail names another page's href: `navTrail('<href>', nav)` is written by hand,
 * and one left behind when the route moved draws another page's trail. It names its own route, or for a detail page
 * (`/requests/[id]`) the nearest nav item above it, as the rail reads it (`entryFor`). A literal href is checked; one
 * held in a variable is not. `hrefs` is every nav item's.
 */
export function navTrailProblems(files: { file: string; route: string; src: string }[], hrefs: string[]): string[] {
  const out: string[] = [];
  const items = hrefs.map((href) => ({ href }));
  for (const { file, route, src } of files) {
    const nearest = entryFor(route, items)?.href;
    for (const m of src.matchAll(/\bnavTrail\(\s*(['"`])([^'"`]+)\1/g)) {
      if (m[2] !== route && m[2] !== nearest) out.push(`${file}: navTrail('${m[2]}') is another page's trail; this file's route is ${route}`);
    }
  }
  return out;
}
