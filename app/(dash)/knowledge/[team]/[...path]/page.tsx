import { gate, gatedMetadata } from '@/data/access';
import type { KnowledgeBody } from '@/lib/api-shapes';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { readFirst } from '../../read';

/** The node's title is the record's, which only its read knows; a gated title never names it. */
export function generateMetadata() { return gatedMetadata('knowledge', { title: 'Knowledge' }); }

/**
 * The page asks `knowledge` before it renders, and before its address is read. Its first read, the node, is made here on
 * the console's server with the person's own cookie, bounded; the gateway answers the active team's lessons and the
 * shared shelf's, and nothing of another team's.
 */
export default async function KnowledgeNodePage({ params }: { params: Promise<{ team: string; path: string[] }> }) {
  const denied = await gate('knowledge');
  if (denied) return denied;
  const { team: rawTeam, path } = await params;
  const team = decodeURIComponent(rawTeam);
  const rel = path.map(decodeURIComponent).join('/');
  return <KnowledgeNodeView read={await readFirst<KnowledgeBody>(`/knowledge/${team}/${rel}`)} team={team} rel={rel} />;
}
