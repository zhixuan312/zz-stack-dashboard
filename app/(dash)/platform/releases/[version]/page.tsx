import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { MissingPage } from '@/views/no-access';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { readRelease } from '../read-releases';

type Params = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('releases', { title: `Release ${(await params).version}` });
}

/**
 * The page asks `releases` before it renders, and before its address is read. Its one read, made on the console's server
 * as the person, comes before the masthead, because a version the record does not hold is answered by the missing page,
 * exactly as an address that names nothing is: the masthead never names a release nobody recorded.
 */
export default async function PlatformReleasePage({ params }: Params) {
  const denied = await gate('releases');
  if (denied) return denied;
  const { version } = await params;
  const read = await readRelease(version);
  if (read.state === 'missing') return <MissingPage />;
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.platform.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/platform/releases" className="hit rounded-xs hover:text-ink">Releases</Link>
        </span>
      }
      title={`Release ${version}`}
      description="What changed, what clients must do, and what was observed in the 72 hours either side of it."
    >
      <PlatformReleaseView version={version} served={read} />
    </PageFrame>
  );
}
