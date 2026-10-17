import {
  Activity, BookOpen, Bug, ClipboardCheck, FlaskConical, Gauge, HeartPulse, KeyRound, LayoutGrid, LibraryBig, ListTree,
  Package, ScrollText, ShieldCheck, Tag, Timer, UserSquare, Users, type LucideIcon,
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
 * The whole primary navigation, in one place: every destination of both workspaces, in the groups and the order of the
 * spec's destinations table (FR-1). Work's rail is Work (Home, Record, Initiatives, Approvals, Knowledge), Agents
 * (Activity, Runs), Catalog (Plugins) and Account (Access); Platform's is Health (Status, Releases, Bugs, Evaluation)
 * and Fleet (Teams, People, Usage, Audit, Knowledge health).
 *
 * Each item asks its feature's need, so the grants decide who is shown it (`chromeAccess().only` in
 * `src/data/access.ts`), and the page's own gate decides who may open it. Everybody is shown Work's nine and Health's
 * four; Fleet is the one group that holds both kinds of need: Usage and Knowledge health are the platform's public
 * pages, read by a member as much as a superadmin, and Teams, People and Audit need `fleet:read`. Meridian's chrome
 * narrows a group's items by what the person may see and keeps its label, so a member reads Fleet over Usage and
 * Knowledge health alone, each drawn for them without another team's split (reconciliation 64).
 *
 * Settings is on no rail: Access holds what it held. `/settings`, `/teams`, `/people` and `/knowledge/log` keep their
 * pages at their old addresses, each asking its own feature, until Phase 7 removes them (AC-1.12).
 *
 * A tool reads this to know which routes exist: `scripts/lib/routes.ts` walks it for verify's navigation smoke and
 * `--full`'s mapping. `src/nav.ts` says which of these the view in force shows.
 */
export const nav: NavGroup[] = [
  {
    label: 'Work',
    items: [
      { href: '/', label: 'Home', icon: LayoutGrid, workspace: 'main', feature: 'home', needs: FEATURES.home.needs },
      { href: '/record', label: 'Record', icon: ScrollText, workspace: 'main', feature: 'record', needs: FEATURES.record.needs },
      { href: '/initiatives', label: 'Initiatives', icon: ListTree, workspace: 'main', feature: 'initiatives', needs: FEATURES.initiatives.needs },
      { href: '/approvals', label: 'Approvals', icon: ClipboardCheck, workspace: 'main', feature: 'approvals', needs: FEATURES.approvals.needs },
      { href: '/knowledge', label: 'Knowledge', icon: BookOpen, workspace: 'main', feature: 'knowledge', needs: FEATURES.knowledge.needs },
    ],
  },
  {
    label: 'Agents',
    items: [
      { href: '/activity', label: 'Activity', icon: Activity, workspace: 'main', feature: 'activity', needs: FEATURES.activity.needs },
      { href: '/runs', label: 'Runs', icon: Timer, workspace: 'main', feature: 'runs', needs: FEATURES.runs.needs },
    ],
  },
  {
    label: 'Catalog',
    items: [
      // A plugin is a package's skills plus the MCP servers those skills call, shipped together under one declared
      // version, and an evaluation asks its questions of the whole.
      { href: '/plugins', label: 'Plugins', icon: Package, workspace: 'main', feature: 'plugins', needs: FEATURES.plugins.needs },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/access', label: 'Access', icon: KeyRound, workspace: 'main', feature: 'access', needs: FEATURES.access.needs },
    ],
  },
  {
    label: 'Health',
    items: [
      { href: '/platform', label: 'Status', icon: HeartPulse, workspace: 'platform', feature: 'platform-status', needs: FEATURES['platform-status'].needs },
      { href: '/platform/releases', label: 'Releases', icon: Tag, workspace: 'platform', feature: 'releases', needs: FEATURES.releases.needs },
      { href: '/platform/bugs', label: 'Bugs', icon: Bug, workspace: 'platform', feature: 'bugs', needs: FEATURES.bugs.needs },
      { href: '/platform/evaluation', label: 'Evaluation', icon: FlaskConical, workspace: 'platform', feature: 'evaluation', needs: FEATURES.evaluation.needs },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { href: '/platform/teams', label: 'Teams', icon: Users, workspace: 'platform', feature: 'teams', needs: FEATURES.teams.needs },
      { href: '/platform/people', label: 'People', icon: UserSquare, workspace: 'platform', feature: 'people', needs: FEATURES.people.needs },
      { href: '/platform/usage', label: 'Usage', icon: Gauge, workspace: 'platform', feature: 'usage', needs: FEATURES.usage.needs },
      { href: '/platform/audit', label: 'Audit', icon: ShieldCheck, workspace: 'platform', feature: 'audit', needs: FEATURES.audit.needs },
      { href: '/platform/knowledge', label: 'Knowledge health', icon: LibraryBig, workspace: 'platform', feature: 'knowledge-health', needs: FEATURES['knowledge-health'].needs },
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
