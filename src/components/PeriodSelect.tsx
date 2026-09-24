'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { usePeriod } from '@/components/PeriodProvider';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/period';

/**
 * The period picker. The state lives in `PeriodProvider`, which also writes the address bar
 * so a windowed view stays linkable — on this app's statically prerendered routes a
 * `useSearchParams()` read never sees a `router.push` write.
 */
export function PeriodSelect() {
  const { period, setPeriod } = usePeriod();

  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <SelectTrigger className="w-[160px]" aria-label="Reporting period">
        {/* DELIBERATE: explicit children, not a bare <SelectValue />. Radix resolves the
            label from its rendered items, which live in a portal that has not mounted on
            first paint, so the trigger comes up blank until the menu is opened once. */}
        <SelectValue>{PERIOD_LABEL[period]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p} value={p}>
            {PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
