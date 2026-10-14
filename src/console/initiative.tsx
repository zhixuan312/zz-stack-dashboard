import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { initiativeState, ownGates, type StateOf } from '@/console/initiative-state';

export function StateBadge({ of }: { of: StateOf }) {
  const state = initiativeState(of);
  if (state === 'Waiting on you') {
    const open = ownGates(of).filter((g) => g.written && !g.passed);
    return <Badge tone="warning" dot title={`Waiting on: ${open.map((g) => g.name).join(', ')}`}>Waiting on you</Badge>;
  }
  const tone = state === 'Accepted' || state === 'Delivered' ? 'positive' : state === 'Ready to close' ? 'accent' : 'neutral';
  return <Badge tone={tone} dot>{state}</Badge>;
}

/** Where an initiative is in its flow: "S4 · plan" and one notch per stage, the passed ones filled. */
export function FlowPosition({ at, of, name, closed = false }: { at: number; of: number; name: string; /** Every notch is passed once it closed. */ closed?: boolean }) {
  if (!of) return <span className="text-xs text-ink-3">No flow</span>;
  const label = name ? name.replace(/-/g, ' ') : 'open';
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span className="text-xs font-medium text-ink">S{at} · {label}</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={cn('block h-1.5 w-2.5 rounded-full', i + 1 < at || (closed && i + 1 === at) ? 'bg-positive' : i + 1 === at ? 'bg-accent' : 'bg-fill-track')} />
        ))}
      </span>
      <span className="sr-only">Stage {at} of {of}</span>
    </span>
  );
}
