import { gate } from '@/data/access';
import { RunsView } from '@/views/pages/runs';

/** The page asks `runs` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function RunsPage() {
  const denied = await gate('runs');
  if (denied) return denied;
  return <RunsView />;
}
