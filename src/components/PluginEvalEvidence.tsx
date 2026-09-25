'use client';

import { Panel } from '@/components/Panel';
import { CompositionBar } from '@/components/charts/CompositionBar';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatCount, formatPercent } from '@/lib/format';
import type { EvalFinding, PluginEval } from '@/lib/api-shapes';

type Run = NonNullable<PluginEval['run']>;

/** A quiet sub-panel state, plain text rather than a mascot — see PluginEvalOverview.tsx's own
 *  `Quiet` for why the illustrated `EmptyState` is not reached for every waiting section. */
function Quiet({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[13px] text-ink-faint">{description}</p>
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
      <span className="t-eyebrow text-ink-faint">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-ink">{formatPercent(fraction)}</span>
      <span className="text-[11px] text-ink-faint">
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
    <Panel title="Usage" aside="what the evidence behind this run actually covers">
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
  if (!rows.length) return <p className="py-2 text-sm text-ink-faint">{emptyLabel}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pattern</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Decision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="max-w-[420px] text-sm">{f.pattern}</TableCell>
            <TableCell>
              <Badge variant={f.ownerKind === 'plugin' ? 'accent' : 'neutral'}>
                {OWNER_LABEL[f.ownerKind ?? 'unknown']}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-ink-soft">{f.decision}</TableCell>
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
    <Panel title="Learning" aside={`${total} finding${total === 1 ? '' : 's'}`}>
      <CompositionBar
        slices={[
          { key: 'strength', label: 'Strengths', value: findings.strengths.length, tint: 'accent' },
          { key: 'defect', label: 'Defects', value: findings.defects.length, tint: 'pink' },
          { key: 'unknown', label: 'Unknowns', value: findings.unknowns.length, tint: 'lavender' },
        ]}
      />
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-faint">Defects</p>
          <FindingTable rows={findings.defects} emptyLabel="No defect is recorded against this run." />
        </div>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-faint">Unknowns</p>
          <FindingTable rows={findings.unknowns} emptyLabel="No unknown is recorded against this run." />
        </div>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-faint">Strengths</p>
          <FindingTable rows={findings.strengths} emptyLabel="No strength is recorded against this run." />
        </div>
      </div>
    </Panel>
  );
}
