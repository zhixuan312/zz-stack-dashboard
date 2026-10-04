'use client';

import { Row } from '@/components/base/shell';
import { ConsolePage } from '@/console/page';
import { ClientSetupPanel } from '@/console/settings/client-setup-panel';
import { ConsoleScopePanel } from '@/console/settings/console-scope-panel';
import { PlatformSection } from '@/console/settings/platform-section';
import { TeamAdminPanel } from '@/console/settings/team-admin-panel';
import { TeamsPanel } from '@/console/settings/teams-panel';
import { TokensPanel } from '@/console/settings/tokens-panel';

/**
 * A person's own settings, a team tier for anyone who administers one, and a platform tier for a superadmin.
 *
 * Every `/me/*` section takes the caller's identity alone: there is no field here, or in the gateway routes behind
 * it, by which a person could name somebody else. The team and platform tiers name what is acted on, so their routes
 * are validated by `teamAuthority` and `superOnly`; hiding either here is courtesy, not enforcement. Appearance
 * (theme, accent, density) is in the rail's menu and the command palette, Meridian's own place for it.
 */
export default function SettingsPage() {
  return (
    <ConsolePage title="Settings" description="What this console shows you, plus your tokens, client setup and teams." showPeriod={false}>
      <Row split="1/2">
        <ConsoleScopePanel />
        <TeamsPanel />
      </Row>
      <TokensPanel />
      <ClientSetupPanel />
      <TeamAdminPanel />
      <PlatformSection />
    </ConsolePage>
  );
}
