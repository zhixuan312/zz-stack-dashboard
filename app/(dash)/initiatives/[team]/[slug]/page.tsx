import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { InitiativeClose, InitiativeLead, InitiativeMeta, InitiativeTitle, InitiativeView } from '@/views/pages/initiative';
import { readInitiative } from '../../read-initiatives';

type Params = { params: Promise<{ team: string; slug: string }> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('initiatives', { title: (await params).slug });
}

/**
 * The page asks `initiatives` before it renders, and before its address is read. The initiative is then read once, on
 * the console's server as the person, before anything is drawn, as a document's page is: the title is the work's name,
 * which its documents carry, so the masthead waits for the read with the body, and `loading.tsx` stands meanwhile. The
 * one read is handed to the title, the lead, the state, Close and the body.
 */
export default async function InitiativePage({ params }: Params) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const { team, slug } = await params;
  const served = await readInitiative(team, slug);
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
      title={<InitiativeTitle team={team} slug={slug} served={served} />}
      description={<InitiativeLead team={team} slug={slug} served={served} />}
      meta={<InitiativeMeta team={team} slug={slug} served={served} />}
      actions={<InitiativeClose team={team} slug={slug} served={served} />}
    >
      <InitiativeView team={team} slug={slug} served={served} />
    </PageFrame>
  );
}
