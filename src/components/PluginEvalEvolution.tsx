'use client';

import { Panel } from '@/components/Panel';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time } from '@/components/ui';
import type { CandidateStatus, PluginEval } from '@/lib/api-shapes';

const STATUS_LABEL: Record<CandidateStatus, string> = {
  recorded: 'recorded', awaiting_build: 'awaiting build', valid: 'valid',
  invalid: 'invalid', released: 'released', rolled_back: 'rolled back',
};
const STATUS_TONE: Record<CandidateStatus, 'sage' | 'rose' | 'amber' | 'neutral'> = {
  recorded: 'neutral', awaiting_build: 'amber', valid: 'sage',
  invalid: 'rose', released: 'sage', rolled_back: 'rose',
};

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

/**
 * Evolution: every candidate the run's findings seeded, its hypothesis and status, how its local
 * build and gate went, and where release/rollback stands. `ownershipMode === 'evaluation_only'`
 * reads exactly that on a third-party plugin, per this task's own console rule — it can still be diagnosed and
 * proposed to (spec v8 FR-51), it can never be released, and the aside says so before the table
 * does.
 */
export function EvalEvolution({ pluginEval }: { pluginEval: PluginEval }) {
  const { candidates, ownershipMode } = pluginEval;
  const aside = ownershipMode === 'evaluation_only' ? 'Evaluation only' : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`;
  if (!candidates.length) {
    return (
      <Panel title="Evolution" aside={aside}>
        <Quiet title="No improvement search yet"
          description={ownershipMode === 'evaluation_only'
            ? 'A third-party plugin may still receive a diagnosed proposal, once a plugin-owned finding seeds one.'
            : 'No finding from this run has started an improvement run.'} />
      </Panel>
    );
  }
  return (
    <Panel title="Evolution" aside={aside} padded={false}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Build</TableHead>
            <TableHead>Release</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-[280px]">
                <span className="block text-sm text-ink">{c.hypothesis}</span>
                <span className="text-[11px] text-ink-faint"><Time value={c.createdAt} /></span>
              </TableCell>
              <TableCell><Badge variant={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></TableCell>
              <TableCell className="text-xs">
                {!c.build ? <span className="text-ink-faint">not built</span>
                  : c.build.ok ? <Badge variant="sage">passed</Badge>
                  : <>
                      <Badge variant="rose">failed</Badge>
                      {c.build.stage ? <span className="block text-ink-faint">at {c.build.stage}</span> : null}
                    </>}
              </TableCell>
              <TableCell className="text-xs">
                {!c.release ? <span className="text-ink-faint">not released</span> : (
                  <>
                    <Badge variant={c.release.status === 'released' ? 'sage' : c.release.status === 'refused' || c.release.status === 'failed' ? 'rose' : 'neutral'}>
                      {c.release.rolledBack ? 'rolled back' : c.release.status}
                    </Badge>
                    {c.release.releasedDeclaredVersion ? <span className="block text-ink-faint">v{c.release.releasedDeclaredVersion}</span> : null}
                    {c.release.reason ? <span className="block text-ink-faint">{c.release.reason}</span> : null}
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
    <Panel title="Automation & Trust" aside={pluginEval.ownershipMode === 'evaluation_only' ? 'evaluation only' : 'owned'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 text-[13px]">
          <Field k="Origin" v={pluginEval.origin ?? '—'} />
          <Field k="Owner team" v={pluginEval.ownerTeam ?? 'none recorded'} />
          <Field k="Evolvable" v={pluginEval.evolvable ? 'yes' : 'no'} />
          <Field k="Release owners" v={pluginEval.releaseOwners.length ? pluginEval.releaseOwners.join(', ') : 'none — cannot be released'} />
        </div>
        <div>
          <p className="mb-1.5 t-eyebrow text-ink-faint">Evaluator qualification</p>
          {!pluginEval.evaluatorTrust.length ? (
            <p className="text-sm text-ink-faint">This protocol names no model-backed evaluator.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pluginEval.evaluatorTrust.map((t) => (
                <li key={t.stableKey} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-mono text-xs text-ink">{t.stableKey}</span>
                  <span className="shrink-0 text-right">
                    <Badge variant={t.state === 'human_calibrated' || t.state === 'operationally_qualified' ? 'sage' : t.state === 'mechanically_qualified' ? 'amber' : 'neutral'}>
                      {t.state ?? 'never qualified'}
                    </Badge>
                    {t.qualifiedAt ? <span className="ml-2 text-[11px] text-ink-faint"><Time value={t.qualifiedAt} /></span> : null}
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
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}
