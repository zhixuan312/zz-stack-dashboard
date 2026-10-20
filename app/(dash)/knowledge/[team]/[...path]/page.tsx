import { gate, gatedMetadata } from '@/data/access';
import type { KnowledgeBody } from '@/lib/api-shapes';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { decodePath } from '@/lib/store-path';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { readFirst } from '../../read';

type Params = { params: Promise<{ team: string; path: string[] }> };

/** The node's title is the record's, which only its read knows; a gated title never names it, and an address that
 *  names no node is titled as the missing page it draws. */
export async function generateMetadata({ params }: Params) {
  const { team, path } = await params;
  return decodePath([team]) === null || decodePath(path) === null ? MISSING_METADATA : gatedMetadata('knowledge', { title: 'Knowledge' });
}

/**
 * The page asks `knowledge` before it renders, and before its address is read. Next hands the address's segments as
 * they were sent, still escaped; an address that names no store path, an escape that does not decode or a `..` among
 * its segments, is the missing page, and nothing is read. Its first read, the node, is made here on the console's
 * server with the person's own cookie, bounded, at the gateway route that mirrors the page's own address, each segment
 * escaped again; the gateway answers the active team's lessons and the shared shelf's, and nothing of another team's.
 */
export default async function KnowledgeNodePage({ params }: Params) {
  const denied = await gate('knowledge');
  if (denied) return denied;
  const { team: sent, path } = await params;
  const [team, rel] = [decodePath([sent]), decodePath(path)];
  if (team === null || rel === null) return <MissingPage />;
  return <KnowledgeNodeView read={await readFirst<KnowledgeBody>(knowledgeNodeHref(team, rel))} team={team} rel={rel} />;
}
