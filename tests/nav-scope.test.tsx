import { describe, expect, it } from 'vitest';
import { nav } from '@/app.config';
import { FEATURES } from '@/data/features';
import { shownIn } from '@/nav';
import { visible } from '@/views/console-chrome';

/**
 * The superadmin's team view, as a rule over what the server answered — not the pixels.
 *
 * The server says which destinations a person may open (`chromeAccess().only`); in `Your team` the browser narrows that
 * to what a member is shown, and it can only take away. Asserted through the two functions the rail is drawn from:
 * `shownIn` narrows the server's answer, and Meridian's own `visible` narrows `nav` to it, which is what the release's
 * `ConsoleRail` and `ConsolePalette` render.
 */
const EVERY = nav.flatMap((g) => g.items).map((i) => i.href);
/** What the server answers a member today: every destination that does not need the fleet's grant. */
const MEMBER = ['/', '/initiatives', '/knowledge', '/settings', '/platform'];
const groups = (mode: 'platform' | 'team', only = EVERY) => visible(shownIn(only, mode));
const hrefs = (mode: 'platform' | 'team', only = EVERY) => groups(mode, only).flatMap((s) => s.items.map((i) => i.href));

describe('the rail in team mode', () => {
  it('hides every platform surface the server answered a superadmin', () => {
    const team = hrefs('team');
    for (const href of ['/teams', '/people', '/plugins', '/runs', '/activity']) {
      expect(team).not.toContain(href);
    }
  });

  it("keeps the member's own working set", () => {
    expect(hrefs('team')).toEqual(MEMBER);
  });

  it('does not put a member\'s pages under "Platform"', () => {
    // Knowledge arrives scoped to the caller's own team, so the fleet's eyebrow over it would name the
    // wrong owner on the one view meant to show a member their boundary. Meridian's chrome keeps a group's label and
    // narrows its items, so the rule is held by the grouping: the group called Platform holds only fleet surfaces,
    // and is gone as a whole when none of them is shown.
    expect(groups('team').map((s) => s.label)).not.toContain('Platform');
    const platform = groups('platform').find((s) => s.label === 'Platform');
    expect(platform?.items.map((i) => i.href)).toEqual(['/plugins', '/runs', '/activity']);
    expect(platform?.items.every((i) => i.needs === 'fleet:read')).toBe(true);
  });

  it('drops a group whose every destination is hidden, so nothing is left headless', () => {
    // A group filtered down to zero items would render as a bare eyebrow with nothing under it.
    for (const group of groups('team')) expect(group.items.length).toBeGreaterThan(0);
    expect(groups('team')).toHaveLength(groups('platform').length - 1);
  });
});

describe('the feature table', () => {
  /** What each page asks for once People is the superadmin's, written out from the spec's tables and not read from the code. */
  const NEEDS: Record<string, string> = {
    home: 'work:read', record: 'work:read', initiatives: 'work:read', approvals: 'work:read', knowledge: 'work:read', settings: 'work:read', access: 'work:read', 'platform-status': 'platform:read',
    teams: 'fleet:read', people: 'fleet:read', plugins: 'fleet:read', runs: 'fleet:read', activity: 'fleet:read',
    usage: 'platform:read', 'knowledge-health': 'platform:read', audit: 'fleet:read',
    releases: 'platform:read', bugs: 'platform:read', evaluation: 'platform:read',
  };

  it('asks of every page what the grants table says, People and Audit of the fleet\'s grant', () => {
    expect(Object.fromEntries(Object.entries(FEATURES).map(([id, f]) => [id, f.needs]))).toEqual(NEEDS);
  });

  it('keeps Teams and People on the superadmin\'s Work rail until the phase that moves them', () => {
    const work = groups('platform').find((s) => s.items.some((i) => i.href === '/teams'));
    expect(work?.items.map((i) => i.href)).toEqual(['/', '/teams', '/initiatives', '/knowledge', '/people']);
  });
});

describe('the rail in platform mode', () => {
  it('offers every surface the server answered, in the rail\'s order', () => {
    expect(hrefs('platform')).toEqual([
      '/', '/teams', '/initiatives', '/knowledge', '/people',
      '/plugins', '/runs', '/activity',
      '/settings',
      '/platform',
    ]);
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
      const fewer = ['/', '/settings'];
      expect(hrefs(mode, fewer)).toEqual(fewer);
      expect(hrefs(mode, [])).toEqual([]);
      for (const href of shownIn(MEMBER, mode)) expect(MEMBER).toContain(href);
    }
  });
});

describe('the rail is not headed by a word that says nothing', () => {
  it('gives Settings no eyebrow of its own', () => {
    // "You" over a single item called Settings said nothing the word Settings did not, and a
    // one-item group under a heading reads as a group that failed to load the rest of itself.
    for (const mode of ['platform', 'team'] as const) {
      expect(groups(mode).find((s) => s.items.some((i) => i.href === '/settings'))?.label).toBeUndefined();
    }
  });
});
