'use client';

import { useState } from 'react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Segmented, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
  usePaged,
} from '@/components/ui';
import { useConsole, type ActivityEvent } from '@/lib/api';

/**
 * The audit view. Every tool call, gate and admin action, newest first.
 *
 * `team` is null for a great many rows and that is CORRECT, not missing data:
 * issuing a token or downloading a client package is a thing a person did, not
 * a thing a team did. The API reads the team through its foreign key rather
 * than the denormalised column beside it, so a blank here means "no team was
 * involved" rather than "the team went missing".
 */
export default function ActivityPage() {
  const [failedOnly, setFailedOnly] = useState(false);
  const q = useConsole<{ events: ActivityEvent[]; limit: number }>(
    `/activity?limit=200${failedOnly ? '&failed=1' : ''}`,
  );

  return (
    <DashboardPage
      title="Activity"
      description="Everything the platform recorded, newest first."
      showPeriod={false}
      updatedAt={new Date()}
      actions={
        <Segmented
          label="Event filter"
          value={failedOnly ? 'failed' : 'all'}
          onChange={(v) => setFailedOnly(v === 'failed')}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'failed', label: 'Refusals only' },
          ]}
        />
      }
    >
      <Query query={q}>
        {(d) => (
          <Panel title="Events" aside={`${d.events.length} shown`} padded={false}>
            <EventTable events={d.events} filter={failedOnly ? 'failed' : 'all'} />
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** Its own component so it can hold the page state — a hook cannot run inside `Query`. */
function EventTable({ events, filter }: { events: ActivityEvent[]; filter: string }) {
  const { page, controls } = usePaged(events, filter);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead hideBelow="md">Actor</TableHead>
            <TableHead hideBelow="xl">Team</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead hideBelow="lg">Subject</TableHead>
            <TableHead hideBelow="2xl">Step</TableHead>
            <TableHead>Result</TableHead>
            <TableHead hideBelow="xl">Refusal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((e, i) => (
            <TableRow key={`${e.ts}-${i}`}>
              <TableCell className="whitespace-nowrap"><Time value={e.ts} /></TableCell>
              <TableCell hideBelow="md" className="max-w-[18ch] truncate font-mono text-xs" title={e.actor ?? ''}>
                {e.actor ? e.actor.split('@')[0] : <span className="text-ink-faint">—</span>}
              </TableCell>
              <TableCell hideBelow="xl" className="text-xs">
                {e.team ?? <span className="text-ink-faint">—</span>}
              </TableCell>
              <TableCell className="break-all font-mono text-xs">{e.kind}</TableCell>
              <TableCell hideBelow="lg" className="max-w-[30ch] truncate font-mono text-xs text-ink" title={e.subject ?? ''}>
                {e.subject ?? '—'}
              </TableCell>
              <TableCell hideBelow="2xl" className="text-xs">{e.step || <span className="text-ink-faint">—</span>}</TableCell>
              <TableCell>
                {e.ok === false
                  ? <Badge variant="rose" dot>refused</Badge>
                  : e.ok === true
                    ? <Badge variant="sage" dot>ok</Badge>
                    : <span className="text-xs text-ink-faint">—</span>}
              </TableCell>
              <TableCell hideBelow="xl" className="max-w-[34ch] truncate text-xs text-[var(--rose-deep)]" title={e.refusal ?? ''}>
                {e.refusal ?? ''}
              </TableCell>
            </TableRow>
          ))}
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-ink-faint">
                No activity in this window.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
