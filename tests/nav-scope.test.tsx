import { describe, expect, it } from 'vitest';
import { nav } from '@/app.config';
import { FEATURES } from '@/data/features';
import { shownIn } from '@/nav';
import { visible } from '@/views/console-chrome';
import { navOf } from '@/views/workspaces';

/**
 * The two rails, and the superadmin's team view as a rule over what the server answered — not the pixels.
 *
 * The rails are the spec's destinations table, written out here in its groups and order and never read from `nav`.
 * The server says which destinations a person may open (`chromeAccess().only`); in `Your team` the browser narrows that
 * to what a member is shown, and it can only take away. Asserted through the functions the rail is drawn from:
 * `navOf` is one workspace's navigation, `shownIn` narrows the server's answer, and Meridian's own `visible` narrows a
 * navigation to it, which is what the release's `ConsoleRail` and `ConsolePalette` render.
 */
const WORK_RAIL = [
  { label: 'Work', items: ['/', '/record', '/initiatives', '/approvals', '/knowledge'] },
  { label: 'Agents', items: ['/activity', '/runs'] },
  { label: 'Catalog', items: ['/plugins'] },
  { label: 'Account', items: ['/access'] },
];
const PLATFORM_RAIL = [
  { label: 'Health', items: ['/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation'] },
  { label: 'Fleet', items: ['/platform/teams', '/platform/people', '/platform/usage', '/platform/audit', '/platform/knowledge'] },
];
/** Each destination's name and feature, from the destinations table. */
const DESTINATIONS: Record<string, [label: string, feature: string]> = {
  '/': ['Home', 'home'], '/record': ['Record', 'record'], '/initiatives': ['Initiatives', 'initiatives'],
  '/approvals': ['Approvals', 'approvals'], '/knowledge': ['Knowledge', 'knowledge'], '/activity': ['Activity', 'activity'],
  '/runs': ['Runs', 'runs'], '/plugins': ['Plugins', 'plugins'], '/access': ['Access', 'access'],
  '/platform': ['Status', 'platform-status'], '/platform/releases': ['Releases', 'releases'], '/platform/bugs': ['Bugs', 'bugs'],
  '/platform/evaluation': ['Evaluation', 'evaluation'], '/platform/teams': ['Teams', 'teams'], '/platform/people': ['People', 'people'],
  '/platform/usage': ['Usage', 'usage'], '/platform/audit': ['Audit', 'audit'], '/platform/knowledge': ['Knowledge health', 'knowledge-health'],
};
/** What each page asks for (reconciliation 67), written out from the spec's tables and not read from the code. */
const NEEDS: Record<string, string> = {
  home: 'work:read', record: 'work:read', initiatives: 'work:read', approvals: 'work:read', knowledge: 'work:read',
  activity: 'work:read', runs: 'work:read', plugins: 'work:read', access: 'work:read', settings: 'work:read',
  'platform-status': 'platform:read', releases: 'platform:read', bugs: 'platform:read', evaluation: 'platform:read',
  usage: 'platform:read', 'knowledge-health': 'platform:read',
  teams: 'fleet:read', people: 'fleet:read', audit: 'fleet:read', bug: 'fleet:read',
};
/** What the server answers a superadmin: all eighteen, Work's then Platform's. */
const EVERY = [...WORK_RAIL, ...PLATFORM_RAIL].flatMap((g) => g.items);
/** What the server answers a member: every Work destination and Platform's six public ones (FR-3). */
const MEMBER = [
  '/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access',
  '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge',
];
/** The superadmin's alone. */
const FLEET_PAGES = ['/platform/teams', '/platform/people', '/platform/audit'];

const shape = (groups: { label?: string; items: { href: string }[] }[]) => groups.map((g) => ({ label: g.label, items: g.items.map((i) => i.href) }));
const groups = (mode: 'platform' | 'team', only = EVERY, rail = nav) => visible(shownIn(only, mode), rail);
const hrefs = (mode: 'platform' | 'team', only = EVERY) => groups(mode, only).flatMap((s) => s.items.map((i) => i.href));

describe('the two rails', () => {
  it("draw Work's destinations in the destinations table's groups and order", () => {
    expect(shape(navOf('main'))).toEqual(WORK_RAIL);
  });

  it("draw Platform's destinations in the destinations table's groups and order, Fleet among them", () => {
    expect(shape(navOf('platform'))).toEqual(PLATFORM_RAIL);
  });

  it('are the whole navigation: nothing on it belongs to no workspace', () => {
    expect(nav.flatMap((g) => g.items).map((i) => i.href)).toEqual(EVERY);
    expect(nav.flatMap((g) => g.items).every((i) => i.workspace !== undefined)).toBe(true);
  });

  it('name each destination as the table does, ask its own feature and that feature\'s need by reference', () => {
    for (const item of nav.flatMap((g) => g.items)) {
      expect([item.label, item.feature], item.href).toEqual(DESTINATIONS[item.href]);
      expect(item.needs, item.href).toBe(FEATURES[item.feature].needs);
    }
  });

  it('put Settings on no rail, nor the old addresses Phase 7 removes', () => {
    const all = nav.flatMap((g) => g.items);
    expect(all.map((i) => i.feature)).not.toContain('settings');
    for (const old of ['/settings', '/teams', '/people', '/knowledge/log']) expect(all.map((i) => i.href)).not.toContain(old);
  });
});

describe('who each destination is shown to', () => {
  /** The need the rail asks of the person for a destination: its item's, which names its feature's by reference. */
  const needOf = (href: string) => nav.flatMap((g) => g.items).find((i) => i.href === href)!.needs;

  it('shows a member every Work destination and the six public Platform ones, in the rails\' order', () => {
    expect(EVERY.filter((href) => NEEDS[DESTINATIONS[href]![1]] !== 'fleet:read')).toEqual(MEMBER);
    for (const href of MEMBER) expect(needOf(href), href).not.toBe('fleet:read');
  });

  it('keeps Teams, People and Audit the superadmin\'s alone', () => {
    expect(EVERY.filter((href) => NEEDS[DESTINATIONS[href]![1]] === 'fleet:read')).toEqual(FLEET_PAGES);
    for (const href of FLEET_PAGES) expect(needOf(href), href).toBe('fleet:read');
  });
});

describe('the rail in team mode', () => {
  it('hides every superadmin destination the server answered a superadmin', () => {
    const team = hrefs('team');
    for (const href of FLEET_PAGES) expect(team).not.toContain(href);
  });

  it("keeps the member's own set", () => {
    expect(hrefs('team')).toEqual(MEMBER);
  });

  it('keeps Fleet\'s label over the public figures it still holds, and drops no other group', () => {
    // Meridian's chrome keeps a group's label and narrows its items: a member, and a superadmin reading as their team,
    // read Fleet over Usage and Knowledge health.
    const platform = groups('team', EVERY, navOf('platform'));
    expect(shape(platform)).toEqual([PLATFORM_RAIL[0], { label: 'Fleet', items: ['/platform/usage', '/platform/knowledge'] }]);
    expect(shape(groups('team', EVERY, navOf('main')))).toEqual(WORK_RAIL);
  });

  it('drops a group whose every destination is hidden, so nothing is left headless', () => {
    // A group filtered down to zero items would render as a bare eyebrow with nothing under it.
    const fewer = ['/', '/platform'];
    for (const rail of [navOf('main'), navOf('platform')]) {
      for (const group of groups('team', fewer, rail)) expect(group.items.length).toBeGreaterThan(0);
    }
    expect(shape(groups('team', fewer, navOf('main')))).toEqual([{ label: 'Work', items: ['/'] }]);
    expect(shape(groups('team', fewer, navOf('platform')))).toEqual([{ label: 'Health', items: ['/platform'] }]);
  });
});

describe('the feature table', () => {
  it('asks of every page what the grants table says: Knowledge, Activity, Runs, Plugins and Access a member\'s grant', () => {
    expect(Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.needs]))).toEqual(NEEDS);
  });
});

describe('the narrowing only takes away', () => {
  it('returns the server\'s answer as it is in platform mode', () => {
    expect(shownIn(EVERY, 'platform')).toEqual(EVERY);
    expect(shownIn(MEMBER, 'platform')).toEqual(MEMBER);
  });

  it('never adds a destination the server did not answer, in either mode', () => {
    // A member who chose `platform` on a shared machine, or a stored choice that outlived a superadmin's session: the
    // view may say platform, but what is drawn is still only what the server answered.
    for (const mode of ['platform', 'team'] as const) {
      expect(hrefs(mode, MEMBER)).toEqual(MEMBER);
      const fewer = ['/', '/access'];
      expect(hrefs(mode, fewer)).toEqual(fewer);
      expect(hrefs(mode, [])).toEqual([]);
      for (const href of shownIn(MEMBER, mode)) expect(MEMBER).toContain(href);
    }
  });
});
