import { gate, gatedMetadata } from '@/data/access';
import PlatformTeamsPage from '../platform/teams/page';

export function generateMetadata() { return gatedMetadata('teams', { title: 'Teams' }); }

/** Today's address, which renders Platform's Teams until Phase 7 removes it. It asks `teams` first, as that page does. */
export default async function TeamsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('teams');
  if (denied) return denied;
  return <PlatformTeamsPage {...props} />;
}
