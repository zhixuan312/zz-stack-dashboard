import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format-date';
import { Avatar } from '@/components/ui/avatar';
import { AgentMark } from '@/components/ui/agent-mark';

/** One event: who did what to what, and when. `via` names the agent when an assistant acted for `actor`; `system` marks the product acting on its own. */
export type ActivityEvent = { id: string; at: string; actor: string; system?: boolean; via?: string; verb: string; object: string; tone?: 'positive' | 'warning' | 'critical' };

const DOT = { positive: 'bg-positive', warning: 'bg-warning', critical: 'bg-critical' } as const;

/**
 * What happened, who did it, when: one line per event, newest first, on a quiet timeline. The actor is a person, the
 * system, or an agent acting for a person; an agent's change always names the agent and the person it acted for.
 */
export function ActivityFeed({ events, now, className }: { events: ActivityEvent[]; /** The clock the relative times are read against: the data's clock, never render time. */ now: Date; className?: string }) {
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-3 w-px bg-line" /> : null}
          <span className="relative mt-0.5 shrink-0">
            {e.via ? <AgentMark size="md" /> : e.system ? <span className="grid size-6 place-items-center rounded-full bg-fill-track"><span className={cn('size-2 rounded-full', e.tone ? DOT[e.tone] : 'bg-ink-3')} /></span> : <Avatar name={e.actor} size="sm" />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">{e.via ? e.via : e.actor}</span> {e.verb} <span className="text-ink">{e.object}</span>
              {e.via ? <span className="text-ink-3"> · for {e.actor}</span> : null}
            </p>
          </div>
          <time dateTime={e.at} title={formatDateTime(e.at)} className="t-num shrink-0 pt-0.5 text-xs text-ink-3">{formatRelative(e.at, now)}</time>
        </li>
      ))}
    </ol>
  );
}
