import { gate, may } from '@/data/access';
import { FEATURES } from '@/data/features';
import { DocumentView } from '@/views/pages/document';

/**
 * The page asks `initiatives` before it renders, and before its address is read: the view unwraps `params` itself.
 * Whether the reader may open the team's page under Platform is their `/me` answer, asked here once the gate has placed
 * them, so the breadcrumb is a link or plain text in the first paint and never changes at hydration.
 */
export default async function DocumentPage({ params }: { params: Promise<{ team: string; slug: string; path: string[] }> }) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const teamPage = await may(FEATURES.teams.needs);
  return <DocumentView params={params} teamPage={teamPage} />;
}
