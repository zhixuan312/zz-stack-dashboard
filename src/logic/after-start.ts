import { formatDuration } from '../lib/format';

/**
 * When an update came, counted from the incident's start in the product's durations: "after 42m", "after 2.6h". The
 * question a reader has of a timeline is how long each step took, and time ago answers a different one. An update
 * inside the first minute, or timed before the start, came at the start.
 */
export function afterStart(started: string, at: string) {
  const ms = new Date(at).getTime() - new Date(started).getTime();
  return ms < 60_000 ? 'at the start' : `after ${formatDuration(ms)}`;
}
