import { gate } from '@/data/access';
import { InitiativeView } from '@/views/pages/initiative';

/** The page asks `initiatives` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function InitiativePage({ params }: { params: Promise<{ team: string; slug: string }> }) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  return <InitiativeView params={params} />;
}
