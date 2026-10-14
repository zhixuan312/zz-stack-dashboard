import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';

/** A plugin on its way: four tiles, its fitness and its facts, then its skills. The title is the record's, so it stays a skeleton. */
export default function PluginLoading() {
  return (
    <LoadingPage name="plugin">
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-40" /><ChartSkeleton height="h-40" /></Row>
      <TableSkeleton rows={6} filters={false} />
    </LoadingPage>
  );
}
