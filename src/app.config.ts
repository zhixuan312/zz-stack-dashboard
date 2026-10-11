import {
  Activity, BookOpen, LayoutGrid, ListTree, Package, Settings, Timer, UserSquare, Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Everything that makes this console ZZ Stack's, in one file: the name, the accent, the zone every date is shown in,
 * and the navigation. The rail holds no route knowledge of its own; adding a page is a route file plus a line in `nav`.
 */
export const app = {
  /** The product name: the rail, the document title, the sign-in screen. */
  name: 'ZZ Stack',
  /** One line under the name in the rail until the session says which scope is in view. */
  workspace: 'Platform',
  /** The accent preset the product ships with: ZZ's purple, derived by `scripts/brand.ts --hex`. */
  accent: 'brand' as const,
  /** Every date is shown in this zone, and every daily bucket is cut on its midnight. The deployment's own. */
  timezone: 'Asia/Singapore',
  /** ISO 4217 code for every money figure. The console shows none today; the formatters still read it. */
  currency: 'USD',
  /** Shown only until `/me` answers; the rail then shows the signed-in person. */
  user: { name: 'Signing in', role: 'ZZ' },
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  /** Hidden in team mode — a fleet surface, not a member's. */
  platformOnly?: boolean;
};
export type NavGroup = {
  label?: string;
  /** The same group's eyebrow in team mode, when "Platform" would be a lie. */
  teamLabel?: string;
  items: NavItem[];
};

/**
 * The whole primary navigation, in one place: every destination, in the order the rail shows them.
 *
 * Three groups, split by whose the thing is rather than by how many pages there are: the work — the teams and the
 * initiatives they run; what the work is read against — the knowledge it produced, the people who did it, and the
 * machinery it ran on; and Settings, which belongs to the person.
 *
 * A tool reads this to know which routes exist — `scripts/lib/routes.ts` walks it for verify's navigation smoke and
 * `--full`'s mapping. `src/nav.ts` reads it too and narrows it to what the signed-in person and the scope in view may
 * see: Plugins, Runs, Teams and the platform activity feed are fleet surfaces, and two of them are served by `teamless`
 * gateway routes that hand the whole platform's rows to anybody who asks.
 */
export const nav: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid },
      // Teams is a platform page. A member acts as exactly one team at a time, so this renders
      // "All teams · 1 total" over a single row. What that row would have told them — their people,
      // their initiatives, their documents — is the Overview.
      { href: '/teams', label: 'Teams', icon: Users, platformOnly: true },
      { href: '/initiatives', label: 'Initiatives', icon: ListTree },
    ],
  },
  {
    label: 'Platform',
    // In team mode this group is down to Knowledge and People, both of which arrive scoped to the
    // caller's own team, so calling it "Platform" would name the wrong owner.
    teamLabel: 'Your team',
    items: [
      // Plugins, one page. A plugin is a package's skills plus the MCP servers those skills call,
      // shipped together under one declared version — `claude plugin install sdlc@zz-stack`
      // fetches both halves at once — and an evaluation asks its questions of the whole.
      //
      // Still platform machinery: a plugin is read here to evaluate or change it, which is not a
      // member's job.
      { href: '/plugins', label: 'Plugins', icon: Package, platformOnly: true },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
      { href: '/runs', label: 'Runs', icon: Timer, platformOnly: true },
      { href: '/activity', label: 'Activity', icon: Activity, platformOnly: true },
      { href: '/people', label: 'People', icon: UserSquare },
    ],
  },
  {
    // No eyebrow. "You" over a single item called Settings says nothing Settings does not, and a
    // one-item group under a heading reads as though the rest of the group failed to load.
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const slug = 'zz-stack';
