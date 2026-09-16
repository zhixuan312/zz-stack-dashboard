'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { ClientSetupPanel } from '@/components/settings/ClientSetupPanel';
import { ConsoleScopePanel } from '@/components/settings/ConsoleScopePanel';
import { PasswordPanel } from '@/components/settings/PasswordPanel';
import { PlatformSection } from '@/components/settings/PlatformSection';
import { TeamAdminPanel } from '@/components/settings/TeamAdminPanel';
import { TeamsPanel } from '@/components/settings/TeamsPanel';
import { TokensPanel } from '@/components/settings/TokensPanel';

/**
 * My settings (← Task I-13, AC-4 / AC-9; Task I-14, AC-5 / AC-9; Task I-15, AC-5 / AC-9) —
 * a member's OWN write surface, a team tier for anyone who administers one, and a platform
 * tier for a superadmin.
 *
 * Every `/me/*` section here takes the caller's identity alone — there is no field
 * anywhere on this page, or in the gateway routes behind it, by which a person could
 * name somebody else. That is the whole of AC-4's authorisation story: not a check
 * to get right, but a parameter that was never given a place to exist.
 *
 * `TeamAdminPanel` and `PlatformSection` are the exceptions, by necessity: administering a
 * TEAM, or the platform itself, means naming what is being acted on, so their routes are
 * validated by `teamAuthority` and `superOnly` instead — see each component's own header
 * for why hiding either section here is courtesy and not enforcement.
 *
 * `ConsoleScopePanel` used to sit at the bottom of the rail alongside an appearance
 * control. It is not a `/settings/*` route — the scope is client state
 * (`ConsoleModeProvider`) — but "the things you change about this console" is what this
 * page is, and a control's home should be where a person goes looking for it rather than
 * where it happened to fit.
 *
 * The appearance control is GONE, not moved: the console has one theme now, so there is
 * nothing to choose between. See the 2026-09 brand adoption.
 *
 * `showPeriod={false}` and no `updatedAt`: nothing here is a metric with a
 * refresh cadence — see `DashboardPage`'s own comment on `updatedAt` ("a
 * settings form, not a metric").
 *
 * READING WIDTH, one card per row: it is a column of forms, and the tables in it are short
 * rosters sized to fit that column. Every section returns its cards as a fragment, so each
 * card is a row of the page rather than a stack nested inside one.
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
      <PasswordPanel />
      <TokensPanel />
      <ClientSetupPanel />
      <TeamsPanel />
      <TeamAdminPanel />
      <PlatformSection />
    </DashboardPage>
  );
}
