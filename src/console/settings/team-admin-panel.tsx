'use client';

import { FormSection } from '@/components/patterns/form-section';
import { useAccess } from '@/console/settings/access-read';
import { TeamMembersPanel } from '@/console/settings/team-members-panel';
import { actingOf } from '@/views/access-context';

/**
 * The members of the team this browser acts for, for its admin: drawn only when the Access read names the caller
 * `admin` of that team. A superadmin administers any team's members on that team's page under Platform, so here they
 * see this section only where they are the acted-for team's admin too.
 *
 * Hiding is courtesy, not enforcement: every route under `/settings/team/*` runs `teamAuthority` again on the team the
 * request names (settings.ts), so a stale value here gets the same 403 an MCP caller would.
 */
export function TeamAdminPanel() {
  const { access } = useAccess();
  const acting = actingOf(access);
  if (!acting || acting.role !== 'admin') return null;
  return (
    <FormSection as="div" flush title={`${acting.team}'s members`} description="Who is on the team you act for, and their role. You administer it, so you add, remove and change them here.">
      <TeamMembersPanel team={acting.team} />
    </FormSection>
  );
}
