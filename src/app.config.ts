import type { LucideIcon } from 'lucide-react';

/**
 * Everything that makes this console ZZ Stack's, in one file: the name, the accent and the zone every date is shown in.
 * The navigation is in `src/nav.ts`, because what the rail offers depends on who is signed in and which scope they
 * chose; the rail itself holds no route knowledge.
 */
export const app = {
  /** The product name: the rail, the document title, the sign-in screen. */
  name: 'ZZ Stack',
  /** One line under the name in the rail until the session says which scope is in view. */
  workspace: 'Platform',
  /** The accent preset the product ships with: ZZ's purple, derived by `scripts/brand.ts --hex`. */
  accent: 'zz' as const,
  /** Every date is shown in this zone, and every daily bucket is cut on its midnight. The deployment's own. */
  timezone: 'Asia/Singapore',
  /** ISO 4217 code for every money figure. The console shows none today; the formatters still read it. */
  currency: 'USD',
  /** Shown only until `/me` answers; the rail then shows the signed-in person. */
  user: { name: 'Signing in', role: 'ZZ' },
} as const;

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };
export type NavGroup = { label?: string; items: NavItem[] };
export const slug = 'zz-stack';
