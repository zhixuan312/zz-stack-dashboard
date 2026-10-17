import { LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** Status on its way: its one tile. */
export default function PlatformStatusLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'status', title: 'Status' })}>
      <TilesSkeleton count={1} />
    </LoadingPage>
  );
}
