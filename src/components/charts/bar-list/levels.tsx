'use client';

import { cn } from '../../../lib/cn';
import { useSize } from '../use-size';

/**
 * The levels row under a Bar list's axis, each a word at its share of the row. Measured so no two words that show stand
 * closer than 4px: from the top inward, a word that would touch the nearest one kept above it, or the first, is kept but
 * drawn invisible. The first and the top always show, and an unmeasured row hides none.
 */
export function Levels({ levels }: { levels: [word: string, at: number][] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const last = levels.length - 1;
  // A word is 7px a character: wider than the 6.5px Diverging bars counts for the same 11px words, so a pair it keeps
  // has room to spare. Anchored at its left edge when first, its right edge when the top and its centre otherwise.
  const box = (i: number) => {
    const w = levels[i][0].length * 7, x = levels[i][1] * width - (i === 0 ? 0 : i === last ? w : w / 2);
    return [x, x + w];
  };
  const hidden = new Set<number>();
  if (width) for (let i = last - 1, edge = box(last)[0]; i > 0; i--) {
    const [l, r] = box(i);
    if (r + 4 > edge || l - 4 < box(0)[1]) hidden.add(i);
    else edge = l;
  }
  return (
    <div ref={ref} aria-hidden className="relative mt-1.5 h-4 text-2xs leading-4 text-ink-3">
      {levels.map(([word, at], i) => (
        <span key={at} data-level className={cn('absolute tabular-nums', i === 0 ? '' : i === last ? '-translate-x-full' : '-translate-x-1/2', hidden.has(i) && 'invisible')} style={{ left: `${at * 100}%` }}>{word}</span>
      ))}
    </div>
  );
}
