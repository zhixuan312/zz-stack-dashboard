import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gate, gatedMetadata } from '@/data/access';
import { PluginsView } from '@/views/pages/plugins';
import type { PluginsRead } from '@/views/plugins-context';
import { readPlugins } from './read-plugins';

export function generateMetadata() { return gatedMetadata('plugins', { title: 'Plugins' }); }

/**
 * The page asks `plugins` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundary that waits for the read, and the one read of the catalog, made on the console's
 * server as the person, is handed to the list. The search narrows it in the browser: the catalog is one read whatever
 * the address holds.
 */
export default async function PluginsPage() {
  const denied = await gate('plugins');
  if (denied) return denied;
  const read = readPlugins();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Plugins"
      description="What a person installs: each plugin's skills and the servers they call, under one version, with its latest public score."
    >
      <Suspense fallback={<Busy name="plugins"><RecordsSkeleton rows={6} /></Busy>}>
        <Catalog read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function Catalog({ read }: { read: Promise<PluginsRead> }) {
  return <PluginsView served={await read} />;
}
