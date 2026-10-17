import { gate, gatedMetadata } from '@/data/access';
import PlatformPeoplePage from '../platform/people/page';

export function generateMetadata() { return gatedMetadata('people', { title: 'People' }); }

/** Today's address, which renders Platform's People until Phase 7 removes it. It asks `people` first, as that page does. */
export default async function PeoplePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('people');
  if (denied) return denied;
  return <PlatformPeoplePage {...props} />;
}
