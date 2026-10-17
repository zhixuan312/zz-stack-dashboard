import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import type { HomeRead } from '@/views/home-context';
import { HomeAsOf, HomeView } from '@/views/pages/home';
import { HomeSkeleton } from './home-skeleton';
import { readHome } from './read-home';

export function generateMetadata() { return gatedMetadata('home', { title: 'Home' }); }

/**
 * The landing page asks `home` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read is shared by the title, which is
 * the gateway's own sentence, the as-of line and the body.
 */
export default async function HomePage() {
  const denied = await gate('home');
  if (denied) return denied;
  const read = readHome();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      name="Home"
      title={<Title read={read} />}
      description="Your team's last whole week, what waits for you, and what is open."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="home"><HomeSkeleton /></Busy>}>
        <Body read={read} />
      </Suspense>
    </PageFrame>
  );
}

/** The gateway's sentence, as it wrote it; nothing when there is none, so the page's name heads it. */
async function Title({ read }: { read: Promise<HomeRead> }) {
  const r = await read;
  return r.state === 'ok' ? r.home.title.sentence : null;
}

async function AsOf({ read }: { read: Promise<HomeRead> }) {
  return <HomeAsOf read={await read} />;
}

async function Body({ read }: { read: Promise<HomeRead> }) {
  return <HomeView read={await read} />;
}
