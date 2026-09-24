'use client';

import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Button, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, usePaged,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsole } from '@/lib/api';
import { type MyTeams } from '@/lib/api-shapes';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Your own teams, and which one you act for — the browser counterpart of `team_mine` (access-door.ts,
 * sharing `myTeamsSummary` with settings.ts's route).
 *
 * The team a person acts for is `principal.active_team_id`, which `chosenTeam` (identity.ts) reads
 * on every request from every client, so it is a property of the person: moving it moves the
 * browser and their agents alike. There is one acting team, and this is where it is set.
 *
 * This console shows one team at a time and every page is scoped to the active one by the gateway,
 * so without a control here a member in two teams can see one of them and has no way in this
 * product to reach the other.
 */
export function TeamsPanel() {
  const teams = useConsole<MyTeams>('/settings/me/teams');
  // `useConsoleMutation` already invalidates the whole `['console']` key on success, which is the
  // honest blast radius here: every read this console makes is scoped by the acting team, so every
  // one of them is stale the moment this returns, not just `/me`. Naming the affected paths would
  // be a list to keep in step with every page ever added.
  const switchTo = useConsoleMutation<{ actingFor: string }, { team: string }>(
    '/settings/me/active-team',
  );

  return (
    <Panel title="Teams" aside="which one you act for right now" padded={false}>
      <Query query={teams}>
        {(t) => (
          <TeamsTable
            t={t}
            pending={switchTo.isPending}
            onSwitch={(team) =>
              switchTo.mutate(
                { team },
                {
                  onSuccess: (r) =>
                    showToast({ type: 'success', message: `Now acting for ${r.actingFor}` }),
                  onError: (e) => showToast({ type: 'error', message: e.message }),
                },
              )
            }
          />
        )}
      </Query>
    </Panel>
  );
}

/** Its own component so it can hold the page state — the rows come from a `Query` render prop. */
function TeamsTable({ t, pending, onSwitch }: { t: MyTeams; pending: boolean; onSwitch: (team: string) => void }) {
  const { page, controls } = usePaged(t.teams);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Acting</TableHead>
            <TableHead>{null}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* A person can be on no team — a principal exists before anybody adds them to one,
              and saying so is the difference between "you have no teams" and a screen that
              looks broken. */}
          {t.teams.length === 0 ? (
            <TableRow>
              <TableCell className="text-ink-faint" colSpan={4}>
                You are not a member of any team yet. A team admin adds you.
              </TableCell>
            </TableRow>
          ) : null}
          {page.map((row) => (
            <TableRow key={row.team}>
              <TableCell className="break-all font-mono text-xs">{row.team}</TableCell>
              <TableCell><Badge variant={row.role === 'admin' ? 'accent' : 'neutral'} size="sm">{row.role}</Badge></TableCell>
              <TableCell>{row.active ? <Badge variant="sage" dot size="sm">acting</Badge> : null}</TableCell>
              <TableCell>
                {/* No button on the row you are already acting for — an action whose
                    effect is "stay where you are" is a control that does nothing. */}
                {row.active ? null : (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => onSwitch(row.team)}>
                    Act as this team
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {t.note ? <p className="border-t border-line px-4 py-3 text-xs text-ink-faint">{t.note}</p> : null}
      <PageControl {...controls} />
    </>
  );
}
