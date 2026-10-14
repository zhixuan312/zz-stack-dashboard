'use client';

import { useEffect, useState } from 'react';

/** How long the typing has to stop before the address is written. */
const PAUSE_MS = 250;

/**
 * A search box over a view whose state is its address. It returns what the box shows, which follows every key, and the
 * setter the box calls; `write` is called with the text once the typing has stopped for a quarter of a second, so a
 * word asks the server once and not once a letter. Clearing writes at once. When the address changes for another
 * reason (a link, Back, "Clear filters") the box follows it.
 */
export function useSearchDraft(applied: string, write: (q: string) => void): [string, (q: string) => void] {
  const [draft, setDraft] = useState(applied);
  const [seen, setSeen] = useState(applied);
  if (seen !== applied) {
    setSeen(applied);
    setDraft(applied);
  }
  useEffect(() => {
    if (draft === applied) return;
    const t = setTimeout(() => write(draft), draft === '' ? 0 : PAUSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  return [draft, setDraft];
}
