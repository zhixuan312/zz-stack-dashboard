import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';

/** A skill on its way: four tiles, then its cost beside what it is. The title is the record's, so it stays a skeleton. */
export default function SkillLoading() {
  return (
    <LoadingPage name="skill">
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
    </LoadingPage>
  );
}
