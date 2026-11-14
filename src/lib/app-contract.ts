import type { LucideIcon } from 'lucide-react';
import type { Need } from './collection.ts';

/**
 * What the managed code reads of a project's `src/app.config.ts`. The configuration is the project's own file and an
 * update never touches it, so this module is the one place the two agree: `app.config.ts` is checked against these types,
 * and a field the managed code reads that the configuration lacks fails the project's type check.
 */

/** The product's identity: the fields of `app`. `theme` and `logo` are optional and left unset in the template. */
export type AppIdentity = {
  name: string;
  description: string;
  workspace: string;
  accent: string;
  timezone: string;
  currency: string;
  user: { name: string; role: string };
  theme?: string;
  logo?: string;
};

/** A workspace, as the rail's menu and its home read it. */
export type Workspace = { label: string; audience: string; homeHref: string };

/**
 * `needs` is the feature's own need from `src/data/features.ts`, by reference: the rail asks it of the person. `feature`
 * names that feature by its id where its need is one others share, as every `public` one is: the assistant reads from
 * it what the page shows (the actions the features table puts on it), whatever the item is labelled.
 *
 * `prefetch` asks for the item's page to be prefetched in full, its URL data with it, where Next's default prefetches the
 * route's App Shell only. It is for a destination whose content is its URL data (a document page under a dynamic
 * segment), and every visible such link makes a request of its own, so it is for one or two items.
 *
 * `under` is the href of an item in the same group that this item is a sub page of. `W` is the project's workspace ids.
 */
export type NavItem<W extends string = string> = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  workspace?: W;
  needs: Need;
  feature?: string;
  prefetch?: true;
  under?: string;
};
export type NavGroup<W extends string = string> = { label?: string; items: NavItem<W>[] };
