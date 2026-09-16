import { describe, expect, it } from 'vitest';
import type { Me } from '@/lib/api';

// The browser must be able to tell a team admin from a member. Before this task
// `Me.teams` was `string[]`, so no surface could. This file lives in `tests/`
// because vitest.config.ts scans ONLY `tests/**` — a test anywhere else is
// skipped in silence while the suite still reports success.
describe('Me.teams', () => {
  it('carries a role alongside each slug', () => {
    const me: Me = {
      platformVersion: '0.0.0-test',
      email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true,
      superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'admin' }],
      activeTeam: 'team-one',
    };
    expect(me.teams[0].role).toBe('admin');
    expect(me.teams.some((t) => t.slug === 'team-one' && t.role === 'admin')).toBe(true);
  });
});
