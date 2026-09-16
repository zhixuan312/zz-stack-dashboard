import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { TeamAdminPanel } from '@/components/settings/TeamAdminPanel';
import type { Me } from '@/lib/api';

/**
 * Task I-14's console-side rule (← AC-5, AC-9): the team tier of Settings shows its
 * controls only when `me.teams` names the caller `admin` for a team, or `me.superadmin`
 * is true — and HIDES them for a plain member, who the gateway would refuse 403 anyway
 * (see `TeamAdminPanel`'s own header: this is courtesy, not the authorisation itself).
 *
 * Every case here answers `GET /api/console/me` with a fixture and lets
 * `TeamAdminPanel` run its own visibility rule for real, rather than asserting on a
 * copy of that rule — the same reason `tests/mode-switch.test.tsx` drives the real
 * component instead of re-deriving what it should show.
 */
const base: Omit<Me, 'teams' | 'superadmin'> = {
  platformVersion: '0.0.0-test',
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true, via: 'session', activeTeam: 'team_one',
};

function mockFetch(me: Me) {
  return vi.fn((url: string) => {
    // The members/flows GET routes this panel fires the moment a team is in view —
    // checked BEFORE `/me`, because "team/members" contains the substring "/me" and
    // would otherwise hand this panel a `Me` object where it expects an array.
    if (url.includes('/settings/team/members') || url.includes('/settings/team/flows')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }
    if (url.endsWith('/console/me')) {
      return Promise.resolve({ ok: true, json: async () => me } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
}

function renderPanel(me: Me) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch(me);
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <TeamAdminPanel />
    </QueryClientProvider>,
  );
  return { ...result, restore: () => { global.fetch = originalFetch; } };
}

describe('TeamAdminPanel — who sees the team controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the team tier from a plain member of a team they do not administer', async () => {
    const me: Me = { ...base, superadmin: false, teams: [{ slug: 'team_one', role: 'member' }] };
    const { restore } = renderPanel(me);
    try {
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(screen.queryByText('Team administration')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows the team tier to an admin of one team, defaulted to that team', async () => {
    const me: Me = { ...base, superadmin: false, teams: [{ slug: 'team_one', role: 'admin' }] };
    const { restore } = renderPanel(me);
    try {
      await waitFor(() => expect(screen.getByText('Team administration')).toBeInTheDocument());
      // The Select is defaulted to the caller's own (only) admin team, not left empty —
      // its value renders as the trigger's visible text.
      expect(await screen.findByText('team_one')).toBeInTheDocument();
      // And the member/flow panels for THAT team are mounted underneath it.
      await waitFor(() => expect(screen.getByText('Members')).toBeInTheDocument());
      expect(screen.getByText('Flows')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('does not show the team tier to an admin of one team when asked about a DIFFERENT team', async () => {
    // Regression guard for the console's own hiding rule: `me.teams.some(t => t.slug
    // === team && t.role === 'admin')` must be checked against the TEAM IN VIEW, not
    // merely "is admin of something" — a caller administering product_group_2 gets no
    // free pass into team_one just because they administer some team.
    const me: Me = { ...base, superadmin: false, teams: [{ slug: 'product_group_2', role: 'admin' }] };
    const { restore } = renderPanel(me);
    try {
      await waitFor(() => expect(screen.getByText('Team administration')).toBeInTheDocument());
      // Defaults to their OWN admin team (product_group_2), never team_one.
      expect(await screen.findByText('product_group_2')).toBeInTheDocument();
      expect(screen.queryByText('team_one')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows the team tier to a superadmin, as a free-text field rather than a fixed list', async () => {
    const me: Me = {
      ...base, superadmin: true, role: 'superadmin',
      teams: [{ slug: 'zz-platform', role: 'admin' }],
    };
    const { restore } = renderPanel(me);
    try {
      await waitFor(() => expect(screen.getByText('Team administration')).toBeInTheDocument());
      // A superadmin administers every team, not only the ones `me.teams` happens to
      // list — so this is a text field they can type any slug into, not a Select
      // limited to their own memberships.
      expect(screen.getByPlaceholderText('team slug')).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
