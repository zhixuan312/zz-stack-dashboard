import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/**
 * A section opened in place: the native `<details>`, so the browser owns the press, the keyboard and the open state,
 * and no client code ships. It opens at once; only the chevron turns.
 */
export function Disclosure({ summary, defaultOpen, children, className }: { summary: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  return (
    <details open={defaultOpen} className={cn('group/disclosure', className)}>
      <summary className="hit flex cursor-pointer list-none items-start gap-1.5 rounded-xs py-0.5 text-sm leading-5 text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="h-5 w-3.5 shrink-0 text-ink-3 transition-transform duration-(--dur-hover) ease-out group-open/disclosure:rotate-90" strokeWidth={2} />
        <span className="min-w-0">{summary}</span>
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}
