import type { SelectOption } from '@/components/ui/select';

/**
 * A filter's options, built from the rows themselves: "everything" first (its value `all` is the filter's off state),
 * then each value with how many rows carry it, most common first. Counted over the unfiltered rows, so the numbers
 * beside the options do not move as the other filters narrow. A value nothing carries is never offered: an option
 * that empties the table by design is a trap.
 */
export function facet(all: string, values: (string | null)[], order?: readonly string[]): SelectOption[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const keys = order ? order.filter((k) => counts.has(k)) : [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
  return [{ value: 'all', label: all }, ...keys.map((k) => ({ value: k, label: `${k} · ${counts.get(k)}` }))];
}
