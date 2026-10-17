import { gate, gatedMetadata, may } from '@/data/access';
import { FLEET } from '@/data/features';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { readFirst } from '../read';

export function generateMetadata() { return gatedMetadata('knowledge', { title: 'Knowledge log' }); }

/**
 * Knowledge's log, at the address it keeps until Phase 7 removes it. The page asks `knowledge` before it renders, and its
 * first read, the log, is made here on the console's server with the person's own cookie, bounded. Whose log it is, is
 * settled here too, as `view_knowledge_log` settles it: the server's read asks for the platform's scope, which the
 * gateway grants a superadmin alone, so the page says what was read rather than what the browser's scope switch shows.
 */
export default async function KnowledgeLogPage() {
  const denied = await gate('knowledge');
  if (denied) return denied;
  const [read, wide] = await Promise.all([readFirst<{ entries: KnowledgeLogEntry[] }>('/knowledge/log'), may(FLEET)]);
  return <KnowledgeLogView read={read} mode={wide ? 'platform' : 'team'} />;
}
