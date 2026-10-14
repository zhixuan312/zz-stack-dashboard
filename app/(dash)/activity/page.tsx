import { gate } from '@/data/access';
import { ActivityView } from '@/views/pages/activity';

/** The page asks `activity` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function ActivityPage() {
  const denied = await gate('activity');
  if (denied) return denied;
  return <ActivityView />;
}
