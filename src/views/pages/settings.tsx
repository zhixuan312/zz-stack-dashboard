'use client';

import type { ReactNode } from 'react';
import { AskAbout } from '@/components/patterns/ask-about';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { AssistantPanel } from '@/console/settings/assistant-panel';
import { ClientSetupPanel } from '@/console/settings/client-setup-panel';
import { ConsoleScopePanel } from '@/console/settings/console-scope-panel';
import { PlatformSection } from '@/console/settings/platform-section';
import { TeamAdminPanel } from '@/console/settings/team-admin-panel';
import { TeamsPanel } from '@/console/settings/teams-panel';
import { TokensPanel } from '@/console/settings/tokens-panel';
import { useConsole, useConsoleMode } from '@/lib/api';
import type { Me, MyAccessToken, MyTeams } from '@/lib/api-shapes';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { settingsContext } from '@/views/settings-context';

/**
 * A person's own settings, a team tier for anyone who administers one, and a platform tier for a superadmin.
 *
 * Every `/me/*` section takes the caller's identity alone: there is no field here, or in the gateway routes behind
 * it, by which a person could name somebody else. The team and platform tiers name what is acted on, so their routes
 * are validated by `teamAuthority` and `superOnly`; hiding either here is courtesy, not enforcement. Appearance
 * (theme, accent, density) is in the rail's menu and the command palette, Meridian's own place for it; the assistant's
 * own switch is the last section here, where the console has an assistant.
 */
export function SettingsView() {
  useLive(['settings']);
  return (
    <SettingsFrame>
      {/* Sections 56px apart, as Meridian's settings stack them: yours, then your team's, then the platform's. */}
      <div className="flex flex-col gap-14">
        <ConsoleScopePanel />
        <TeamsPanel />
        <TokensPanel />
        <ClientSetupPanel />
        <TeamAdminPanel />
        <PlatformSection />
        <AssistantPanel />
      </div>
    </SettingsFrame>
  );
}

/**
 * The page's frame, with the reads its shared context is built from.
 *
 * DELIBERATE: apart from the page, which hands it the sections as `children`. These three reads are the ones the
 * sections below already make, under the same keys, so they cost no request; but a component re-renders when its read
 * lands, and held in the page that would re-render every section with it. An element a parent created is the same
 * object when this frame re-renders, so React leaves the sections alone, and the page's largest text is painted once.
 */
function SettingsFrame({ children }: { children: ReactNode }) {
  const { mode } = useConsoleMode();
  const me = useConsole<Me>('/me');
  const teams = useConsole<MyTeams>('/settings/me/teams');
  const tokens = useConsole<MyAccessToken[]>('/settings/me/tokens');
  const arrival = useArrival(me);
  const context = me.data
    ? settingsContext({ me: me.data, teams: teams.data, tokens: tokens.data, mode, ...arrival })
    : pendingContext({ view: 'settings', title: 'Settings', address: '/settings', scope: 'your own settings' }, failureOf(me));
  return (
    <ConsolePage
      title="Settings"
      description="What this console shows you, plus your tokens, client setup and teams."
      showPeriod={false}
      width="form"
      context={context}
      // In the masthead: every section is a form section, whose head takes no actions.
      actions={<AskAbout question="Which team am I acting for, and which of my tokens are live?" />}
    >
      {children}
    </ConsolePage>
  );
}
