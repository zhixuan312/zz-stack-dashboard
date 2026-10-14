import { gate } from '@/data/access';
import { PluginView } from '@/views/pages/plugin';

/** The page asks `plugins` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function PluginPage({ params }: { params: Promise<{ plugin: string }> }) {
  const denied = await gate('plugins');
  if (denied) return denied;
  return <PluginView params={params} />;
}
