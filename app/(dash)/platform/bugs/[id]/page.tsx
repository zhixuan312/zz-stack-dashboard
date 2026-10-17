import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { MissingPage } from '@/views/no-access';
import { PlatformBugView } from '@/views/pages/platform-bug';
import { readBug, readDuplicates } from '../read-bugs';

type Params = { params: Promise<{ id: string }> };

export function generateMetadata() { return gatedMetadata('bug', { title: 'Bug report' }); }

/**
 * The page asks `bug`, the superadmin's, before it renders and before its address is read: a member is answered by the
 * refused page, and nothing is read for them. Its two reads, the report and its duplicate targets, are made together on
 * the console's server as the person, before the masthead, because an id that names no report is answered by the
 * missing page, exactly as an address that names nothing is.
 */
export default async function PlatformBugPage({ params }: Params) {
  const denied = await gate('bug');
  if (denied) return denied;
  const { id } = await params;
  const [read, duplicates] = await Promise.all([readBug(id), readDuplicates(id)]);
  if (read.state === 'missing') return <MissingPage />;
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.platform.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/platform/bugs" className="hit rounded-xs hover:text-ink">Bugs</Link>
        </span>
      }
      title="Bug report"
      description="What the reporter wrote, what it is about, and what was decided."
    >
      <PlatformBugView id={id} served={read} duplicates={duplicates} />
    </PageFrame>
  );
}
