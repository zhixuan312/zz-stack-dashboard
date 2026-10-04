import type { Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { When } from '@/console/when';
import type { Initiative } from '@/lib/api-shapes';
import { cn } from '@/lib/cn';

/**
 * What is happening to an initiative, in one closed vocabulary, on every page that shows one. Not a stage name: the
 * flow position answers where it is.
 *
 * The three closed values are the platform's own: `close()` records exactly one of `accepted`, `delivered` or
 * `abandoned`, and all three mean closed. One rule per colour, so the column reads without a key: positive is closed
 * with what was asked for, warning always means a person must act, neutral never means a problem.
 */
export interface StateOf {
  outcome: string | null;
  /** `written` tells "nobody has drafted it" from "drafted and unsigned". */
  gates: { name: string; passed: boolean; written: boolean; role?: string }[];
}

/** The six words the state can say, most-closed first: the order a filter lists them in. */
export const INITIATIVE_STATES = ['Accepted', 'Delivered', 'Abandoned', 'Waiting on you', 'Ready to close', 'In progress'] as const;
type InitiativeState = (typeof INITIATIVE_STATES)[number];

/** The gates an open initiative is judged on: the handover is written after the close, so it is never one of them. */
const ownGates = (of: StateOf) => of.gates.filter((g) => g.role !== 'handover');

/** The rule, apart from the badge, so a filter can ask the same question the column answers. */
export function initiativeState(of: StateOf): InitiativeState {
  if (of.outcome === 'accepted') return 'Accepted';
  if (of.outcome === 'delivered') return 'Delivered';
  if (of.outcome === 'abandoned') return 'Abandoned';
  const gates = ownGates(of);
  // Written and unsigned, not merely unsigned: a gate nobody has drafted waits on the agent, not a person.
  if (gates.some((g) => g.written && !g.passed)) return 'Waiting on you';
  if (gates.some((g) => !g.written)) return 'In progress';
  // Every gate passed and no outcome recorded: the work is done and nobody has closed it.
  if (gates.length) return 'Ready to close';
  return 'In progress';
}

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

/** Written and unsigned: a gate document a person can read and sign today. */
export const waitingOnYou = (of: StateOf) => ownGates(of).some((g) => g.written && !g.passed);

/** The initiative list's columns, shared by /initiatives and a team's page; `team` adds the team column. */
export function initiativeColumns({ team = false }: { team?: boolean } = {}): Column<Initiative>[] {
  const passed = (i: Initiative) => ownGates(i).filter((g) => g.passed).length;
  return aligned([
    { key: 'slug', header: 'Initiative', grow: true, truncate: true, mobile: 'title', sortValue: (i) => i.slug, cell: (i) => <span title={i.slug} className="font-medium text-ink">{i.slug}</span> },
    ...(team ? [{ key: 'team', header: 'Team', hideBelow: 'md' as const, mobile: 'fact' as const, sortValue: (i: Initiative) => i.team, cell: (i: Initiative) => <span className="text-ink-2">{i.team}</span> }] : []),
    { key: 'position', header: 'Flow position', hideBelow: 'lg', sortValue: (i) => (i.of ? i.at / i.of : -1), cell: (i) => <FlowPosition at={i.at} of={i.of} name={i.stage} closed={i.closed} /> },
    { key: 'state', header: 'State', mobile: 'status', sortValue: (i) => INITIATIVE_STATES.indexOf(initiativeState(i)), cell: (i) => <StateBadge of={i} /> },
    { key: 'gates', header: 'Gates', numeric: true, hideBelow: 'xl', sortValue: passed, cell: (i) => (ownGates(i).length ? `${passed(i)} of ${ownGates(i).length}` : '—') },
    { key: 'updated', header: 'Updated', numeric: true, mobile: 'fact', sortValue: (i) => i.updated, cell: (i) => <When at={i.updated} />, mobileCell: (i) => <>Updated <When at={i.updated} /></> },
  ]);
}

/** One gate document a person can sign today: written, not approved, on an open initiative. */
type WaitingGate = { id: string; gate: string; initiative: Initiative };

/** Every gate waiting on a person, newest first. The bell and the Overview read the same list. */
export function waitingGates(initiatives: Initiative[]): WaitingGate[] {
  return initiatives
    .filter((i) => !i.closed)
    .flatMap((i) => ownGates(i).filter((g) => g.written && !g.passed).map((g) => ({ id: `${i.team}/${i.slug}/${g.name}`, gate: g.name.replace(/^approve /, ''), initiative: i })))
    .sort((a, b) => b.initiative.updated.localeCompare(a.initiative.updated));
}
