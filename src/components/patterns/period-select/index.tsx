'use client';

import { usePeriod } from '@/console/period';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/period';
import { Segmented } from '@/components/ui/segmented';

const SHORT: Record<Period, string> = { '1d': '24H', '7d': '7D', '30d': '30D', '90d': '90D', all: 'All' };

/**
 * The reporting period. Held in the console's period context, which mirrors it into the address (?period=) so a
 * view is linkable, without making every page read search params and suspend for them.
 */
export function PeriodSelect() {
  const { period, setPeriod } = usePeriod();
  return (
    <Segmented
      label="Reporting period"
      value={period}
      onChange={setPeriod}
      options={PERIODS.map((p) => ({ value: p, label: SHORT[p], title: PERIOD_LABEL[p] }))}
    />
  );
}
