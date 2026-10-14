import { gate } from '@/data/access';
import { PeopleView } from '@/views/pages/people';

/** The page asks `people` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function PeoplePage() {
  const denied = await gate('people');
  if (denied) return denied;
  return <PeopleView />;
}
