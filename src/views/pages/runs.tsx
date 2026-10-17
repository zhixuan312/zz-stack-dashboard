'use client';

import { useMemo, useState } from 'react';
import { HardDrive, RotateCw, Timer, Trophy } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Busy, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { failureOf } from '@/console/query';
import { BY_SKILL_TITLE, SkillWorkPanel } from '@/console/skill-work';
import { useDataClock } from '@/lib/api';
import type { RunRow, Runs } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import {
  PAGE_SIZE, RUNS_DEFAULTS, TILES, outputOf, pageOf, runsContext, runsPath, runsTrouble, stateOf, type RunsFilters, type RunsRead,
} from '@/views/runs-context';
import { useServed } from '@/views/use-served';

/** A byte count as the tiles show it. */
const kb = (bytes: number): string => formatKb(bytes / 1024);

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the runs and the
 * browser asks for nothing more, then the browser's own once the runs collection changes or a Retry asks. A new skill
 * or page of recent runs is read by the console's server as the navigation renders the page again, and meanwhile the
 * runs drawn stay, marked busy. A failure is stated only when there is nothing to draw.
 */
function useRuns(served: RunsRead | null) {
  const [f, set] = useQueryState(RUNS_DEFAULTS);
  const filters = useMemo((): RunsFilters => ({ skill: f.skill, page: f.page }), [f.skill, f.page]);
  const path = runsPath(filters);
  const mine = served?.path === path ? served : null;
  const { q, follow } = useServed<Runs>(path, mine !== null, mine === null && served !== null);
  const fresh = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  // The runs last drawn, kept as React keeps a value derived from the previous render: set while rendering, once.
  const [last, setLast] = useState<Runs | undefined>(fresh);
  if (fresh && fresh !== last) setLast(fresh);
  const failed = failureOf(q);
  const trouble = fresh ? null : failed ?? (mine && mine.state !== 'ok' && !q.isFetching ? runsTrouble(mine) : null);
  const data = fresh ?? (trouble ? undefined : last);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  const updatedAt = q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null;
  return { data, stale: !fresh && data !== undefined, trouble, retry, filters, set, updatedAt };
}

/** Runs' body on its way: the three tiles, the runs by skill, and the recent runs. COUPLED: `app/(dash)/runs/loading.tsx` draws the same rows. */
export function RunsSkeleton() {
  return (
    <>
      <TilesSkeleton count={3} />
      <Skeleton className="h-96 rounded-xl" />
      <TableSkeleton rows={10} filters={false} />
    </>
  );
}

/** The masthead's as-of line: the cutoff of the runs drawn, nothing while there are none. */
export function RunsAsOf({ served }: { served: RunsRead | null }) {
  const { data } = useRuns(served);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}

/**
 * The masthead's skill control, which narrows the whole page: the tiles, the runs by skill and the recent runs are all
 * the gateway's for that skill. It is usable before the runs have arrived, offering the skill the address names; once
 * they have, it offers every skill they hold. Nothing is read here: the read is the server's.
 */
export function RunsActions({ served }: { served: RunsRead | null }) {
  return served ? <ServedActions served={served} /> : <SkillControl />;
}

function ServedActions({ served }: { served: RunsRead }) {
  const { data } = useRuns(served);
  return <SkillControl skills={data?.bySkill.state === 'ok' ? data.bySkill.data.rows.map((k) => k.skill) : []} />;
}

function SkillControl({ skills = [] }: { skills?: string[] }) {
  const [f, set] = useQueryState(RUNS_DEFAULTS);
  const names = f.skill !== 'all' && !skills.includes(f.skill) ? [f.skill, ...skills] : skills;
  return (
    <Select
      aria-label="Skill"
      className="w-56 max-w-full"
      value={f.skill}
      onValueChange={(skill) => set({ skill, page: '1' })}
      options={[{ value: 'all', label: 'Every skill' }, ...names.map((s) => ({ value: s, label: s }))]}
    />
  );
}

/**
 * Runs: every run the active team recorded since its first, or of the skill the address names, by the skill that drove
 * it and lately, read on the console's server and handed here. A part the gateway could not read draws its own
 * unavailable state and the rest stands; a read that failed or took longer than its bound is the error state with
 * Retry, which reads again in the browser.
 */
export function RunsView({ served }: { served: RunsRead }) {
  useLive(['runs']);
  const { data, stale, trouble, retry, filters, set, updatedAt } = useRuns(served);
  const now = useDataClock();
  useShareView(data && !stale
    ? runsContext(data, { filters, updatedAt, now })
    : pendingContext({ view: 'runs', title: 'Runs', address: '/runs', scope: 'your active team\'s runs' }, trouble));
  if (!data) {
    if (!trouble) return <Busy name="runs"><RunsSkeleton /></Busy>;
    return (
      <Card>
        <EmptyState kind="error" title="The runs did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={retry}>Retry</Button>}>
          {trouble}
        </EmptyState>
      </Card>
    );
  }
  const one = filters.skill !== 'all';
  return (
    <Stack aria-busy={stale || undefined} className={stale ? 'opacity-60 transition-opacity' : undefined}>
      <Tiles r={data} />
      <div data-protagonist={BY_SKILL_TITLE} className="contents">
        <SkillWorkPanel
          skills={data.bySkill.state === 'ok' ? data.bySkill.data.rows : []}
          oneCall={data.coverage.oneCall}
          error={data.bySkill.state === 'unavailable' ? data.bySkill.reason : undefined}
          onRetry={retry}
          of={one ? filters.skill : undefined}
          ask={<AskAbout question={one ? `What do the runs of ${filters.skill} show, and what is their observed output?` : 'Which skill\'s runs answer the most observed output, and how long does a typical run of it take?'} />}
        />
      </div>
      <Recent r={data} filters={filters} onPage={(page) => set({ page })} retry={retry} />
    </Stack>
  );
}

/** The three tiles: the runs since the first, the observed output per run with the runs that measured none, the largest run. */
function Tiles({ r }: { r: Runs }) {
  const { runs, outputPerRun, largest } = r.tiles;
  return (
    <Row split="tiles" data-figures="read">
      <MetricTile label={TILES.runs.label} hint={TILES.runs.definition} icon={<Timer />} value={runs.value ?? 'Unavailable'}
                  note={r.since ? `Since ${formatDate(r.since)}` : 'None recorded yet'} />
      {/* Null is not zero: a run nothing measured has answered nothing anyone counted. Bytes go in as a number with their
          formatter, as every other tile's figure does: a formatted string is a word value, which wraps on a phone. */}
      <MetricTile label={TILES.outputPerRun.label} hint={TILES.outputPerRun.definition} icon={<HardDrive />} value={outputPerRun.value ?? 'Not measured'} format={kb}
                  note={outputPerRun.unmeasured ? `${formatCount(outputPerRun.unmeasured)} not measured` : 'Every run measured'} />
      <MetricTile label={TILES.largest.label} hint={TILES.largest.definition} icon={<Trophy />} value={largest?.bytes ?? 'None measured'} format={kb}
                  note={largest ? largest.skill : 'No run measured'} />
    </Row>
  );
}

const muted = (text: string) => <span className="text-ink-3">{text}</span>;

/** A run's state as the gateway gave it: active while its last call is recent, the last call's time, or one call. */
const State = ({ r }: { r: RunRow }) => (r.state === 'active' ? <Badge tone="accent" dot>{stateOf(r)}</Badge> : <span className="text-ink-2">{stateOf(r)}</span>);

/** The recent runs' columns, in the gateway's order: newest last call first, paged where they are read. */
const RECENT: Column<RunRow>[] = aligned([
  { key: 'skill', header: 'Skill', grow: true, mobile: 'title', title: (r) => r.skill, cell: (r) => <span className="block truncate font-medium text-ink" title={r.skill}>{r.skill}</span>, mobileCell: (r) => <span className="[overflow-wrap:anywhere]">{r.skill}</span> },
  {
    key: 'initiative', header: 'Initiative', hideBelow: 'md', mobile: 'fact', title: (r) => r.initiative ?? 'No initiative',
    cell: (r) => (r.initiative ? <span className="block truncate" title={r.initiative}>{r.initiative}</span> : muted('No initiative')),
    mobileCell: (r) => <span className="[overflow-wrap:anywhere]">{r.initiative ?? 'No initiative'}</span>,
  },
  { key: 'started', header: 'Started', numeric: true, hideBelow: 'lg', cell: (r) => formatDateTime(r.startedAt) },
  { key: 'length', header: 'Length', numeric: true, hideBelow: 'lg', cell: (r) => (r.calls > 1 ? formatSeconds(r.lengthMs / 1000) : muted('—')) },
  { key: 'calls', header: 'Calls', numeric: true, hideBelow: 'md', cell: (r) => formatCount(r.calls) },
  { key: 'output', header: 'Output', numeric: true, mobile: 'fact', cell: (r) => (r.bytes === null ? muted(outputOf(null)) : outputOf(r.bytes)), mobileCell: (r) => (r.bytes === null ? 'Output not measured' : `${outputOf(r.bytes)} output`) },
  { key: 'state', header: 'State', mobile: 'status', cell: (r) => <State r={r} /> },
]);

/** The recent runs: newest last call first, ten to a page, paged by the gateway. */
function Recent({ r, filters, onPage, retry }: { r: Runs; filters: RunsFilters; onPage: (page: string) => void; retry: () => void }) {
  const recent = r.recent.state === 'ok' ? r.recent.data : null;
  const first = (pageOf(filters) - 1) * PAGE_SIZE;
  const shown = recent?.rows.length ? `Newest last call first · ${formatCount(first + 1)} to ${formatCount(first + recent.rows.length)} of ${formatCount(recent.total)}` : 'Newest last call first';
  return (
    <DataTable
      caption="Recent runs"
      noun="recent runs"
      title="Recent runs"
      description={shown}
      rows={recent?.rows ?? []}
      columns={RECENT}
      rowKey={(x) => x.id}
      manual
      total={recent?.total ?? 0}
      pageSize={PAGE_SIZE}
      pageSizes={[PAGE_SIZE]}
      error={r.recent.state === 'unavailable' ? r.recent.reason : undefined}
      onRetry={retry}
      state={{ sort: '', dir: 'desc', page: filters.page }}
      onStateChange={(p) => { if (p.page) onPage(p.page); }}
      empty={{ title: filters.skill === 'all' ? 'No run recorded yet' : `No run of ${filters.skill} recorded`, body: `A run appears here once your team's agents follow a skill. ${formatCount(r.tiles.runs.value ?? 0)} ${plural(r.tiles.runs.value ?? 0, 'run')} so far.` }}
    />
  );
}
