'use client';

import { Panel } from '@/console/panel';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCount, formatPercent } from '@/lib/format';
import type { EvalFinding, PluginEval } from '@/lib/api-shapes';

type Run = NonNullable<PluginEval['run']>;

/** A quiet sub-panel state, plain text rather than a mascot — see PluginEvalOverview.tsx's own
 *  `Quiet` for why the illustrated `EmptyState` is not reached for every waiting section. */
function Quiet({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-ink-3">{description}</p>
    </div>
  );
}

/** A rate with its own denominator beside it (FR-9) — never a bare percentage, because a
 *  coverage figure with no count behind it cannot be told apart from one measured on three
 *  runs. */
function Rate({ label, n, of }: { label: string; n: number | null; of: number | null }) {
  const fraction = n !== null && of !== null && of > 0 ? n / of : null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="t-eyebrow text-ink-3">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-ink">{formatPercent(fraction)}</span>
      <span className="text-2xs text-ink-3">
        {n === null || of === null ? 'not measured' : `${formatCount(n)} of ${formatCount(of)}`}
      </span>
    </div>
  );
}

/** Usage: the real production evidence this run's score was built from — every rate here
 *  carries the denominator it was measured against, per this task's own console rule. */
export function EvalUsage({ run }: { run: Run | null }) {
  if (!run || !run.coverage) {
    return <Panel title="Usage"><Quiet title="No evidence yet" description="OBSERVE has not built a production snapshot for this subject." /></Panel>;
  }
  const { usableRunCount, totalRunCount, surfaceObserved, surfaceTotal } = run.coverage;
  return (
    <Panel title="Usage" description="what the evidence behind this run actually covers">
      <div className="flex flex-wrap gap-8">
        <Rate label="Usable runs" n={usableRunCount} of={totalRunCount} />
        <Rate label="Observable surface" n={surfaceObserved} of={surfaceTotal} />
      </div>
    </Panel>
  );
}

const OWNER_LABEL: Record<string, string> = {
  plugin: 'plugin', dependency: 'dependency', platform: 'platform',
  environment: 'environment', user_input: 'user input', unknown: 'unknown',
};

function FindingTable({ rows, emptyLabel }: { rows: EvalFinding[]; emptyLabel: string }) {
  if (!rows.length) return <p className="py-2 text-sm text-ink-3">{emptyLabel}</p>;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Pattern</TableHeader>
          <TableHeader>Owner</TableHeader>
          <TableHeader>Decision</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="max-w-[420px] text-sm">{f.pattern}</TableCell>
            <TableCell>
              <Badge tone={f.ownerKind === 'plugin' ? 'accent' : 'neutral'}>
                {OWNER_LABEL[f.ownerKind ?? 'unknown']}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-ink-2">{f.decision}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Learning: what this run found (FR-12) — every defect, strength and unknown, classified by
 *  who owns it. Only a `plugin`-owned defect can seed a candidate (FR-34), so ownership is the
 *  one column that decides what happens next, not decoration. */
export function EvalLearning({ findings }: { findings: PluginEval['findings'] | null }) {
  if (!findings) {
    return <Panel title="Learning"><Quiet title="Nothing recorded" description="No completed run to read findings from." /></Panel>;
  }
  const total = findings.strengths.length + findings.defects.length + findings.unknowns.length;
  if (total === 0) {
    return <Panel title="Learning"><Quiet title="No finding recorded" description="This run produced no strength, defect or unknown yet." /></Panel>;
  }
  return (
    <Panel title="Learning" description={`${total} finding${total === 1 ? '' : 's'}`}>
      <CompositionBar
        label="Findings by kind"
        parts={[
          { label: 'Strengths', value: findings.strengths.length, color: 'positive' },
          { label: 'Defects', value: findings.defects.length, color: 'warning' },
          { label: 'Unknowns', value: findings.unknowns.length, color: 'neutral' },
        ]}
      />
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-3">Defects</p>
          <FindingTable rows={findings.defects} emptyLabel="No defect is recorded against this run." />
        </div>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-3">Unknowns</p>
          <FindingTable rows={findings.unknowns} emptyLabel="No unknown is recorded against this run." />
        </div>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-3">Strengths</p>
          <FindingTable rows={findings.strengths} emptyLabel="No strength is recorded against this run." />
        </div>
      </div>
    </Panel>
  );
}

/** The five evidence panels at once, for the state every plugin starts in: no completed run, so
 *  no guardrail, dimension, snapshot, finding or candidate to show.
 *
 *  DELIBERATE: one panel, not five. Five full-width cards each saying "nothing yet" is a screen
 *  of chrome around five sentences, and it pushes the skills table — the one thing on the page
 *  with content — below the fold. The moment any of the five has something, the page goes back
 *  to drawing them separately. */
export function EvalNotYet({ evaluationOnly }: { evaluationOnly: boolean }) {
  const parts: [string, string][] = [
    ['Health', 'No completed run to read guardrails from.'],
    ['Quality', 'No completed run to read dimensions from.'],
    ['Usage', 'OBSERVE has not built a production snapshot for this subject.'],
    ['Learning', 'No strength, defect or unknown recorded yet.'],
    ['Evolution', evaluationOnly
      ? 'A third-party plugin may still receive a proposal, once a plugin-owned finding seeds one.'
      : 'No finding has started an improvement run.'],
  ];
  return (
    <Panel title="Evaluation evidence" description="no completed run yet" flush>
      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {parts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1.5 border-line px-5 py-4 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0 sm:[&:nth-child(n+3)]:border-t xl:[&:nth-child(n+3)]:border-t-0 xl:[&:not(:first-child)]:border-l">
            <dt className="t-eyebrow">{k}</dt>
            <dd className="text-xs leading-relaxed text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
