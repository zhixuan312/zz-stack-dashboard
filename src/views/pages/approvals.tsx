'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, EyeOff, Hourglass, Inbox, Signature } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { ColumnChart } from '@/components/charts/column-chart';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Records } from '@/components/templates/records';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkTabs } from '@/components/ui/tabs';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import type { Revised } from '@/data/gateway';
import { useDataClock } from '@/lib/api';
import { AXIS_FORMATTERS, plural } from '@/lib/format';
import { formatDateTime, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { encodePath } from '@/lib/store-path';
import type { ApprovalRow, Approvals, WaitingRow } from '@/lib/work-shapes';
import {
  APPROVALS_DEFAULTS, DECISION_BASIS, IN_YOUR_NAME, PAGE_SIZE, PRESENTATION, TEAM_APPROVALS, TILES, approvalsAddress, approvalsContext, approvedHref,
  approvalsPath, approvalsTrouble, approvedWhen, dayOnly, filtersOfPath, noPresentationLine, noPresentationNote, pageOf, tabOf, waited, type ApprovalsRead, type ApprovalsTab,
} from '@/views/approvals-context';
import { pendingContext } from '@/views/context';
import { useServed, useServedAddress } from '@/views/use-served';

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the rows and the
 * browser asks for nothing more, then the browser's own once a hint, an approval or a Retry asks for it. A tab or a page
 * moves the address, and the console's server reads it again; the browser waits for that answer rather than asking
 * beside it. Meanwhile the answer last drawn keeps the tiles and the weeks, which are the same on every tab and page,
 * and its rows stay, quieter, when they are of the same tab.
 */
function useApprovals(served: ApprovalsRead | null) {
  const [filters, set] = useServedAddress(APPROVALS_DEFAULTS, served, filtersOfPath);
  const tab = tabOf(filters);
  const path = approvalsPath(filters);
  const mine = served?.path === path ? served : null;
  const { q, error, retry, busy: retrying } = useServed<Approvals>(path, mine !== null, mine === null && served !== null);
  const fresh = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  // The answer last drawn, with its tab, kept as React keeps a value derived from the previous render: set while rendering, once.
  const [last, setLast] = useState<{ data: Approvals; tab: ApprovalsTab } | undefined>(fresh && { data: fresh, tab });
  if (fresh && fresh !== last?.data) setLast({ data: fresh, tab });
  const failed = failureOf({ error });
  const trouble = fresh ? null : failed ?? (mine && mine.state !== 'ok' ? approvalsTrouble(mine) : null);
  const shown = fresh ?? (trouble ? undefined : last?.data);
  const team = served?.state === 'ok' ? served.team : null;
  return {
    fresh, shown, rowsOf: fresh ?? (last?.tab === tab && !trouble ? last.data : undefined), trouble, retry, retrying, tab, page: pageOf(filters), set, team,
    updatedAt: q.data ? new Date(q.dataUpdatedAt) : fresh ? fresh.meta.asOf : null,
  };
}

/** Approvals' body on its way: the four tiles, the tabbed table, and the weeks. COUPLED: `app/(dash)/approvals/loading.tsx` draws the same rows. */
export function ApprovalsSkeleton() {
  return (
    <>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={10} />
      <ChartSkeleton height="h-56" />
    </>
  );
}

/**
 * A content revision as a person reads it: its first eight characters after the `cr_`, as a short commit hash is read.
 * The token is a hash, so eight characters tell one snapshot from another; the whole of it is the cell's title.
 */
const shortRevision = (contentRevision: string) => contentRevision.replace(/^cr_/, '').slice(0, 8);

/** A revision as a row names it: its version, and under it the snapshot's short hash, the whole token on hover. */
function Revision({ version, contentRevision }: { version: number; contentRevision: string }) {
  return (
    <span className="block min-w-0 whitespace-nowrap">
      <span className="t-num font-medium text-ink">v{version}</span>
      <span className="t-caption block font-mono">{shortRevision(contentRevision)}</span>
    </span>
  );
}

/**
 * A file name and a slug, each whole on one line where the table is a table: the document column is as wide as its
 * longest file name and the initiative takes the rest. On a phone's card they wrap rather than being cut.
 */
const documentCell = (r: { path: string }) => <span title={r.path} className="font-medium whitespace-nowrap text-ink @max-[640px]:whitespace-normal @max-[640px]:[overflow-wrap:anywhere]">{r.path}</span>;
const initiativeCell = (r: { initiative: string }) => <span title={r.initiative} className="text-sm whitespace-nowrap text-ink-2">{r.initiative}</span>;

/**
 * Waiting's columns, in the gateway's order, the longest wait first; Review opens the revision on the document's page.
 * Under 896px the version gives way: the row and its Review open that exact revision, which names it.
 */
function waitingColumns(hrefOf: ((r: WaitingRow) => string) | undefined, asOf: string): Column<WaitingRow>[] {
  return aligned<WaitingRow>([
    { key: 'document', header: 'Document', mobile: 'title', cell: documentCell },
    { key: 'initiative', header: 'Initiative', align: 'left', grow: true, mobile: 'fact', cell: initiativeCell },
    { key: 'version', header: 'Version', hideBelow: 'lg', cell: (r) => <Revision version={r.version} contentRevision={r.contentRevision} />, title: (r) => `v${r.version}, ${r.contentRevision}` },
    {
      key: 'since', header: 'Waiting since', mobile: 'fact', title: (r) => formatDateTime(r.waitingSince),
      cell: (r) => (
        <span className="block whitespace-nowrap">
          <span className="text-ink">{waited(r.waitingSince, asOf)}</span>
          <time className="t-caption block" dateTime={r.waitingSince}>{formatDateTime(r.waitingSince)}</time>
        </span>
      ),
      mobileCell: (r) => `Waiting ${waited(r.waitingSince, asOf)}`,
    },
    {
      key: 'review', header: 'Review', mobile: 'status',
      cell: (r) => (hrefOf ? (
        <Button asChild size="sm"><Link href={hrefOf(r)} aria-label={`Review ${r.path} v${r.version} of ${r.initiative}`}>Review</Link></Button>
      ) : <span className="text-ink-3">—</span>),
    },
  ]);
}

/**
 * A class the gateway gave an approval, whole on one line where the table is a table, the unknown quieter. `phone` is
 * said after it on a phone's card alone, where its own column gives way.
 */
const classCell = (label: string, unknown: boolean, phone?: string) => (
  <span className={`whitespace-nowrap @max-[640px]:whitespace-normal ${unknown ? 'text-ink-3' : 'text-ink'}`}>
    {label}{phone ? <span className="hidden @max-[640px]:inline"> · {phone}</span> : null}
  </span>
);

/**
 * History's document: the file name, and a quiet arrow after it that says the row opens the version it names, as a row
 * that opens a page does everywhere in the console. On a phone, where the version column gives way, the version follows
 * the name, so the card still says which one was approved.
 */
const approvedDocumentCell = (r: ApprovalRow) => (
  <span title={`${r.path} v${r.version}`} className="font-medium whitespace-nowrap text-ink @max-[640px]:whitespace-normal @max-[640px]:[overflow-wrap:anywhere]">
    {r.path}<span className="hidden @max-[640px]:inline"> v{r.version}</span>{' '}
    <ArrowRight data-goes aria-hidden className="inline size-3.5 shrink-0 align-[-0.15em] text-ink-3 group-hover/row:text-ink" />
  </span>
);

/**
 * History's columns, newest first: the revision approved, when, and what the record holds of how, as the gateway
 * classified it, each class on one line ("Covered in / an agent's / context" stacked three high beside a half-empty
 * initiative column). Under 896px the version and the decision basis give way as columns: the phone's card names the
 * version after the file and the basis after the presentation.
 */
const HISTORY_COLUMNS: Column<ApprovalRow>[] = aligned<ApprovalRow>([
  { key: 'document', header: 'Document', mobile: 'title', cell: approvedDocumentCell },
  { key: 'initiative', header: 'Initiative', align: 'left', grow: true, mobile: 'fact', cell: initiativeCell },
  { key: 'version', header: 'Version', hideBelow: 'lg', cell: (r) => <Revision version={r.version} contentRevision={r.contentRevision} />, title: (r) => `v${r.version}, ${r.contentRevision}` },
  {
    key: 'approved', header: 'Approved at', mobile: 'fact', title: (r) => approvedWhen(r.approvedAt),
    cell: (r) => (
      <span className="block whitespace-nowrap">
        <time dateTime={r.approvedAt}>{approvedWhen(r.approvedAt)}</time>
        {dayOnly(r.approvedAt) ? <span className="t-caption block">Day only</span> : null}
      </span>
    ),
    mobileCell: (r) => `Approved ${approvedWhen(r.approvedAt)}${dayOnly(r.approvedAt) ? ', day only' : ''}`,
  },
  {
    key: 'presentation', header: 'Presentation', mobile: 'fact', title: (r) => PRESENTATION[r.presentation].definition,
    // On a phone's card, where the basis column gives way, the basis follows the presentation on its line.
    // "Unknown" alone after a presentation would read as the presentation's, so the basis names itself there.
    cell: (r) => classCell(PRESENTATION[r.presentation].label, r.presentation === 'unknown', r.decisionBasis === 'unknown' ? 'Basis unknown' : DECISION_BASIS[r.decisionBasis].label),
  },
  {
    key: 'basis', header: 'Decision basis', hideBelow: 'lg', title: (r) => DECISION_BASIS[r.decisionBasis].definition,
    cell: (r) => classCell(DECISION_BASIS[r.decisionBasis].label, r.decisionBasis === 'unknown'),
  },
]);

/**
 * History's row on a phone: the file and its version, then three lines, each fact whole on its own: the initiative,
 * when it was approved, and how it was shown with the basis it was decided on, wrapping where it is long. No line opens
 * with a separator, and no date is left alone at the start of one ("· 25 Sept 2026, 02:00", Work M-5). Children by
 * position, in `HISTORY_COLUMNS`' order: the initiative is the second cell, the approval the fourth, the presentation
 * the fifth.
 */
const HISTORY_PHONE_CARD = [
  '@max-[640px]:[&_tbody_td:nth-child(2)]:!basis-full',
  '@max-[640px]:[&_tbody_td:nth-child(4)]:!basis-full @max-[640px]:[&_tbody_td:nth-child(4)_[data-sep]]:!hidden',
  '@max-[640px]:[&_tbody_td:nth-child(5)]:!basis-full @max-[640px]:[&_tbody_td:nth-child(5)]:!whitespace-normal @max-[640px]:[&_tbody_td:nth-child(5)_[data-sep]]:!hidden',
].join(' ');

/** A count's tick, whole only: a scale of one approval steps by halves, and a count has no half, so that line goes unnamed. */
const wholeTick = (n: number) => (Number.isInteger(n) ? AXIS_FORMATTERS.count(n) : '');

/** What each tab's Ask asks: about the list the tab shows. */
const ASK: Record<ApprovalsTab, string> = {
  waiting: 'Which revisions have waited longest for approval, and what should I check before approving each?',
  history: 'What does the record hold of how my approvals were shown and decided, and which have no presentation recorded?',
};

/**
 * Approvals, drawn from the release's Records template: four tiles over both lists, then two tabs, Waiting and History,
 * as addresses of their own, the page's protagonist and so first under the tiles, then the approvals in the caller's
 * name by week. Waiting is the team's queue, labelled `Team
 * approvals` because nothing records who must decide a revision, each row opening its revision on the document's page
 * for review; History is every approval recorded in the caller's name in the team, with its exact version and content
 * revision, when it was approved, and where it was shown and on what basis it was decided, as the gateway classified
 * them. The gateway pages each tab, ten to a page; the first page the address names is read on the console's server.
 */
export function ApprovalsView({ served }: { served: Revised<ApprovalsRead> }) {
  // `/approvals` is kept under `initiatives` on the live stream: an approval anywhere hints it.
  useLive(['initiatives'], served.revisions);
  const { fresh, shown, rowsOf, trouble, retry, retrying, tab, page, set, team, updatedAt } = useApprovals(served);
  const now = useDataClock();
  useShareView(fresh
    ? approvalsContext(fresh, { tab, page, updatedAt, now })
    : pendingContext({ view: 'approvals', title: 'Approvals', address: approvalsAddress(tab, page), scope: 'your active team\'s revisions waiting, and the approvals recorded in your name there' }, trouble));
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const list = rowsOf ? (tab === 'waiting' ? rowsOf.waiting : rowsOf.history) : undefined;
  const total = list?.state === 'ok' ? list.data.total : 0;
  const tableError = trouble ?? (list?.state === 'unavailable'
    ? (tab === 'waiting' ? `The waiting queue could not be read: ${list.reason}. History and its figures stand.` : `The approvals in your name could not be read: ${list.reason}. Waiting and its figures stand.`)
    : undefined);
  const counted = (part: Approvals['waiting'] | Approvals['history'] | undefined) => (part?.state === 'ok' ? formatCount(part.data.total) : undefined);
  const tabs = [
    { key: 'waiting', label: 'Waiting', href: approvalsAddress('waiting'), count: counted(shown?.waiting) },
    { key: 'history', label: 'History', href: approvalsAddress('history'), count: counted(shown?.history) },
  ].map(({ count, ...t }) => (count === undefined ? t : { ...t, count }));
  // A waiting row opens its document's live version under the team the person acts for, as History's opens the one
  // approved (`approvedHref`): the store path segment by segment, so a name holding `#`, `?` or `%` opens itself.
  const waitingHref = team ? (r: WaitingRow) => `/initiatives/${team}/${r.initiative}/${encodePath(r.path)}` : undefined;
  const pageState = { sort: '', dir: 'desc', page: String(page) };
  const onPage = (p: { page?: string }) => { if (p.page) set({ page: p.page }); };
  const toolbar = (
    <div className="flex min-w-0 flex-col gap-3">
      <LinkTabs label="Approvals views" active={tab} tabs={tabs} className="-mt-1.5" />
      {/* The Ask beside the line that says what the list is, labelled and inside the card's padding, as on every page. */}
      <div className="flex min-w-0 items-center gap-3">
        <p className="t-caption min-w-0 flex-1">
          <span className="font-medium text-ink">{tab === 'waiting' ? TEAM_APPROVALS : IN_YOUR_NAME}</span>
          {' · '}
          {tab === 'waiting'
            ? 'Presented and not yet approved, longest waiting first. Nothing records who must decide one, so the queue is your team\'s.'
            : shown?.tiles.noPresentation ? `${noPresentationLine(shown.tiles.noPresentation, shown.tiles.inYourName)}. Newest first.` : 'Newest first.'}
        </p>
        <AskAbout question={ASK[tab]} className="shrink-0" />
      </div>
    </div>
  );
  const shared = {
    manual: true, total, pageSize: PAGE_SIZE, pageSizes: [PAGE_SIZE], loading: !rowsOf && !trouble, busy: !!rowsOf && !fresh,
    error: tableError, onRetry: retry, retrying, state: pageState, onStateChange: onPage, toolbar,
  };

  return (
    <Records summary={tiles(shown, mark)}>
      <div data-protagonist="Approvals" className="contents">
        {tab === 'waiting' ? (
          <DataTable
            {...shared}
            caption={TEAM_APPROVALS}
            noun="revisions"
            rows={list?.state === 'ok' ? (list.data.rows as WaitingRow[]) : []}
            columns={waitingColumns(waitingHref, shown?.meta.asOf ?? '')}
            rowKey={(r) => r.contentRevision}
            rowHref={waitingHref}
            empty={{ title: 'Nothing waits for approval', body: 'A revision appears here once it is presented for approval, and leaves once it is approved.' }}
          />
        ) : (
          <DataTable
            {...shared}
            caption={IN_YOUR_NAME}
            className={HISTORY_PHONE_CARD}
            noun="approvals"
            rows={list?.state === 'ok' ? (list.data.rows as ApprovalRow[]) : []}
            columns={HISTORY_COLUMNS}
            rowKey={(r) => `${r.contentRevision}:${r.approvedAt}`}
            rowHref={team ? (r) => approvedHref(team, r) : undefined}
            empty={{ title: 'No approval in your name yet', body: 'An approval appears here once a revision of this team is approved in your name; a teammate\'s never does.' }}
          />
        )}
      </div>
      <Weeks data={shown} mark={mark} />
    </Records>
  );
}

/**
 * The four tiles, over both lists whatever the tab: a list that could not be read reads Unavailable, never zero. A
 * fragment, which the Records template opens, so its tiles row counts four.
 */
function tiles(data: Approvals | undefined, mark: string) {
  const t = data?.tiles;
  const old = data?.waiting.state === 'ok' ? data.waiting.data.summary.olderThan14Days : 0;
  const unread = (n: number | null | undefined) => (n === null ? 'Unavailable' : n ?? mark);
  return (
    <>
      <MetricTile label={TILES.waiting.label} hint={TILES.waiting.definition} icon={<Inbox />} value={t ? unread(t.waiting) : mark}
                  note={t?.waiting ? (old ? `${formatCount(old)} waiting longer than 14 days` : 'None longer than 14 days') : undefined} />
      <MetricTile
        label={TILES.oldest.label} hint={TILES.oldest.definition} icon={<Hourglass />}
        value={t && data ? (t.oldestWaitingSince ? waited(t.oldestWaitingSince, data.meta.asOf) : t.waiting === null ? 'Unavailable' : 'None waiting') : mark}
        note={t?.oldestWaitingSince ? `Presented ${formatDateTime(t.oldestWaitingSince)}` : undefined}
      />
      <MetricTile label={TILES.inYourName.label} hint={TILES.inYourName.definition} icon={<Signature />} value={t ? unread(t.inYourName) : mark}
                  note={t && t.inYourName !== null ? 'A teammate\'s are never counted' : undefined} />
      <MetricTile label={TILES.noPresentation.label} hint={TILES.noPresentation.definition} icon={<EyeOff />} value={t ? (t.noPresentation ? t.noPresentation.count : 'Unavailable') : mark}
                  note={t?.noPresentation ? noPresentationNote(t.noPresentation, t.inYourName) : undefined} />
    </>
  );
}

/** The approvals in the caller's name, a column a Monday week, the running week drawn unfinished. */
function Weeks({ data, mark }: { data: Approvals | undefined; mark: string }) {
  const title = 'Approvals in your name by week';
  const weeks = data?.weeks;
  const dates = useMemo(() => (weeks ?? []).map((w) => w.window.from), [weeks]);
  if (!data) {
    // A read that failed is said once, by the table's Retry; the chart only says it has nothing to draw.
    return mark === '—'
      ? <Panel title={title}><EmptyState kind="error" title="Not read" className="py-10">The weeks come with the approvals, which did not load.</EmptyState></Panel>
      : <ChartSkeleton height="h-56" />;
  }
  if (data.history.state !== 'ok') {
    return <Panel title={title}><EmptyState kind="error" title="The approvals in your name could not be read" className="py-10">The waiting queue and its figures are read; the weeks are not.</EmptyState></Panel>;
  }
  if (!weeks?.length) {
    return <Panel title={title}><EmptyState kind="first-run" title="No approval in your name yet" className="py-10">A week is drawn from the week of your first approval in this team.</EmptyState></Panel>;
  }
  return (
    <Panel title={title} description={`Revisions approved in your name, ${formatCount(weeks.length)} ${plural(weeks.length, 'week')}; a teammate's are never counted.`}>
      <ColumnChart whole
        label={title}
        dates={dates}
        running={!weeks.at(-1)!.window.complete}
        noData="None recorded"
        format={formatCount}
        axisFormat={wholeTick}
        columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.figure.value }))}
      />
    </Panel>
  );
}

/** The masthead's as-of line: the cutoff of the read the page draws, nothing while there is none. */
export function ApprovalsAsOf({ served }: { served: ApprovalsRead }) {
  const { shown } = useApprovals(served);
  return shown ? <span className="t-small text-ink-3">As of {formatDateTime(shown.meta.asOf)}</span> : null;
}
