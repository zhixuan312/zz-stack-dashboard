import { gate, gatedMetadata } from '@/data/access';
import PlatformTeamPage from '../../platform/teams/[slug]/page';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('teams', { title: (await params).slug });
}

/** Today's address, which renders Platform's team page until Phase 7 removes it. It asks `teams` first, as that page does. */
export default async function TeamPage(props: Params) {
  const denied = await gate('teams');
  if (denied) return denied;
  return <PlatformTeamPage {...props} />;
}
