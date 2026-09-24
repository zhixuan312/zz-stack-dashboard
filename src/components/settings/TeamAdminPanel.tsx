'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import { TeamMembersPanel } from '@/components/settings/TeamMembersPanel';
import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useConsole } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The team tier of Settings — visible only to someone who administers at least one team, or
 * a superadmin.
 *
 * Hiding is courtesy, not enforcement: what this renders decides nothing about what the
 * gateway accepts. Every route under `/settings/team/*` runs `teamAuthority` again on the
 * team the request names (settings.ts), so a stale or forged value here gets the same 403 an
 * MCP caller would.
 *
 * The team in view is local state, not this console's platform/team mode (`useConsoleMode`)
 * — that toggle picks a superadmin's own acting scope for reads elsewhere, and a team admin
 * here may administer a team that is not their active one. A `<Select>` of the caller's own
 * admin teams covers that; a superadmin gets a free-text field with those teams as
 * suggestions, since they may reach for a team they do not belong to.
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
