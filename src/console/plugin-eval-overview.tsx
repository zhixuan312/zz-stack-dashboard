'use client';

import { SCORE_OUT_OF, STANDING_TONE } from '@/console/eval-score';
import { Panel } from '@/console/panel';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPercent, plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import type { DimensionScore, PluginEval, PluginEvalFound } from '@/lib/api-shapes';
import type { PluginScore } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { contributionsOf, outOfTen, rebuiltSaid, shareSaid } from '@/views/eval-score';
import { standingSaid, wordsOf } from '@/views/plugins-context';

type Run = NonNullable<PluginEvalFound['run']>;

/** A quiet sub-panel state, plain text rather than a mascot — the design system reserves the
 *  illustrated `EmptyState` for a whole page or a whole feature having nothing at all (see
 *  `docs/brand.md` for where a mascot appears); a section still waiting on an earlier
 *  stage of the same run is the same shape as "No round has reached a verdict for this plugin"
 *  already used to be, one paragraph, not a second mascot.
 *
 *  Exported because the other two thirds of this page draw the same state, and one paragraph of
 *  plain text is not worth three copies of it. */
export function Quiet({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-ink-3">{description}</p>
    </div>
  );
}

/** How the owning team's scored run stands to the public score the page leads with, in one sentence. */
function relation(run: Run, lead: PluginScore | null): string {
  if (!lead) return 'The platform has no public score of it yet, so this is the only score drawn.';
  const sameProtocol = lead.protocol.version === run.protocol.version && (lead.protocol.key === null || lead.protocol.key === run.protocol.key);
  if (sameProtocol && lead.scoredAt === run.scoredAt) return 'The same scoring as the public score above.';
  return sameProtocol
    ? `A different scoring from the public score above, against the same protocol, scored on ${formatDate(run.scoredAt)}.`
    : `A different scoring from the public score above, against another protocol version: the two do not compare.`;
}

/**
 * FR-55's own order, stepped back below the page's lead: overall score, its status, and the protocol version it was
 * measured against, before anything else in the evaluation, at a card's size and not a second hero, with a sentence
 * saying how it stands to the public score. `scoreStatus === 'not_established'` never shows a number beside the
 * status word — even where `overallScore` happens to be non-null, which `scoreRun` (zz-stack) never actually
 * produces, this reads the status rather than the number so the console rule holds by construction, not by the
 * scorer's own accident.
 */
export function EvalHeadline({ pluginEval, lead = null }: { pluginEval: PluginEval; lead?: PluginScore | null }) {
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
      <Panel title="Overall fit for purpose" description={pluginEval.ownershipMode === 'evaluation_only' ? 'A third-party plugin' : undefined}>
        <Quiet title="Not evaluated yet"
          description="Registered, but OBSERVE has never profiled a subject version for it." />
      </Panel>
    );
  }
  const run = pluginEval.run;
  return (
    <Panel
      title="Overall fit for purpose"
      description={`The owning team's evaluation of version ${pluginEval.subjectVersion.declaredVersion}${pluginEval.ownershipMode === 'evaluation_only' ? ', a third-party plugin' : ''}${run ? `. ${relation(run, lead)}` : ''}`}
    >
      {!run ? (
        <Quiet title="Not evaluated yet"
          description="A subject version exists, but no EVALUATE run has scored it." />
      ) : (
        <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <dt className="t-eyebrow text-ink-3">Score</dt>
            {run.scoreStatus === 'not_established' || run.overallScore === null ? (
              <dd className="text-lg font-semibold text-ink-3">{standingSaid(run.scoreStatus)}</dd>
            ) : (
              <dd className="text-lg font-semibold tabular-nums text-ink">
                {/* One place, as the public score above and the parts below read: 7.10 beside 7.1 read as two figures. */}
                {run.overallScore.toFixed(1)}
                <span className="text-xs font-regular text-ink-3"> / {SCORE_OUT_OF}</span>
              </dd>
            )}
          </div>
          <div>
            <dt className="t-eyebrow text-ink-3">Status</dt>
            <dd><Badge tone={STANDING_TONE[run.scoreStatus ?? 'not_established']} dot>{standingSaid(run.scoreStatus)}</Badge></dd>
          </div>
          <div>
            <dt className="t-eyebrow text-ink-3">Protocol</dt>
            <dd className="text-sm font-medium text-ink">
              <span className="font-mono text-xs">{run.protocol.key}</span> v{run.protocol.version}
            </dd>
          </div>
          <div>
            <dt className="t-eyebrow text-ink-3">Guardrails</dt>
            <dd><Badge tone={GUARDRAIL_TONE[run.guardrailStatus ?? 'not_established']}>{GUARDRAIL_SAID[run.guardrailStatus ?? 'not_established']}</Badge></dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

/** The run's one verdict over its guardrails, in words and its colour. */
const GUARDRAIL_SAID = { pass: 'All held', fail: 'A guardrail broke', not_established: 'Not established' } as const;
const GUARDRAIL_TONE = { pass: 'positive', fail: 'critical', not_established: 'neutral' } as const;

/** Health: whether this run's non-compensatory guardrails held (FR-23) — the number stays for
 *  diagnosis, but a fail never disappears into the average above. A guardrail is a measure the
 *  protocol flags as one, read where it sits in its dimension; the run's `guardrailStatus` is the
 *  one verdict over all of them, so no row claims a verdict of its own. */
export function EvalHealth({ run }: { run: Run | null }) {
  if (!run) {
    return <Panel title="Health"><Quiet title="Nothing to check" description="No scored run to read guardrails from." /></Panel>;
  }
  const guardrails = run.dimensions.flatMap((d) => d.measures.filter((m) => m.guardrail).map((m) => ({ ...m, dimension: d.key })));
  const status = run.guardrailStatus ?? 'not_established';
  return (
    <Panel
      title="Health"
      description={`${guardrails.length} ${plural(guardrails.length, 'guardrail')}, each a share of what it measures`}
      actions={<Badge tone={GUARDRAIL_TONE[status]}>{GUARDRAIL_SAID[status]}</Badge>}
    >
      {guardrails.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">This protocol declares no critical guardrail.</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Guardrail</TableHeader>
              <TableHeader hideBelow="sm" align="center">Dimension</TableHeader>
              <TableHeader align="right">Value</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {guardrails.map((g) => (
              <TableRow key={`${g.dimension}/${g.key}`}>
                <TableCell className="text-sm whitespace-nowrap" title={g.key}>{wordsOf(g.key)}</TableCell>
                <TableCell hideBelow="sm" align="center" className="text-xs whitespace-nowrap text-ink-2" title={g.dimension}>{wordsOf(g.dimension)}</TableCell>
                <TableCell align="right" className="tabular-nums text-xs">
                  {g.value === null ? <span className="text-ink-3">{g.excludedReason ?? 'Not measured'}</span> : shareSaid(g.value)}
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
 * slice IS its contribution to `overall_score`, its weight re-normalised over the dimensions that
 * count, so the parts add up to the overall and the sentence under the bar shows the sum. Every
 * dimension the bar leaves out — not applicable, or applicable with no measure scored — says why
 * under the table, and the bar's caption says how its weight was shared out, instead of drawing
 * a silent zero-width slice.
 *
 * No horizontal scroll on the table below (house rule — nothing in the console scrolls
 * sideways): five columns fit, and `Kind` is the one that drops first on a narrow card.
 */
export function EvalQuality({ run }: { run: Run | null }) {
  if (!run) {
    return <Panel title="Quality"><Quiet title="Nothing to score" description="No scored run to read dimensions from." /></Panel>;
  }
  const applicable = run.dimensions.filter((d) => d.applicable);
  const notApplicable = run.dimensions.filter((d) => !d.applicable);
  /* A dimension whose every measure was excluded has no score, and `scoreRun` leaves it OUT of the
     overall mean rather than counting it as zero — so the bar leaves it out too. Drawn as a part it
     would read "contributed nothing", beside a table row that says the truer "not scored". */
  const { parts: points } = contributionsOf(run.dimensions);
  const parts = points.map((p) => ({ label: wordsOf(p.key), value: p.tenths }));
  const leftOut = [
    ...notApplicable.map((d) => `${wordsOf(d.key)}: ${d.notApplicableReason ?? 'no reason recorded'}`),
    ...applicable.flatMap((d) => (d.score === null ? [`${wordsOf(d.key)}: no measure scored, ${formatCount(d.measuresScored)} of ${formatCount(d.measuresTotal)}`] : [])),
  ];
  const required = run.dimensions.some((d) => d.required);
  return (
    <Panel title="Quality" description={`${applicable.length} of ${run.dimensions.length} ${plural(run.dimensions.length, 'dimension')} applicable${required ? '; Required marks the ones its protocol requires' : ''}`}>
      {/* The bar reads in the overall score's own points, out of 10: a part is a dimension's score times its weight
          over the weight that counts, so the parts sum to the headline number, and the sentence shows the sum. */}
      {parts.length ? (
        <>
          <CompositionBar
            label="Each dimension's contribution to the overall score"
            parts={parts}
            format={(v) => (v / 10).toFixed(1)}
          />
          <p className="t-caption mt-3">{rebuiltSaid(run.dimensions)}</p>
        </>
      ) : <p className="py-2 text-sm text-ink-3">No dimension has a score, so there is no contribution to draw.</p>}
      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeader>Dimension</TableHeader>
            <TableHeader hideBelow="md" align="center">Kind</TableHeader>
            <TableHeader align="center">Score out of {SCORE_OUT_OF}</TableHeader>
            <TableHeader hideBelow="sm" align="center">Weight</TableHeader>
            <TableHeader hideBelow="sm" align="right">Measures</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {run.dimensions.map((d: DimensionScore) => (
            <TableRow key={d.key}>
              <TableCell className="text-sm whitespace-nowrap" title={d.key}>
                {wordsOf(d.key)}
                {d.required ? <span className="t-caption ml-2">Required</span> : null}
              </TableCell>
              <TableCell hideBelow="md" align="center" className="text-xs text-ink-2">{wordsOf(d.canonicalKind)}</TableCell>
              <TableCell align="center" className="tabular-nums">
                {/* A dimension's score is a share in [0, 1] and the overall is 10 × the weighted sum, so it reads out of 10. */}
                {d.applicable
                  ? (d.score === null ? <span className="text-ink-3">Not scored</span> : outOfTen(d.score))
                  : <span className="text-ink-3" title={d.notApplicableReason ?? undefined}>Not applicable</span>}
              </TableCell>
              <TableCell hideBelow="sm" align="center" className="tabular-nums text-xs">{formatPercent(d.weight)}</TableCell>
              <TableCell hideBelow="sm" align="right" className="tabular-nums text-xs">
                {formatCount(d.measuresScored)} of {formatCount(d.measuresTotal)}
              </TableCell>
            </TableRow>
          ))}
          {run.dimensions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-ink-3">This protocol declares no dimension.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {leftOut.length ? (
        <p className="mt-3 text-2xs leading-relaxed text-ink-3">{leftOut.join(' · ')}</p>
      ) : null}
    </Panel>
  );
}
