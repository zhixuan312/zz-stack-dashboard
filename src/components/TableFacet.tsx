'use client';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui';

/**
 * One facet, as a Select built from the rows themselves.
 *
 * A Select rather than a chip row: it carries its own active state in its trigger, keeps the
 * counts beside each option, and comes with keyboard and screen-reader behaviour hand-rolled
 * buttons do not. "All" is the absence of a choice rather than an option beside the others.
 *
 * Shared, so two tables cannot grow two facet controls that drift apart.
 */
export function Facet({ all, values, value, onChange }: {
  all: string; values: [string, number][]; value: string | null; onChange: (v: string | null) => void;
}) {
  // Rendered in the order given, which is the caller's decision: `tally` sorts by frequency,
  // right for teams and flows, while a caller with its own vocabulary keeps that vocabulary's
  // progression so a reader scanning for "Waiting on you" finds it in the same place.
  //
  // Present whenever there is anything to show, even when every row shares one value. An absent
  // control does not read as "this filter would do nothing right now"; it reads as "this filter
  // does not exist", and the reader stops looking. Nothing is rendered for no values, which is a
  // column with no data rather than a column whose data happens to agree.
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
 *  between renders. Nulls are not a facet value: "no flow" is a fact about a row, and offering
 *  it as something to filter by is a different feature. */
export const tally = (xs: (string | null)[]): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
