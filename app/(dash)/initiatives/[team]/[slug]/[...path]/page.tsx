import { gate, may } from '@/data/access';
import { FEATURES } from '@/data/features';
import { decodePath } from '@/lib/store-path';
import { readDocument } from '@/views/document-read';
import { versionOf } from '@/views/document-version';
import { DocumentView } from '@/views/pages/document';

/**
 * The page asks `initiatives` before it renders, and before its address is read. Whether the reader may open the team's
 * page under Platform is their `/me` answer, asked here once the gate has placed them, so the breadcrumb is a link or
 * plain text in the first paint and never changes at hydration. The document itself is read here too, on the console's
 * server as the person and bounded, so its title, status and body are in the first paint rather than after hydration;
 * `loading.tsx` stands while it is read. `?version=<n>`, an Approvals history row's address, opens that version: read
 * here from the request, never with `useSearchParams`, so the page's first paint stays its own.
 */
export default async function DocumentPage({ params, searchParams }: { params: Promise<{ team: string; slug: string; path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const [{ team, slug, path }, { version }] = await Promise.all([params, searchParams]);
  const rel = decodePath(path);
  const [teamPage, served] = await Promise.all([may(FEATURES.teams.needs), readDocument(team, slug, rel)]);
  return <DocumentView team={team} slug={slug} rel={rel} served={served} teamPage={teamPage} version={versionOf(version)} />;
}
