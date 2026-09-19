'use client';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui';

/**
 * One facet, as a Select built from the rows themselves.
 *
 * NOT A CHIP ROW, and not a fixed list of teams. Chips were a third button style beside the
 * kit's own controls, they stacked into three rows above the table, and they break the moment
 * there are ten teams — which is a thing that happens without this file being touched. A
 * Select carries its own active state in its trigger, keeps the counts beside each option,
 * and comes with keyboard and screen-reader behaviour that hand-rolled buttons do not.
 *
 * "All" is the absence of a choice rather than an option beside the others: an unselected
 * facet already means all of them, and a pill saying so is a control that does nothing.
 *
 * SHARED, because it was written for /initiatives and the second table that needed filtering
 * would otherwise have got a second one. Two facet controls on one console drift — one grows
 * counts, the other does not; one hides itself at a single value, the other renders a Select
 * with nothing to choose — and a reader learns two controls for one idea.
 */
export function Facet({ all, values, value, onChange }: {
  all: string; values: [string, number][]; value: string | null; onChange: (v: string | null) => void;
}) {
  // RENDERED IN THE ORDER GIVEN, which is the caller's decision and not this component's:
  // `tally` sorts by frequency, right for teams and flows; a caller with its own vocabulary
  // keeps that vocabulary's progression, because a reader scanning for "Waiting on you"
  // should find it in the same place every time rather than wherever this week's counts put it.
  //
  // PRESENT WHENEVER THERE IS ANYTHING TO SHOW, even when every row shares one value.
  //
  // This hid itself below two distinct values, on the reasoning that one option filters
  // nothing and a control that cannot change the table is clutter. That reasoning is right
  // about the mechanics and wrong about the reader. On /teams every team was `active`, so
  // the status filter vanished — and the page then looked like one that had a search box and
  // no filters at all. It was asked for twice, by someone who had just been told it was
  // there. An absent control does not read as "this filter would do nothing right now"; it
  // reads as "this filter does not exist", and the reader stops looking.
  //
  // A facet that is always in the same place is also a thing a reader can learn once. Showing
  // it with one option costs a glance; hiding it costs a search through the page, and then a
  // question. Nothing is rendered for NO values, because that is a column with no data rather
  // than a column whose data happens to agree.
  if (values.length === 0) return null;
  return (
    <Select value={value ?? '*'} onValueChange={(v) => onChange(v === '*' ? null : v)}>
      <SelectTrigger className="w-[13rem]">
        <SelectValue placeholder={all} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="*">{all}</SelectItem>
        {values.map(([v, n]) => (
          <SelectItem key={v} value={v}>
            <span className="flex w-full items-center justify-between gap-4">
              <span className="truncate">{v}</span>
              <span className="tabular-nums text-ink-faint">{n}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Count the values, most common first, ties broken alphabetically so the order is stable
 *  between renders rather than whatever the Map happened to hold. Nulls are not a facet
 *  value: "no flow" is a fact about a row, and offering it as an option to filter BY is a
 *  different feature from counting the ones that have one. */
export const tally = (xs: (string | null)[]): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
