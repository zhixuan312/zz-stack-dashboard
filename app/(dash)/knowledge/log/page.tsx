import { gate } from '@/data/access';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';

/** The page asks `knowledge` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function KnowledgeLogPage() {
  const denied = await gate('knowledge');
  if (denied) return denied;
  return <KnowledgeLogView />;
}
