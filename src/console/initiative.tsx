import { Badge } from '@/components/ui/badge';
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

