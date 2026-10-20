'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { ArrowRight, CircleCheck, ListTree, Signature } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Records } from '@/components/templates/records';
import { EmptyState } from '@/components/ui/empty-state';
import { Busy, ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { StateBadge } from '@/console/initiative';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import type { Revised } from '@/data/gateway';
import { useDataClock } from '@/lib/api';
import { plural } from '@/lib/format';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { grainOf, type Grain } from '@/lib/grain';
import { useLive } from '@/lib/live';
import type { InitiativeList } from '@/lib/work-shapes';
import { pendingContext } from '@/views/context';
import { TILES, closedLine, initiativesContext, openLine, waitingLine, initiativesTrouble, nextOf, type InitiativesRead, type InitiativesShown, type ShownRow } from '@/views/initiatives-context';
import { INITIATIVES_DEFAULTS, LIST_STATES, PAGE_SIZE, STATE_LABEL, filtersOfPath, listPath, narrowed, pageOf, type InitiativesFilters } from '@/views/initiatives-filter';
import { useServed, useServedAddress } from '@/views/use-served';
import { OUTCOME_PARTS } from '@/views/outcome-parts';

// The chart is the page's heaviest module and draws below the tiles, so it arrives after the first paint.
const ColumnChart = dynamic(() => import('@/components/charts/column-chart').then((m) => m.ColumnChart), { loading: () => <Skeleton className="h-56 rounded-md" /> });

/** Gates passed of the gates the row's flow has, or a dash for a piece of work with no flow. */
const gatesOf = (r: ShownRow) => (r.gates.of ? `${r.gates.passed} of ${r.gates.of}` : '—');

/**
 * The table's columns, in the server's order: the list is sorted and paged where it is read. Each column is as wide as
 * what it holds: the slug on one line, the counts and the date at their own width, and the flow position, the sentence
 * this page is read for, takes the rest, so it reads on one or two lines rather than one word to a line.
 */
const COLUMNS: Column<ShownRow>[] = aligned([
  // Whole on one line where the table is a table; a phone's card wraps it rather than cutting it, since a slug's tail
  // tells two pieces of work of one project apart. A quiet arrow after it says the row opens its initiative before the
  // pointer finds it, as a row that opens a page does everywhere in the console (Status's needs, a plugin's rows).
  {
    key: 'slug', header: 'Initiative', mobile: 'title',
    cell: (r) => (
      <span title={r.slug} className="font-medium whitespace-nowrap text-ink @max-[640px]:whitespace-normal @max-[640px]:[overflow-wrap:anywhere]">
        {r.slug} <ArrowRight data-goes aria-hidden className="inline size-3.5 shrink-0 align-[-0.15em] text-ink-3 group-hover/row:text-ink" />
      </span>
    ),
  },
  { key: 'next', header: 'Flow position', align: 'left', grow: true, hideBelow: 'lg', mobile: 'fact', cell: (r) => <span className="text-xs whitespace-normal text-ink-2" title={r.nextMove?.why}>{r.flow ? nextOf(r) : 'No flow'}</span> },
  { key: 'state', header: 'State', mobile: 'status', cell: (r) => <StateBadge state={r.state} /> },
  { key: 'gates', header: 'Gates passed', numeric: true, hideBelow: 'lg', mobile: 'fact', cell: (r) => gatesOf(r), mobileCell: (r) => (r.gates.of ? `${gatesOf(r)} gates` : 'No gates') },
  { key: 'touched', header: 'Last touched', numeric: true, mobile: 'fact', cell: (r) => <When at={r.lastTouched} />, mobileCell: (r) => <>Touched <When at={r.lastTouched} /></> },
]);

/**
 * A row's card on a phone: the slug and its state, the flow position on a line of its own, wrapping where it is long,
 * then the gates and the last touch together. The flow position is the first fact, so it carries no dot; the gates
 * open the line under it, so their dot goes too, and no line of the card starts with a separator. Children by
 * position, in `COLUMNS`' order: the flow position is the second cell and the gates the fourth.
 */
const PHONE_CARD = [
  '@max-[640px]:[&_tbody_td:nth-child(2)]:!basis-full @max-[640px]:[&_tbody_td:nth-child(2)]:!whitespace-normal',
  '@max-[640px]:[&_tbody_td:nth-child(4)_[data-sep]]:!hidden',
].join(' ');

const STATE_OPTIONS = [{ value: 'all', label: 'All' }, ...LIST_STATES.map((s) => ({ value: s, label: STATE_LABEL[s] }))];

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the rows and the
 * browser asks for nothing more, then the browser's own once a change, a close or a Retry asks for it. A filter or a
 * page moves the address, and the server reads it again; the browser waits for that answer rather than asking beside it.
 */
function useInitiatives(served: InitiativesRead | null, filters: InitiativesFilters) {
  const path = listPath(filters);
  const mine = served?.path === path ? served : null;
  const { q, error, retry, busy } = useServed<InitiativeList>(path, mine !== null, mine === null && served !== null);
  const data: InitiativesShown | undefined = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf({ error });
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' ? initiativesTrouble(mine) : null);
  return { data, trouble, retry, busy, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

/**
 * The active team's work, drawn from the release's Records template: three tiles over the whole team's, then every
 * initiative with where it goes next, as zz-core's `next_move` answered it, the page's protagonist and so first under
 * the tiles, then its closures by week and outcome. The gateway
 * filters, searches and pages the list, ten to a page; the first page the address names is read on the console's server
 * and handed here, with the team a row opens its initiative under.
 */
export function InitiativesView({ served }: { served: Revised<InitiativesRead> }) {
  useLive(['initiatives'], served.revisions);
  const [filters, set] = useServedAddress(INITIATIVES_DEFAULTS, served, filtersOfPath);
  const [draft, setDraft] = useSearchDraft(filters.q, (q) => set({ q, page: '1' }));
  const { data, trouble, retry, busy, updatedAt } = useInitiatives(served, filters);
  const now = useDataClock();
  const page = pageOf(filters);
  useShareView(data
    ? initiativesContext(data, { filters: { q: filters.q, state: filters.state, flow: filters.flow }, page, updatedAt, now })
    : pendingContext({ view: 'initiatives', title: 'Initiatives', address: '/initiatives', scope: 'your active team\'s work' }, trouble));
  // The flows the filtered population holds, and the one chosen, which a narrower filter could otherwise drop.
  const flows = useMemo(() => {
    const named = data?.summary.state === 'ok' ? data.summary.data.byFlow.flatMap((b) => (b.flow ? [b.flow] : [])) : [];
    return [...new Set([...named, ...(filters.flow === 'all' ? [] : [filters.flow])])];
  }, [data, filters.flow]);
  const narrow = narrowed(filters);
  const clear = () => set({ q: '', state: 'all', flow: 'all', page: '1' });
  const team = served.state === 'ok' ? served.team : null;
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const tiles = data?.tiles;
  const closed = tiles ? tiles.closed.accepted + tiles.closed.delivered + tiles.closed.abandoned : null;

  return (
    <Records
      summary={
        <>
          {/* Each tile with its line, so the three are one height of text and none is a third empty (Work M-16). */}
          <MetricTile label={TILES.open.label} hint={TILES.open.definition} icon={<ListTree />} value={tiles ? tiles.open : mark} note={tiles ? openLine(tiles) : undefined} />
          <MetricTile label={TILES.waiting.label} hint={TILES.waiting.definition} icon={<Signature />} value={tiles ? tiles.waiting : mark} note={tiles ? waitingLine(tiles) : undefined} />
          <MetricTile label={TILES.closed.label} hint={TILES.closed.definition} icon={<CircleCheck />} value={closed ?? mark} note={tiles ? closedLine(tiles.closed) : undefined} />
        </>
      }
    >
      <div data-protagonist="Initiatives" className="contents">
        <DataTable
          caption="Initiatives"
          className={PHONE_CARD}
          noun="initiatives"
          rows={data?.rows ?? []}
          columns={COLUMNS}
          rowKey={(r) => r.slug}
          rowHref={team ? (r) => `/initiatives/${team}/${r.slug}` : undefined}
          manual
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          pageSizes={[PAGE_SIZE]}
          loading={!data && !trouble}
          error={trouble ?? undefined}
          onRetry={retry}
          retrying={busy}
          state={{ sort: '', dir: 'desc', page: String(page) }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={narrow}
          onClearFilters={clear}
          empty={{ title: 'No initiative yet', body: 'An initiative starts with initiative_open, and every document written afterwards lands under it.' }}
          toolbar={
            <FilterBar
              search={{ value: draft, onChange: setDraft, placeholder: 'Search initiatives' }}
              filters={[
                { key: 'state', label: 'State', value: filters.state, onChange: (v) => set({ state: v, page: '1' }), options: STATE_OPTIONS },
                { key: 'flow', label: 'Flow', value: filters.flow, onChange: (v) => set({ flow: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...flows.map((v) => ({ value: v, label: v }))] },
              ]}
              result={data ? `${formatCount(data.total)} ${plural(data.total, 'initiative')}` : mark}
              ask={<AskAbout question={narrow ? 'What do the initiatives in this list have in common, and which needs me next?' : 'Which initiatives need me next, and what is each waiting on?'} />}
              onClear={clear}
            />
          }
        />
      </div>
      <Closures list={data} mark={mark} />
    </Records>
  );
}

/** A period's column: `05 Oct` for a week, its first month, `Oct 2026`, for a month or a quarter. */
const tickOf = (grain: Grain) => (from: string) => (grain === 'week' ? formatShortDate(from) : formatDate(from).split(' ').slice(1).join(' '));

/**
 * The team's closures, a column a period split by the outcome the platform recorded, the running period drawn
 * unfinished, each named by the grain they arrive in. Closures not read have no grain, so they are said with none.
 */
function Closures({ list, mark }: { list: InitiativesShown | undefined; mark: string }) {
  const weeks = list?.closures.state === 'ok' ? list.closures.data : [];
  const grain = grainOf(weeks.map((w) => w.window));
  const title = `Closures by ${grain} and outcome`;
  if (!list) {
    // A read that failed is said once, by the table's Retry; the chart only says it has nothing to draw.
    return <Panel title="Closures by outcome">{mark === '—' ? <EmptyState kind="error" title="Not read" className="py-10">The closures come with the initiatives, which did not load.</EmptyState> : <Skeleton className="h-56 rounded-md" />}</Panel>;
  }
  if (list.closures.state !== 'ok') {
    return <Panel title="Closures by outcome"><EmptyState kind="error" title="The closures could not be read" className="py-10">The tiles and the initiatives are read; the closures are not.</EmptyState></Panel>;
  }
  if (!weeks.length) {
    return <Panel title={title}><EmptyState kind="first-run" title="No week recorded yet" className="py-10">A week is drawn once the team&apos;s first initiative closes.</EmptyState></Panel>;
  }
  return (
    <Panel title={title} description={`The team's closures, ${formatCount(weeks.length)} ${plural(weeks.length, grain)}, whatever the filters`}>
      <ColumnChart whole
        label={title}
        dates={weeks.map((w) => w.window.from)}
        running={!weeks.at(-1)!.window.complete}
        noData="None recorded"
        parts={OUTCOME_PARTS}
        columns={weeks.map((w) => ({ key: w.window.from, label: tickOf(grain)(w.window.from), values: [w.accepted.value, w.delivered.value, w.abandoned.value] }))}
      />
    </Panel>
  );
}

/** The masthead's as-of line: the cutoff of the read the page draws, nothing while there is none. */
export function InitiativesAsOf({ served }: { served: InitiativesRead }) {
  const [filters] = useServedAddress(INITIATIVES_DEFAULTS, served, filtersOfPath);
  const { data } = useInitiatives(served, filters);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}

/**
 * The records on their way, the page's fallback while its read is out. A client view, so the page's flight payload
 * names it rather than writing out every skeleton block it draws.
 */
export function InitiativesBusy() { return <Busy name="initiatives"><TilesSkeleton count={3} /><TableSkeleton rows={10} /><ChartSkeleton height="h-56" /></Busy>; }
