import type { Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { When } from '@/console/when';
import type { Initiative } from '@/lib/api-shapes';
import { cn } from '@/lib/cn';
import { INITIATIVE_STATES, initiativeState, ownGates, type StateOf } from '@/console/initiative-state';

export function StateBadge({ of }: { of: StateOf }) {
  const state = initiativeState(of);
  if (state === 'Waiting on you') {
    const open = ownGates(of).filter((g) => g.written && !g.passed);
    return <Badge tone="warning" dot title={`Waiting on: ${open.map((g) => g.name).join(', ')}`}>Waiting on you</Badge>;
  }
  const tone = state === 'Accepted' || state === 'Delivered' ? 'positive' : state === 'Ready to close' ? 'accent' : 'neutral';
  return <Badge tone={tone} dot>{state}</Badge>;
}

/** Where an initiative is in its flow: "S4 · plan" and one notch per stage, the passed ones filled. */
export function FlowPosition({ at, of, name, closed = false }: { at: number; of: number; name: string; /** Every notch is passed once it closed. */ closed?: boolean }) {
  if (!of) return <span className="text-xs text-ink-3">No flow</span>;
  const label = name ? name.replace(/-/g, ' ') : 'open';
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span className="text-xs font-medium text-ink">S{at} · {label}</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={cn('block h-1.5 w-2.5 rounded-full', i + 1 < at || (closed && i + 1 === at) ? 'bg-positive' : i + 1 === at ? 'bg-accent' : 'bg-fill-track')} />
        ))}
      </span>
      <span className="sr-only">Stage {at} of {of}</span>
    </span>
  );
}

/** The initiative list's columns, shared by /initiatives and a team's page; `team` adds the team column. */
export function initiativeColumns({ team = false }: { team?: boolean } = {}): Column<Initiative>[] {
  const passed = (i: Initiative) => ownGates(i).filter((g) => g.passed).length;
  return aligned([
    // Wrap rather than truncate. A truncated slug hides the *tail*, which is the part that tells two initiatives of the
    // same project apart: at 768px `2026-10-01-ledger-migration-to-d…` hid 50 of its 71 characters, the whole of
    // `double-entry-bookkeeping-with-nightly-reconciliation`. `anywhere` keeps the min-content width at one character
    // so the table can still shrink the column — the same idiom the document page's path cell uses — and a slug that
    // fits stays on one line, so nothing changes above 900px.
    { key: 'slug', header: 'Initiative', grow: true, mobile: 'title', sortValue: (i) => i.slug, cell: (i) => <span title={i.slug} className="font-medium whitespace-normal text-ink [overflow-wrap:anywhere]">{i.slug}</span> },
    ...(team ? [{ key: 'team', header: 'Team', hideBelow: 'md' as const, mobile: 'fact' as const, sortValue: (i: Initiative) => i.team, cell: (i: Initiative) => <span className="text-ink-2">{i.team}</span> }] : []),
    // Carried on the phone card too: this list says how far through its flow each piece of work got, and a reader on a
    // phone could not see it at all. `S3 · plan` with its notches is compact enough to sit among the card's facts.
    { key: 'position', header: 'Flow position', hideBelow: 'lg', mobile: 'fact', sortValue: (i) => (i.of ? i.at / i.of : -1), cell: (i) => <FlowPosition at={i.at} of={i.of} name={i.stage} closed={i.closed} /> },
    { key: 'state', header: 'State', mobile: 'status', sortValue: (i) => INITIATIVE_STATES.indexOf(initiativeState(i)), cell: (i) => <StateBadge of={i} /> },
    { key: 'gates', header: 'Gates', numeric: true, hideBelow: 'xl', sortValue: passed, cell: (i) => (ownGates(i).length ? `${passed(i)} of ${ownGates(i).length}` : '—') },
    { key: 'updated', header: 'Updated', numeric: true, mobile: 'fact', sortValue: (i) => i.updated, cell: (i) => <When at={i.updated} />, mobileCell: (i) => <>Updated <When at={i.updated} /></> },
  ]);
}
