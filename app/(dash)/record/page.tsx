import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { RecordActions, RecordAsOf, RecordSkeleton, RecordView } from '@/views/pages/record';
import { filtersOf, type RecordServed } from '@/views/record-context';
import { readRecord } from './read-record';

export function generateMetadata() { return gatedMetadata('record', { title: 'Record' }); }

/**
 * The page asks `record` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, the period control usable before it answers, and the one
 * read of the address's period and page, made on the console's server as the person, is shared by the as-of line,
 * `Copy as text` and the body.
 */
export default async function RecordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('record');
  if (denied) return denied;
  const read = searchParams.then((params) => readRecord(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Record"
      description="What your team's text would take one person to write, and the work of the period you choose."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      actions={<Suspense fallback={<RecordActions served={null} />}><Actions read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="record"><RecordSkeleton /></Busy>}>
        <Body read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<RecordServed> }) {
  return <RecordAsOf served={await read} />;
}

async function Actions({ read }: { read: Promise<RecordServed> }) {
  return <RecordActions served={await read} />;
}

async function Body({ read }: { read: Promise<RecordServed> }) {
  return <RecordView served={await read} />;
}
