import { nav, type NavGroup, type WorkspaceId } from '@/app.config';

/** One workspace's navigation: the declared groups holding only its entries, in their order, an emptied group dropped. */
export function navOf(id: WorkspaceId): NavGroup[] {
  return nav.map((g) => ({ ...g, items: g.items.filter((i) => i.workspace === id) })).filter((g) => g.items.length > 0);
}
