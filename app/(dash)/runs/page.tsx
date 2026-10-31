import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/console/gate';
import { RunsActions, RunsAsOf, RunsSkeleton, RunsView } from '@/views/pages/runs';
import { filtersOf, type RunsRead, type SkillPages } from '@/logic/runs-context';
import { readRunSkills, readRuns, readSkillPages } from './read-runs';

export function generateMetadata() { return gatedMetadata('runs', { title: 'Runs' }); }

/**
 * The page asks `runs` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, the skill control usable before it answers, and the one
 * read of the address's skill and page of recent runs, made on the console's server as the person, is shared by the
 * as-of line, the skill control and the body. The skill control also offers every skill the team ran, which a read
 * narrowed to one skill does not hold (`readRunSkills`). The body also waits for the catalog's skill addresses, read beside it,
 * so a skill's row opens its page.
 */
export default async function RunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('runs');
  if (denied) return denied;
  const filters = searchParams.then(filtersOf);
  const read = filters.then(readRuns);
  const skills = filters.then((f) => readRunSkills(f, read));
  const pages = readSkillPages();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Runs"
      description="Every run your team recorded, by the skill that drove it, and the latest of them."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      actions={<Suspense fallback={<RunsActions served={null} />}><Actions read={read} skills={skills} /></Suspense>}
    >
      <Suspense fallback={<Busy name="runs"><RunsSkeleton /></Busy>}>
        <Body read={read} pages={pages} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<RunsRead> }) {
  return <RunsAsOf served={await read} />;
}

async function Actions({ read, skills }: { read: Promise<RunsRead>; skills: Promise<string[]> }) {
  const [served, ran] = await Promise.all([read, skills]);
  return <RunsActions served={served} skills={ran} />;
}

async function Body({ read, pages }: { read: Promise<RunsRead>; pages: Promise<SkillPages> }) {
  const [served, skillPages] = await Promise.all([read, pages]);
  return <RunsView served={served} pages={skillPages} />;
}
