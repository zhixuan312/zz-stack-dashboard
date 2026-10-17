import { gate, gatedMetadata } from '@/data/access';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { readFirst } from '../read';

export function generateMetadata() { return gatedMetadata('knowledge', { title: 'Knowledge log' }); }

/**
 * Knowledge's log, at the address it keeps until Phase 7 removes it. The page asks `knowledge` before it renders, and its
 * first read, the log, is made here on the console's server with the person's own cookie, bounded. It is the active
 * team's log, for the superadmin too, as the rest of Work is.
 */
export default async function KnowledgeLogPage() {
  const denied = await gate('knowledge');
  if (denied) return denied;
  const read = await readFirst<{ entries: KnowledgeLogEntry[] }>('/knowledge/log');
  return <KnowledgeLogView read={read} />;
}
