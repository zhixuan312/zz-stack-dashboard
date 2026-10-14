import { gate } from '@/data/access';
import { PluginsView } from '@/views/pages/plugins';

/** The page asks `plugins` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function PluginsPage() {
  const denied = await gate('plugins');
  if (denied) return denied;
  return <PluginsView />;
}
