'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/base/shell';
import { CommandPalette } from '@/components/patterns/command-palette';
import { Rail, type Scope } from '@/components/patterns/rail';
import { ShellTools, type Alert } from '@/components/patterns/shell-tools';
import { ConsoleGate } from '@/console/gate';
import { useConsole, useConsoleMode } from '@/lib/api';
import type { Initiative, Me } from '@/lib/api-shapes';
import { navGroups } from '@/nav';

/** Sign out is a POST, so a link prefetch can never end a session: build the form and submit it. */
function signOut() {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/auth/logout';
  document.body.append(form);
  form.submit();
}

/**
 * Work sitting on a person: every gate document that is written and not yet approved, on an open initiative. The
 * bell is the one place the console says "this needs you" without being asked.
 */
function useWaitingAlerts(enabled: boolean): Alert[] {
  const q = useConsole<{ initiatives: Initiative[] }>(enabled ? '/initiatives' : null);
  return (q.data?.initiatives ?? [])
    .filter((i) => !i.closed)
    .flatMap((i) => i.gates.filter((g) => g.written && !g.passed && g.role !== 'handover').map((g) => ({
      id: `${i.team}/${i.slug}/${g.name}`,
      title: `${g.name.replace(/^approve /, '')} waits for approval`,
      detail: `${i.team} · ${i.slug}`,
      at: i.updated,
      href: `/initiatives/${i.team}/${i.slug}`,
      tone: 'warning' as const,
      unread: true,
    })))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * The console's frame: Meridian's shell, with a rail scoped to who is signed in. A superadmin switches between the
 * whole platform and their own team from the workspace menu; a member sees their team only. The gate wraps the page
 * and not the shell, so a visitor who is not signed in still sees the rail while they are sent to sign in.
 */
export function ConsoleFrame({ children }: { children: ReactNode }) {
  const me = useConsole<Me>('/me');
  const { mode, setMode } = useConsoleMode();
  const nav = navGroups(mode);
  const signedIn = !!me.data?.mayRead;
  const alerts = useWaitingAlerts(signedIn);
  const team = me.data?.activeTeam;
  const scopes: Scope[] = me.data?.superadmin
    ? [
      { id: 'platform', label: 'The whole platform', active: mode === 'platform', onSelect: () => setMode('platform') },
      { id: 'team', label: team ? `Your team · ${team}` : 'Your team', active: mode === 'team', onSelect: () => setMode('team') },
    ]
    : [];
  const user = me.data ? { name: me.data.name || me.data.email, role: me.data.superadmin ? 'Superadmin' : 'Member' } : undefined;
  return (
    <AppShell
      rail={<Rail nav={nav} workspace={mode === 'platform' ? 'The platform' : team ?? 'Your team'} scopes={scopes} user={user} signOut={signedIn ? signOut : null} />}
      tools={<ShellTools alerts={alerts} />}
    >
      <ConsoleGate>{children}</ConsoleGate>
      <CommandPalette nav={nav} />
    </AppShell>
  );
}
