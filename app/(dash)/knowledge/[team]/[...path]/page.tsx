import { gate } from '@/data/access';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';

/** The page asks `knowledge` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function KnowledgeNodePage({ params }: { params: Promise<{ team: string; path: string[] }> }) {
  const denied = await gate('knowledge');
  if (denied) return denied;
  return <KnowledgeNodeView params={params} />;
}
