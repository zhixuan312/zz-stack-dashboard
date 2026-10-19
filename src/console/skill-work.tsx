'use client';

import type { ReactNode } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { aligned } from '@/console/columns';
import type { SkillRunRow } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { refusedOf, timedOf } from '@/views/runs-context';
import { perRunOf } from '@/views/runs-figures';

/** The card's title, and the page's protagonist: the card the page's Ask sits on. COUPLED: the Runs README's `Protagonist:`. */
export const BY_SKILL_TITLE = 'By skill';

const muted = (text: string) => <span className="text-ink-3">{text}</span>;

/**
 * Each skill's runs as the gateway answered them, in its order: the most observed output per run first, a skill nothing
 * measured last. The browser ranks, counts and times nothing here. A typical length is the gateway's median over a
 * skill's runs of more than one call, and the cell says how many runs it rests on whenever that is not all of them.
 * Output is the response bytes of a run's own calls, observed output, never what a model read.
 */
const COLUMNS: Column<SkillRunRow>[] = aligned([
  { key: 'skill', header: 'Skill', grow: true, mobile: 'title', title: (k) => k.skill, cell: (k) => <span className="block font-medium whitespace-normal text-ink [overflow-wrap:anywhere]">{k.skill}</span> },
  { key: 'runs', header: 'Runs', numeric: true, mobile: 'fact', cell: (k) => formatCount(k.runs), mobileCell: (k) => `${formatCount(k.runs)} ${plural(k.runs, 'run')}` },
  { key: 'calls', header: 'Calls per run', numeric: true, hideBelow: 'lg', cell: (k) => perRunOf(k.callsPerRun) },
  // Ink, not a red pill: nearly every skill refuses something, and red on every row says nothing.
  { key: 'refused', header: 'Refused', numeric: true, hideBelow: 'lg', cell: (k) => refusedOf(k.shareRefused) ?? muted('—') },
  { key: 'output', header: 'Output per run', numeric: true, mobile: 'fact', cell: (k) => (k.outputPerRun === null ? muted('Not measured') : formatKb(k.outputPerRun / 1024)), mobileCell: (k) => (k.outputPerRun === null ? 'Output not measured' : `${formatKb(k.outputPerRun / 1024)} a run`) },
  {
    key: 'typical', header: 'Typical length', numeric: true, hideBelow: 'md',
    cell: (k) => (
      <span className="inline-flex flex-col items-end">
        <span className={k.typicalMs === null ? 'text-ink-3' : undefined}>{formatSeconds(k.typicalMs === null ? null : k.typicalMs / 1000)}</span>
        {timedOf(k) ? <span className="t-caption">{timedOf(k)}</span> : null}
      </span>
    ),
  },
]);

/**
 * The runs by skill, sorted by observed output per run as the gateway sorted them, ten a page. `oneCall` is the
 * gateway's count of the runs of one call, which have no span and so no length: said under the table when there are
 * any. `ask` is the page's Ask about, drawn in the card's head. `of` is the skill the page is narrowed to, if it is.
 */
export function SkillWorkPanel({ skills, oneCall, error, onRetry, retrying, ask, of }: { skills: SkillRunRow[]; oneCall: number; error?: string; onRetry?: () => void; retrying?: boolean; ask?: ReactNode; of?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        caption="Runs by skill"
        noun="skills"
        title={BY_SKILL_TITLE}
        description={`Most observed output per run first · ${formatCount(skills.length)} ${plural(skills.length, 'skill')}`}
        actions={ask}
        rows={skills}
        columns={COLUMNS}
        rowKey={(k) => k.skill}
        pageSize={10}
        pageSizes={[10]}
        error={error}
        onRetry={onRetry}
        retrying={retrying}
        empty={of
          ? { title: `No run of ${of} recorded`, body: 'It appears here once your team\'s agents follow it and it makes a call.' }
          : { title: 'Your team has run no skill yet', body: 'A skill your agents follow appears here once it has made a call.' }}
      />
      {!error && oneCall > 0 ? (
        <p className="t-caption px-1">
          A run&rsquo;s length is the span between its first and last call, so the {formatCount(oneCall)} single-call {plural(oneCall, 'run')} have no span to report. Lengths are taken over the rest.
        </p>
      ) : null}
    </div>
  );
}
