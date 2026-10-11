'use client';

import { useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useSurface } from '../../base/surface/index';
import { Tooltip } from '../../ui/tooltip/index';

/**
 * Hand a card to the agent: one press posts a question about exactly what the card shows into the conversation.
 * It exists only where an agent is listening (an MCP host); on the console it renders nothing, so no dead control
 * is ever shown. The question is written for the person to read in the thread, so it names the card's facts.
 * On the console it hands the card to the assistant panel. It renders only after hydration: whether an agent listens is
 * known in the browser, and a part of the page that hydrates late must match the HTML the server sent without it.
 */
const subscribe = () => () => {};
/** `iconBelowSm` keeps only the mark on a phone, for a card whose head has no room beside a long kicker. */
export function AskAbout({ question, iconBelowSm, className }: { question: string; iconBelowSm?: boolean; className?: string }) {
  const { ask } = useSurface();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ask || !hydrated) return null;
  return (
    <Tooltip content="Ask the assistant about this">
      <button
        type="button"
        onClick={() => ask(question)}
        aria-label={`Ask: ${question}`}
        className={cn('press hit inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-accent-ink hover:bg-accent-tint', className)}
      >
        <Sparkles className="size-3.5" /> <span className={cn(iconBelowSm && 'max-sm:sr-only')}>Ask</span>
      </button>
    </Tooltip>
  );
}
