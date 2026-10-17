import { formatDateTime, formatRelative } from '@/lib/format-date';

/**
 * When something last happened, against the read's own cutoff: the data's clock, so the server's first paint and the
 * browser's hydration draw the same words, never the browser's clock at render. The exact time is in its title.
 */
export function Since({ at, asOf, never = 'Never' }: { at: string | null; asOf: string; never?: string }) {
  if (!at) return <span className="text-ink-3">{never}</span>;
  return <time dateTime={at} title={formatDateTime(at)}>{formatRelative(at, new Date(asOf))}</time>;
}
