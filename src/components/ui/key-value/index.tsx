import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export type KeyValueItem = {
  label: ReactNode;
  value: ReactNode;
  /** The whole value, when it is drawn as a node (a link, a method beside a route): the row's title, so a value the row cuts can still be read. A value that is text titles itself. */
  title?: string;
  action?: ReactNode;
  mono?: boolean;
  /** A value read in full (a path, an address, a list of links): it wraps instead of ending in an ellipsis. */
  wrap?: boolean;
};

/**
 * Facts about one thing, label and value per row, divided by hairlines: a request's method and status, a key's
 * scope and last use. Labels are quiet, values carry the reading; numbers are tabular so a column lines up.
 *
 * Two columns are counted from the list's own width, never the window's: a card beside another is narrow in a wide
 * window, and two columns there left each value some 50px. A value the row cuts keeps the whole of itself in its title.
 */
export function KeyValue({ items, columns = 1, className }: { items: KeyValueItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <div className={cn('@container min-w-0', className)}>
      <dl className={cn('grid min-w-0 grid-cols-1', columns === 2 && '@min-[40rem]:grid-cols-2 @min-[40rem]:gap-x-8')}>
        {items.map((it, i) => {
          // An unknown value is a dash, never a blank row or a "0" that was not measured.
          const unknown = it.value === null || it.value === undefined || it.value === '';
          return (
            <div key={i} className={cn('flex min-h-11 min-w-0 items-center gap-4 border-b border-line py-2.5 last:border-0', columns === 2 && '@min-[40rem]:[&:nth-last-child(2):nth-child(odd)]:border-0')}>
              <dt className="w-32 shrink-0 text-sm text-ink-3">{it.label}</dt>
              {/* The row's action is part of its value's definition: a `dl` row group may hold only a `dt` and its
                  `dd`s, and the button sat beside the value as a third child of the row. */}
              <dd
                title={it.wrap || unknown ? undefined : (it.title ?? (typeof it.value === 'string' || typeof it.value === 'number' ? String(it.value) : undefined))}
                className="t-num flex min-w-0 flex-1 items-center gap-4 text-sm text-ink"
              >
                <span
                  className={cn(
                    'min-w-0 flex-1',
                    // A value the row cuts keeps its whole text in its title, which a pointer reads and a phone cannot (issue
                    // #89). Below the width where a sentence value cannot fit beside its label the row wraps instead, the way
                    // `wrap` asks for, so nothing is left unreadable behind a hover that does not exist there.
                    it.wrap ? '[overflow-wrap:anywhere]' : 'truncate @max-[26rem]:whitespace-normal @max-[26rem]:[overflow-wrap:anywhere]',
                    it.mono && 'font-mono text-xs',
                  )}
                >
                  {unknown ? <span className="text-ink-3">—</span> : it.value}
                </span>
                {it.action ? <span className="-my-1 shrink-0">{it.action}</span> : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
