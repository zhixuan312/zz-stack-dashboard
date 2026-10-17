import Link from 'next/link';
import { nav, refusal, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/console/brand';
import { chromeAccess } from '@/data/access';
import { FEATURES, type FeatureId } from '@/data/features';
import { whoCan } from '@/data/roles';
import type { Need } from '@/lib/collection';
import { NOT_FOUND } from '@/views/missing';
import { navOf } from '@/views/workspaces';


/**
 * An address that leads nowhere, said inside the shell so the rail stays where it was: the not-found screen's words and
 * its one way back. `gate` answers it for an address the person may not open, so a refused page reads exactly as one
 * that does not exist. It takes nothing, so it can say nothing of what was asked for. `data-missing-page` is what
 * `pnpm verify --as` looks for on such an address, and what the page-view recorder reads as no page.
 */
export function MissingPage() {
  return (
    <PageFrame kicker={NOT_FOUND.kicker} title={NOT_FOUND.sentence.replace(/\.$/, '')} description={NOT_FOUND.lead}>
      <Card data-missing-page="" className="items-center gap-8 px-(--card-pad) py-14 text-center">
        <Mascot pose="notfound" />
        <Button asChild variant="primary" size="lg"><Link href={NOT_FOUND.way.href}>{NOT_FOUND.way.label}</Link></Button>
      </Card>
    </PageFrame>
  );
}

/** Names as a reader meets them, in table order: "Superadmins", "Superadmins and Members". */
function list(roles: readonly string[]): string {
  const names = roles.map((role) => `${role}s`);
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The same names offered as a choice, with the article the first one takes: "a Superadmin". */
function or(roles: readonly string[]): string {
  const [first] = roles;
  if (!first) return '';
  return `${/^[aeiou]/i.test(first) ? 'an' : 'a'} ${roles.join(' or ')}`;
}

/**
 * What a person who may not open a page is told under `explain`: the title they followed, who can open it, and who to
 * ask. The roles are read off the table (`whoCan`), never written per feature, so editing `GRANTS` edits every
 * sentence. Who to ask is whoever may add a person to the platform. When `whoCan` is empty no role holds the need, and
 * the sentence says that rather than naming a role that would not suffice. A need of `public` never reaches here.
 */
function noAccessCopy(need: Need, title: string): { title: string; description: string } {
  const roles = need === 'public' ? [] : whoCan(need);
  const ask = `Ask ${or(whoCan('people:manage'))} for access.`;
  return {
    title: `You don't have access to ${title}`,
    description: roles.length === 0 ? `No role opens it. ${ask}` : `${list(roles)} can open it. ${ask}`,
  };
}

/**
 * The one way out of a refused page under `explain`: the first destination of the page's own workspace that this
 * person may open, or Work's home when there is none (or when who they are cannot be told). The page's workspace is
 * the one whose entry carries the feature's own need; a feature no entry names belongs to Work.
 */
async function wayOut(feature: FeatureId): Promise<{ href: string; label: string }> {
  const owner = nav.flatMap((g) => g.items).find((i) => i.needs === FEATURES[feature].needs)?.workspace ?? 'main';
  const only = await chromeAccess().then((a) => a.only, () => null);
  const first = only ? navOf(owner).flatMap((g) => g.items).find((i) => only.includes(i.href)) : undefined;
  return first ? { href: first.href, label: first.label } : { href: workspaces.main.homeHref, label: workspaces.main.label };
}

/**
 * What a page returns a person who may not open it: the product's `refusal` (`src/app.config.ts`). Under `absent` it is
 * the missing page, which is handed nothing of the feature; under `explain` the feature's own title, who can, and one
 * link out. A page asks authorization first and returns this before any protected read — so the answer is a normal
 * 200 that holds none of the records, never a thrown `notFound()` — and it is async, so a page awaits it and no caller
 * depends on a synchronous result.
 */
export async function NoAccess({ feature }: { feature: FeatureId }) {
  if (refusal === 'absent') return <MissingPage />;
  const { title, description } = noAccessCopy(FEATURES[feature].needs, FEATURES[feature].title);
  const out = await wayOut(feature);
  return (
    <PageFrame title={FEATURES[feature].title}>
      <EmptyState
        kind="no-access"
        title={title}
        action={<Button asChild variant="secondary"><Link href={out.href}>Go to {out.label}</Link></Button>}
      >
        {description}
      </EmptyState>
    </PageFrame>
  );
}
