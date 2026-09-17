'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import { TeamMembersPanel } from '@/components/settings/TeamMembersPanel';
import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useConsole, type Me } from '@/lib/api';

/**
 * The team tier of Settings (← Task I-14, AC-5 / AC-9) — visible only to someone who
 * administers at least one team, or a superadmin.
 *
 * HIDING IS COURTESY, NOT ENFORCEMENT. `me.teams.some(t => t.slug === team && t.role
 * === 'admin') || me.superadmin` decides what this component renders; it decides
 * NOTHING about what the gateway accepts. Every route under `/settings/team/*` runs
 * `teamAuthority` again on the team the request actually names (settings.ts), so a
 * stale or forged value here gets the same 403 an MCP caller would.
 *
 * TEAM IN VIEW is local state, not this console's platform/team mode
 * (`useConsoleMode`) — that toggle picks a superadmin's OWN acting scope for reads
 * elsewhere on the console, and a team admin managing this surface may administer a
 * team that is not their active one, or (for a superadmin) any team at all. A plain
 * `<Select>` of the caller's own admin teams covers the common case; a superadmin
 * additionally gets a free-text field with those same teams as suggestions, since
 * they may reach for a team they do not personally belong to.
 */
export function TeamAdminPanel() {
  const me = useConsole<Me>('/me');
  const [manualTeam, setManualTeam] = useState('');
  const data = me.data;

  if (!data) return null;
  const adminTeams = data.teams.filter((t) => t.role === 'admin').map((t) => t.slug);
  if (!data.superadmin && adminTeams.length === 0) return null;

  const team = data.superadmin ? manualTeam.trim() : (manualTeam || adminTeams[0] || '');

  return (
    <>
      <Panel title="Team administration" aside="members and roles for a team you administer">
        <Field label="Team" hint={data.superadmin ? 'Any team slug — as a superadmin you administer all of them' : undefined}>
          {(p) =>
            data.superadmin ? (
              <>
                <Input
                  {...p}
                  list="team-admin-suggestions"
                  placeholder="team slug"
                  value={manualTeam}
                  onChange={(e) => setManualTeam(e.target.value)}
                />
                <datalist id="team-admin-suggestions">
                  {adminTeams.map((slug) => <option key={slug} value={slug} />)}
                </datalist>
              </>
            ) : (
              <Select value={team} onValueChange={setManualTeam}>
                <SelectTrigger id={p.id} aria-describedby={p['aria-describedby']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adminTeams.map((slug) => (
                    <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        </Field>
      </Panel>

      {team ? (
        <TeamMembersPanel team={team} />
      ) : null}
    </>
  );
}
