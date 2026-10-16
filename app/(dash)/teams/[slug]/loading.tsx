import { LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';

/**
 * A team on its way: four tiles, then its members. The title is the record's, so it stays a skeleton.
 *
 * DELIBERATE: one table. The team's initiatives are not a list on its page — Work answers the active team's work
 * alone, so another team's is read nowhere in the console — and a skeleton for a table the page never draws is a page
 * that shrinks under the reader the moment the record arrives.
 */
export default function TeamLoading() {
  return (
    <LoadingPage name="team">
      <TilesSkeleton count={4} />
      <TableSkeleton rows={5} filters={false} />
    </LoadingPage>
  );
}
