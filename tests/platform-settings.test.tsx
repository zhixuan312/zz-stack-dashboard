import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { PlatformSection } from '@/components/settings/PlatformSection';
import type { Me } from '@/lib/api';

/**
 * Task I-15's console-side rule (← AC-5, AC-9): the platform tier of Settings shows its
 * controls only when `me.superadmin` is true — and HIDES them for a team admin, who the
 * gateway would refuse 403 anyway (see `PlatformSection`'s own header: this is courtesy,
 * not the authorisation itself). The same discipline `tests/team-settings.test.tsx` proves
 * for `TeamAdminPanel`: every case answers `GET /api/console/me` with a fixture and lets
 * `PlatformSection` run its own visibility rule for real, rather than asserting on a copy
 * of that rule.
 */
const base: Omit<Me, 'teams' | 'superadmin'> = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true, via: 'session', activeTeam: 'team_one',
};

function mockFetch(me: Me) {
  return vi.fn((url: string) => {
    if (url.includes('/settings/platform/people')) {
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }
    if (url.endsWith('/console/me')) {
      return Promise.resolve({ ok: true, json: async () => me } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
}

function renderSection(me: Me) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch(me);
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <PlatformSection />
    </QueryClientProvider>,
  );
  return { ...result, restore: () => { global.fetch = originalFetch; } };
}

describe('PlatformSection — who sees the platform controls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render for a team admin', async () => {
    // Administering a team is not platform authority — see `superOnly` (admin.ts) and its
    // own scope-check.ts matrix, which refuses exactly this identity.
    const me: Me = { ...base, superadmin: false, teams: [{ slug: 'team_one', role: 'admin' }] };
    const { restore, container } = renderSection(me);
    try {
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(screen.queryByText('Platform administration')).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    } finally {
      restore();
    }
  });

  it('does not render for a plain member', async () => {
    const me: Me = { ...base, superadmin: false, teams: [{ slug: 'team_one', role: 'member' }] };
    const { restore, container } = renderSection(me);
    try {
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(screen.queryByText('Platform administration')).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    } finally {
      restore();
    }
  });

  it('renders every platform panel for a superadmin', async () => {
    const me: Me = { ...base, superadmin: true, role: 'superadmin', teams: [{ slug: 'zz-platform', role: 'admin' }] };
    const { restore } = renderSection(me);
    try {
      await waitFor(() => expect(screen.getByText('Platform administration')).toBeInTheDocument());
      expect(screen.getByText('People')).toBeInTheDocument();
      expect(screen.getByText('Create a team')).toBeInTheDocument();
      expect(screen.getByText('Grant block access')).toBeInTheDocument();
      expect(screen.getByText("Set someone's password")).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
