'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { usePeriod } from '@/components/PeriodProvider';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/period';

/**
 * The period picker.
 *
 * It drove the URL through `router.push` and read it back with `useSearchParams()`, and on
 * this app's statically prerendered routes the read never saw the write — the control was
 * stuck on whatever it loaded with, for ever. The state lives in `PeriodProvider` now,
 * which still writes the address bar so a windowed view stays linkable; see that file for
 * why URL-as-state bought nothing in a console with no server components.
 */
export function PeriodSelect() {
  const { period, setPeriod } = usePeriod();

  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <SelectTrigger className="w-[160px]" aria-label="Reporting period">
        {/* Explicit children, not a bare <SelectValue />. Radix resolves the
            selected item's label from its rendered items, and the items live in
            a portal that has not mounted on first paint — so the trigger comes
            up blank until the menu is opened once. */}
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
