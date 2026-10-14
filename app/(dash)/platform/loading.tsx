import { LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';

/** Status on its way: its one tile. */
export default function PlatformStatusLoading() {
  return (
    <LoadingPage name="status" title="Status">
      <TilesSkeleton count={1} />
    </LoadingPage>
  );
}
