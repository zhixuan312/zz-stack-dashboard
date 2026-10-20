import { Badge } from '@/components/ui/badge';
import type { InitiativeRow } from '@/lib/work-shapes';
import { STATE_LABEL } from '@/views/initiatives-filter';

/** One rule per colour, as every state badge: warning means a person must act, positive closed with what was asked. */
const TONE: Record<InitiativeRow['state'], 'warning' | 'positive' | 'neutral'> = {
  waiting: 'warning', accepted: 'positive', delivered: 'positive', open: 'neutral', quiet: 'neutral', abandoned: 'neutral',
};

/** An initiative's state, in the list's words, wherever one is drawn; `waitingOn` names the documents it waits on. */
export function StateBadge({ state, waitingOn = [] }: { state: InitiativeRow['state']; waitingOn?: string[] }) {
  return (
    <Badge tone={TONE[state]} dot title={state === 'waiting' && waitingOn.length ? `Waiting on: ${waitingOn.join(', ')}` : undefined}>
      {STATE_LABEL[state]}
    </Badge>
  );
}
