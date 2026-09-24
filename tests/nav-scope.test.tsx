import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS, navSections } from '@/nav';

/**
 * What a team member sees in the rail — the rule, not the pixels.
 *
 * The platform surfaces are gone in team mode, and the five a member actually works in are
 * still there. Two of the platform ones (`/plugins`, `/runs`) are served by `teamless` gateway
 * routes that answer with the whole fleet for anybody who asks.
 *
 * Asserted on `navSections` rather than through a rendered `Sidebar`: the question is which
 * routes a member is offered, and mounting the rail would drag in a router and a `/me` fetch.
 */
const hrefs = (mode: 'platform' | 'team') =>
  navSections(mode).flatMap((s) => s.items.map((i) => i.href));

describe('the rail in team mode', () => {
  it('hides every platform surface', () => {
    const team = hrefs('team');
    for (const href of ['/teams', '/plugins', '/runs', '/activity']) {
      expect(team).not.toContain(href);
    }
  });

  it("keeps the member's own working set", () => {
    const team = hrefs('team');
    for (const href of ['/', '/initiatives', '/knowledge', '/people', '/settings']) {
      expect(team).toContain(href);
    }
  });

  it('does not call the surviving group "Platform"', () => {
    // Knowledge and People arrive scoped to the caller's own team, so the fleet's eyebrow over
    // them would name the wrong owner on the one view meant to show a member their boundary.
    const labels = navSections('team').map((s) => s.label);
    expect(labels).not.toContain('Platform');
    expect(labels).toContain('Your team');
  });

  it('drops no section entirely, so nothing is left headless', () => {
    // A section filtered down to zero items would render as a bare eyebrow with nothing under
    // it. `navSections` removes it; today none actually empties.
    for (const section of navSections('team')) expect(section.items.length).toBeGreaterThan(0);
  });
});

describe('the rail in platform mode', () => {
  it('is unchanged — platform is what we already had', () => {
    expect(navSections('platform')).toBe(NAV_SECTIONS);
    expect(hrefs('platform')).toEqual([
      '/', '/teams', '/initiatives',
      '/plugins', '/knowledge', '/runs', '/activity', '/people',
      '/settings',
    ]);
  });
});

describe('the rail is not headed by a word that says nothing', () => {
  it('gives Settings no eyebrow of its own', () => {
    // "You" over a single item called Settings said nothing the word Settings did not, and a
    // one-item group under a heading reads as a group that failed to load the rest of itself.
    expect(NAV_SECTIONS.find((s) => s.id === 'you')?.label).toBeUndefined();
  });
});
