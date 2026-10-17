import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { EvaluationAsOf, EvaluationSkeleton, PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import type { EvaluationRead } from '@/views/platform-evaluation-context';
import { readEvaluation } from './read-evaluation';

export function generateMetadata() { return gatedMetadata('evaluation', { title: 'Evaluation' }); }

/**
 * The page asks `evaluation` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read, made on the console's server
 * with the caller's own cookie, is shared by the as-of line and the page. The page reads only: an evaluation is run and
 * a finding decided through zz-plugin-eval's tools.
 */
export default async function PlatformEvaluationPage() {
  const denied = await gate('evaluation');
  if (denied) return denied;
  const read = readEvaluation();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Evaluation"
      description="Each plugin's score as the platform recorded it, which scores compare, and the findings still waiting for a decision."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="evaluation"><EvaluationSkeleton /></Busy>}>
        <EvaluationBody read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<EvaluationRead> }) {
  return <EvaluationAsOf read={await read} />;
}

async function EvaluationBody({ read }: { read: Promise<EvaluationRead> }) {
  return <PlatformEvaluationView read={await read} />;
}
