import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const SIZE = { sm: 'size-5 [&_svg]:size-3', md: 'size-6 [&_svg]:size-3.5', lg: 'size-8 [&_svg]:size-4' } as const;

/**
 * The sign of an agent: anything an AI assistant did, proposed or is doing carries it, so a reader can always tell a
 * person's change from an agent's. A square, never round: agents are not people.
 */
export function AgentMark({ size = 'md', className }: { size?: keyof typeof SIZE; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-grid shrink-0 place-items-center rounded-sm bg-accent-tint text-accent-ink ring-1 ring-accent-line', SIZE[size], className)}>
      <Sparkles strokeWidth={2} />
    </span>
  );
}
