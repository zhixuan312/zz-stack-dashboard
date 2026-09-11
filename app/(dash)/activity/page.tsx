'use client';

import { useState } from 'react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Segmented, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
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
          label="Which events"
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Refusal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.events.map((e, i) => (
                  <TableRow key={`${e.ts}-${i}`}>
                    <TableCell><Time value={e.ts} /></TableCell>
                    <TableCell className="max-w-[18ch] truncate font-mono text-xs" title={e.actor ?? ''}>
                      {e.actor ? e.actor.split('@')[0] : <span className="text-ink-faint">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.team ?? <span className="text-ink-faint">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.kind}</TableCell>
                    <TableCell className="max-w-[30ch] truncate font-mono text-xs text-ink" title={e.subject ?? ''}>
                      {e.subject ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">{e.step || <span className="text-ink-faint">—</span>}</TableCell>
                    <TableCell className="text-xs">{e.block || <span className="text-ink-faint">—</span>}</TableCell>
                    <TableCell>
                      {e.ok === false
                        ? <Badge variant="rose" dot>refused</Badge>
                        : e.ok === true
                          ? <Badge variant="sage" dot>ok</Badge>
                          : <span className="text-xs text-ink-faint">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[34ch] truncate text-xs text-[var(--rose-deep)]" title={e.refusal ?? ''}>
                      {e.refusal ?? ''}
                    </TableCell>
                  </TableRow>
                ))}
              
                    {d.events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-ink-faint">
                          No activity in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
            </Table>
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}
