'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Team } from '@/lib/api';

export default function TeamsPage() {
  const q = useConsole<{ teams: Team[] }>('/teams');

  return (
    <DashboardPage
      title="Teams"
      description="Every team on the platform, and how much of its work the platform saw."
      showPeriod={false}
      updatedAt={new Date()}
      // ONE child fills the column and owns the scrolling inside it. Left as the default
      // `outer`, the panel sized to its three rows and floated in the top fifth of an
      // empty page — the table is the page here, so it should be its height.
      scroll="inner"
    >
      <Query query={q}>
        {(d) => (
          <Panel
            title="All teams"
            aside={`${d.teams.length} total`}
            padded={false}
            className="h-full min-h-0"
          >
            <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead className="text-right">Initiatives</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                    {/* THE DEFINITION TRAVELS WITH THE COLUMN. This was the page subtitle's
                      second sentence, which made the subtitle wrap to two lines while
                      explaining a single column most readers never reach. Rule 2: the
                      definition belongs on the face of the thing it defines. */}
                  <TableHead className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-line-strong">
                          Recorded work
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[34ch]">
                        Events naming the team&rsquo;s own initiatives — not admin actions, and
                        not documents loaded in from elsewhere.
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                    <TableHead>Flows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.teams.map((t) => (
                    <TableRow key={t.slug}>
                      <TableCell>
                        <Link href={`/teams/${t.slug}`} className="font-medium text-accent hover:underline">
                          {t.slug}
                        </Link>
                        <span className="block text-xs text-ink-faint">{t.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'active' ? 'sage' : 'neutral'} dot>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.members}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.initiatives || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.documents || '—'}</TableCell>
                      <TableCell className="text-right">
                        {/* NOT the raw event count.
                            A team can hold 197 documents and have produced none of them
                            here — load the files in and there is nothing to record — so
                            its event total is admin actions only. Printed as a number
                            beside a busy team's, that reads as "this team does less
                            work", which is not what it measures. Two teams on this
                            deployment are in exactly that state, and the column was
                            misread on sight the first time anybody looked at it. */}
                        {t.instrumented === false ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-line-strong text-xs text-ink-faint">
                                not recorded
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[34ch]">
                              This team holds documents but produced none of them through the
                              platform, so nothing was recorded. Its work is real; it is not
                              measured here.
                            </TooltipContent>
                          </Tooltip>
                        ) : t.workEvents ? (
                          <span className="tabular-nums">{formatCount(t.workEvents)}</span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.flows.length ? t.flows.join(', ') : <span className="text-ink-faint">none</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}
