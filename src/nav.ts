import {
  Activity, BookOpen, Package, LayoutGrid, ListTree, Settings, Timer, Users, UserSquare,
  type LucideIcon,
} from 'lucide-react';

import type { NavGroup } from '@/app.config';
import type { ConsoleMode } from '@/lib/api';

/**
 * The whole primary navigation, in one place. The rail and the command palette render this and own no
 * route knowledge of their own, so adding a page is a route file plus a line here.
 *
 * Three groups, split by whose the thing is rather than by how many pages there are: the work — the
 * teams and the initiatives they run; what the work is read against — the knowledge it produced,
 * the people who did it, and the machinery it ran on; and Settings, which belongs to the person.
 *
 * The rail is different in team mode. Plugins, Runs and the platform activity feed are fleet
 * surfaces, and two of them are served by `teamless` gateway routes that hand the whole platform's
 * rows to anybody who asks. `platformOnly` marks them; `navSections` drops them in team mode.
 *
 * What survives in team mode is the member's own working set, every one of which the gateway
 * already narrows to the caller's own team via `resolveScope`.
 */
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden in team mode — a fleet surface, not a member's. */
  platformOnly?: boolean;
}
interface NavSection {
  /** Renders as a small eyebrow above the group. Omit for the first group. */
  label?: string;
  /** The same group's eyebrow in team mode, when "Platform" would be a lie. */
  teamLabel?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
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

/**
 * The rail for one mode — groups with their team-mode items and label, and any group left empty
 * dropped entirely. A pure function over `NAV_SECTIONS` rather than a filter inlined in the rail,
 * so what a member actually sees is a question a test can ask directly.
 */
export function navGroups(mode: ConsoleMode): NavGroup[] {
  return NAV_SECTIONS.flatMap((section) => {
    const items = mode === 'platform' ? section.items : section.items.filter((i) => !i.platformOnly);
    if (!items.length) return [];
    const label = mode === 'platform' ? section.label : section.teamLabel ?? section.label;
    return [{ label, items: items.map(({ href, label: l, icon }) => ({ href, label: l, icon })) }];
  });
}
