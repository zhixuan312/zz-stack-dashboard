import { describe, expect, it } from 'vitest';
import { shownIn } from '@/nav';
import { visible } from '@/views/console-chrome';

/**
 * What a team member sees in the rail — the rule, not the pixels.
 *
 * The platform surfaces are gone in team mode, and the five a member actually works in are
 * still there. Two of the platform ones (`/plugins`, `/runs`) are served by `teamless` gateway
 * routes that answer with the whole fleet for anybody who asks.
 *
 * Asserted through the two functions the rail is drawn from, and not through a rendered rail: `shownIn` says which
 * destinations the view in force shows, and Meridian's own `visible` narrows `nav` to them, which is what the release's
 * `ConsoleRail` and `ConsolePalette` render. Mounting the rail would drag in a router and a `/me` fetch.
 */
const groups = (mode: 'platform' | 'team') => visible(shownIn(mode));
const hrefs = (mode: 'platform' | 'team') => groups(mode).flatMap((s) => s.items.map((i) => i.href));

describe('the rail in team mode', () => {
  it('hides every platform surface', () => {
    const team = hrefs('team');
    for (const href of ['/teams', '/plugins', '/runs', '/activity']) {
      expect(team).not.toContain(href);
    }
  });

  it("keeps the member's own working set", () => {
    expect(hrefs('team')).toEqual(['/', '/initiatives', '/knowledge', '/people', '/settings']);
  });

  it('does not put a member\'s pages under "Platform"', () => {
    // Knowledge and People arrive scoped to the caller's own team, so the fleet's eyebrow over them would name the
    // wrong owner on the one view meant to show a member their boundary. Meridian's chrome keeps a group's label and
    // narrows its items, so the rule is held by the grouping: the group called Platform holds only fleet surfaces,
    // and is gone as a whole when none of them is shown.
    expect(groups('team').map((s) => s.label)).not.toContain('Platform');
    const platform = groups('platform').find((s) => s.label === 'Platform');
    expect(platform?.items.map((i) => i.href)).toEqual(['/plugins', '/runs', '/activity']);
    expect(platform?.items.every((i) => i.needs === 'platform:read')).toBe(true);
  });

  it('drops a group whose every destination is hidden, so nothing is left headless', () => {
    // A group filtered down to zero items would render as a bare eyebrow with nothing under it.
    for (const group of groups('team')) expect(group.items.length).toBeGreaterThan(0);
    expect(groups('team')).toHaveLength(groups('platform').length - 1);
  });
});

describe('the rail in platform mode', () => {
  it('offers every surface, in the rail\'s order', () => {
    expect(hrefs('platform')).toEqual([
      '/', '/teams', '/initiatives', '/knowledge', '/people',
      '/plugins', '/runs', '/activity',
      '/settings',
    ]);
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
