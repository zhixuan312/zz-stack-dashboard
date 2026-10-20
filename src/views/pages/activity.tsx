'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, Ban, RotateCw, Wrench } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import type { Revised } from '@/data/gateway';
import { useConsole, useDataClock } from '@/lib/api';
import type { ActivityLog, ActivityRow, ActivitySummary, RefusalGroup, RefusalOwner } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import {
  AGENT_CALL, NO_FILTER, OWNER_LABEL, PAGE_SIZE, REFUSAL_PARTS, TILES, activityContext, activityPath, activityTrouble, fourOwners,
  narrowed, weekOf, type ActivityRead,
} from '@/views/activity-context';
import { pendingContext } from '@/views/context';
import { useServed } from '@/views/use-served';

/** The protagonist's title: the card the page's Ask sits on. COUPLED: the README's `Protagonist:`. */
const REFUSALS_TITLE = 'Refusals';

/** A dash where nothing was involved: an event that is not a tool call names no tool. */
const dash = <span className="text-ink-3">—</span>;

/** An owner's badge: the platform's own failure critical, a malformed call a warning, the rest neutral, as the chart has them. */
const OWNER_TONE: Record<RefusalOwner, 'critical' | 'warning' | 'neutral'> = { theirs: 'critical', ours: 'warning', guardrail: 'neutral', other: 'neutral' };
const Owner = ({ owner }: { owner: RefusalOwner }) => <Badge tone={OWNER_TONE[owner]} dot>{OWNER_LABEL[owner]}</Badge>;
const Message = ({ text }: { text: string | null }) => (text
  ? <span className="block py-1 leading-snug whitespace-normal [overflow-wrap:anywhere] text-ink">{text}</span>
  : <span className="text-ink-3">No message recorded</span>);

/**
 * A phone card's fact after its time: the kind, which its title already is for an event that called no tool, and who
 * acted, where somebody did, as `tool_call by jane.doe@example.com`: a person by their email, as Approvals and the
 * knowledge log name them.
 */
const phoneFact = (e: ActivityRow): ReactNode => {
  if (!e.actor) return e.kind;
  return <>{e.tool ? `${e.kind} ` : ''}by <span className="[overflow-wrap:anywhere]">{e.actor}</span></>;
};

/**
 * The log's columns. The tool is what an event is about, so it takes the slack and is a phone card's title, with the
 * kind beside the time under it; an event that called no tool is titled by its kind. A time and an owner are each whole
 * on one line: wrapped, "4 h / ago" and "A / guardrail / held" read as three things. A tool name breaks only between its
 * parts, and only under 896px of table (`ToolName`): a long one held whole ran the log past its frame at 1024 (#3842).
 */
const LOG_COLUMNS: Column<ActivityRow>[] = aligned([
  { key: 'when', header: 'When', width: 'w-28', mobile: 'fact', cell: (e) => <span className="whitespace-nowrap"><When at={e.ts} /></span> },
  { key: 'kind', header: 'Kind', mobile: 'fact', cell: (e) => <Dotted name={e.kind} />, mobileCell: phoneFact },
  {
    key: 'tool', header: 'Tool', align: 'left', grow: true, mobile: 'title', title: (e) => e.tool ?? e.kind,
    cell: (e) => (e.tool ? <ToolName name={e.tool} /> : dash),
    mobileCell: (e) => <span className="font-mono text-xs [overflow-wrap:anywhere]">{e.tool ?? e.kind}</span>,
  },
  { key: 'initiative', header: 'Initiative', hideBelow: 'xl', truncate: true, cell: (e) => (e.initiative ? <span title={e.initiative} className="text-xs">{e.initiative}</span> : dash) },
  // A person by their whole email, as every other page names one (`Email`). A phone card says who acted beside the kind, and nothing where nobody
  // did: a dash in a line of facts says nothing. A tool call is an agent's, and the platform records no person for one
  // by design, so it says so rather than a dash on every row.
  { key: 'actor', header: 'Actor', hideBelow: 'md', cell: (e) => (e.actor ? <Email address={e.actor} /> : e.kind === 'tool_call' ? <span className="whitespace-nowrap text-ink-3" title={AGENT_CALL}>An agent</span> : dash) },
  // A refusal is the row worth finding, so it alone carries colour; ok is the normal case and stays neutral.
  { key: 'result', header: 'Result', mobile: 'status', cell: (e) => (e.ok === false ? <Badge tone="critical" dot>Refused</Badge> : e.ok === true ? <Badge tone="neutral">OK</Badge> : dash) },
  { key: 'owner', header: 'Why', hideBelow: 'lg', cell: (e) => <span className="whitespace-nowrap">{e.ok === false ? OWNER_LABEL[e.owner ?? 'other'] : ''}</span> },
  { key: 'message', header: 'Message', align: 'left', hideBelow: 'xl', truncate: true, cell: (e) => (e.ok !== false ? '' : e.message ? <span title={e.message} className="text-critical-ink">{e.message}</span> : <span className="text-ink-3">No message recorded</span>) },
]);

/**
 * A kind, `knowledge.supersede`, whole on one line where the table has the width. Under 896px of table it may break
 * after a dot or an underscore and nowhere else: held whole, the longest kind and the Tool column's own floor (the
 * managed table keeps a growing column at least 256px wide) ran the log 5px past its frame at 1024 (#4207).
 */
const Dotted = ({ name }: { name: string }) => (
  <span className="font-mono text-xs whitespace-nowrap text-ink @max-[896px]:whitespace-normal">
    {name.split(/(?<=[._])/).map((part, i) => <Fragment key={i}>{i ? <wbr /> : null}{part}</Fragment>)}
  </span>
);

/**
 * A tool's name, `core:document_approve`, whole on one line where the table has the width. Under 896px of table the
 * message has little left, so the name may break, but only between its parts: after the door and after an underscore,
 * never "cor / e:d / ocu".
 */
const ToolName = ({ name }: { name: string }) => (
  <span className="font-mono text-xs whitespace-nowrap @max-[896px]:whitespace-normal">
    {name.split(/(?<=[:_])/).map((part, i) => <Fragment key={i}>{i ? <wbr /> : null}{part}</Fragment>)}
  </span>
);

/**
 * A person's email, whole on one line where the table has the width. Under 896px of table it may break before its `@`
 * and nowhere else, or it ran the Result column out of the frame: two atomic parts, which `nowrap` keeps together, where
 * a `<wbr>` is a break Chrome takes even inside `nowrap` (it split the address at 1440).
 */
const Email = ({ address }: { address: string }) => {
  const at = address.lastIndexOf('@');
  return (
    <span className="whitespace-nowrap @max-[896px]:whitespace-normal">
      {at > 0 ? <><span className="inline-block">{address.slice(0, at)}</span><span className="inline-block">{address.slice(at)}</span></> : address}
    </span>
  );
};

/** The groups in the gateway's order, most first: the browser ranks and counts none of them. */
const GROUP_COLUMNS: Column<RefusalGroup>[] = aligned([
  { key: 'owner', header: 'Owner', width: 'w-40', mobile: 'status', cell: (g) => <Owner owner={g.owner} /> },
  // A tool's name whole on one line, and the message, which may run to a sentence, takes the slack and wraps. No break
  // point at all here: the message grows, so the table sizes this column to its narrowest, and Chrome breaks a line at
  // a `<wbr>` even inside `nowrap` — "core: / document_ / approve". The column drops under 672px, so it never squeezes.
  { key: 'tool', header: 'Tool', hideBelow: 'md', mobile: 'fact', cell: (g) => <span className="font-mono text-xs whitespace-nowrap">{g.tool}</span> },
  { key: 'message', header: 'Message', align: 'left', grow: true, mobile: 'title', cell: (g) => <Message text={g.message} /> },
  { key: 'count', header: 'Refused', numeric: true, mobile: 'fact', cell: (g) => `${formatCount(g.count)}×`, mobileCell: (g) => `${formatCount(g.count)}× refused` },
  // Below lg the tool's whole name needs the room: Harbormaster #3991 read the table 788 wide in a 729 frame at 768.
  { key: 'last', header: 'Last seen', numeric: true, hideBelow: 'lg', cell: (g) => formatDate(g.lastSeen) },
]);

const RESULT_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'true', label: 'Refused' }, { value: 'false', label: 'Not refused' }];

/**
 * The summary the page draws: the one the console's server read and handed here, so the first paint carries it and the
 * browser asks for nothing more, then the browser's own once the activity collection changes or a Retry asks for it.
 */
function useSummary(read: ActivityRead) {
  const { q, error, retry, busy } = useServed<ActivitySummary>('/activity/summary', true);
  const data = q.data ?? (read.state === 'ok' ? read.data : undefined);
  const trouble = data ? null : failureOf({ error }) ?? (read.state !== 'ok' ? activityTrouble(read) : null);
  const at = q.data ? q.dataUpdatedAt : read.state === 'ok' ? Date.parse(read.at) : 0;
  return { data, trouble, retry, busy, at };
}

/** How long the cursor has to rest on a week before the page takes it as what the person is pointing at. */
const POINT_SETTLE_MS = 150;

/** Tells the page which week the Meridian points at, once the cursor rests there: a sweep passes every week. */
function Pointed({ onChange }: { onChange: (index: number | null) => void }) {
  const { index } = useMeridianIndex();
  useEffect(() => {
    const t = setTimeout(() => onChange(index), POINT_SETTLE_MS);
    return () => clearTimeout(t);
  }, [index, onChange]);
  return null;
}

/**
 * The active team's real work by week: last week's calls and refusals, the refusals by week and owner, the groups they
 * fall into, and the log, newest first. The summary is the console's server's read, handed here; the log, its filters
 * and its pages are read in the browser, and the gateway counts, groups, filters and pages all of it.
 */
export function ActivityView({ read }: { read: Revised<ActivityRead> }) {
  useLive(['activity'], read.revisions);
  const [f, set] = useQueryState({ ...NO_FILTER, page: '1' });
  const filters = useMemo(() => ({ kind: f.kind, tool: f.tool, initiative: f.initiative, refused: f.refused }), [f.kind, f.tool, f.initiative, f.refused]);
  const page = Math.max(1, Number(f.page) || 1);
  const [initiative, setInitiative] = useSearchDraft(f.initiative === 'all' ? '' : f.initiative, (v) => set({ initiative: v.trim() || 'all', page: '1' }));
  const [pointed, setPointed] = useState<number | null>(null);
  const [groupsPage, setGroupsPage] = useState(1);
  const summary = useSummary(read);
  const log = useConsole<ActivityLog>(activityPath(filters, { offset: (page - 1) * PAGE_SIZE }));
  const now = useDataClock();
  const stamps = [summary.at, log.dataUpdatedAt].filter((n) => n > 0);
  const updatedAt = stamps.length ? new Date(Math.min(...stamps)) : null;
  const context = summary.data
    ? activityContext({ summary: summary.data, log: log.data, filters, page, index: pointed, groupsPage, updatedAt, now })
    : pendingContext({ view: 'activity', title: 'Activity', address: '/activity', scope: 'your active team\'s real work' }, summary.trouble);
  const weeks = summary.data?.weeks.state === 'ok' ? summary.data.weeks.data : null;
  const dates = useMemo(() => (weeks ?? []).map((w) => w.window.from), [weeks]);
  const clear = () => set({ ...NO_FILTER, page: '1' });
  // The log read stops at its own ceiling, and the gateway's `total` is the matches UP TO that ceiling — so at the
  // ceiling the count is as far as the read reached and the console cannot tell "exactly that many" from "more". The
  // clause therefore says what was read and not what was left. `…` is coming and `—` is not.
  const counted = log.data
    ? `${log.data.total} ${plural(log.data.total, 'event')}${log.data.total >= log.data.ceiling ? `, the latest ${log.data.ceiling} read` : ''}`
    : log.isPending ? '…' : '—';
  const option = (v: string) => ({ value: v, label: v });

  return (
    <ConsolePage
      title="Activity"
      description="Your team's real work by week, what was refused and why, and everything it recorded, newest first."
      updatedAt={updatedAt}
      context={context}
    >
      <Meridian dates={dates}>
        <Pointed onChange={setPointed} />
        <Tiles summary={summary.data} trouble={summary.trouble} />
        {summary.trouble ? (
          <EmptyState kind="error" title={'The week\'s figures did not load'} action={<Button size="sm" icon={<RotateCw />} busy={summary.busy} onClick={summary.retry}>Retry</Button>}>{summary.trouble}</EmptyState>
        ) : null}
        <Refusals summary={summary.data} />
      </Meridian>
      <Groups summary={summary.data} page={groupsPage} onPage={setGroupsPage} />
      <DataTable
        caption="Activity"
        noun="events"
        rows={log.data?.rows ?? []}
        columns={LOG_COLUMNS}
        rowKey={(e) => e.id}
        manual
        total={log.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        pageSizes={[PAGE_SIZE]}
        loading={log.isPending}
        error={failureOf(log)}
        onRetry={() => void log.refetch()}
        state={{ sort: '', dir: 'desc', page: String(page) }}
        onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
        filtered={narrowed(filters)}
        onClearFilters={clear}
        empty={{ title: 'Nothing recorded yet', body: 'An event lands here when your team\'s agents call a tool or write a document.' }}
        toolbar={
          <FilterBar
            // The log answers the kinds and the tools its filters may take, and no list of initiatives: the initiative is
            // its slug, typed, and the gateway matches it within the active team.
            search={{ value: initiative, onChange: setInitiative, placeholder: 'Initiative slug' }}
            filters={[
              { key: 'kind', label: 'Kind', value: f.kind, onChange: (v) => set({ kind: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...(log.data?.kinds ?? []).map(option)] },
              { key: 'tool', label: 'Tool', value: f.tool, onChange: (v) => set({ tool: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...(log.data?.tools ?? []).map(option)] },
              { key: 'refused', label: 'Result', value: f.refused, onChange: (v) => set({ refused: v, page: '1' }), options: RESULT_OPTIONS },
            ]}
            result={counted}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}

/**
 * The three tiles of the last whole week; the calls carry their weeks, which the refusals chart's cursor reads. A figure
 * whose read failed is `Unavailable`, never a zero or `None`: the tool refused most is its own read, so it can fail while
 * the refused beside it stands, and `None` is said only of a week read with nothing refused.
 */
function Tiles({ summary, trouble }: { summary?: ActivitySummary; trouble: string | null }) {
  const mark = trouble ? '—' : '…';
  const tiles = summary?.tiles;
  const weeks = summary?.weeks.state === 'ok' ? summary.weeks.data : null;
  const value = (v: number | null | undefined) => (v === undefined ? mark : v === null ? 'Unavailable' : v);
  const owners = tiles?.refused.owners.state === 'ok' ? tiles.refused.owners.data : null;
  const most = tiles?.mostRefused;
  return (
    <Row split="tiles" data-figures={tiles ? 'read' : undefined}>
      {/* The note is one short line: a tile with points reads the pointed week in the note's place, and a note that wrapped
          to two lines would make the tile shorter whenever the cursor crossed the chart. */}
      <MetricTile label={TILES.calls.label} hint={TILES.calls.definition} icon={<Activity />} value={value(tiles?.calls.figure.value)}
                  points={weeks && weeks.length > 1 ? weeks.map((w) => w.calls) : undefined}
                  note={tiles ? `The ${weekOf(tiles.calls.window)}` : undefined} />
      <MetricTile label={TILES.refused.label} hint={TILES.refused.definition} icon={<Ban />} value={value(tiles?.refused.figure.value)}
                  note={owners && tiles?.refused.figure.value !== null ? fourOwners(owners) : undefined} />
      <MetricTile label={TILES.mostRefused.label} hint={TILES.mostRefused.definition} icon={<Wrench />}
                  value={!most ? mark : most.state !== 'ok' ? 'Unavailable' : most.data ? most.data.count : 'None'}
                  note={most?.state !== 'ok' ? undefined : most.data ? `${most.data.tool}, of ${formatCount(most.data.of)}` : 'Nothing refused last week'} />
    </Row>
  );
}

/** Ask on the refusals card: about the week the cursor points at, or about last week when it points at none. */
function AskWeek() {
  const { index, dates } = useMeridianIndex();
  const at = index !== null ? dates[index] : null;
  return <AskAbout question={at ? `What was refused in the week of ${formatDay(at)}, and who is each refusal put down to?` : 'What was refused last week, and which group of refusals should we fix first?'} />;
}

/** A part of the summary that could not be read, in its own card. */
const Unread = ({ title, reason, actions }: { title: string; reason: string; actions?: ReactNode }) => (
  <Panel title={title} actions={actions}><EmptyState kind="error" title={`${title} did not load`} className="py-8">{reason}</EmptyState></Panel>
);

/** The refusals by week, each split by its four owners, the last whole week the one the card is about. */
function Refusals({ summary }: { summary?: ActivitySummary }) {
  if (!summary) return <Panel title={REFUSALS_TITLE} actions={<AskWeek />}><p className="t-small text-ink-3">Not read: the week&apos;s figures did not load.</p></Panel>;
  if (summary.weeks.state !== 'ok') return <Unread title={REFUSALS_TITLE} reason={summary.weeks.reason} actions={<AskWeek />} />;
  const weeks = summary.weeks.data;
  const last = summary.tiles.refused;
  return (
    <Panel
      title={REFUSALS_TITLE}
      description={last.figure.value === null ? 'By week and by who each refusal is put down to'
        : last.denominator === null ? `${formatCount(last.figure.value)} ${plural(last.figure.value, 'call')} refused in the ${weekOf(last.window)}, by week and owner`
        : `${formatCount(last.figure.value)} of ${formatCount(last.denominator)} calls refused in the ${weekOf(last.window)}, by week and owner`}
      actions={<AskWeek />}
    >
      {weeks.length ? (
        <ColumnChart whole
          label="The team's refused calls by week, by who each is put down to"
          parts={REFUSAL_PARTS}
          columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), values: REFUSAL_PARTS.map((p) => w.owners[p.key]) }))}
          dates={weeks.map((w) => w.window.from)}
          running={!weeks.at(-1)!.complete}
          highlight={last.window.from}
          format={formatCount}
          height={200}
        />
      ) : <EmptyState title="No weeks yet" className="py-8">The first week is drawn once your team&apos;s agents have made a call.</EmptyState>}
    </Panel>
  );
}

/** The team's refusals grouped by owner, tool and message, as the gateway grouped them, most first, ten a page. */
function Groups({ summary, page, onPage }: { summary?: ActivitySummary; page: number; onPage: (page: number) => void }) {
  const title = 'Refusals by owner, tool and message';
  if (!summary) return <Panel title={title}><p className="t-small text-ink-3">Not read: the week&apos;s figures did not load.</p></Panel>;
  if (summary.groups.state !== 'ok') return <Unread title={title} reason={summary.groups.reason} />;
  const { rows, groups, rest } = summary.groups.data;
  return (
    <DataTable
      caption={title}
      noun="groups"
      rows={rows}
      columns={GROUP_COLUMNS}
      rowKey={(g) => `${g.owner}|${g.tool}|${g.message ?? ''}`}
      pageSize={PAGE_SIZE}
      pageSizes={[PAGE_SIZE]}
      state={{ sort: '', dir: 'desc', page: String(page) }}
      onStateChange={(p) => { if (p.page) onPage(Number(p.page)); }}
      empty={{ title: 'Nothing refused', body: 'No call your team made in these weeks was refused.' }}
      toolbar={
        <div className="min-w-0">
          <h2 className="t-card">{title}</h2>
          <p className="t-caption mt-1">
            {`Your team's own, most refused first, the messages as the platform stored them${groups > rows.length ? `: ${formatCount(rows.length)} of ${formatCount(groups)} groups` : ''}`}
            {rest ? `; the ${formatCount(rest.groups)} smallest, ${formatCount(rest.count)} ${plural(rest.count, 'refusal')}, are counted together` : ''}
          </p>
        </div>
      }
    />
  );
}
