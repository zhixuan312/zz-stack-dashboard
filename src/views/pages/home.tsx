'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ComponentProps } from 'react';
import { ArrowRight, BookCheck, CalendarDays, Clock, RotateCw, Search } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { FeaturedMetric, type FeaturedFigure } from '@/components/patterns/featured-metric';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/console/panel';
import { formatPercent, plural } from '@/lib/format';
import { formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { PeriodFigure } from '@/lib/platform-shapes';
import type { Home } from '@/lib/work-shapes';
import {
  APPROVALS_LINE, FOOT, HALVES, MILESTONE, TILES, TILE_FORMAT, absent, asOfLine, covered, coverageLine, footOf, halvesOf,
  homeContext, lastWeekOf, pointLabel, since, tileOf, troubleOf, waitingOf, weekIn, weekOf, type HomeRead, type TileKey,
} from '@/views/home-context';
import { nextOf } from '@/views/initiatives-context';

/**
 * Home: the active team's last whole week, what waits on it, and what is open, read on the console's server and handed
 * here. The title is the gateway's sentence (the page's masthead draws it); under it the waiting strip, the paired
 * Featured metric of words added and approvals in the caller's name, the four tiles, and the lists. A part the gateway
 * could not read draws its own unavailable state and the rest stands; a read that failed or took longer than its bound
 * is the template's error state with Retry, which asks the server again.
 */
export function HomeView({ read }: { read: HomeRead }) {
  // The week the paired chart's cursor rests on, reported up from inside the Meridian: it is part of what the page shows.
  const [pointed, setPointed] = useState<number | null>(null);
  useShareView(homeContext(read, { index: pointed }));
  if (read.state !== 'ok') return <HomeTrouble state={read.state} />;
  return <Week home={read.home} team={read.team} onPoint={setPointed} />;
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function HomeAsOf({ read }: { read: HomeRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.home.meta)}</span>;
}

/**
 * A link on Home, prefetched when a person shows they mean it (the pointer on it, or focus) rather than when it is seen.
 * Home is the landing page: on a phone with the drawer closed it may prefetch nothing, and the waiting strip's link is
 * in view the moment it loads; on a desktop the rows prefetched on sight a page of destinations nobody had chosen.
 */
function Go({ href, onPointerEnter, onFocus, ...rest }: Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onPointerEnter={(e) => { router.prefetch(href); onPointerEnter?.(e); }}
      onFocus={(e) => { router.prefetch(href); onFocus?.(e); }}
    />
  );
}

/** How long the cursor has to rest on a week before the page takes it as what the person is pointing at. */
const POINT_SETTLE_MS = 150;

/**
 * Tells the page which week the Meridian points at, once the cursor rests there: a sweep across the chart passes every
 * week, and what the assistant needs is where the person stopped.
 */
function Pointed({ onChange }: { onChange: (index: number | null) => void }) {
  const { index } = useMeridianIndex();
  useEffect(() => {
    const t = setTimeout(() => onChange(index), POINT_SETTLE_MS);
    return () => clearTimeout(t);
  }, [index, onChange]);
  return null;
}

/** Ask on the paired figure: about the week the cursor points at, or about last week when it points at none. */
function AskWeek({ home }: { home: Home }) {
  const { index, dates } = useMeridianIndex();
  const at = index !== null ? dates[index] : null;
  return <AskAbout question={at ? `What happened in the week of ${formatDay(at)}, in words added and approvals in my name?` : `What stands out in last week, the ${weekOf(lastWeekOf(home))}, and why?`} />;
}

/**
 * A half's figure. A week with no value has no number: the card is handed none, and sets in the figure's place, at the
 * figure's height, why it has none, as the context says it: nothing recorded, too few, or unavailable. A missing week is
 * never drawn as zero.
 *
 * DELIBERATE: no `points`. A figure handed them reads the week the cursor points at, and with no change beside it the
 * card adds the pill's row only while a week is pointed at: every card below it moved by that row (96px on a phone, two
 * halves stacked) whenever the pointer crossed a chart, which on a phone left a pressed control under the foot instead.
 * The chart's own readout says the pointed week's value, and Ask asks about it, as Status's paired figure does.
 */
function half(home: Home, key: keyof typeof HALVES, weeks: PeriodFigure[] | null, dates: string[]): FeaturedFigure {
  const words = HALVES[key];
  const last = lastWeekOf(home);
  if (!weeks) return { kicker: words.kicker, value: null, missing: absent('unavailable', words.what), format: formatCount, caption: words.unread };
  const p = weekIn(weeks, last);
  const finding = key === 'words' ? (home.words.state === 'ok' ? home.words.data.finding : null) : (home.approvals.state === 'ok' ? home.approvals.data.finding : null);
  return {
    kicker: words.kicker,
    value: p?.figure.value ?? null,
    missing: !p || p.figure.why === 'no_data' ? words.none : absent(p.figure.why, words.what),
    format: formatCount,
    caption: key === 'words' && home.words.state === 'ok' ? coverageLine(home.words.data.coverage) : APPROVALS_LINE,
    finding: finding ? { text: finding.text } : undefined,
    children: (
      <ColumnChart
        height="fill"
        label={words.chart}
        dates={dates}
        running={weeks.length > 0 && !weeks.at(-1)!.window.complete}
        highlight={last.from}
        noData={words.none}
        format={formatCount}
        columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.figure.value }))}
      />
    ),
  };
}

/** The foot of the paired figure: the writing estimate with its pace, the run coverage and the peak, and how it is estimated. */
function Foot({ home }: { home: Home }) {
  const foot = footOf(home);
  return (
    <>
      <dl>
        <div>
          <dt title={FOOT.estimateHint}>{FOOT.estimate}</dt>
          <dd>{foot.estimate}{foot.pace ? <span className="ml-1.5 text-xs font-regular text-ink-2">{foot.pace}</span> : null}</dd>
        </div>
        <div><dt>{FOOT.coverage}</dt><dd>{foot.coverage}</dd></div>
        <div><dt>{FOOT.peak}</dt><dd>{foot.peak}</dd></div>
      </dl>
      <Go href="/record" className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent-ink">How it is estimated <ArrowRight className="size-3.5" /></Go>
    </>
  );
}

const TILE_ICON: Record<TileKey, React.ReactNode> = { closed: <BookCheck />, medianHoursToClose: <Clock />, searchesWithResults: <Search />, agentDays: <CalendarDays /> };

function Tiles({ home }: { home: Home }) {
  return (
    <Row split="tiles">
      {(Object.keys(TILES) as TileKey[]).map((k) => {
        const t = tileOf(k, home.tiles[k]);
        return <MetricTile key={k} label={TILES[k].label} hint={TILES[k].hint} icon={TILE_ICON[k]} value={t.value} format={TILE_FORMAT[k]} note={t.note} />;
      })}
    </Row>
  );
}

/** The waiting strip: absent when nothing waits; one document opens it, two or more open Approvals; an unread queue says so. */
function WaitingStrip({ home, team }: { home: Home; team: string | null }) {
  const w = waitingOf(home, team);
  if (w.kind === 'none') return null;
  if (w.kind === 'unavailable') return <Banner tone="neutral" title="What waits for approval could not be read">This is not an all-clear: the queue did not answer, so nothing is said about it.</Banner>;
  return (
    <Banner tone="warning" title={w.title} action={<Button asChild size="sm" variant="primary"><Go href={w.href}>{w.kind === 'one' ? 'Review' : 'Open Approvals'}</Go></Button>}>
      {w.detail}
    </Banner>
  );
}

/** A part that could not be read, inside its own card. */
const Unread = ({ what }: { what: string }) => <EmptyState kind="error" layout="inline" title={`${what} could not be read`} className="px-(--card-pad) py-4">The rest of the page stands; this part did not answer.</EmptyState>;

function Runs({ home }: { home: Home }) {
  if (home.runs.state !== 'ok') return <Panel title="Runs active now" flush><Unread what="The runs" /></Panel>;
  const { active, more, lastRunAt } = home.runs.data;
  const n = active.reduce((a, g) => a + g.runs.length, 0) + more;
  return (
    <Panel title="Runs active now" description={n ? `${formatCount(n)} ${plural(n, 'run')} of your agents` : 'What your agents are running'} flush>
      {n ? (
        <>
          <ul className="divide-y divide-line">
            {active.map((g) => (
              <li key={g.initiative ?? '—'} className="flex flex-col gap-1 px-(--card-pad) py-3">
                <span className="text-sm font-medium [overflow-wrap:anywhere] text-ink">{g.initiative ?? 'No initiative'}</span>
                {g.runs.map((r) => <span key={`${r.skill}@${r.startedAt}`} className="t-caption">{r.skill}, started {since(r.startedAt, home.meta)}</span>)}
              </li>
            ))}
          </ul>
          {more ? <Go href="/runs" className="flex items-center gap-1.5 border-t border-line px-(--card-pad) py-3 text-sm font-medium text-ink hover:bg-fill-hover">{formatCount(more)} more {plural(more, 'run')} on Runs <ArrowRight className="size-3.5" /></Go> : null}
        </>
      ) : (
        <p data-last-run className="t-small px-(--card-pad) py-4 text-ink-2">{lastRunAt ? `No run is active now. The last ended ${since(lastRunAt, home.meta)}.` : 'No run is active now, and none is recorded yet.'}</p>
      )}
    </Panel>
  );
}

function Milestones({ home }: { home: Home }) {
  if (home.milestones.state !== 'ok') return <Panel title="Next milestones" flush><Unread what="The milestones" /></Panel>;
  const list = home.milestones.data;
  return (
    <Panel title="Next milestones" description="The next round number in each count, and how far there is to go">
      <BarList
        label="Next milestones"
        total={1}
        format={(n) => formatPercent(n, 0)}
        items={list.map((m) => ({ key: m.count, label: MILESTONE[m.count], meta: `${formatCount(m.next - m.value)} to go to ${formatCount(m.next)}`, value: covered(m) }))}
      />
    </Panel>
  );
}

const STATE_TONE: Record<string, 'warning' | 'neutral'> = { waiting: 'warning', open: 'neutral', quiet: 'neutral' };

function OpenWork({ home, team }: { home: Home; team: string | null }) {
  if (home.openWork.state !== 'ok') return <Panel title="Open work" flush><Unread what="The open work" /></Panel>;
  const { rows, quiet, total } = home.openWork.data;
  return (
    <Panel title="Open work" description={total ? `${formatCount(total)} open ${plural(total, 'initiative')}, waiting first` : 'What your team has open'} flush>
      {total ? (
        <>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.slug}>
                <Go href={team ? `/initiatives/${team}/${r.slug}` : '/initiatives'} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-1 px-(--card-pad) py-3 transition-colors hover:bg-fill-hover">
                  <span className="text-sm font-medium [overflow-wrap:anywhere] text-ink">{r.slug}</span>
                  <Badge tone={STATE_TONE[r.state] ?? 'neutral'}>{r.state === 'waiting' ? 'Waiting' : r.state === 'quiet' ? 'Quiet' : 'Open'}</Badge>
                  <span data-next-move className="t-caption" title={r.nextMove?.why}>{r.flow ? nextOf(r) : 'No flow'}</span>
                  <span className="t-caption justify-self-end whitespace-nowrap">{r.gates.of ? `${r.gates.passed} of ${r.gates.of} gates` : 'No gates'}</span>
                </Go>
              </li>
            ))}
            {quiet ? (
              <li>
                <Go href="/initiatives?state=quiet" className="flex px-(--card-pad) py-3 text-sm text-ink-2 hover:bg-fill-hover">{formatCount(quiet)} quiet {plural(quiet, 'initiative')}, untouched for 14 days or more</Go>
              </li>
            ) : null}
          </ul>
          <Go href="/initiatives" className="flex items-center gap-1.5 border-t border-line px-(--card-pad) py-3 text-sm font-medium text-ink hover:bg-fill-hover">All {formatCount(total)} on Initiatives <ArrowRight className="size-3.5" /></Go>
        </>
      ) : <EmptyState layout="inline" title="Nothing is open" className="px-(--card-pad) py-4">An initiative opened by your agents appears here, waiting work first.</EmptyState>}
    </Panel>
  );
}

const OUTCOME_TONE: Record<string, 'positive' | 'neutral'> = { accepted: 'positive', delivered: 'positive', abandoned: 'neutral' };

function ClosedLastWeek({ home, team }: { home: Home; team: string | null }) {
  const week = weekOf(lastWeekOf(home));
  if (home.closedLastWeek.state !== 'ok') return <Panel title="Closed last week" flush><Unread what="Last week's closures" /></Panel>;
  const closed = home.closedLastWeek.data;
  return (
    <Panel title="Closed last week" description={`The ${week}`} flush>
      {closed.length ? (
        <ul className="divide-y divide-line">
          {closed.map((c) => (
            <li key={c.slug}>
              <Go href={team ? `/initiatives/${team}/${c.slug}` : '/initiatives'} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 px-(--card-pad) py-3 hover:bg-fill-hover">
                <span className="text-sm font-medium [overflow-wrap:anywhere] text-ink">{c.slug}</span>
                <Badge tone={OUTCOME_TONE[c.outcome] ?? 'neutral'} dot>{c.outcome[0].toUpperCase()}{c.outcome.slice(1)}</Badge>
                <span className="t-caption">Closed {formatDay(c.closedAt)}</span>
              </Go>
            </li>
          ))}
        </ul>
      ) : <EmptyState layout="inline" title="Nothing closed last week" className="px-(--card-pad) py-4">A closure lands here in the week it is recorded.</EmptyState>}
    </Panel>
  );
}

function Week({ home, team, onPoint }: { home: Home; team: string | null; onPoint: (index: number | null) => void }) {
  const { words, approvals, dates } = halvesOf(home);
  return (
    <Meridian dates={dates}>
      <Pointed onChange={onPoint} />
      <Stack>
        <WaitingStrip home={home} team={team} />
        <FeaturedMetric
          {...half(home, 'words', words, dates)}
          peer={half(home, 'approvals', approvals, dates)}
          pointLabel={pointLabel}
          actions={<AskWeek home={home} />}
          foot={<Foot home={home} />}
        />
        <Tiles home={home} />
        <Row split="2/3">
          <OpenWork home={home} team={team} />
          <Runs home={home} />
        </Row>
        <Row split="1/2">
          <Milestones home={home} />
          <ClosedLastWeek home={home} team={team} />
        </Row>
        <Go data-record-line href="/record" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink hover:text-accent-ink">
          Everything your team has recorded, by quarter and year, is on Record <ArrowRight className="size-3.5" />
        </Go>
      </Stack>
    </Meridian>
  );
}

function HomeTrouble({ state }: { state: Exclude<HomeRead['state'], 'ok'> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = troubleOf(state);
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
