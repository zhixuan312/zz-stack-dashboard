import { gate } from '@/data/access';
import { KnowledgeView } from '@/views/pages/knowledge';

/** The page asks `knowledge` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function KnowledgePage() {
  const denied = await gate('knowledge');
  if (denied) return denied;
  return <KnowledgeView />;
}
