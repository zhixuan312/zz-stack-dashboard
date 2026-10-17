'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition, type ReactNode } from 'react';
import { BookOpen, PencilLine, RotateCw, Search, SearchX } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Figure, PeriodFigure, Window } from '@/lib/platform-shapes';
import {
  TILES, WEEKLY_TILES, askOf, asOfLine, changeOf, cohortNote, cohortText, exactSince, figureText, isFleet, knowledgeHealthContext, knowledgeHealthTrouble,
  lastWhole, leftOut, madeLine, searchLine, shelfName, valueIn, weekOf, type KnowledgeHealthRead, type MadeWeek, type Question,
  type SearchWeek, type ShelfRow, type WeeklyTile,
} from '@/views/platform-knowledge-context';

/** The protagonist's title: the card the page's Ask sits on. COUPLED: the README's `Protagonist:`. */
const SHELVES_TITLE = 'Each shelf';

/**
 * The knowledge store's health, read on the console's server and handed here whole: the four tiles, each shelf, the
 * lessons made by week outside the import cohorts, the share of searches with no result by week, the lessons by the
 * week made, the lessons by kind and, for a superadmin alone, the questions the searches that found nothing asked. A
 * part the gateway could not work out draws its own state and the rest stands; a read that failed or took longer than
 * its bound is the error state with Retry, which asks the server again. Nothing here is judged: no figure takes a
 * colour for being higher or lower.
 */
export function PlatformKnowledgeView({ read }: { read: KnowledgeHealthRead }) {
  useShareView(knowledgeHealthContext(read));
  if (read.state !== 'ok') return <KnowledgeTrouble read={read} />;
  const h = read.health;
  const fleet = isFleet(h);
  return (
    <Stack>
      <Tiles part={h.tiles} />
      <div data-protagonist={SHELVES_TITLE} className="contents">
        <Shelves part={h.shelves} fleet={fleet} />
      </div>
      <Weeks health={h} />
      <Row split="1/2">
        <Cohorts part={h.cohorts} />
        <ByKind part={h.byKind} />
      </Row>
      {h.questions !== null ? <Questions part={h.questions} /> : null}
    </Stack>
  );
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function KnowledgeHealthAsOf({ read }: { read: KnowledgeHealthRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.health)}</span>;
}

/**
 * Knowledge health on its way, in the shape of the page. COUPLED: `app/(dash)/platform/knowledge/loading.tsx`, the same
 * blocks before the gate has answered.
 */
export function KnowledgeHealthSkeleton() {
  return (
    <>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={3} filters={false} />
      <Row split="1/2"><ChartSkeleton height="h-56" /><ChartSkeleton height="h-56" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
    </>
  );
}

/** A part the read could not work out, said in its own card, so the parts beside it stand. */
function Unavailable({ title, reason, actions }: { title: string; reason: string; actions?: ReactNode }) {
  return (
    <Panel title={title} actions={actions}>
      <EmptyState layout="inline" title={`${title}: unavailable`}>It could not be read ({reason}). The rest of the page stands.</EmptyState>
    </Panel>
  );
}

/** A tile's value: its number, or the word for why there is none, never a zero. */
const tileValue = (f: Figure): number | string => (f.value === null ? (f.why === 'unavailable' ? 'Unavailable' : 'No data') : f.value);
const ICONS: Record<WeeklyTile, ReactNode> = { madeLastWeek: <PencilLine />, searches: <Search />, noResult: <SearchX /> };

function Tiles({ part }: { part: KnowledgeHealth['tiles'] }) {
  if (part.state !== 'ok') return <Unavailable title="Last week" reason={part.reason} />;
  const t = part.data;
  // A week whose change cannot be set beside the week before says what the week before was instead, never a zero change.
  const weekly = (k: WeeklyTile) => {
    const pair: { last: PeriodFigure; previous: PeriodFigure } = t[k];
    const { kind } = TILES[k];
    const delta = changeOf(pair);
    return (
      <MetricTile
        key={k} label={TILES[k].label} hint={TILES[k].definition} icon={ICONS[k]}
        value={tileValue(pair.last.figure)} format={(n) => valueIn(kind, n)} intent="neutral"
        {...(delta === null
          ? { note: `The ${weekOf(pair.previous.window)}: ${figureText(kind, pair.previous.figure)}${pair.last.figure.why === 'insufficient' ? '; last week too few' : ''}` }
          : { delta, compare: `vs the ${weekOf(pair.previous.window)}` })}
      />
    );
  };
  return (
    <Row split="tiles" data-figures="read">
      <MetricTile label={TILES.standing.label} hint={TILES.standing.definition} icon={<BookOpen />} value={t.standing} note="Every shelf, imports included" />
      {WEEKLY_TILES.map(weekly)}
    </Row>
  );
}

/** A count in a cell, as a figure set in the table's numerals. */
const num = (n: number) => <span className="t-num">{formatCount(n)}</span>;

/**
 * A phone card holds a title, a status and three facts, so the three facts carry every figure: what stands with what was
 * superseded and imported, last week's lessons made with its searches, and the share with no result.
 */
const shelfColumns = (fleet: boolean): Column<ShelfRow>[] => aligned([
  {
    key: 'shelf', header: 'Shelf', grow: true, mobile: 'title',
    cell: (r) => <span title={shelfName(r, fleet)} className={r.kind === 'all' ? 'font-medium text-ink' : undefined}>{shelfName(r, fleet)}</span>,
  },
  {
    key: 'standing', header: 'Standing', numeric: true, mobile: 'fact', cell: (r) => num(r.standing),
    mobileCell: (r) => `${formatCount(r.standing)} standing, ${formatCount(r.superseded)} superseded, ${formatCount(r.imported)} imported`,
  },
  { key: 'superseded', header: 'Superseded', numeric: true, hideBelow: 'md', mobile: 'hidden', cell: (r) => num(r.superseded) },
  { key: 'imported', header: 'Imported', numeric: true, mobile: 'hidden', cell: (r) => num(r.imported) },
  {
    key: 'made', header: 'Made last week', numeric: true, mobile: 'fact', cell: (r) => num(r.madeLastWeek),
    mobileCell: (r) => `${formatCount(r.madeLastWeek)} made, ${formatCount(r.searchesLastWeek)} ${plural(r.searchesLastWeek, 'search', 'searches')} last week`,
  },
  { key: 'searches', header: 'Searches last week', numeric: true, hideBelow: 'md', mobile: 'hidden', cell: (r) => num(r.searchesLastWeek) },
  { key: 'noResult', header: 'No result', numeric: true, mobile: 'fact', cell: (r) => figureText('share', r.noResult.figure), mobileCell: (r) => `${figureText('share', r.noResult.figure)} no result` },
]);

/** Each shelf, the page's protagonist, with the Ask in its head. */
function Shelves({ part, fleet }: { part: KnowledgeHealth['shelves']; fleet: boolean }) {
  const ask = <AskAbout question={askOf(fleet)} />;
  if (part.state !== 'ok') return <Unavailable title={SHELVES_TITLE} reason={part.reason} actions={ask} />;
  const rows = part.data.rows;
  const week = rows[0]?.noResult.window;
  return (
    <DataTable
      title={SHELVES_TITLE}
      description={`${fleet ? 'Every team\'s shelf by its slug, the shared shelf and the totals' : 'Your team\'s shelf, the shared shelf and every shelf\'s totals'}: what stands, what was superseded and imported, and${week ? ` the ${weekOf(week)}'s` : ' last week\'s'} lessons made and searches`}
      actions={ask}
      caption="Each shelf's lessons and last week's searches"
      noun="shelves"
      rows={rows}
      columns={shelfColumns(fleet)}
      rowKey={(r) => `${r.kind}:${r.shelf}`}
      // Every shelf on one page, so the totals, which come last, are never paged away from the shelves they add up.
      pageSize={100}
      pageSizes={[100]}
      empty={{ title: 'No shelf yet', body: 'A shelf is listed once a team has one.' }}
    />
  );
}

/** The lessons made and the searches by week, on one cursor: pointing at a week reads it in both. */
function Weeks({ health }: { health: KnowledgeHealth }) {
  const made = health.made.state === 'ok' ? health.made.data.weeks : [];
  const searched = health.searches.state === 'ok' ? health.searches.data.weeks : [];
  const weeks = made.length ? made : searched;
  const dates = useMemo(() => weeks.map((w) => w.window.from), [weeks]);
  return (
    <Meridian dates={dates}>
      <Row split="1/2">
        <Made part={health.made} />
        <Searches part={health.searches} />
      </Row>
    </Meridian>
  );
}

/** The week the cursor points at, or else the last whole one, by its index in `weeks`. */
function usePointed<T extends { window: Window }>(weeks: T[]): T | null {
  const { index } = useMeridianIndex();
  const at = index !== null && weeks[index] ? index : lastWhole(weeks);
  return at >= 0 ? weeks[at] : null;
}

/** The week's figures under a chart, with the week they are of. */
function WeekLine({ week, items, ...rest }: { week: { window: Window }; items: { label: string; value: string }[] } & Record<`data-${string}`, string>) {
  return (
    <div {...rest}>
      <p className="t-caption mb-1">The week of {formatDay(week.window.from)}{week.window.complete ? '' : ', so far'}</p>
      <KeyValue items={items} />
    </div>
  );
}

function Made({ part }: { part: KnowledgeHealth['made'] }) {
  const title = 'Lessons made by week';
  const weeks = part.state === 'ok' ? part.data.weeks : [];
  const shown = usePointed<MadeWeek>(weeks);
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const outs = weeks.filter((w) => leftOut(w));
  return (
    <Panel title={title} description={`Lessons made each week outside the import cohorts. ${exactSince(part.data)}.`}>
      {weeks.length ? (
        <div className="flex flex-col gap-4">
          <ColumnChart
            label="Lessons made by week, outside the import cohorts"
            columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.made.value }))}
            dates={weeks.map((w) => w.window.from)}
            running={!weeks.at(-1)!.window.complete}
            highlight={shown?.window.from}
            height={180}
          />
          {shown ? <WeekLine data-made="" week={shown} items={madeLine(shown)} /> : null}
          {outs.length ? (
            <p data-left-out className="t-small whitespace-normal text-ink-3 [overflow-wrap:anywhere]">
              Left out as imports: {outs.map((w) => `the ${weekOf(w.window)}, ${leftOut(w)}`).join('; ')}.
            </p>
          ) : <p data-left-out className="t-small text-ink-3">No import was left out of these weeks.</p>}
        </div>
      ) : <EmptyState title="No weeks yet" className="py-8">The first week is drawn once the platform has a record to count from.</EmptyState>}
    </Panel>
  );
}

function Searches({ part }: { part: KnowledgeHealth['searches'] }) {
  const title = 'Searches with no result by week';
  const weeks = part.state === 'ok' ? part.data.weeks : [];
  const shown = usePointed<SearchWeek>(weeks);
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  return (
    <Panel title={title} description="The share of real-work searches that found nothing, with the share the engine widened and the mean results a search returned">
      {weeks.length ? (
        <div className="flex flex-col gap-4">
          <ColumnChart
            label="Share of searches with no result, by week"
            columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.noResult.figure.value }))}
            dates={weeks.map((w) => w.window.from)}
            running={!weeks.at(-1)!.window.complete}
            highlight={shown?.window.from}
            format={(n) => valueIn('share', n)}
            height={180}
          />
          {shown ? <WeekLine data-searches="" week={shown} items={searchLine(shown)} /> : null}
        </div>
      ) : <EmptyState title="No weeks yet" className="py-8">A week is drawn once a search has recorded its results.</EmptyState>}
    </Panel>
  );
}

function Cohorts({ part }: { part: KnowledgeHealth['cohorts'] }) {
  const title = 'Lessons by the week made';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const rows = part.data.rows.filter((c) => c.made > 0);
  return (
    <Panel title={title} description="Every lesson by the week it was made, imports included and labelled, with how many have been superseded since; nothing records when">
      {rows.length ? (
        <BarList
          label="Lessons by the week made"
          limit={8}
          items={rows.map((c) => {
            const said = `Week of ${formatDay(c.window.from)}: ${cohortText(c)}`;
            return {
              key: c.window.from,
              label: <span title={said}>Week of {formatDay(c.window.from)}<span className="text-ink-3"> · {cohortNote(c)}</span></span>,
              value: c.made,
            };
          })}
        />
      ) : <EmptyState layout="inline" title="No lesson made yet">A week is listed once a lesson is made in it.</EmptyState>}
    </Panel>
  );
}

function ByKind({ part }: { part: KnowledgeHealth['byKind'] }) {
  const title = 'Lessons by kind';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const kinds = part.data.filter((k) => k.standing > 0);
  return (
    <Panel title={title} description="The lessons standing on every shelf, by the kind each was given">
      {kinds.length
        ? <BarList label="Standing lessons by kind" limit={6} items={kinds.map((k) => ({ key: k.kind, label: <span title={k.kind}>{k.kind}</span>, value: k.standing }))} />
        : <EmptyState layout="inline" title="No lesson stands yet">A kind is listed once a lesson of it stands on a shelf.</EmptyState>}
    </Panel>
  );
}

const QUESTION_COLUMNS: Column<Question>[] = aligned([
  { key: 'question', header: 'Question', grow: true, mobile: 'title', cell: (r) => <span className="whitespace-normal [overflow-wrap:anywhere]">{r.question}</span> },
  { key: 'shelf', header: 'Team', mobile: 'fact', cell: (r) => <span className="font-mono text-xs" title={r.shelf}>{r.shelf}</span> },
  { key: 'asked', header: 'Asked', numeric: true, mobile: 'fact', cell: (r) => num(r.asked), mobileCell: (r) => `Asked ${formatCount(r.asked)} ${plural(r.asked, 'time')}` },
  { key: 'last', header: 'Last asked', mobile: 'status', cell: (r) => <span className="t-num">{formatDateTime(r.lastAskedAt)}</span> },
]);

/** The superadmin's alone: what the searches that found nothing asked, most asked first. */
function Questions({ part }: { part: NonNullable<KnowledgeHealth['questions']> }) {
  const title = 'Questions with no result';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { window, rows, total } = part.data;
  return (
    <DataTable
      title={title}
      description={`What real-work searches that found nothing asked, by question and the team that asked, the weeks from ${formatDay(window.from)}, most asked first, ${formatCount(rows.length)} shown of ${formatCount(total)}; only a superadmin reads them`}
      caption="Questions the searches that found nothing asked"
      noun="questions"
      rows={rows}
      columns={QUESTION_COLUMNS}
      rowKey={(r) => `${r.shelf}\0${r.question}`}
      empty={{ title: 'Every search found something', body: 'No real-work search in these weeks came back empty.' }}
    />
  );
}

function KnowledgeTrouble({ read }: { read: Exclude<KnowledgeHealthRead, { state: 'ok' }> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = knowledgeHealthTrouble(read);
  return (
    <Card>
      <EmptyState
        kind="error"
        title={title}
        className="py-16"
        action={<Button variant="primary" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}
      >
        {detail}
      </EmptyState>
    </Card>
  );
}
