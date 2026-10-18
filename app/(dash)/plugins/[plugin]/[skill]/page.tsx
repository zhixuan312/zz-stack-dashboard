import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { MissingPage } from '@/views/no-access';
import { SkillTabs, SkillView } from '@/views/pages/skill';
import { viewOf } from '@/views/skill-view';
import { readSkill } from '../../read-plugins';

type Params = { params: Promise<{ plugin: string; skill: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('plugins', { title: (await params).skill });
}

/**
 * The page asks `plugins` before it renders, and before its address is read. Its four reads are made together on the
 * console's server as the person, before the masthead, because a skill its plugin does not ship is answered by the
 * missing page, exactly as an address that names nothing is. The view is the address's, read here, so the first paint
 * is the view it asked for.
 */
export default async function PluginSkillPage({ params, searchParams }: Params) {
  const denied = await gate('plugins');
  if (denied) return denied;
  const [{ plugin, skill }, query] = await Promise.all([params, searchParams]);
  const read = await readSkill(plugin, skill);
  if (read.text.state === 'missing') return <MissingPage />;
  const view = viewOf(query.view);
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.main.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/plugins" className="hit rounded-xs hover:text-ink">Plugins</Link>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href={`/plugins/${plugin}`} className="hit rounded-xs hover:text-ink">{plugin}</Link>
        </span>
      }
      title={skill}
      description="One skill a plugin ships: how your team's runs of it went, the text itself, and what ships beside it."
      toolbar={<SkillTabs plugin={plugin} skill={skill} view={view} served={read} />}
    >
      <SkillView plugin={plugin} skill={skill} view={view} served={read} />
    </PageFrame>
  );
}
