import { gate } from '@/data/access';
import { SettingsView } from '@/views/pages/settings';

/** The page asks `settings` before it renders; the rail hiding a destination is presentation, never this gate. */
export default async function SettingsPage() {
  const denied = await gate('settings');
  if (denied) return denied;
  return <SettingsView />;
}
