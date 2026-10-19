'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UseQueryResult } from '@tanstack/react-query';
import { Archive, BookOpen, RotateCw, Search, SearchX } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { KnowledgeTabs, useServerReadLive } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { useConsole, useDataClock, type ApiError } from '@/lib/api';
import type { SearchAnswer, SearchHit } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeRow, KnowledgeSummary } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { useLive } from '@/lib/live';
import type { PeriodFigure } from '@/lib/platform-shapes';
import {
  KNOWLEDGE_KINDS, PAGE_SIZE, knowledgeContext, knowledgePath, narrowed, searchPath, troubleOf, type ServerRead,
} from '@/views/knowledge-context';
import { hitAddress } from '@/views/search-context';

// The chart arrives after the page's first paint, in a room of its own height: the figures it is drawn from are in the
// page's HTML either way, and loaded with the page it was 9 KiB of the route's first-load JS, which put `/knowledge` at
// 851 KiB over the 850 KiB cap. 224px is the plot's 200 and its row of week labels.
const ColumnChart = dynamic(() => import('@/components/charts/column-chart').then((m) => m.ColumnChart), { loading: () => <Skeleton className="h-56 rounded-md" /> });

/** The protagonist's title: the card the page leads with and its Ask sits on. COUPLED: the README's `Protagonist:`. */
export const SEARCH_TITLE = 'Search what your team has learned';

/** The shelf, in the server's order: newest first, paged where it is read. */
const SHELF_COLUMNS: Column<KnowledgeRow>[] = aligned([
  { key: 'num', header: 'Lesson', width: 'w-24', cell: (n) => <span className="font-mono text-xs text-ink-3">{n.num}</span> },
  { key: 'title', header: 'Title', align: 'left', grow: true, mobile: 'title', cell: (n) => <span className="block py-1 leading-snug font-medium whitespace-normal text-ink">{n.title}</span> },
  { key: 'kind', header: 'Kind', hideBelow: 'lg', cell: (n) => <span className="font-mono text-xs text-ink-3">{n.type}</span> },
  // Colour only where it means something: superseded is still readable, so neutral; adopted is the current lesson.
  { key: 'status', header: 'Status', hideBelow: 'md', mobile: 'status', cell: (n) => <Badge tone={n.status === 'adopted' ? 'positive' : 'neutral'} dot>{n.status}</Badge> },
  { key: 'updated', header: 'Recorded', numeric: true, mobile: 'fact', cell: (n) => <When at={n.updated} />, mobileCell: (n) => <>Recorded <When at={n.updated} /></> },
]);

type Question = { question: string; asked: number; lastAsked: string };
/** The gateway's order, most asked first: the browser ranks nothing. Dates are absolute: these came from the server. */
const QUESTION_COLUMNS: Column<Question>[] = aligned([
  { key: 'question', header: 'Question', align: 'left', grow: true, mobile: 'title', cell: (x) => <span className="block py-1 leading-snug whitespace-normal text-ink">{x.question}</span> },
  { key: 'asked', header: 'Asked', numeric: true, mobile: 'status', cell: (x) => `${formatCount(x.asked)}×` },
  { key: 'last', header: 'Last asked', numeric: true, hideBelow: 'md', mobile: 'fact', cell: (x) => formatDate(x.lastAsked), mobileCell: (x) => <>Last asked {formatDate(x.lastAsked)}</> },
]);

const KIND_OPTIONS = [{ value: 'all', label: 'All' }, ...KNOWLEDGE_KINDS.map((k) => ({ value: k, label: k }))];

/** The oldest of the reads the page shows, the server's and the browser's, as the freshness stamp reads it. */
function arrivalOf(read: ServerRead<unknown>, ...queries: { dataUpdatedAt?: number }[]): Date | null {
  const stamps = [read.state === 'ok' ? Date.parse(read.at) : 0, ...queries.map((q) => q.dataUpdatedAt ?? 0)].filter((n) => n > 0);
  return stamps.length ? new Date(Math.min(...stamps)) : null;
}

/**
 * What the active team has learned and how its searches went. It leads with the platform's own ranked search, which
 * runs when the person submits a question, never as they type; then the four tiles, the questions that found nothing,
 * searches with results by week, and the newest lessons beside the shelf. The summary is the console's server's read,
 * handed here; the search and the shelf's pages are read in the browser, and the gateway ranks, filters and pages all
 * of it.
 */
export function KnowledgeView({ read }: { read: ServerRead<KnowledgeSummary> }) {
  useLive(['knowledge'], read.state === 'ok' ? read.revisions : undefined);
  useServerReadLive('/knowledge/summary');
  const [f, set] = useQueryState({ q: '', kind: 'all', page: '1' });
  const filters = useMemo(() => ({ q: f.q, kind: f.kind }), [f.q, f.kind]);
  const page = Math.max(1, Number(f.page) || 1);
  const question = f.q.trim();
  const search = useConsole<SearchAnswer>(question ? searchPath(question) : null);
  // The shelf by its kind and page alone: the page's question is the search's, never a words filter on the shelf.
  const list = useConsole<KnowledgeList>(knowledgePath({ kind: f.kind }, { offset: (page - 1) * PAGE_SIZE }));
  const summary = read.state === 'ok' ? read.data : undefined;
  const failure = read.state === 'ok' ? undefined : troubleOf(read);
  const updatedAt = arrivalOf(read, list);
  const now = useDataClock();
  const context = knowledgeContext({ summary, list: list.data, filters, page, search: search.data, failure, updatedAt, now });

  return (
    <ConsolePage
      title="Knowledge"
      description="What your team has learned, kept as lessons, and what its searches found."
      showPeriod={false}
      updatedAt={updatedAt}
      context={context}
      toolbar={<KnowledgeTabs active="knowledge" />}
    >
      <Panel
        title={SEARCH_TITLE}
        description="The platform's own ranked search, over your team's documents and lessons and the platform's shared shelf."
        actions={<AskAbout question={question ? `What do the results for "${question}" say, and what do they leave open?` : 'Which of our questions found nothing, and where else could we look for them?'} />}
      >
        <SearchForm applied={question} onSearch={(q) => set({ q })} />
        <SearchResults question={question} search={search} />
      </Panel>
      <Tiles read={read} />
      <Row split="1/2">
        <Questions summary={summary} />
        <Weeks summary={summary} />
      </Row>
      <Row split="1/3">
        <Newest summary={summary} />
        <DataTable
          caption="Lessons"
          noun="lessons"
          rows={list.data?.rows ?? []}
          columns={SHELF_COLUMNS}
          rowKey={(n) => n.key}
          rowHref={(n) => knowledgeNodeHref(n.team, n.path)}
          manual
          total={list.data?.total ?? 0}
          pageSize={PAGE_SIZE}
          pageSizes={[PAGE_SIZE]}
          loading={list.isPending}
          error={failureOf(list)}
          onRetry={() => void list.refetch()}
          state={{ sort: '', dir: 'desc', page: String(page) }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={narrowed(filters)}
          onClearFilters={() => set({ kind: 'all', page: '1' })}
          empty={{ title: 'Nothing on the shelf yet', body: 'A lesson arrives when an initiative closes and something in it was worth keeping.' }}
          toolbar={
            <FilterBar
              filters={[{ key: 'kind', label: 'Kind', value: f.kind, onChange: (v) => set({ kind: v, page: '1' }), options: KIND_OPTIONS }]}
              result={<>{list.data ? `${list.data.total} ${plural(list.data.total, 'lesson')} on the shelf` : list.isPending ? '…' : '—'}</>}
              onClear={() => set({ kind: 'all', page: '1' })}
            />
          }
        />
      </Row>
    </ConsolePage>
  );
}

/**
 * The question, asked when the person submits it: Enter or Search. Typing changes nothing until then, because every
 * search the platform runs is counted as one, and a search a keystroke at a time would count each prefix.
 */
function SearchForm({ applied, onSearch }: { applied: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(applied);
  const [seen, setSeen] = useState(applied);
  // A question set from elsewhere (back, a link, the assistant) is the field's new text.
  if (seen !== applied) {
    setSeen(applied);
    setDraft(applied);
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form role="search" aria-label="Search your team's knowledge" onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <SearchInput value={draft} onValueChange={setDraft} placeholder="Ask in plain words, such as how we rotate the signing key" maxLength={200} className="min-w-0 flex-1" aria-label="Question" />
      <Button type="submit" variant="primary" icon={<Search />}>Search</Button>
    </form>
  );
}

/** A matched fragment as the search marked it: each matched term between `**`, drawn strong. */
function Excerpt({ text }: { text: string }) {
  const parts = text.replace(/\s+/g, ' ').trim().split('**');
  return <p className="t-small mt-1 line-clamp-3 text-ink-2">{parts.map((p, i) => (i % 2 ? <b key={i} className="font-semibold text-ink">{p}</b> : p))}</p>;
}

function Hit({ hit }: { hit: SearchHit }) {
  const address = hitAddress(hit);
  const title = <span className="leading-snug font-medium text-ink">{hit.title}</span>;
  return (
    <li data-result={hit.shelf} className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {address ? <Link href={address} className="link hit">{title}</Link> : title}
        <Badge tone="neutral">{hit.kind === 'node' ? 'Lesson' : 'Document'}</Badge>
        {/* Which shelf holds it: the team's own, or the platform's, which every team reads and nobody here changes. */}
        <Badge tone={hit.shelf === 'platform' ? 'accent' : 'neutral'}>{hit.shelf === 'platform' ? 'Shared shelf' : 'Your team'}</Badge>
        {hit.superseded_by ? <Badge tone="warning" dot>Superseded by {hit.kind === 'node' ? `node ${hit.superseded_by}` : hit.superseded_by}</Badge> : null}
      </div>
      <Excerpt text={hit.excerpt} />
      {hit.kind === 'document' && hit.initiative ? <p className="t-caption mt-1 font-mono [overflow-wrap:anywhere]">{hit.initiative}/{hit.path}</p> : null}
    </li>
  );
}

/** The ranked results, in the gateway's order, each with its shelf; or why there are none. */
function SearchResults({ question, search }: { question: string; search: UseQueryResult<SearchAnswer, ApiError> }) {
  if (!question) return <p className="t-small mt-3 text-ink-3">The search reads what each document and lesson says, not only its title, and ranks what matches. Each search is counted, on this page as from the assistant and MCP.</p>;
  if (search.isPending) {
    return <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Searching">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (search.error) {
    return <EmptyState kind="error" title="The search did not run" className="py-8" action={<Button size="sm" onClick={() => void search.refetch()}>Retry</Button>}>{search.error.message}</EmptyState>;
  }
  const a = search.data;
  if (!a.results.length) {
    return <EmptyState kind="filtered" title={`Nothing found for "${a.query}"`} className="py-8">{a.note ?? 'Nothing in your team\'s documents and lessons, or on the shared shelf, matched it.'}</EmptyState>;
  }
  return (
    <div className="mt-4">
      <p className="t-caption">{`${a.results.length} of ${formatCount(a.ranked_total)} ranked ${plural(a.ranked_total, 'result')}, best first. A result is text that matched the question; open it to read it whole.`}</p>
      {a.note ? <p className="t-small mt-1 text-ink-2">{a.note}</p> : null}
      <ol className="mt-3 flex flex-col divide-y divide-line">{a.results.map((h) => <Hit key={`${h.shelf}:${h.team}:${h.initiative ?? ''}:${h.path}`} hit={h} />)}</ol>
    </div>
  );
}

/** The four tiles, from the server's read; over a read that failed, dashes and the reason, with Retry. */
function Tiles({ read }: { read: ServerRead<KnowledgeSummary> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const tiles = read.state === 'ok' ? read.data.tiles : null;
  const value = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);
  return (
    <>
      <Row split="tiles" data-figures={tiles ? 'read' : undefined}>
        <MetricTile label="Lessons adopted" hint="Lessons on the shelf now, as of the cutoff; an imported one was brought in rather than learned by an initiative." icon={<BookOpen />} value={value(tiles?.standing.value)} note={tiles ? `${formatCount(tiles.standing.imported)} imported` : undefined} />
        <MetricTile label="Superseded" hint="Lessons a later one replaced. They stay on the shelf, readable." icon={<Archive />} value={value(tiles?.superseded.value)} note={tiles ? 'Replaced, still readable' : undefined} />
        <MetricTile label="Searches last week" hint="The team's searches in the last whole week, from this page, the assistant and MCP alike." icon={<Search />} value={value(tiles?.searches.figure.value)} note={tiles ? `Week of ${formatDay(tiles.searches.window.from)}` : undefined} />
        {/* The denominator is a searched count, and the shape says null never means zero: "Of 0 last week" would be a
            week whose searches were never counted read as one that held none. */}
        <MetricTile label="Searches with no result" hint="The team's searches in the last whole week that found nothing at all." icon={<SearchX />} value={value(tiles?.noResult.figure.value)} note={tiles ? (tiles.noResult.denominator === null ? 'Not measured last week' : `Of ${formatCount(tiles.noResult.denominator)} last week`) : undefined} />
      </Row>
      {read.state !== 'ok' ? (
        <EmptyState kind="error" title="The shelf's figures did not load" action={<Button size="sm" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}>{troubleOf(read)}</EmptyState>
      ) : null}
    </>
  );
}

/** A part of the summary the gateway could not read, said in its own card. */
const Unread = ({ title, reason }: { title: string; reason: string }) => (
  <Panel title={title}><EmptyState kind="error" title={`${title} did not load`} className="py-8">{reason}</EmptyState></Panel>
);

function Questions({ summary }: { summary?: KnowledgeSummary }) {
  if (!summary) return <Panel title="Questions that found nothing"><p className="t-small text-ink-3">Not read: the shelf&rsquo;s figures did not load.</p></Panel>;
  if (summary.questions.state !== 'ok') return <Unread title="Questions that found nothing" reason={summary.questions.reason} />;
  const { rows, total } = summary.questions.data;
  return (
    <DataTable
      caption="Questions that found nothing"
      noun="questions"
      rows={rows}
      columns={QUESTION_COLUMNS}
      rowKey={(x) => x.question}
      pageSize={10}
      pageSizes={[10]}
      empty={{ title: 'Every question found something', body: 'No search your team ran has come back empty.' }}
      toolbar={
        <div className="min-w-0">
          <h2 className="t-card">Questions that found nothing</h2>
          <p className="t-caption mt-1">{total > rows.length ? `Your team's own, most asked first: ${rows.length} of ${formatCount(total)}` : 'Your team\'s own, most asked first'}</p>
        </div>
      }
    />
  );
}

/** The week's share as the chart writes it. */
const share = (n: number) => `${Math.round(n)}%`;

/** The last whole week with searches, in one line: a week whose figure was not worked out says so, never "0 of N". */
function lastWeekLine(last: PeriodFigure | undefined): string {
  if (!last) return 'No whole week of searches yet';
  const week = `the week of ${formatDay(last.window.from)}`;
  if (last.numerator === null || last.denominator === null || last.figure.why === 'unavailable') return `Unavailable: the searches that found something in ${week} were not counted`;
  return `${formatCount(last.numerator)} of ${formatCount(last.denominator)} searches found something in ${week}`;
}

function Weeks({ summary }: { summary?: KnowledgeSummary }) {
  const title = 'Searches with results, by week';
  if (!summary) return <Panel title={title}><p className="t-small text-ink-3">Not read: the shelf&rsquo;s figures did not load.</p></Panel>;
  if (summary.weeks.state !== 'ok') return <Unread title={title} reason={summary.weeks.reason} />;
  // Every week the answer holds, which is never past 26: the gateway draws its 24 newest whole weeks and the running one.
  const weeks: PeriodFigure[] = summary.weeks.data;
  // A week with no search has no share: it keeps its slot and reads "No searches", never 0%.
  const columns = weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.denominator === 0 ? null : w.figure.value }));
  const last = [...weeks].reverse().find((w) => w.window.complete && w.denominator);
  return (
    <Panel
      title={title}
      description={lastWeekLine(last)}
    >
      {weeks.length ? (
        <ColumnChart
          label="Share of the team's searches that found something, by week"
          columns={columns}
          dates={weeks.map((w) => w.window.from)}
          running={weeks.at(-1)?.window.complete === false}
          highlight={last?.window.from}
          format={share}
          noData="No searches"
          height={200}
        />
      ) : <EmptyState title="No weeks yet" className="py-8">The first week of searches is drawn once it has begun.</EmptyState>}
      <p className="t-caption mt-3">Found something means text came back to read: retrieval coverage, which says nothing about whether it settled the question.</p>
    </Panel>
  );
}

function Newest({ summary }: { summary?: KnowledgeSummary }) {
  const title = 'Newest lessons';
  const foot = <Link href="/knowledge/log" className="link hit t-small mt-4 inline-block">Every lesson recorded or superseded is in the log</Link>;
  if (!summary) return <Panel title={title}><p className="t-small text-ink-3">Not read: the shelf&rsquo;s figures did not load.</p>{foot}</Panel>;
  if (summary.newest.state !== 'ok') return <Unread title={title} reason={summary.newest.reason} />;
  const newest = summary.newest.data;
  // The gateway answers the five newest and no count of the rest, so the card says how many it shows.
  return (
    <Panel title={title} description={newest.length ? `The ${formatCount(newest.length)} ${plural(newest.length, 'lesson')} your team recorded most recently` : 'The latest your team recorded'}>
      {newest.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {newest.map((n) => (
            <li key={`${n.team}/${n.path}`} className="py-2.5 first:pt-0">
              <Link href={knowledgeNodeHref(n.team, n.path)} className="link hit leading-snug font-medium">{n.title}</Link>
              <p className="t-caption mt-1">{n.kind}{n.imported ? ' · imported' : ''} · {formatDate(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : <p className="t-small text-ink-3">Nothing recorded yet.</p>}
      {foot}
    </Panel>
  );
}
