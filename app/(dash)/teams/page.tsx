import { gate } from '@/data/access';
import { TeamsView } from '@/views/pages/teams';

/** The page asks `teams` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function TeamsPage() {
  const denied = await gate('teams');
  if (denied) return denied;
  return <TeamsView />;
}
