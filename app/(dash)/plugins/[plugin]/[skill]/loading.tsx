import { ChartSkeleton, LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';

/**
 * A skill on its way: four tiles, then the region its own record fills. The title is the record's, so it stays a skeleton.
 *
 * COUPLED: the region is `h-72` because that is what the cost view reserves while its read is in flight
 * (`src/views/pages/skill.tsx`'s `Query … skeleton={<Skeleton className="h-72 rounded-lg" />}`) — the frame owes
 * the page the room the page means to take. It drew TWO `h-48` charts in a `split="1/2"` row until 2026-10-16,
 * 96px short of the page, and `/plugins/research-kit/research-scan` read CLS **0.106** against a 0.1 bar on a
 * machine the coordinator had measured as having nothing else running. `span.shimmer.block` 0.066 was the largest
 * mover, with the card and the container 0.040 each: the skeleton shrinking as the page arrived, which is the
 * shift this file exists to prevent. `tests/routes-shape.test.tsx` now holds every route to the height its view
 * declares, so this cannot drift back.
 */
export default function SkillLoading() {
  return (
    <LoadingPage name="skill">
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-72" />
    </LoadingPage>
  );
}
