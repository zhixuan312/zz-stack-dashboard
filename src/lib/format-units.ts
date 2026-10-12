/**
 * The console's own formatters, beside Meridian's `format.ts`, which is the release's file and is left as it is.
 *
 * Three things the platform counts that the release has no word for on its own: a plain count, which the release
 * formats but does not export by name; a run's span in seconds; and tool output in KB.
 */
import { FORMATTERS } from './format';

/** A whole number with thousands separators, or a dash for nothing: the release's own count format, by name. */
export const formatCount: (n: number | null) => string = FORMATTERS.count;

/** A run's span in seconds, at the unit a person reads it in: `< 1 s`, `42 s`, `7 min`, `1.4 h`. */
export function formatSeconds(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—';
  if (s < 1) return s === 0 ? '0 s' : '< 1 s';
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

/** Bytes moved, given in KB: `840 KB`, `1.6 MB`. */
export function formatKb(kb: number | null): string {
  if (kb === null || !Number.isFinite(kb)) return '—';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
