import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** A plugin on its way: what it is beside its public score, then its skills. The title is the plugin's, so it stays a skeleton. */
export default function PluginLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'plugin', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>
      <TableSkeleton rows={6} filters={false} />
    </LoadingPage>
  );
}
