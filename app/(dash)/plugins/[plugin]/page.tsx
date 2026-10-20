import Link from 'next/link';
import { cache } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import { PluginView } from '@/views/pages/plugin';
import type { PluginRead } from '@/views/plugin-context';
import { readPlugin } from '../read-plugins';

type Params = { params: Promise<{ plugin: string }> };

/** The plugin's reads, made once a request: the tab and the page are decided by the same answer. */
const readOnce = cache(readPlugin);

/** A name the catalog does not list and nothing registered for evaluation, both read. An evaluation the gateway
 *  withholds from this reader counts as nothing registered for them; a read that failed or is slow names nothing. */
function unknown(plugin: string, read: PluginRead): boolean {
  const listed = read.catalog.state === 'ok' && read.catalog.data.plugins.some((p) => p.plugin === plugin);
  const registered = read.evaluation.state === 'ok' && read.evaluation.data.found;
  return read.catalog.state === 'ok' && !listed && !registered && read.evaluation.state !== 'failed' && read.evaluation.state !== 'slow';
}

/** The tab names the plugin, or says "Not found" for a name nobody registered, as it does for an address that names
 *  nothing. A refused reader is answered before anything is read. */
export async function generateMetadata({ params }: Params) {
  const titled = { title: (await params).plugin };
  const gated = await gatedMetadata('plugins', titled);
  if (gated !== titled) return gated;
  return unknown(titled.title, await readOnce(titled.title)) ? MISSING_METADATA : titled;
}

/**
 * The page asks `plugins` before it renders, and before its address is read. Its three reads, the catalog, the owning
 * team's evaluation and the scores' series, are made together on the console's server as the person, before the
 * masthead, because a name nobody registered is answered by the missing page, exactly as an address that names nothing
 * is: the same body and the same tab.
 */
export default async function PluginPage({ params }: Params) {
  const denied = await gate('plugins');
  if (denied) return denied;
  const { plugin } = await params;
  const read = await readOnce(plugin);
  if (unknown(plugin, read)) return <MissingPage />;
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
