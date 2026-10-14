import { LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';

/** A team on its way: four tiles, then its initiatives and its members. The title is the record's, so it stays a skeleton. */
export default function TeamLoading() {
  return (
    <LoadingPage name="team">
      <TilesSkeleton count={4} />
      <TableSkeleton rows={5} filters={false} />
      <TableSkeleton rows={4} filters={false} />
    </LoadingPage>
  );
}
