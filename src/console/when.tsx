import { formatDateTime, formatRelative } from '@/lib/format-date';

/**
 * A moment, as a person reads it in a list: "3 h ago", with the exact time in the deployment's zone on hover. Rendered
 * only once data has arrived in the browser, so the relative words never differ between server and client.
 */
export function When({ at, className }: { at: string | null; className?: string }) {
  if (!at) return <span className="text-ink-3">Never</span>;
  return <time dateTime={at} title={formatDateTime(at)} className={className}>{formatRelative(at)}</time>;
}
