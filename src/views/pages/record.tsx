'use client';

import { memo, useDeferredValue, useState, type ReactNode } from 'react';
import { Copy, RotateCw } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { Heatmap } from '@/components/charts/heatmap';
import { Meridian } from '@/components/charts/meridian';
import { TrendChart } from '@/components/charts/trend-chart';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FeaturedMetric } from '@/components/patterns/featured-metric';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Busy, ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { PeriodSelect } from '@/components/patterns/period-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { aligned } from '@/console/columns';
import { failureOf } from '@/console/query';
import { Panel } from '@/console/panel';
import { recordText } from '@/console/record-text';
import { plural } from '@/lib/format';
import { dayOf, formatCalendarDate, formatDate, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Window } from '@/lib/platform-shapes';
import type { RecordRead } from '@/lib/work-shapes';
import {
  FIRST, LEAD, PAGE_SIZE, PERIOD_OPTIONS, RECORD_DEFAULTS, SLICES, asOfLine, asOfWords, coverageLine, filtersOfPath, footOf,
  formatHours, formatShare, grainWords, leadOf, periodLine, periodOf, recordContext, recordPath, recordTrouble, summaryLine, tickOf, tilesOf,
  type RecordFilters, type RecordPeriod, type RecordServed, type SliceKey, type Tile,
} from '@/views/record-context';
import { LESSONS_MADE } from '@/views/record-names';
import { useServed, useServedAddress } from '@/views/use-served';
import { OUTCOME_PARTS } from '@/views/outcome-parts';

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the record and the
 * browser asks for nothing more, then the browser's own once the period or the table's page changes, or a Retry asks.
 * While a new period is on its way the record drawn stays, marked busy, so the page does not fall to a skeleton and
 * back. A failure is stated only when there is nothing to draw.
 */
function useRecord(served: RecordServed | null) {
  const [filters, set] = useServedAddress(RECORD_DEFAULTS, served, filtersOfPath);
  const path = recordPath(filters);
  const mine = served?.path === path ? served : null;
  const { q, error, retry, busy } = useServed<RecordRead>(path, mine !== null, mine === null && served !== null);
  const fresh = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  // The record last drawn, kept as React keeps a value derived from the previous render: set while rendering, once.
  const [last, setLast] = useState<RecordRead | undefined>(fresh);
  if (fresh && fresh !== last) setLast(fresh);
  const failed = failureOf({ error });
  const trouble = fresh ? null : failed ?? (mine && mine.state !== 'ok' ? recordTrouble(mine) : null);
  const data = fresh ?? (trouble ? undefined : last);
  const team = served?.state === 'ok' ? served.team : null;
  return { data, stale: !fresh && data !== undefined, trouble, retry, busy, filters, set, team };
}

/** Record's body on its way: the lead, a slice's tiles and charts, and the record. COUPLED: `app/(dash)/record/loading.tsx` draws the same rows. */
export function RecordSkeleton() {
  return (
    <>
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
      <TableSkeleton rows={10} filters={false} />
    </>
  );
}

/** The masthead's as-of line: the cutoff of the record drawn, nothing while there is none. */
export function RecordAsOf({ served }: { served: RecordServed | null }) {
  const { data } = useRecord(served);
  return data ? <span className="t-small text-ink-3">{asOfLine(data)}</span> : null;
}

/**
 * The masthead's controls: the period, usable before the record has arrived and while another period is on its way,
 * and `Copy as text`, which copies the record drawn once there is one. Before the server's read has answered there is
 * nothing to copy and nothing is read here: the read is the server's, and a browser read beside it would be a second.
 */
export function RecordActions({ served }: { served: RecordServed | null }) {
  return served ? <ServedActions served={served} /> : <Controls served={null} />;
}

function ServedActions({ served }: { served: RecordServed }) {
  const { data, stale } = useRecord(served);
  return <Controls served={served} record={stale ? undefined : data} />;
}

/** The period control and `Copy as text`; only a write the clipboard resolved says it was copied. */
function Controls({ served, record }: { served: RecordServed | null; record?: RecordRead }) {
  const [f, set] = useServedAddress(RECORD_DEFAULTS, served, filtersOfPath);
  const copy = async () => {
    if (!record) return;
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(recordText(record));
      toast({ tone: 'positive', title: 'Record copied as text', description: periodLine(record) });
    } catch {
      toast({ tone: 'critical', title: 'Nothing was copied', description: 'This browser did not let the page write to the clipboard.' });
    }
  };
  return (
    <>
      <PeriodSelect<RecordPeriod> value={periodOf(f)} onChange={(period) => set({ period, page: '1' })} periods={PERIOD_OPTIONS} />
      <Button icon={<Copy />} disabled={!record} onClick={() => void copy()}>Copy as text</Button>
    </>
  );
}

/**
 * Record: the active team's retained text as of the read's cutoff, the period's work in its slices, and the record of
 * every initiative, read on the console's server and handed here. A slice the gateway could not read draws its own
 * unavailable state and the rest stands; a read that failed or took longer than its bound is the error state with
 * Retry, which reads again in the browser.
 */
export function RecordView({ served }: { served: RecordServed }) {
  const { data, stale, trouble, retry, busy, filters, set, team } = useRecord(served);
  /* DELIBERATE: the record drawn trails the record read by a render of its own. A period's record arrives in the render
   * the address readers are told the address moved in (`useQueryState` announces it once the navigation has committed),
   * and a store's change is rendered synchronously: drawing the whole record there, every chart of it, was one task of
   * 54 ms of script and 33 ms of style and layout on the phone, a dropped frame on every press (Wave 5's timed run,
   * #3676). Deferred, that render only marks the record busy, and the new one is drawn in a render React may interrupt.
   * COUPLED: `Slices` is memoised on the read, so the render that marks the record busy draws no chart again; the
   * table stands outside it, since its page answers a press of its own at once. */
  const shown = useDeferredValue(data);
  const behind = stale || shown !== data;
  useShareView(recordContext(shown && !behind ? shown : null, { filters, trouble }));
  if (!data || !shown) {
    if (!trouble) return <Busy name="record"><RecordSkeleton /></Busy>;
    return (
      <Card>
        <EmptyState kind="error" title="Record did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={busy} onClick={retry}>Retry</Button>}>
          {trouble}
        </EmptyState>
      </Card>
    );
  }
  return (
    <Stack aria-busy={behind || undefined} className={behind ? 'opacity-60 transition-opacity' : undefined}>
      <Slices r={shown} />
      <Initiatives r={shown} team={team} filters={filters} onPage={(page) => set({ page })} retry={retry} busy={busy} />
    </Stack>
  );
}

/** The slices of one read, the lead first: drawn again only when the read changes. */
const Slices = memo(function Slices({ r }: { r: RecordRead }) {
  const windows = r.cumulative.map((p) => p.window);
  return (
    <Meridian dates={windows.map((w) => w.from)}>
      <Lead r={r} windows={windows} />
      <Work r={r} windows={windows} />
      <Documents r={r} windows={windows} />
      <Knowledge r={r} windows={windows} />
      <Agents r={r} />
      <Firsts r={r} />
    </Meridian>
  );
});

type Slice = { r: RecordRead; windows: Window[] };

/** A period's figures by period: present, and running when its last period is not over. */
const series = (windows: Window[]) => ({ dates: windows.map((w) => w.from), running: windows.length > 0 && !windows.at(-1)!.complete });
/** A chart's place when the period holds no period yet. */
const NoPeriods = () => <EmptyState layout="inline" title="Nothing recorded in the period" className="py-6">A period appears here once it has begun.</EmptyState>;

/** The lead: the retained text's estimate as of the cutoff, above the words the period added, a running total; the period's work in its foot. */
function Lead({ r, windows }: Slice) {
  const lead = leadOf(r);
  const { dates, running } = series(windows);
  return (
    <FeaturedMetric
      kicker={lead.kicker}
      value={Number.isNaN(lead.hours) ? null : lead.hours}
      missing={lead.text}
      format={formatHours}
      caption={lead.pace ? (
        <>
          <span className="block">{`${lead.pace[0].toUpperCase()}${lead.pace.slice(1)}, over ${lead.basis}: ${LEAD.note}.`}</span>
          <span className="block">{lead.coverage}</span>
        </>
      ) : LEAD.unread}
      actions={<AskAbout question={`What does our record show for ${periodLine(r).toLowerCase()}, and what would the retained text take one person to write?`} />}
      foot={
        <>
          <dl>{footOf(r).map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
          <span>{periodLine(r)}</span>
        </>
      }
    >
      <p className="t-caption px-2 pb-2">{`${LEAD.chart}, ${grainWords(windows)}: ${LEAD.added}`}</p>
      {windows.length ? (
        <TrendChart
          height="fill"
          label={LEAD.chart}
          dates={dates}
          running={running}
          tick={tickOf(windows)}
          series={[{ key: 'words', label: 'Words added', values: r.cumulative.map((p) => p.figure.value), kind: 'area' }]}
        />
      ) : <NoPeriods />}
    </FeaturedMetric>
  );
}

/** A slice: its heading and the period it is of, its four tiles, and its charts; a slice that could not be read says so. */
function SliceOf({ k, r, line, tiles, children }: { k: SliceKey; r: RecordRead; line?: string; tiles: Tile[] | null; children?: ReactNode }) {
  return (
    <section aria-labelledby={`slice-${k}`} data-slice={k} className="flex min-w-0 flex-col gap-(--stack-gap) pt-4">
      <div>
        <h2 id={`slice-${k}`} className="t-section">{SLICES[k].title}</h2>
        <p className="t-small mt-1 text-ink-2">{line ?? periodLine(r)}</p>
      </div>
      {tiles ? (
        <>
          <Row split="tiles">
            {tiles.map((t) => <MetricTile key={t.key} label={t.label} hint={t.hint} value={t.value} format={t.format} note={t.note} />)}
          </Row>
          {children}
        </>
      ) : (
        <Card><EmptyState kind="error" layout="inline" title={SLICES[k].unread} className="px-(--card-pad) py-4">The rest of the page stands; this part did not answer.</EmptyState></Card>
      )}
    </section>
  );
}

function Work({ r, windows }: Slice) {
  const w = r.work.state === 'ok' ? r.work.data : null;
  const { dates, running } = series(windows);
  const tick = tickOf(windows);
  const grain = grainWords(windows);
  const spread = (s: { median: { value: number | null }; largest: { value: number | null } }, f = formatCount) =>
    s.median.value === null ? 'None closed' : `${f(s.median.value)}, the largest ${s.largest.value === null ? 'unknown' : f(s.largest.value)}`;
  return (
    <SliceOf k="work" r={r} tiles={tilesOf(r).work}>
      {w ? (
        <>
          <Row split="1/2">
            <Panel title="Closures in all" description={`A running total of the whole record, ${grain}`}>
              {windows.length ? <TrendChart label="Closures in all" dates={dates} running={running} tick={tick} series={[{ key: 'closures', label: 'Closures in all', values: w.closuresInAll.map((p) => p.figure.value), kind: 'area' }]} /> : <NoPeriods />}
            </Panel>
            <Panel title="Closures by outcome" description={`Initiatives closed, ${grain}`}>
              {windows.length ? (
                <ColumnChart
                  label="Closures by outcome"
                  dates={dates}
                  running={running}
                  noData="None recorded"
                  parts={OUTCOME_PARTS}
                  columns={w.closuresByWeek.map((c) => ({ key: c.window.from, label: tick(c.window.from), values: [c.accepted.value, c.delivered.value, c.abandoned.value] }))}
                />
              ) : <NoPeriods />}
            </Panel>
          </Row>
          <Row split="2/3">
            <Panel title="Median hours to close" description={`Over each period's closures, ${grain}`}>
              {windows.length ? (
                <ColumnChart
                  label="Median hours to close"
                  dates={dates}
                  running={running}
                  noData="Nothing closed"
                  format={formatHours}
                  columns={w.medianHoursByWeek.map((p) => ({ key: p.window.from, label: tick(p.window.from), value: p.figure.value }))}
                />
              ) : <NoPeriods />}
            </Panel>
            <Panel title="A typical piece of work" description="The median and the largest, over the work closed in the period">
              <KeyValue items={[
                { label: 'Documents', value: spread(w.typical.documents) },
                { label: 'Versions', value: spread(w.typical.versions) },
                { label: 'Sources', value: spread(w.typical.sources) },
                { label: 'Words it retains', value: spread(w.typical.words) },
              ]} />
            </Panel>
          </Row>
        </>
      ) : null}
    </SliceOf>
  );
}

function Documents({ r, windows }: Slice) {
  const d = r.documents.state === 'ok' ? r.documents.data : null;
  const { dates, running } = series(windows);
  const tick = tickOf(windows);
  return (
    <SliceOf k="documents" r={r} tiles={tilesOf(r).documents}>
      {d ? (
        <Row split="2/3">
          <Panel title="Words added" description={`The words each revision added, ${grainWords(windows)}, nothing taken off for what a later one removed. ${coverageLine(d.coverage)}`}>
            {windows.length ? (
              <ColumnChart
                label="Words added"
                dates={dates}
                running={running}
                noData="No words recorded"
                columns={d.wordsByWeek.map((p) => ({ key: p.window.from, label: tick(p.window.from), value: p.figure.value }))}
              />
            ) : <NoPeriods />}
          </Panel>
          <Panel
            title="Most rewritten documents"
            // The gateway answers the five given the most versions and no count of the rest, so the card says how many it shows.
            description={d.mostRewritten.length ? `The ${formatCount(d.mostRewritten.length)} ${plural(d.mostRewritten.length, 'document')} given the most versions in the period, with the versions each was given` : 'The versions each was given in the period'}
          >
            {d.mostRewritten.length ? (
              <BarList
                label="Most rewritten documents"
                items={d.mostRewritten.map((m) => ({ key: `${m.initiative}/${m.path}`, label: <span className="[overflow-wrap:anywhere]">{m.initiative}/{m.path}</span>, value: m.versions }))}
              />
            ) : <EmptyState layout="inline" title="Nothing rewritten in the period" className="py-6">A document given a second version appears here.</EmptyState>}
          </Panel>
        </Row>
      ) : null}
    </SliceOf>
  );
}

function Knowledge({ r, windows }: Slice) {
  const k = r.knowledge.state === 'ok' ? r.knowledge.data : null;
  const { dates, running } = series(windows);
  const tick = tickOf(windows);
  const grain = grainWords(windows);
  return (
    <SliceOf k="knowledge" r={r} tiles={tilesOf(r).knowledge}>
      {k ? (
        <>
          <Row split="1/2">
            <Panel title="Searches with results" description={`The share of completed searches that returned something, ${grain}: retrieval, not a proven answer`}>
              {windows.length ? (
                <ColumnChart
                  label="Searches with results"
                  dates={dates}
                  running={running}
                  noData="No searches recorded"
                  format={formatShare}
                  columns={k.searchesWithResults.map((p) => ({ key: p.window.from, label: tick(p.window.from), value: p.figure.value }))}
                />
              ) : <NoPeriods />}
            </Panel>
            <Panel title="What searches returned" description="Every entry a search returned in the period, by kind">
              {k.returnedByKind.length ? <BarList label="What searches returned" items={k.returnedByKind.map((b) => ({ key: b.kind, label: b.kind, value: b.results }))} /> : <EmptyState layout="inline" title="No search returned anything" className="py-6">A search that returns an entry is counted here.</EmptyState>}
            </Panel>
          </Row>
          <Row split="1/2">
            <Panel title={`${LESSONS_MADE} in all`} description={`A running total of the whole record, an import's left out, ${grain}`}>
              {windows.length ? <TrendChart label={`${LESSONS_MADE} in all`} dates={dates} running={running} tick={tick} series={[{ key: 'lessons', label: `${LESSONS_MADE} in all`, values: k.adoptedInAll.map((p) => p.figure.value), kind: 'area' }]} /> : <NoPeriods />}
            </Panel>
            {/* Knowledge's measure, under Knowledge's name: the lessons standing on the shelf, not those made. */}
            <Panel title="Lessons adopted, by kind" description={`The lessons standing on your shelf ${asOfWords(r)}, an import's included`}>
              {k.byKind.length ? <BarList label="Lessons adopted, by kind" items={k.byKind.map((b) => ({ key: b.kind, label: b.kind, value: b.lessons }))} /> : <EmptyState layout="inline" title="No lesson on the shelf" className="py-6">A lesson the team adopts appears here by its kind.</EmptyState>}
            </Panel>
          </Row>
        </>
      ) : null}
    </SliceOf>
  );
}

/**
 * The record's first day, in its timezone, when the period begins before it: `null` when the period lies inside the
 * record. A Heatmap draws no gap, so a day before it would be a 0 cell for a day nothing observed.
 */
const recordBegins = (r: RecordRead): string | null => {
  if (!r.meta.coverageFrom || Date.parse(r.meta.coverageFrom) <= Date.parse(r.meta.period.from)) return null;
  return dayOf(r.meta.coverageFrom, r.meta.timezone);
};
/** A week of hours is drawn once every hour of it was observed: before that a 0 cell is an hour nobody saw. */
const WEEK_MS = 7 * 86_400_000;
const sawAWeek = (r: RecordRead) =>
  r.meta.coverageFrom !== null && Date.parse(r.meta.asOf) - Math.max(Date.parse(r.meta.period.from), Date.parse(r.meta.coverageFrom)) >= WEEK_MS;

/** The period's days from the record's first, a year at a time: the latest year first, and every year the period reaches offered beside it. */
function Days({ r, days }: { r: RecordRead; days: { day: string; runs: number }[] }) {
  const begins = recordBegins(r);
  const observed = r.meta.coverageFrom === null ? [] : days.filter((d) => !begins || d.day >= begins);
  const years = [...new Set(observed.map((d) => d.day.slice(0, 4)))];
  const [year, setYear] = useState<string | null>(null);
  const shown = year && years.includes(year) ? year : years.at(-1);
  const cells = observed.filter((d) => d.day.startsWith(shown ?? '')).map((d) => ({ date: d.day, value: d.runs }));
  return (
    <Panel
      title="Every day"
      description={begins ? `Runs started each day from ${formatCalendarDate(begins)}, when the record begins, in ${r.meta.timezone}` : `Runs started each day, in ${r.meta.timezone}`}
      actions={years.length > 1 ? <Segmented size="sm" label="Year" value={shown!} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} /> : null}
    >
      {cells.length ? (
        <Heatmap label={`Runs started each day of ${shown}`} days={cells} scale="quantile" unit="runs" running={cells.at(-1)!.date === dayOf(r.meta.asOf, r.meta.timezone)} />
      ) : <EmptyState layout="inline" title="No day in the period yet" className="py-6">Each day of the period appears here.</EmptyState>}
    </Panel>
  );
}

function Agents({ r }: { r: RecordRead }) {
  const a = r.agents.state === 'ok' ? r.agents.data : null;
  const begins = recordBegins(r);
  return (
    <SliceOf k="agents" r={r} tiles={tilesOf(r).agents}>
      {a ? (
        <>
          <Panel title="Weekday by hour" description={begins ? `Runs started from ${formatCalendarDate(begins)}, when the record begins, in ${r.meta.timezone}` : `Runs started in the period, in ${r.meta.timezone}`}>
            {sawAWeek(r) ? (
              <Heatmap label="Runs started by weekday and hour" values={a.weekdayHour} timezone={r.meta.timezone} unit="runs" />
            ) : <EmptyState layout="inline" title="Not a whole week observed yet" className="py-6">Every hour of the week is drawn once the record holds seven days.</EmptyState>}
          </Panel>
          <Row split="2/3">
            <Days r={r} days={a.days} />
            <Panel title="Runs by skill" description="The period's observed runs, by the skill each ran">
              {a.bySkill.length ? <BarList label="Runs by skill" items={a.bySkill.map((s) => ({ key: s.skill, label: <span className="[overflow-wrap:anywhere]">{s.skill}</span>, value: s.runs }))} /> : <EmptyState layout="inline" title="No run in the period" className="py-6">A run of a skill appears here.</EmptyState>}
            </Panel>
          </Row>
        </>
      ) : null}
    </SliceOf>
  );
}

function Firsts({ r }: { r: RecordRead }) {
  const f = r.firsts.state === 'ok' ? r.firsts.data : null;
  return (
    <SliceOf k="firsts" r={r} tiles={tilesOf(r).firsts}>
      {f ? (
        <Panel title="Dated firsts" description="Over the whole record, the earliest first">
          {f.firsts.length ? (
            <KeyValue items={f.firsts.map((x) => ({ label: FIRST[x.key], value: <time dateTime={x.at}>{formatDate(x.at)}</time> }))} />
          ) : <EmptyState layout="inline" title="No first yet" className="py-6">The first closure, approval, lesson, run and week of words appear here.</EmptyState>}
        </Panel>
      ) : null}
    </SliceOf>
  );
}

const OUTCOME_TONE: Record<string, 'positive' | 'neutral'> = { accepted: 'positive', delivered: 'positive', abandoned: 'neutral' };
type InitiativeRecord = Extract<RecordRead['record'], { state: 'ok' }>['data']['rows'][number];

const COLUMNS: Column<InitiativeRecord>[] = aligned([
  { key: 'initiative', header: 'Initiative', grow: true, mobile: 'title', cell: (i) => <span className="block truncate font-medium text-ink" title={i.slug}>{i.slug}</span>, title: (i) => i.slug, mobileCell: (i) => <span className="[overflow-wrap:anywhere]">{i.slug}</span> },
  {
    key: 'outcome', header: 'Outcome', mobile: 'status',
    cell: (i) => (i.outcome ? <Badge tone={OUTCOME_TONE[i.outcome] ?? 'neutral'} dot>{i.outcome[0].toUpperCase()}{i.outcome.slice(1)}</Badge> : <Badge tone="neutral">Open</Badge>),
  },
  { key: 'opened', header: 'Opened', numeric: true, mobile: 'fact', cell: (i) => formatDate(i.opened), mobileCell: (i) => `Opened ${formatDay(i.opened)}` },
  { key: 'closed', header: 'Closed', numeric: true, hideBelow: 'md', cell: (i) => (i.closed ? formatDate(i.closed) : '—') },
  { key: 'took', header: 'Took', numeric: true, mobile: 'fact', cell: (i) => (i.tookHours === null ? '—' : formatHours(i.tookHours)), mobileCell: (i) => (i.tookHours === null ? 'Still open' : `Took ${formatHours(i.tookHours)}`) },
  { key: 'documents', header: 'Documents', numeric: true, hideBelow: 'lg', cell: (i) => formatCount(i.documents) },
  { key: 'lessons', header: 'Lessons', numeric: true, hideBelow: 'lg', cell: (i) => formatCount(i.lessons) },
]);

/** The record: every initiative opened before the cutoff, newest first, ten to a page, paged by the gateway. */
function Initiatives({ r, team, filters, onPage, retry, busy }: { r: RecordRead; team: string | null; filters: RecordFilters; onPage: (page: string) => void; retry: () => void; busy: boolean }) {
  const rec = r.record.state === 'ok' ? r.record.data : null;
  return (
    <section aria-labelledby="slice-record" data-slice="record" className="flex min-w-0 flex-col gap-(--stack-gap) pt-4">
      <div>
        <h2 id="slice-record" className="t-section">The record</h2>
        <p className="t-small mt-1 text-ink-2">{summaryLine(r) ?? 'Every initiative opened before the cutoff'}, {asOfWords(r)}</p>
      </div>
      <DataTable
        caption="The record"
        noun="initiatives"
        rows={rec?.rows ?? []}
        columns={COLUMNS}
        rowKey={(i) => i.slug}
        rowHref={(i) => (team ? `/initiatives/${team}/${i.slug}` : `/initiatives?q=${encodeURIComponent(i.slug)}`)}
        manual
        total={rec?.total ?? 0}
        pageSize={PAGE_SIZE}
        pageSizes={[PAGE_SIZE]}
        error={rec ? undefined : 'The record of initiatives could not be read.'}
        onRetry={retry}
        retrying={busy}
        state={{ sort: '', dir: 'desc', page: filters.page }}
        onStateChange={(p) => { if (p.page) onPage(p.page); }}
        empty={{ title: 'No initiative yet', body: 'An initiative your agents open appears here, newest first.' }}
      />
    </section>
  );
}
