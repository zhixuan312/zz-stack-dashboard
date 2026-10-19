import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PageFrame } from '@/components/base/shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mascot } from '@/console/brand';
import { chromeAccess } from '@/data/access';

/** Where a retired address's page went: its name, the workspace it is in (`workspaces` in src/app.config.ts), and its address now. */
type Moved = { label: string; under: string; href: string };

/**
 * The console's retired addresses (AC-1.12, reconciliation 75) and the page each one's contents live on now. A retired
 * address answers no page of its own: the catch-all draws it. `rail` is the destination the person's rail must hold
 * for the page to say where it went; the address itself may carry more (a team's slug). Only these four: an address
 * that never named a page has nowhere to point.
 */
const RETIRED: { address: RegExp; moved: (segments: string[]) => Moved; rail: string }[] = [
  { address: /^teams$/, moved: () => ({ label: 'Teams', under: 'Platform', href: '/platform/teams' }), rail: '/platform/teams' },
  {
    address: /^teams\/[^/]+$/,
    moved: ([, slug]) => ({ label: `${slug} in Teams`, under: 'Platform', href: `/platform/teams/${encodeURIComponent(slug)}` }),
    rail: '/platform/teams',
  },
  { address: /^people$/, moved: () => ({ label: 'People', under: 'Platform', href: '/platform/people' }), rail: '/platform/people' },
  { address: /^settings$/, moved: () => ({ label: 'Access', under: 'Work', href: '/access' }), rail: '/access' },
];

/**
 * Where the page a retired address named went, for a person whose rail holds it, and null for everyone else and for
 * every other address: they get the missing page as it is, which names nothing (FR-5). So the answer adds nothing a
 * person could not already read on their own rail, and a member is never told that a page they cannot open exists.
 * Nobody the role table cannot place reaches here: the gate in front has sent them to sign in.
 */
export async function movedFor(segments: string[] | undefined): Promise<Moved | null> {
  const path = (segments ?? []).join('/');
  const retired = RETIRED.find((r) => r.address.test(path));
  if (!retired) return null;
  const only = await chromeAccess().then((a) => a.only, () => null);
  return only?.includes(retired.rail) ? retired.moved(path.split('/')) : null;
}

/**
 * A retired address, said to a person whose rail holds the page it moved to: the missing page's tab, status and marker
 * (`data-missing-page`, so the page-view recorder still reads it as no page), with what moved where and the one way
 * there in place of the console's front door, under a kicker that says it moved rather than `404`. The card holds the
 * sentence and the button, as wide as the words need.
 */
export function MovedPage({ moved }: { moved: Moved }) {
  return (
    <PageFrame kicker="Moved" title="This address has moved" description={`What it showed is on ${moved.label}, in the ${moved.under} workspace. The old address is no longer used.`}>
      <Card data-missing-page="" data-moved={moved.href} className="flex-row flex-wrap items-center gap-x-8 gap-y-5 px-(--card-pad) py-8">
        <Mascot pose="notfound" scale={0.6} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <p className="t-small max-w-[60ch] text-ink-2">Update a bookmark or a link that still points here to the new address, <code className="font-mono text-xs text-ink">{moved.href}</code>.</p>
          <Button asChild variant="primary" size="lg"><Link href={moved.href}>Open {moved.label} <ArrowRight className="size-4" /></Link></Button>
        </div>
      </Card>
    </PageFrame>
  );
}
