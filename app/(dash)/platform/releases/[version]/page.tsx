import Link from 'next/link';
import { cache } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Prose } from '@/components/patterns/prose';
import { gate, gatedMetadata } from '@/data/access';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { lifted } from '@/views/platform-releases-context';
import { readRelease } from '../read-releases';

type Params = { params: Promise<{ version: string }> };

/** The release's read, made once a request: the tab and the page are decided by the same answer. */
const readOnce = cache(readRelease);

/** The tab names the release, or says "Not found" for a version the record does not hold, as it does for an address
 *  that names nothing. A refused reader is answered before anything is read. */
export async function generateMetadata({ params }: Params) {
  const { version } = await params;
  const titled = { title: `Release ${version}` };
  const gated = await gatedMetadata('releases', titled);
  if (gated !== titled) return gated;
  return (await readOnce(version)).state === 'missing' ? MISSING_METADATA : titled;
}

/**
 * The page asks `releases` before it renders, and before its address is read. Its one read, made on the console's server
 * as the person, comes before the masthead, because a version the record does not hold is answered by the missing page,
 * exactly as an address that names nothing is: neither the masthead nor the tab names a release nobody recorded.
 */
export default async function PlatformReleasePage({ params }: Params) {
  const denied = await gate('releases');
  if (denied) return denied;
  const { version } = await params;
  const read = await readOnce(version);
  if (read.state === 'missing') return <MissingPage />;
  // The changelog is drawn here, as prose: the browser is sent what it makes, never the renderer, so it reads the same
  // from the first paint through hydration.
  const notes = read.state === 'ok' ? { changelog: <Prose>{lifted(read.data.changelog)}</Prose> } : null;
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
      <PlatformReleaseView version={version} served={read} notes={notes} />
    </PageFrame>
  );
}
