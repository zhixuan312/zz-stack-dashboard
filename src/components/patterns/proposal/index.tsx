'use client';

import { ArrowRight, Check, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { AgentMark } from '../../ui/agent-mark/index';
import { Button } from '../../ui/button/index';

export type ProposalChange = { label: string; from: ReactNode; to: ReactNode };
export type ProposalState = 'pending' | 'applying' | 'applied' | 'dismissed' | 'failed' | 'expired';

/**
 * A change an agent wants to make, waiting for a person. The agent can read anything and do nothing without consent:
 * every write it proposes arrives as this card, with what changes (before → after), why, and what it affects.
 * Approve runs it once; Dismiss closes it. A removal is proposed with the critical tone: its button reads "Approve and remove".
 * Uncontrolled, the card keeps its own pending, applying, applied and failed flow; controlled (`state`), only pending
 * shows buttons and the caller owns every other state.
 */
export function Proposal({
  agent = 'Claude',
  title,
  tone = 'neutral',
  reason,
  changes,
  impact,
  note,
  onApprove,
  onDismiss,
  state: controlled,
  className,
}: {
  agent?: string;
  /** What will happen, as a sentence: "Raise Example Co's rate limit". */
  title: string;
  /** Critical for a removal: the approve button turns danger and reads "Approve and remove". */
  tone?: 'neutral' | 'critical';
  /** Why the agent proposes it, in one or two sentences, with the evidence it used. */
  reason?: ReactNode;
  changes: ProposalChange[];
  /** Who or what else this touches: "Applies to all 14 API keys of Example Co". */
  impact?: ReactNode;
  /** Said under the changes once the proposal is closed, for example why it expired. */
  note?: ReactNode;
  onApprove?: () => Promise<void> | void;
  onDismiss?: () => void;
  state?: ProposalState;
  className?: string;
}) {
  const [own, setOwn] = useState<ProposalState>('pending');
  const state = controlled ?? own;
  const approve = async () => {
    setOwn('applying');
    try { await onApprove?.(); setOwn('applied'); } catch { setOwn('failed'); }
  };
  const settled = state === 'applied' || state === 'dismissed' || state === 'expired';
  const buttons = controlled ? state === 'pending' : !settled;
  return (
    <article
      aria-label={`Proposal from ${agent}: ${title}`}
      className={cn(
        'relative rounded-lg border bg-surface shadow-card transition-[border-color,box-shadow] duration-(--dur-enter)',
        state === 'failed' || (tone === 'critical' && !settled) ? 'border-critical/45' : settled ? 'border-line' : 'edge-lit border-line shadow-halo',
        className,
      )}
    >
      <div className="flex items-start gap-3 px-(--card-pad) pt-4">
        <AgentMark size="lg" />
        <div className="min-w-0 flex-1">
          <p className="t-caption">{agent} proposes</p>
          <h2 className={cn('t-card mt-0.5', settled && 'text-ink-2')}>{title}</h2>
        </div>
        <StateTag state={state} />
      </div>
      <div className="px-(--card-pad) pt-3 pb-4">
        {reason ? <p className="t-small text-ink-2">{reason}</p> : null}
        <dl className={cn('overflow-hidden rounded-md border border-line', reason && 'mt-3.5')}>
          {changes.map((c) => (
            <div key={c.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="text-xs text-ink-3">{c.label}</dt>
              <dd className="t-num flex min-w-0 items-center gap-2 text-sm max-sm:col-span-2">
                <span className="text-ink-3 line-through decoration-ink-3/50">{c.from}</span>
                <ArrowRight className="size-3.5 shrink-0 text-ink-3" />
                <span className="font-medium">{c.to}</span>
              </dd>
            </div>
          ))}
        </dl>
        {impact ? <p className="t-caption mt-2.5">{impact}</p> : null}
        {note ? <p className="t-small mt-2.5 text-ink-2">{note}</p> : null}
      </div>
      {buttons ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-line bg-surface-sunk/50 px-(--card-pad) py-3">
          {state === 'failed' ? <p className="basis-full text-xs text-critical-ink" role="alert">It did not apply. Nothing changed; try again or open the console.</p> : null}
          <Button variant="ghost" size="sm" onClick={() => { setOwn('dismissed'); onDismiss?.(); }} disabled={state === 'applying'}>Dismiss</Button>
          <Button variant={tone === 'critical' ? 'danger' : 'primary'} size="sm" icon={<Check />} busy={state === 'applying'} onClick={approve}>
            {state === 'failed' ? 'Try again' : tone === 'critical' ? 'Approve and remove' : 'Approve'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function StateTag({ state }: { state: ProposalState }) {
  if (state === 'applied') return <span className="inline-flex items-center gap-1 text-xs font-medium text-positive-ink"><Check className="size-3.5" />Applied</span>;
  if (state === 'dismissed') return <span className="inline-flex items-center gap-1 text-xs text-ink-3"><X className="size-3.5" />Dismissed</span>;
  if (state === 'applying') return <span className="text-xs text-ink-3">Applying…</span>;
  if (state === 'expired') return <span className="inline-flex items-center gap-1 text-xs text-ink-3"><X className="size-3.5" />Expired</span>;
  if (state === 'failed') return <span className="inline-flex items-center gap-1 text-xs font-medium text-critical-ink"><X className="size-3.5" />Not applied</span>;
  return <span className="text-xs font-medium text-accent-ink">Needs you</span>;
}
