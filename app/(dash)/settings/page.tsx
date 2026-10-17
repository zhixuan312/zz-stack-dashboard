import { gate, gatedMetadata } from '@/data/access';
import { SettingsView } from '@/views/pages/settings';

export function generateMetadata() { return gatedMetadata('settings', { title: 'Settings' }); }

/**
 * The page asks `settings` before it renders, as it did while it held what Access holds now, so a person who may not
 * open it is answered as an address that names nothing; it then says where its contents went, and nothing else.
 */
export default async function SettingsPage() {
  const denied = await gate('settings');
  if (denied) return denied;
  return <SettingsView />;
}
