import {
  Activity, BookOpen, HeartPulse, LayoutGrid, ListTree, Package, Settings, Timer, UserSquare, Users,
  type LucideIcon,
} from 'lucide-react';
// Relative with its extension, and a type-only need below: `scripts/check.ts` imports this file under plain node.
import { FEATURES, type FeatureId } from './data/features.ts';
import type { Need } from './lib/collection.ts';

/**
 * Everything that makes this console ZZ Stack's, in one file: the name, the accent, the zone every date is shown in,
 * and the navigation. The rail holds no route knowledge of its own; adding a page is a route file plus a line in `nav`.
 */
export const app = {
  /** The product name: the rail, the document title, the sign-in screen. */
  name: 'ZZ Stack',
  /** One line under the name in the rail until the session says which scope is in view. */
  workspace: 'Platform',
  /**
   * ZZ's mark, which Meridian's `AppMark` draws in the rail: the Zz wordmark with its sparkle, from the brand kit and
   * never redrawn. It is the kit's bitmap inside an SVG, because a product's logo is an SVG path and nothing else
   * (`src/lib/logo.ts`); `scripts/build-brand-assets.py` writes both. One of three ZZ marks and not interchangeable
   * with the others: the flat single Z is the tab icon (`app/icon.png`), because two letters at 16px is mush, and the
   * mascot squircle is the home-screen icon (`app/apple-icon.png`).
   */
  logo: '/assets/brand/wordmark.svg',
  /** The accent preset the product ships with: ZZ's purple, derived by `scripts/brand.ts --hex`. */
  accent: 'brand' as const,
  /** Every date is shown in this zone, and every daily bucket is cut on its midnight. The deployment's own. */
  timezone: 'Asia/Singapore',
  /** ISO 4217 code for every money figure. The console shows none today; the formatters still read it. */
  currency: 'USD',
  /** Shown only until `/me` answers; the rail then shows the signed-in person. */
  user: { name: 'Signing in', role: 'ZZ' },
} as const;

/**
 * The console's workspaces, in the order the rail's menu lists them. A workspace is where a person looks, not what they
 * may do: access is decided by each page's feature, never by this. Each is `label` (its name), `audience` (who it is
 * for) and `homeHref` (the entry the menu opens).
 */
export const workspaces = {
  main: { label: 'Work', audience: 'You and your agents', homeHref: '/' },
  platform: { label: 'Platform', audience: 'The platform itself', homeHref: '/platform' },
} as const;
export type WorkspaceId = keyof typeof workspaces;

/**
 * `feature` is the page's own id in `src/data/features.ts`, the one its gate asks and a page view records; `needs` is
 * that feature's need, by reference: the rail asks it of the person.
 */
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string; workspace?: WorkspaceId; feature: FeatureId; needs: Need };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * The whole primary navigation, in one place: every destination, in the order the rail shows them.
 *
 * Three groups, split by who reads the thing. The first is the work and what it is read against: the teams, the
 * initiatives they run, the knowledge that came out of them and the people who did them. A member's rail is this group
 * and Settings. The second is the platform's own machinery, the plugins, the runs and the audit feed, which a
 * superadmin reads across the fleet: every destination in it needs `fleet:read`, so the group is there or not as a
 * whole, and its name is true whenever it is shown. The third is Settings, which belongs to the person. These three are
 * Work's; the fourth, Health, is the Platform workspace's, and holds Status.
 *
 * DELIBERATE: a group's name never depends on who is reading. Meridian's chrome narrows a group's items by what the
 * person may see and keeps its label, so a group that mixed a member's pages with the fleet's read "Platform" over one
 * team's shelf. Grouping by reader is what makes the release's chrome say the right thing with nothing of our own.
 *
 * A tool reads this to know which routes exist: `scripts/lib/routes.ts` walks it for verify's navigation smoke and
 * `--full`'s mapping. `src/nav.ts` says which of these the view in force shows.
 */
export const nav: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Home', icon: LayoutGrid, workspace: 'main', feature: 'home', needs: FEATURES.home.needs },
      // Teams is a platform page. A member acts as exactly one team at a time, so this renders
      // "All teams · 1 total" over a single row. What that row would have told them — their people,
      // their initiatives, their documents — is the Overview.
      { href: '/teams', label: 'Teams', icon: Users, workspace: 'main', feature: 'teams', needs: FEATURES.teams.needs },
      { href: '/initiatives', label: 'Initiatives', icon: ListTree, workspace: 'main', feature: 'initiatives', needs: FEATURES.initiatives.needs },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen, workspace: 'main', feature: 'knowledge', needs: FEATURES.knowledge.needs },
      { href: '/people', label: 'People', icon: UserSquare, workspace: 'main', feature: 'people', needs: FEATURES.people.needs },
    ],
  },
  {
    label: 'Platform',
    items: [
      // Plugins, one page. A plugin is a package's skills plus the MCP servers those skills call,
      // shipped together under one declared version — `claude plugin install sdlc@zz-stack`
      // fetches both halves at once — and an evaluation asks its questions of the whole.
      //
      // Platform machinery: a plugin is read here to evaluate or change it, which is not a
      // member's job. Runs and Activity are served by routes that answer with the whole fleet.
      { href: '/plugins', label: 'Plugins', icon: Package, workspace: 'main', feature: 'plugins', needs: FEATURES.plugins.needs },
      { href: '/runs', label: 'Runs', icon: Timer, workspace: 'main', feature: 'runs', needs: FEATURES.runs.needs },
      { href: '/activity', label: 'Activity', icon: Activity, workspace: 'main', feature: 'activity', needs: FEATURES.activity.needs },
    ],
  },
  {
    // No eyebrow. "You" over a single item called Settings says nothing Settings does not, and a
    // one-item group under a heading reads as though the rest of the group failed to load.
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, workspace: 'main', feature: 'settings', needs: FEATURES.settings.needs },
    ],
  },
  {
    // The Platform workspace: how the platform itself is doing, which every role reads.
    label: 'Health',
    items: [
      { href: '/platform', label: 'Status', icon: HeartPulse, workspace: 'platform', feature: 'platform-status', needs: FEATURES['platform-status'].needs },
    ],
  },
];

/**
 * What an address a person may not open draws, the product's choice and declared only here (`gate` in
 * `src/data/access.ts` and `gatedMetadata` beside it read it, and `gatedLoading` in `src/data/refusal.ts`). `explain`
 * draws the no-access page: the page's title, who can open it, who to ask and one way out. `absent` draws exactly what
 * an address that names nothing draws, so nothing on it names the page, a role or who to ask.
 *
 * The console's choice is `absent` (spec FR-5): a person cannot tell a page they may not open from one that does not
 * exist, so a refused address says nothing about who holds what.
 */
export const refusal: 'explain' | 'absent' = 'absent';

export const slug = 'zz-stack';
