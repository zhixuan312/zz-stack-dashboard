import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { MissingPage } from '@/views/no-access';
import { PluginView } from '@/views/pages/plugin';
import { readPlugin } from '../read-plugins';

type Params = { params: Promise<{ plugin: string }> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('plugins', { title: (await params).plugin });
}

/**
 * The page asks `plugins` before it renders, and before its address is read. Its two reads, the catalog and the owning
 * team's evaluation, are made together on the console's server as the person, before the masthead, because a name the
 * catalog does not list and nothing registered for evaluation is answered by the missing page, exactly as an address
 * that names nothing is. An evaluation the gateway withholds from this reader counts as nothing registered for them.
 */
export default async function PluginPage({ params }: Params) {
  const denied = await gate('plugins');
  if (denied) return denied;
  const { plugin } = await params;
  const read = await readPlugin(plugin);
  const listed = read.catalog.state === 'ok' && read.catalog.data.plugins.some((p) => p.plugin === plugin);
  const registered = read.evaluation.state === 'ok' && read.evaluation.data.found;
  if (read.catalog.state === 'ok' && !listed && !registered && read.evaluation.state !== 'failed' && read.evaluation.state !== 'slow') return <MissingPage />;
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.main.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/plugins" className="hit rounded-xs hover:text-ink">Plugins</Link>
        </span>
      }
      title={plugin}
      description="One plugin: how to install it, its public score and whether its scores compare, and every skill it ships."
    >
      <PluginView name={plugin} served={read} />
    </PageFrame>
  );
}
