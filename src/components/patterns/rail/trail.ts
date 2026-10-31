import type { NavGroup } from '../../../app.config';
import type { Crumb } from '../../ui/breadcrumb/index';

type Item = NavGroup['items'][number];

/**
 * The item `it` is drawn under: another item of the same group that `under` names, and which is not itself a sub page.
 * An `under` that names nothing of the kind leaves the item at the top level. The rail, the palette's hint and the trail
 * all read the hierarchy through this one rule.
 */
export function parentOf(g: NavGroup, it: Item): Item | undefined {
  const parent = it.under === undefined ? undefined : g.items.find((p) => p.href === it.under && p !== it);
  return parent && !(parent.under !== undefined && g.items.some((x) => x.href === parent.under && x !== parent)) ? parent : undefined;
}

/**
 * The entry an address falls under: the longest `href` it equals or continues on a whole path segment (`/requests` claims
 * `/requests/req_1`, never `/requests-archive`), a trailing slash ignored. The home `/` claims only itself. The rail's
 * current page, the workspace an address belongs to and the not-found page's nearest place all read it.
 */
export function entryFor<T extends { href: string }>(path: string, items: readonly T[]): T | undefined {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  let best: T | undefined;
  for (const it of items) {
    const under = it.href === '/' ? clean === '/' : clean === it.href || clean.startsWith(`${it.href}/`);
    if (under && (best === undefined || it.href.length > best.href.length)) best = it;
  }
  return best;
}

/**
 * The crumbs from the top of the declared navigation to `href`: `[parent, item]` for a sub page, `[item]` for an item
 * with no parent, `[]` for an href no item declares. The last crumb has no `href`, so Breadcrumb draws it as the page.
 */
export function navTrail(href: string, groups: NavGroup[]): Crumb[] {
  const group = groups.find((g) => g.items.some((it) => it.href === href));
  const item = group?.items.find((it) => it.href === href);
  if (!group || !item) return [];
  const parent = parentOf(group, item);
  return parent ? [{ label: parent.label, href: parent.href }, { label: item.label }] : [{ label: item.label }];
}
