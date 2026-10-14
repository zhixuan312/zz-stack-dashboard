import { ChartSkeleton, LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';

/** An initiative on its way: its progress, then its documents and its sources. The title is the record's, so it stays a skeleton. */
export default function InitiativeLoading() {
  return (
    <LoadingPage name="initiative">
      <ChartSkeleton height="h-24" />
      <TableSkeleton rows={5} filters={false} />
      <TableSkeleton rows={3} filters={false} />
    </LoadingPage>
  );
}
