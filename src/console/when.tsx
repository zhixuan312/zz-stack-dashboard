'use client';

import { formatDateTime, formatRelative } from '@/lib/format-date';
import { useDataClock } from '@/lib/api';

/**
 * A moment, as a person reads it in a list: "3 h ago", with the exact time in the deployment's zone on hover. Rendered
 * only once data has arrived in the browser, so the relative words never differ between server and client.
 *
 * The clock is the data's (`useDataClock`), never `new Date()` at render: over a page left open for an hour the browser
 * clock would keep re-reading "just now" about rows that arrived before it.
 */
export function When({ at, className }: { at: string | null; className?: string }) {
  const now = useDataClock();
  if (!at) return <span className="text-ink-3">Never</span>;
  return <time dateTime={at} title={formatDateTime(at)} className={className}>{formatRelative(at, now)}</time>;
}
