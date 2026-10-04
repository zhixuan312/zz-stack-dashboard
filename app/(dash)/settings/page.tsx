'use client';

import { DashboardPage } from '@/console-old/DashboardPage';
import { ClientSetupPanel } from '@/console-old/settings/ClientSetupPanel';
import { ConsoleScopePanel } from '@/console-old/settings/ConsoleScopePanel';
import { PlatformSection } from '@/console-old/settings/PlatformSection';
import { TeamAdminPanel } from '@/console-old/settings/TeamAdminPanel';
import { TeamsPanel } from '@/console-old/settings/TeamsPanel';
import { TokensPanel } from '@/console-old/settings/TokensPanel';

/**
 * My settings — a member's own write surface, a team tier for anyone who administers one, and
 * a platform tier for a superadmin.
 *
 * Every `/me/*` section takes the caller's identity alone: there is no field on this page, or
 * in the gateway routes behind it, by which a person could name somebody else.
 *
 * `TeamAdminPanel` and `PlatformSection` are the exceptions, because administering a team or
 * the platform means naming what is being acted on, so their routes are validated by
 * `teamAuthority` and `superOnly`. Hiding either section here is courtesy, not enforcement.
 *
 * `ConsoleScopePanel` is not a `/settings/*` route — the scope is client state
 * (`ConsoleModeProvider`) — and lives here because this page is the things you change about
 * this console.
 *
 * `showPeriod={false}` and no `updatedAt`: nothing here is a metric with a refresh cadence.
 *
 * Reading width, one card per row: it is a column of forms, and the tables in it are short
 * rosters sized to fit that column. Every section returns its cards as a fragment, so each card
 * is a row of the page rather than a stack nested inside one.
 */
export default function SettingsPage() {
  return (
    <DashboardPage
      title="Settings"
      description="How this console looks and what it shows you, plus your tokens, client setup and teams."
      showPeriod={false}
      width="reading"
    >
      <ConsoleScopePanel />
      <TokensPanel />
      <ClientSetupPanel />
      <TeamsPanel />
      <TeamAdminPanel />
      <PlatformSection />
    </DashboardPage>
  );
}
