'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * A metric's number counting up to its value when it lands — the ARRIVE register of
 * app/motion.css, for the one thing CSS cannot animate: text.
 *
 * It takes the formatted string the tile was going to print anyway ("1,114", "6.3%", "13 KB"),
 * animates the first number in it and keeps everything around it, so no formatter is duplicated
 * here. A string with no number in it ("—") prints as it is.
 *
 * Three things keep it honest:
 *   - The element's text is always the final value. The counting figure is painted over it by
 *     `.ticker[data-shown]::after` (app/motion.css) while the real text is transparent, so the
 *     tile is its final width from the first frame and nothing beside the number moves.
 *   - Screen readers, copy-paste and `textContent` only ever see the final value.
 *   - `prefers-reduced-motion: reduce` prints the value and never starts the clock.
 *     COUPLED: `checks/motion.ts` asserts that query stays in this file.
 *
 * When the value changes — a new period picked — it counts from the old figure to the new one,
 * so the reader sees which way it moved.
 */
export function Ticker({ value }: { value: string }) {
  const parsed = parse(value);
  // `null` when nothing is counting: the element is then plain text.
  const [shown, setShown] = useState<string | null>(null);
  const from = useRef<number | null>(null);

  useLayoutEffect(() => {
    // No `matchMedia` (a test DOM) is treated as reduced: print the value, start no clock.
    const reduce = typeof window.matchMedia !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current ?? 0;
    if (parsed) from.current = parsed.n;
    const first = !parsed || reduce || start === parsed.n ? null : render(parsed, start);
    // DELIBERATE: a synchronous set, in a layout effect, is the point — the first frame has to be
    // painted at the start value before the browser paints the final one, or the number flashes
    // its answer and then drops to zero.
    setShown(first);
    if (!parsed || first === null) return;

    let raf = 0;
    // The figure on screen right now. An interrupted count — a new value arriving mid-flight,
    // or React's development double-mount — hands it back as the next count's start, so the
    // number never jumps and a remount still counts.
    let at = start;
    const t0 = performance.now() + DELAY_MS;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / DURATION_MS));
      at = start + (parsed.n - start) * (1 - Math.pow(1 - t, 3));
      setShown(t >= 1 ? null : render(parsed, at));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (at !== parsed.n) from.current = at;
    };
    // `parsed` is derived from `value`; keying on the string is the whole dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className="ticker" data-shown={shown ?? undefined}>{value}</span>;
}

/** Matches `--dur-grow` and the bars' own delay, so a tile's number and its mark land together. */
const DURATION_MS = 720;
const DELAY_MS = 120;

interface Parsed { before: string; n: number; decimals: number; grouped: boolean; after: string }

function parse(value: string): Parsed | null {
  const m = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(value);
  if (!m) return null;
  const digits = m[2];
  const n = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return {
    before: m[1],
    n,
    decimals: digits.includes('.') ? digits.split('.')[1].length : 0,
    grouped: digits.includes(','),
    after: m[3],
  };
}

function render(p: Parsed, n: number): string {
  const body = n.toLocaleString('en-US', {
    minimumFractionDigits: p.decimals,
    maximumFractionDigits: p.decimals,
    useGrouping: p.grouped,
  });
  return `${p.before}${body}${p.after}`;
}
