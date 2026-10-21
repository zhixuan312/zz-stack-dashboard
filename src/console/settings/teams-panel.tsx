'use client';

import { useMutation } from '@tanstack/react-query';
import { FormSection } from '@/components/patterns/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePaged } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { PageControl } from '@/console/paged';
import { useAccess } from '@/console/settings/access-read';
import { afterTeamSwitch, type ApiError } from '@/lib/api';
import type { Access } from '@/lib/destination-shapes';
import { consoleMutate } from '@/lib/mutate';

/** The teams a person may act for, and the one this browser acts for, as the Access read answers them. */
type MyTeams = Access['teams'];

/** The team acted for, on Access: the section, from the page's read. */
export function TeamSection() {
  const { access } = useAccess();
  return <TeamsPanel teams={access.teams} />;
}

/**
 * The teams the person belongs to, and which one this browser acts for: the browser counterpart of `team_mine`.
 *
 * The team this browser acts for is this console session's own (`console_session.team_id`), which `resolveSession`
 * (identity.ts) reads on every request and the gateway forwards to every call the page makes. It is a property of the
 * session, not of the person: their agents keep acting for `principal.active_team_id`, which `team_switch` on /manage
 * moves. So switching here changes what this browser shows, and nothing about what their agents see.
 *
 * A switch the gateway accepts keeps nothing of the old team (`afterTeamSwitch`): the assistant's thread is cleared and
 * the document replaced with the same address, so the server draws the chrome again and every read is made afresh.
 * DELIBERATE: not `useConsoleMutation`, whose invalidation refetches what is on screen under the old team's keys before
 * the document goes, and would draw the new team's rows under them. A refused switch says the gateway's sentence and
 * changes nothing.
 */
export function TeamsPanel({ teams }: { teams: MyTeams }) {
  const switchTo = useMutation<{ actingFor: string }, ApiError, { team: string }>({
    mutationFn: (body) => consoleMutate('/settings/me/active-team', body),
  });

  return (
    <FormSection
      as="div"
      flush
      title="The team you act for"
      description="The teams you belong to, and which one this browser acts for. Your agents keep their own team: ask the ZZ Access agent in your client to move them."
    >
      <TeamsTable
        teams={teams}
        // Still pending once accepted: the document is on its way out, and a second press would switch again.
        pending={switchTo.isPending || switchTo.isSuccess}
        onSwitch={(team) => switchTo.mutate({ team }, { onSuccess: afterTeamSwitch, onError: (e) => toast({ tone: 'critical', title: e.message }) })}
      />
    </FormSection>
  );
}

/** Its own component so it can hold the page of rows it shows. */
function TeamsTable({ teams, pending, onSwitch }: { teams: MyTeams; pending: boolean; onSwitch: (team: string) => void }) {
  const { rows: page, ...pager } = usePaged(teams.teams);
  return (
    <>
      <Table caption="Your teams, and the one this browser acts for">
        <TableHead>
          <TableRow>
            <TableHeader grow>Team</TableHeader>
            <TableHeader hideBelow="sm">Role</TableHeader>
            <TableHeader><span className="sr-only">Acting for</span></TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {page.map((row) => (
            <TableRow key={row.team} data-team={row.team}>
              <TableCell className="font-mono text-xs [overflow-wrap:anywhere]">{row.team}</TableCell>
              <TableCell hideBelow="sm"><Badge tone="neutral" dot={row.role === 'admin'}>{row.role === 'admin' ? 'Admin' : 'Member'}</Badge></TableCell>
              <TableCell align="right">
                {/* No button on the row already acted for: an action whose effect is "stay where you are" does nothing. */}
                {row.active ? (
                  <Badge tone="positive" dot>Acting for</Badge>
                ) : (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => onSwitch(row.team)}>Act as this team</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* A person can be on no team: a principal exists before anybody adds them to one, and saying so is the
          difference between "you have no teams" and a screen that looks broken. Outside the table, because a grid row
          draws a spanning cell in its first track only (ZZ Meridian 0.26.0). */}
      {teams.teams.length === 0 ? <p className="py-3 text-sm text-ink-3">You are not a member of any team yet.</p> : null}
      <PageControl {...pager} />
    </>
  );
}
