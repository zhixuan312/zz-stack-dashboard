import Link from 'next/link';
import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy, ChartSkeleton, TableSkeleton } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import type { InitiativeRead } from '@/views/initiative-context';
import { InitiativeClose, InitiativeMeta, InitiativeView, SlugTitle } from '@/views/pages/initiative';
import { readInitiative } from '../../read-initiatives';

type Params = { params: Promise<{ team: string; slug: string }> };
type Read = { team: string; slug: string; read: Promise<InitiativeRead> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('initiatives', { title: (await params).slug });
}

/**
 * The page asks `initiatives` before it renders, and before its address is read. The masthead is the slug and a
 * sentence, so it stands outside the boundaries that wait for the initiative's one read, made on the console's server
 * as the person and shared by the state, Close and the body.
 */
export default async function InitiativePage({ params }: Params) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const { team, slug } = await params;
  const read = readInitiative(team, slug);
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.main.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/initiatives" className="hit rounded-xs hover:text-ink">Initiatives</Link>
          <span aria-hidden className="text-ink-3">/</span>
          <span>{team}</span>
        </span>
      }
      title={<SlugTitle slug={slug} />}
      description="Read from the document store; the platform stamped every gate."
      meta={<Suspense fallback={null}><Meta team={team} slug={slug} read={read} /></Suspense>}
      actions={<Suspense fallback={null}><Close team={team} slug={slug} read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="initiative"><ChartSkeleton height="h-24" /><TableSkeleton rows={5} filters={false} /><TableSkeleton rows={3} filters={false} /></Busy>}>
        <Body team={team} slug={slug} read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function Meta({ team, slug, read }: Read) {
  return <InitiativeMeta team={team} slug={slug} served={await read} />;
}

async function Close({ team, slug, read }: Read) {
  return <InitiativeClose team={team} slug={slug} served={await read} />;
}

async function Body({ team, slug, read }: Read) {
  return <InitiativeView team={team} slug={slug} served={await read} />;
}
