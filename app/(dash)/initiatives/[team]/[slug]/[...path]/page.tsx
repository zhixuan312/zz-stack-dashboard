import { gate } from '@/data/access';
import { DocumentView } from '@/views/pages/document';

/** The page asks `initiatives` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function DocumentPage({ params }: { params: Promise<{ team: string; slug: string; path: string[] }> }) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  return <DocumentView params={params} />;
}
