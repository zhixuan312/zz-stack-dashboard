import { gate } from '@/data/access';
import { TeamView } from '@/views/pages/team';

/** The page asks `teams` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await gate('teams');
  if (denied) return denied;
  return <TeamView params={params} />;
}
