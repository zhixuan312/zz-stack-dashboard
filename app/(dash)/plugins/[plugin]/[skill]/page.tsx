import { gate } from '@/data/access';
import { SkillView } from '@/views/pages/skill';

/** The page asks `plugins` before it renders, and before its address is read: the view unwraps `params` itself. */
export default async function PluginSkillPage({ params }: { params: Promise<{ plugin: string; skill: string }> }) {
  const denied = await gate('plugins');
  if (denied) return denied;
  return <SkillView params={params} />;
}
