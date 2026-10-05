'use client';

import { useState } from 'react';
import { CardBody } from '@/components/ui/card';
import { SettingsCard, SettingsSection } from '@/console/settings/section';
import { TeamMembersPanel } from '@/console/settings/team-members-panel';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
  // The slug the panel below reads, which is not the same as what is being typed into it. Keyed on
  // the field's value, every keystroke named a team — `a`, `at`, `atl` — and each one was a request
  // for that team's members, all of them superseded before they arrived.
  const [committed, setCommitted] = useState('');
  const data = me.data;

  if (!data) return null;
  const adminTeams = data.teams.filter((t) => t.role === 'admin').map((t) => t.slug);
  if (!data.superadmin && adminTeams.length === 0) return null;

  const team = data.superadmin ? committed : (manualTeam || adminTeams[0] || '');

  return (
    <SettingsSection title="Team administration" description="Members and roles for a team you administer.">
      <SettingsCard>
        <CardBody>
          <Field label="Team" className="max-w-sm" hint={data.superadmin ? 'Any team slug — as a superadmin you administer all of them' : undefined}>
            {(p) =>
              data.superadmin ? (
                <>
                  <Input
                    {...p}
                    list="team-admin-suggestions"
                    placeholder="team slug"
                    value={manualTeam}
                    onChange={(e) => setManualTeam(e.target.value)}
                    // A slug is one word: Enter or leaving the field is what says it is finished.
                    onBlur={(e) => setCommitted(e.target.value.trim())}
                    onKeyDown={(e) => { if (e.key === 'Enter') setCommitted(e.currentTarget.value.trim()); }}
                  />
                  <datalist id="team-admin-suggestions">
                    {adminTeams.map((slug) => <option key={slug} value={slug} />)}
                  </datalist>
                </>
              ) : (
                <Select id={p.id} aria-describedby={p['aria-describedby']} value={team} onValueChange={(next) => { setManualTeam(next); setCommitted(next); }} options={adminTeams.map((slug) => ({ value: slug, label: slug }))} />
              )
            }
          </Field>
        </CardBody>
        {team ? <TeamMembersPanel team={team} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
}
