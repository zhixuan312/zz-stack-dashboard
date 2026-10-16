'use client';

import { Panel } from '@/console/panel';
import { plural } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { When } from '@/console/when';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CandidateStatus, PluginEval, PluginEvalFound } from '@/lib/api-shapes';

const STATUS_LABEL: Record<CandidateStatus, string> = {
  recorded: 'recorded', awaiting_build: 'awaiting build', valid: 'valid',
  invalid: 'invalid',
};
const STATUS_TONE: Record<CandidateStatus, 'positive' | 'critical' | 'warning' | 'neutral'> = {
  recorded: 'neutral', awaiting_build: 'warning', valid: 'positive',
  invalid: 'critical',
};

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
    <Panel title="Evolution" description={aside} flush>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Candidate</TableHeader>
            <TableHeader align="center">Status</TableHeader>
            <TableHeader hideBelow="sm" align="center">Build</TableHeader>
            <TableHeader hideBelow="md" align="right">Release</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {candidates.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-[280px]">
                <span className="block text-sm text-ink">{c.hypothesis}</span>
                <span className="text-2xs text-ink-3"><When at={c.createdAt} /></span>
              </TableCell>
              <TableCell align="center"><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></TableCell>
              <TableCell hideBelow="sm" align="center" className="text-xs">
                {!c.build ? <span className="text-ink-3">not built</span>
                  : c.build.ok ? <Badge tone="positive">passed</Badge>
                  : <>
                      <Badge tone="critical">failed</Badge>
                      {c.build.stage ? <span className="block text-ink-3">at {c.build.stage}</span> : null}
                    </>}
              </TableCell>
              <TableCell hideBelow="md" align="right" className="text-xs">
                {!c.release ? <span className="text-ink-3">not released</span> : (
                  <>
                    <Badge tone={c.release.status === 'released' ? 'positive' : c.release.status === 'refused' || c.release.status === 'failed' ? 'critical' : 'neutral'}>
                      {c.release.rolledBack ? 'rolled back' : c.release.status}
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
 * Automation & Trust: who may release this plugin's changes, and how far each model-backed
 * evaluator's own qualification (FR-16) has been earned — the evidence that decides whether the
 * headline score above was even allowed to establish.
 */
export function EvalAutomationTrust({ pluginEval }: { pluginEval: PluginEval }) {
  if (!pluginEval.found) return null;
  return (
    <Panel title="Automation & Trust" description={pluginEval.ownershipMode === 'evaluation_only' ? 'evaluation only' : 'owned'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* A `<dl>`, not a `<div>`: `Field` below renders a `<dt>` and a `<dd>`, and those are only valid inside a
            description list — loose in a div they are invalid markup and nothing associates a label with its value
            for a screen reader. HTML5 lets each pair keep its own `<div>` inside the list, which is why the grouping
            below is unchanged. */}
        <dl className="flex flex-col gap-3 text-xs">
          <Field k="Origin" v={pluginEval.origin ?? '—'} />
          <Field k="Owner team" v={pluginEval.ownerTeam ?? 'none recorded'} />
          <Field k="Release owners" v={pluginEval.releaseOwners.length ? pluginEval.releaseOwners.join(', ') : 'none — cannot be released'} />
        </dl>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-3">Evaluator qualification</p>
          {!pluginEval.evaluatorTrust.length ? (
            <p className="text-sm text-ink-3">This protocol names no model-backed evaluator.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pluginEval.evaluatorTrust.map((t) => (
                <li key={t.stableKey} className="flex items-center justify-between gap-3 text-xs">
                  {/* A stable key is an identifier, and its tail is what tells two of them apart; it wraps rather
                      than cutting, and carries the whole value for the reader who still wants one line. */}
                  <span className="min-w-0 font-mono text-xs text-ink [overflow-wrap:anywhere]" title={t.stableKey}>{t.stableKey}</span>
                  <span className="shrink-0 text-right">
                    <Badge tone={t.state === 'human_calibrated' || t.state === 'operationally_qualified' ? 'positive' : t.state === 'mechanically_qualified' ? 'warning' : 'neutral'}>
                      {t.state ?? 'never qualified'}
                    </Badge>
                    {t.qualifiedAt ? <span className="ml-2 text-2xs text-ink-3"><When at={t.qualifiedAt} /></span> : null}
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
