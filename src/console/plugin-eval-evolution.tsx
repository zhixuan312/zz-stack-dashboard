'use client';

import { Quiet } from '@/console/plugin-eval-overview';
import { Panel } from '@/console/panel';
import { Day } from '@/console/eval-score';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { plural } from '@/lib/format';
import type { CandidateStatus, PluginEval, PluginEvalFound } from '@/lib/api-shapes';
import { RELEASE_JUDGED, TRUST_SAID, evaluatorSaid } from '@/views/plugin-context';
import { wordsOf } from '@/views/plugins-context';

const STATUS_LABEL: Record<CandidateStatus, string> = {
  recorded: 'Recorded', awaiting_build: 'Awaiting build', valid: 'Valid',
  invalid: 'Invalid',
};

const STATUS_TONE: Record<CandidateStatus, 'positive' | 'critical' | 'warning' | 'neutral'> = {
  recorded: 'neutral', awaiting_build: 'warning', valid: 'positive',
  invalid: 'critical',
};

/** The card's edge padding on the Status column wherever the columns after it are hidden (`hideBelow` sm and md). */
const EDGE = '@max-[672px]:pr-(--card-pad)';

/**
 * Evolution: every candidate the run's findings seeded, its hypothesis and status, how its local
 * build and gate went, and where release/rollback stands. `ownershipMode === 'evaluation_only'`
 * reads exactly that on a third-party plugin, per this task's own console rule — it can still be diagnosed and
 * proposed to (spec v8 FR-51), it can never be released, and the aside says so before the table
 * does.
 */
export function EvalEvolution({ pluginEval }: { pluginEval: PluginEvalFound }) {
  const { candidates, ownershipMode } = pluginEval;
  const aside = ownershipMode === 'evaluation_only' ? 'Evaluation only' : `${candidates.length} ${plural(candidates.length, 'candidate')}`;
  // A judged release's reason names a change in refusals or runs; whose they are is said once, above the rows.
  const judged = candidates.some((c) => c.release?.verdict) ? `${aside}. ${RELEASE_JUDGED}` : aside;
  if (!candidates.length) {
    return (
      <Panel title="Evolution" description={aside}>
        <Quiet title="No improvement search yet"
          description={ownershipMode === 'evaluation_only'
            ? 'A third-party plugin may still receive a diagnosed proposal, once a plugin-owned finding seeds one.'
            : 'No finding from this run has started an improvement run.'} />
      </Panel>
    );
  }
  return (
    <Panel title="Evolution" description={judged} flush>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Candidate</TableHeader>
            {/* Under 672px Release and Build are hidden but still the row's last cells, so the card's edge padding, which
                the table gives its last cell, is Status's to carry there: without it "Invalid" ran past the edge. */}
            <TableHeader align="center" className={EDGE}>Status</TableHeader>
            <TableHeader hideBelow="sm" align="center">Build</TableHeader>
            <TableHeader hideBelow="md" align="right">Release</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {candidates.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-[280px]">
                <span className="block text-sm text-ink">{c.hypothesis}</span>
                <span className="text-2xs text-ink-3"><Day at={c.createdAt} /></span>
              </TableCell>
              <TableCell align="center" className={EDGE}><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></TableCell>
              <TableCell hideBelow="sm" align="center" className="text-xs">
                {!c.build ? <span className="text-ink-3">Not built</span>
                  : c.build.ok ? <Badge tone="positive">Passed</Badge>
                  : <>
                      <Badge tone="critical">Failed</Badge>
                      {c.build.stage ? <span className="block text-ink-3">at {c.build.stage}</span> : null}
                    </>}
              </TableCell>
              <TableCell hideBelow="md" align="right" className="text-xs">
                {!c.release ? <span className="text-ink-3">Not released</span> : (
                  <>
                    <Badge tone={c.release.status === 'released' ? 'positive' : c.release.status === 'refused' || c.release.status === 'failed' ? 'critical' : 'neutral'}>
                      {c.release.rolledBack ? 'Rolled back' : wordsOf(c.release.status)}
                    </Badge>
                    {c.release.releasedDeclaredVersion ? <span className="block text-ink-3">v{c.release.releasedDeclaredVersion}</span> : null}
                    {c.release.reason ? <span className="block text-ink-3">{c.release.reason}</span> : null}
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

/**
 * Who may release it, and its judges: who may release this plugin's changes, and how far each model-backed
 * evaluator's own qualification (FR-16) has been earned — the evidence that decides whether the
 * headline score above was even allowed to establish.
 */
export function EvalAutomationTrust({ pluginEval }: { pluginEval: PluginEval }) {
  if (!pluginEval.found) return null;
  return (
    <Panel title="Who releases it, and its judges" description={pluginEval.ownershipMode === 'evaluation_only' ? 'A third-party plugin: evaluated here, never released from here' : 'Owned here: who may release a change to it, and how far each model-backed judge of its runs has qualified'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* A `<dl>`, not a `<div>`: `Field` below renders a `<dt>` and a `<dd>`, and those are only valid inside a
            description list — loose in a div they are invalid markup and nothing associates a label with its value
            for a screen reader. HTML5 lets each pair keep its own `<div>` inside the list, which is why the grouping
            below is unchanged. */}
        <dl className="flex flex-col gap-3 text-xs">
          <Field k="Origin" v={pluginEval.origin ? wordsOf(pluginEval.origin) : '—'} />
          <Field k="Owner team" v={pluginEval.ownerTeam ?? 'none recorded'} />
          <Field k="Release owners" v={pluginEval.releaseOwners.length ? pluginEval.releaseOwners.join(', ') : 'none — cannot be released'} />
        </dl>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-3">Judges</p>
          {!pluginEval.evaluatorTrust.length ? (
            <p className="text-sm text-ink-3">This protocol names no model-backed evaluator.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pluginEval.evaluatorTrust.map((t) => (
                <li key={t.stableKey} className="flex items-center justify-between gap-3 text-xs">
                  {/* In words, with the stable key, an identifier, whole on hover for the reader who wants it. */}
                  <span className="min-w-0 text-xs text-balance text-ink" title={t.stableKey}>{evaluatorSaid(t.stableKey)}</span>
                  <span className="shrink-0 text-right">
                    <Badge tone={t.state === 'human_calibrated' || t.state === 'operationally_qualified' ? 'positive' : t.state === 'mechanically_qualified' ? 'warning' : 'neutral'}>
                      {t.state ? TRUST_SAID[t.state] ?? wordsOf(t.state) : 'Never qualified'}
                    </Badge>
                    {t.qualifiedAt ? <span className="ml-2 text-2xs text-ink-3"><Day at={t.qualifiedAt} /></span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="t-eyebrow">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
