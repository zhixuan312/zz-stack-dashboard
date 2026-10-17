import { gate, gatedMetadata } from '@/data/access';
import { ActivityView } from '@/views/pages/activity';
import { readSummary } from './read-summary';

export function generateMetadata() { return gatedMetadata('activity', { title: 'Activity' }); }

/**
 * The page asks `activity` before it renders; the rail hiding a destination is presentation, never this gate. Its first
 * read, the summary, is made here on the console's server with the person's own cookie, bounded, and handed to the page;
 * the log, its filters and its pages are read in the browser.
 */
export default async function ActivityPage() {
  const denied = await gate('activity');
  if (denied) return denied;
  return <ActivityView read={await readSummary()} />;
}
