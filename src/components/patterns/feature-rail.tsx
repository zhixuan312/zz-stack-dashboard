import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow } from '@/components/ui';
import { ProseBlock } from '@/components/patterns/prose-block';

interface RailNoteProps {
  icon: ReactNode;
  title?: string;
  /** Markdown (the common case) — or rich children when the note carries content markdown
   *  can't express, e.g. a legend's colour-swatch bullets. */
  children: ReactNode;
  className?: string;
}

export function RailNote({ icon, title, children, className }: RailNoteProps) {
  return (
    // `items-start` deliberately: the note body runs to many lines, and an icon centred
    // against a long block would float in the middle of the paragraph.
    // `data-rail-note` marks this as GUIDANCE, not a panel. The content shell fills its
    // rail's last child so the right panel reaches the bottom; a note must never be that
    // child — stretched, it becomes a huge tinted block of empty space under three lines
    // of text. It always wraps its own content.
    <div
      data-rail-note
      className={cn(
        // An accent RAIL, not an accent FILL. A tinted block competes with the
        // one accent-coloured number the page is allowed, and guidance should
        // never be as loud as data. The 3px left edge marks it unmistakably as
        // the interpretive aside while leaving the accent budget intact.
        'flex shrink-0 items-start gap-3 rounded-[var(--r-lg)] border border-line border-l-[3px] border-l-accent bg-surface-2 px-4 py-4',
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 shrink-0 text-ink-faint [&>svg]:size-[18px]"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <Eyebrow as="h3" className="mb-2 text-ink">{title}</Eyebrow> : null}
        {typeof children === 'string' ? <ProseBlock variant="rail">{children}</ProseBlock> : children}
      </div>
    </div>
  );
}
