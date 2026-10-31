'use client';

import { useEffect, useState } from 'react';

/**
 * Whether `key` was already the chart's at the last frame: false for the one frame after it changes, true on the first
 * render and ever after. A chart draws its marks at once and its data table, which nobody sees, a frame later, so a
 * change of period commits the marks without the table's rows: Home's year at 7D, three charts of 52 windows, dropped a
 * frame on a mid-range phone when every row came in the same frame as the columns.
 */
export function useSettled(key: string): boolean {
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    if (settled === key) return;
    const id = requestAnimationFrame(() => setSettled(key));
    return () => cancelAnimationFrame(id);
  }, [key, settled]);
  return settled === key;
}
