/**
 * What the Overview's tiles and chart read: each tile's label and definition, a bucket's label, and the change against
 * the previous window. Shared by the page that draws them and the context that tells the assistant the same words.
 */
import type { Overview } from '@/lib/api-shapes';

/** Each tile's label and what it counts. The tile's info button shows `hint`; the assistant reads it too. */
export const OVERVIEW_METRICS = {
  calls: { label: 'Tool calls', hint: 'Every call a platform door answered in the period, the refused ones included.' },
  progressing: { label: 'Initiatives progressing', hint: 'Median completeness of the open initiatives that declare a flow: absent documents count 0, written a half, approved 1. Closed work is left out, or the figure climbs to 100% and stays there.' },
  knowledge: (perHour: number) => ({ label: 'Knowledge from work', hint: `Share of the knowledge shelf written by initiatives rather than imported in bulk (more than ${perHour} nodes from one source in an hour). Higher is better.` }),
  context: (windowKb: number) => ({ label: 'Context per run', hint: `Median tool output one skill run pulls into an agent's context. One context window is about ${windowKb} KB at four bytes a token, a rule of thumb rather than a count. Lower is better.` }),
  refusals: { label: 'Refusal rate', hint: 'Share of tool calls a door refused rather than answered.' },
} as const;

/** A bucket's label on the deployment's calendar (`timezone` off the payload), never the viewer's and never UTC. */
export function bucketLabel(bucket: string, grain: Overview['grain'], timeZone: string): string {
  const d = new Date(bucket);
  if (grain === 'hour') return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  if (grain === 'month') return new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short', year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(d);
}

/** Change against the previous window as a fraction, or nothing: all time has no previous all time. */
export const change = (now: number | null, prev: number | null): number | null => (now === null || prev === null || prev === 0 ? null : now / prev - 1);
