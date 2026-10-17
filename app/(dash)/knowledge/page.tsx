import { gate, gatedMetadata } from '@/data/access';
import type { KnowledgeSummary } from '@/lib/destination-shapes';
import { KnowledgeView } from '@/views/pages/knowledge';
import { readFirst } from './read';

export function generateMetadata() { return gatedMetadata('knowledge', { title: 'Knowledge' }); }

/**
 * The page asks `knowledge` before it renders; the rail hiding a destination is presentation, never this gate. Its first
 * read, the summary, is made here on the console's server with the person's own cookie, bounded, and handed to the page;
 * the search and the shelf's pages are read in the browser.
 */
export default async function KnowledgePage() {
  const denied = await gate('knowledge');
  if (denied) return denied;
  return <KnowledgeView read={await readFirst<KnowledgeSummary>('/knowledge/summary')} />;
}
