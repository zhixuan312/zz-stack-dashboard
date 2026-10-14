import { gate } from '@/data/access';
import { OverviewView } from '@/views/pages/overview';

/** The landing page asks `home` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function OverviewPage() {
  const denied = await gate('home');
  if (denied) return denied;
  return <OverviewView />;
}
