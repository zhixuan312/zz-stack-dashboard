import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessProvider } from '@/console/settings/access-read';
import { TeamAdminPanel } from '@/console/settings/team-admin-panel';
import type { Access } from '@/lib/destination-shapes';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { ME } from '../scripts/fake-gateway/people.ts';

/**
 * A team's members on Access are drawn for the admin of the team the person acts for, and for nobody else: not for a
 * member of it, not for an admin of another team they do not act for, and not for a superadmin as such, who administers
 * any team's members on that team's page under Platform. Each case hands `TeamAdminPanel` an Access read and lets it run
 * its own rule, rather than asserting on a copy of that rule. Hiding is courtesy: the gateway's `teamAuthority` refuses
 * anybody else's change anyway.
 */
const BASE = access(ME)[1] as Access;
const withTeams = (teams: Access['teams']['teams']): Access => ({ ...BASE, teams: { actingFor: teams.find((t) => t.active)?.team ?? null, teams } });

function drawn(read: Access, superadmin = false) {
  const reads: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    reads.push(String(input));
    return Promise.resolve({ ok: true, status: 200, json: async () => [{ email: 'one@example.com', role: 'admin' }] } as unknown as Response);
  }));
  render(<QueryClientProvider client={new QueryClient()}><AccessProvider value={{ access: read, superadmin }}><TeamAdminPanel /></AccessProvider></QueryClientProvider>);
  return reads;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('the team\'s members on Access', () => {
  it('are drawn for the admin of the team acted for, and read for that team alone', async () => {
    const reads = drawn(withTeams([{ team: 'atlas', role: 'admin', active: true }, { team: 'beacon', role: 'admin', active: false }]));
    expect(screen.getByRole('heading', { name: 'atlas\'s members' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('one@example.com')).toBeInTheDocument());
    expect(reads.map((u) => new URL(u, 'http://console.test').searchParams.get('team'))).toEqual(['atlas']);
  });

  it('are not drawn, or read, for a member of the team acted for, though they administer another', () => {
    const reads = drawn(withTeams([{ team: 'atlas', role: 'member', active: true }, { team: 'beacon', role: 'admin', active: false }]));
    expect(screen.queryByRole('heading', { name: /members$/ })).toBeNull();
    expect(reads).toEqual([]);
  });

  it('are not drawn for a superadmin who is a member of the team acted for, nor for a person in no team', () => {
    drawn(withTeams([{ team: 'atlas', role: 'member', active: true }]), true);
    expect(screen.queryByRole('heading', { name: /members$/ })).toBeNull();
    drawn(withTeams([]));
    expect(screen.queryByRole('heading', { name: /members$/ })).toBeNull();
  });
});
