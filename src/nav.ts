import {
  Activity, Blocks, BookOpen, Boxes, LayoutGrid, ListTree, Settings, Timer, Users, UserSquare,
  type LucideIcon,
} from 'lucide-react';

import type { ConsoleMode } from '@/lib/api';

/**
 * The whole primary navigation, in one place. `Sidebar` renders this and owns
 * no route knowledge of its own, so adding a page is a route file plus a line
 * here.
 *
 * THREE GROUPS, and the split is by WHOSE the thing is, not by how many pages
 * there are. The first group is THE WORK — the teams and the initiatives they
 * run. The second is what the work is READ AGAINST: the knowledge it produced,
 * the people who did it, and — for a platform reader — the machinery it ran on.
 * The third is Settings, which belongs to the person rather than to either.
 *
 * THE RAIL IS DIFFERENT IN TEAM MODE, and that is the point of the mode. A team
 * member has no business in the flow catalogue, the block catalogue, the run
 * log or the platform activity feed: those are fleet surfaces, and two of them
 * (Blocks, Runs) are served by `teamless` gateway routes that hand the whole
 * platform's rows to anybody who asks. Leaving them in the rail offered a
 * member a door that either shows them somebody else's data or is simply not
 * theirs to open. `platformOnly` marks them; `navSections` drops them in team
 * mode.
 *
 * WHAT SURVIVES in team mode is exactly the member's own working set — the
 * initiatives they run, the knowledge shelf they read, the people they work
 * with — every one of which the gateway already narrows to the caller's own
 * team via `resolveScope`. So the rail and the server now agree, instead of the
 * rail promising more than the server will give.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The root item owns `/` exactly; every other item matches its own prefix. */
  exact?: boolean;
  /** Hidden in team mode — a fleet surface, not a member's. */
  platformOnly?: boolean;
}
interface NavSection {
  id: string;
  /** Renders as a small eyebrow above the group. Omit for the first group. */
  label?: string;
  /** The same group's eyebrow in team mode, when "Platform" would be a lie. */
  teamLabel?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'work',
    items: [
      { href: '/', label: 'Overview', icon: LayoutGrid, exact: true },
      // TEAMS IS A PLATFORM PAGE. A member acts as exactly one team at a time, so this
      // renders "All teams · 1 total" over a single row — a directory of one, which is
      // furniture rather than a smaller directory. What that row would have told them
      // (their people, their initiatives, their documents) is the Overview.
      { href: '/teams', label: 'Teams', icon: Users, platformOnly: true },
      { href: '/initiatives', label: 'Initiatives', icon: ListTree },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    // In team mode this group is down to Knowledge and People, both of which
    // arrive scoped to the caller's own team. Calling that "Platform" would
    // name the wrong owner on the one screen that is supposed to show a member
    // their own boundary.
    teamLabel: 'Your team',
    items: [
      // FLOWS AND BLOCKS, which is the whole taxonomy. A flow is an agent method: a
      // set of skills that uses blocks, always including ours. A block is something
      // reached over MCP, carrying its team's own package of skills. Every skill on
      // the platform belongs to one or the other — "Skills" as a top-level page was
      // the flat list that hid which. Both are platform machinery: a skill is read
      // here to evaluate or change it, which is not a member's job.
      { href: '/flows', label: 'Flows', icon: Boxes, platformOnly: true },
      { href: '/blocks', label: 'Blocks', icon: Blocks, platformOnly: true },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
      { href: '/runs', label: 'Runs', icon: Timer, platformOnly: true },
      { href: '/activity', label: 'Activity', icon: Activity, platformOnly: true },
      { href: '/people', label: 'People', icon: UserSquare },
    ],
  },
  {
    // No eyebrow. "You" over a single item called Settings said nothing the word
    // Settings did not already say, and a one-item group under a heading reads
    // as though the rest of the group failed to load.
    id: 'you',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/**
 * The rail for one mode — sections with their team-mode items and label, and
 * any section left empty dropped entirely.
 *
 * A pure function over `NAV_SECTIONS` rather than a filter inlined in
 * `Sidebar`, so the "what does a member actually see" question has one answer
 * a test can ask directly.
 */
export function navSections(mode: ConsoleMode): NavSection[] {
  if (mode === 'platform') return NAV_SECTIONS;
  return NAV_SECTIONS.flatMap((section) => {
    const items = section.items.filter((i) => !i.platformOnly);
    if (!items.length) return [];
    return [{ ...section, label: section.teamLabel ?? section.label, items }];
  });
}

export const APP_NAME = 'ZZ Console';
