'use client';

import { useCallback, useState } from 'react';

/** The rendered size of an element, kept current. Charts draw in real pixels, so a stroke is never stretched. The ref is a
 *  callback, so an element that first renders after mount is measured too, and one that leaves stops being watched. */
export function useSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
