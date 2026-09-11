'use client';

import { Panel } from '@/components/Panel';
import { PlatformBlocksPanel } from '@/components/settings/PlatformBlocksPanel';
import { PlatformPasswordPanel } from '@/components/settings/PlatformPasswordPanel';
import { PlatformPeoplePanel } from '@/components/settings/PlatformPeoplePanel';
import { PlatformTeamsPanel } from '@/components/settings/PlatformTeamsPanel';
import { useConsole, type Me } from '@/lib/api';

/**
 * The platform tier of Settings (← Task I-15, AC-5 / AC-9) — visible only to a superadmin.
 *
 * HIDING IS COURTESY, NOT ENFORCEMENT, same as `TeamAdminPanel` above: `me.superadmin`
 * decides what this component renders; it decides NOTHING about what the gateway accepts.
 * Every route under `/settings/platform/*` runs the SAME `superOnly` guard that
 * `/admin/mcp`'s tools do (settings.ts imports `addPerson`/`deactivatePerson`/`createTeam`/
 * `archiveTeam`/`grantTool`/`revokeTool`/`listPeople` from admin.ts as values), so a stale
 * or forged `me` here gets the same 403 an MCP caller would.
 *
 * BLOCK ACCESS STAYS SUPERADMIN-ONLY. `PlatformBlocksPanel` lives here, never inside
 * `TeamAdminPanel` — see that component's own header for why granting or revoking a
 * building block is a platform decision no team-tier surface may reach.
 */
export function PlatformSection() {
  const me = useConsole<Me>('/me');
  if (!me.data?.superadmin) return null;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Platform administration" aside="every principal and team on this deployment">
        <p className="text-xs text-ink-faint">
          Add and deactivate people, create and archive teams, grant and revoke a team&rsquo;s
          block access, and set another principal&rsquo;s password. Every write here logs who
          did it and that it came from this console.
        </p>
      </Panel>
      <PlatformPeoplePanel />
      <PlatformTeamsPanel />
      <PlatformBlocksPanel />
      <PlatformPasswordPanel />
    </div>
  );
}
