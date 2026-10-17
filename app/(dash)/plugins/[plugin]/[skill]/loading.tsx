import { app, workspaces } from '@/app.config';
import { ChartSkeleton, LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * A skill on its way: four tiles, then the region its own record fills. The title is the record's, so it stays a skeleton.
 *
 * COUPLED: the region is `h-72` because that is what the runs view reserves while its record is in flight
 * (`src/views/pages/skill.tsx`'s `<Skeleton className="h-72 rounded-lg" />`) — the frame owes the page the room the page
 * means to take. It drew TWO `h-48` charts in a `split="1/2"` row until 2026-10-16, 96px short of the page, and
 * `/plugins/research-kit/research-scan` read CLS **0.106** against a 0.1 bar: the skeleton shrinking as the page
 * arrived, which is the shift this file exists to prevent.
 */
export default function SkillLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'skill', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-72" />
    </LoadingPage>
  );
}
