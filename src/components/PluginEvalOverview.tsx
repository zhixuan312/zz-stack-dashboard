'use client';

import { Panel } from '@/components/Panel';
import { CompositionBar } from '@/components/charts/CompositionBar';
import {
  Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { formatCount, formatPercent } from '@/lib/format';
import type { DimensionScore, GuardrailScore, PluginEval } from '@/lib/api-shapes';

type Run = NonNullable<PluginEval['run']>;

const STATUS_TONE: Record<string, 'sage' | 'amber' | 'neutral'> = {
  established: 'sage', provisional: 'amber', not_established: 'neutral',
};

/** A quiet sub-panel state, plain text rather than a mascot — the design system reserves the
 *  illustrated `EmptyState` for a whole page or a whole feature having nothing at all (see
 *  `checks/mascot-assignment.ts`'s own closed budget); a section still waiting on an earlier
 *  stage of the same run is the same shape as "No round has reached a verdict for this plugin"
 *  already used to be, one paragraph, not a second mascot. */
function Quiet({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[13px] text-ink-faint">{description}</p>
    </div>
  );
}

/**
 * FR-55's own order: overall score, its status, and the protocol version it was measured
 * against, before anything else on the page. `scoreStatus === 'not_established'` never shows a
 * number beside the status word — even where `overallScore` happens to be non-null, which
 * `scoreRun` (zz-stack) never actually produces, this reads the status rather than the number
 * so the console rule holds by construction, not by the scorer's own accident.
 *
 * `run.runStatus !== 'completed'` is a different quiet state from "not established": a
 * pending/running/failed/cancelled run has no result columns at all, and saying so is not the
 * same claim as a completed run whose evidence fell short.
 */
export function EvalHeadline({ pluginEval }: { pluginEval: PluginEval }) {
  if (!pluginEval.found) {
    return (
      <Panel title="Overall fit for purpose">
        <Quiet title={`'${pluginEval.plugin}' is not registered`}
          description="Nothing has called plugin_register or profiled it yet." />
      </Panel>
    );
  }
  if (!pluginEval.subjectVersion) {
    return (
      <Panel title="Overall fit for purpose" aside={pluginEval.ownershipMode === 'evaluation_only' ? 'third-party' : undefined}>
        <Quiet title="Not evaluated yet"
          description="Registered, but OBSERVE has never profiled a subject version for it." />
      </Panel>
    );
  }
  const run = pluginEval.run;
  return (
    <Panel
      title="Overall fit for purpose"
      aside={`subject v${pluginEval.subjectVersion.declaredVersion}${pluginEval.ownershipMode === 'evaluation_only' ? ' · third-party' : ''}`}
    >
      {!run ? (
        <Quiet title="Not evaluated yet"
          description="A subject version exists, but no EVALUATE run has scored it." />
      ) : run.runStatus !== 'completed' ? (
        <Quiet title={`Run ${run.runStatus}`}
          description="This run has not finished, so it carries no score yet." />
      ) : (
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="t-eyebrow text-ink-faint">Score</p>
            {run.scoreStatus === 'not_established' || run.overallScore === null ? (
              <p className="t-stat text-ink-faint">{run.scoreStatus ?? 'not_established'}</p>
            ) : (
              <p className="t-stat text-ink">
                {run.overallScore.toFixed(2)}
                <span className="text-[0.4em] font-normal text-ink-faint"> / 10</span>
              </p>
            )}
          </div>
          <div>
            <p className="t-eyebrow text-ink-faint">Status</p>
            <Badge variant={STATUS_TONE[run.scoreStatus ?? 'not_established']} dot>
              {run.scoreStatus ?? 'not_established'}
            </Badge>
          </div>
          <div>
            <p className="t-eyebrow text-ink-faint">Protocol</p>
            <p className="text-sm font-medium text-ink">
              <span className="font-mono text-xs">{run.protocol.key}</span> v{run.protocol.version}
            </p>
          </div>
          <div>
            <p className="t-eyebrow text-ink-faint">Guardrails</p>
            <Badge variant={run.guardrailStatus === 'pass' ? 'sage' : run.guardrailStatus === 'fail' ? 'rose' : 'neutral'}>
              {run.guardrailStatus ?? 'not_established'}
            </Badge>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Health: whether this run's non-compensatory guardrails held (FR-23) — the number stays for
 *  diagnosis, but a fail never disappears into the average above. */
export function EvalHealth({ run }: { run: Run | null }) {
  if (!run || run.runStatus !== 'completed') {
    return <Panel title="Health"><Quiet title="Nothing to check" description="No completed run to read guardrails from." /></Panel>;
  }
  return (
    <Panel title="Health" aside={`${run.guardrails.length} guardrail${run.guardrails.length === 1 ? '' : 's'}`}>
      {run.guardrails.length === 0 ? (
        <p className="py-2 text-sm text-ink-faint">This protocol declares no critical guardrail.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guardrail</TableHead>
              <TableHead>Value vs threshold</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.guardrails.map((g: GuardrailScore) => (
              <TableRow key={g.key}>
                <TableCell className="font-mono text-xs">{g.key}</TableCell>
                <TableCell className="tabular-nums text-xs">
                  {g.value === null ? '—' : g.value.toFixed(4)} / {g.threshold.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={g.status === 'pass' ? 'sage' : g.status === 'fail' ? 'rose' : 'neutral'}>{g.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

/**
 * Quality: the six canonical dimensions (FR-19), each dimension's share of the overall score as
 * a composition bar — the console's own "share-of-total bars" rule, made literal: a dimension's
 * slice IS its weighted contribution to `overall_score`, so the bar and the number agree by
 * construction rather than by a second computation. Every dimension not applicable says why
 * instead of drawing a silent zero-width slice.
 *
 * No horizontal scroll on the table below (house rule — nothing in the console scrolls
 * sideways): five columns fit, and `Kind` is the one that drops first on a narrow card.
 */
export function EvalQuality({ run }: { run: Run | null }) {
  if (!run || run.runStatus !== 'completed') {
    return <Panel title="Quality"><Quiet title="Nothing to score" description="No completed run to read dimensions from." /></Panel>;
  }
  const applicable = run.dimensions.filter((d) => d.applicable);
  const notApplicable = run.dimensions.filter((d) => !d.applicable);
  return (
    <Panel title="Quality" aside={`${applicable.length}/${run.dimensions.length} dimension(s) applicable`}>
      <CompositionBar
        slices={applicable.map((d) => ({
          key: d.key, label: d.key,
          // The composed bar reads in the same units as overall_score's own formula
          // (`10 × Σ weight × score`) — a slice's height is its point contribution, not a raw
          // fraction of 1, so ten slices at their measured scores sum to the headline number.
          value: d.score === null ? 0 : Math.round(d.weight * d.score * 1000),
        }))}
        format={(v) => (v / 100).toFixed(2)}
      />
      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Dimension</TableHead>
            <TableHead hideBelow="md">Kind</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Measures</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {run.dimensions.map((d: DimensionScore) => (
            <TableRow key={d.key}>
              <TableCell className="font-mono text-xs">{d.key}{d.required ? ' *' : ''}</TableCell>
              <TableCell hideBelow="md" className="text-xs text-ink-soft">{d.canonicalKind}</TableCell>
              <TableCell className="tabular-nums">
                {d.applicable
                  ? (d.score === null ? <span className="text-ink-faint">not scored</span> : d.score.toFixed(4))
                  : <span className="text-ink-faint" title={d.notApplicableReason ?? undefined}>not applicable</span>}
              </TableCell>
              <TableCell className="tabular-nums text-xs">{formatPercent(d.weight)}</TableCell>
              <TableCell className="tabular-nums text-xs">
                {formatCount(d.measuresScored)} of {formatCount(d.measuresTotal)}
              </TableCell>
            </TableRow>
          ))}
          {run.dimensions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-ink-faint">This protocol declares no dimension.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {notApplicable.length ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          {notApplicable.map((d) => `${d.key}: ${d.notApplicableReason ?? 'no reason recorded'}`).join(' · ')}
        </p>
      ) : null}
    </Panel>
  );
}
