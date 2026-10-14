import { nav, type NavGroup, type WorkspaceId } from '@/app.config';

const entries = nav.flatMap((g) => g.items);

/**
 * The entry that owns an address: the longest entry it falls under, on a whole path segment (an entry `/requests`
 * claims `/requests/req_1`, never `/requests-archive`). The home `/` claims only itself. An address no entry owns has no
 * entry, and neither does one whose only owner names no workspace.
 */
export function entryOf(pathname: string): (typeof entries)[number] | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  let best: (typeof entries)[number] | null = null;
  for (const item of entries) {
    if (item.workspace === undefined) continue;
    const under = item.href === '/' ? clean === '/' : clean === item.href || clean.startsWith(`${item.href}/`);
    if (under && (best === null || item.href.length > best.href.length)) best = item;
  }
  return best;
}

/**
 * The workspace an address belongs to: the owner of the longest entry it falls under, on a whole path segment
 * (`entryOf`). An address no entry owns belongs to no workspace. The address is all there is to read: nothing here
 * remembers a choice.
 */
export function workspaceOf(pathname: string): WorkspaceId | null {
  return entryOf(pathname)?.workspace ?? null;
}

/** One workspace's navigation: the declared groups holding only its entries, in their order, an emptied group dropped. */
export function navOf(id: WorkspaceId): NavGroup[] {
  return nav.map((g) => ({ ...g, items: g.items.filter((i) => i.workspace === id) })).filter((g) => g.items.length > 0);
}
