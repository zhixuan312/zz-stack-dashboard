import Link from 'next/link';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { decodePath } from '@/lib/store-path';
import { MISSING_METADATA } from '@/views/missing';
import { MissingPage } from '@/views/no-access';
import { InitiativeClose, InitiativeLead, InitiativeMeta, InitiativeTitle, InitiativeView } from '@/views/pages/initiative';
import { readInitiative } from '../../read-initiatives';

type Params = { params: Promise<{ team: string; slug: string }> };

/** The address names no initiative where its team or its slug decodes to none (`decodePath`). */
const unnamed = ({ team, slug }: Awaited<Params['params']>) => decodePath([team]) === null || decodePath([slug]) === null;

/** An address that names no initiative is titled as the missing page it draws. */
export async function generateMetadata({ params }: Params) {
  const sent = await params;
  return unnamed(sent) ? MISSING_METADATA : gatedMetadata('initiatives', { title: sent.slug });
}

/**
 * The page asks `initiatives` before it renders, and before its address is read. Next hands the address's segments as
 * they were sent, still escaped; a team or a slug that names none, an escape that does not decode, `.` or `..`, is the
 * missing page, and nothing is read, since `fetch` would resolve `..` in the gateway's address. The initiative is then
 * read once, on the console's server as the person, before anything is drawn, as a document's page is: the title is
 * the work's name, which its documents carry, so the masthead waits for the read with the body, and `loading.tsx`
 * stands meanwhile. The one read is handed to the title, the lead, the state, Close and the body.
 */
export default async function InitiativePage({ params }: Params) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const { team, slug } = await params;
  if (unnamed({ team, slug })) return <MissingPage />;
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
