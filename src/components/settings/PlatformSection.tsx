'use client';

import { Panel } from '@/components/Panel';
import { PlatformPeoplePanel } from '@/components/settings/PlatformPeoplePanel';
import { PlatformTeamsPanel } from '@/components/settings/PlatformTeamsPanel';
import { useConsole } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The platform tier of Settings — visible only to a superadmin.
 *
 * DELIBERATE: hiding is courtesy, not enforcement, same as `TeamAdminPanel` above.
 * `me.superadmin` decides what this component renders and nothing about what the gateway
 * accepts. Every route under `/settings/platform/*` runs the same `superOnly` guard that
 * the /manage tools do (settings/platform.ts calls the same `addPerson`/`deactivatePerson`/
 * `createTeam`/`archiveTeam`/`listPeople` from the gateway's admin/), so a stale or forged
 * `me` here gets the same 403 an MCP caller would.
 */
export function PlatformSection() {
  const me = useConsole<Me>('/me');
  if (!me.data?.superadmin) return null;

  return (
    <>
      <Panel title="Platform administration" aside="every principal and team on this deployment">
        <p className="text-xs text-ink-faint">
          Add and deactivate people, and create and archive teams. Every write here logs who
          did it and that it came from this console.
        </p>
      </Panel>
      <PlatformPeoplePanel />
      <PlatformTeamsPanel />
    </>
  );
}
