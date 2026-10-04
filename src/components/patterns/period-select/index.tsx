'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/period';
import { Segmented } from '@/components/ui/segmented';

/** One period the control offers: its value, the short label it shows ("30D") and the full name in its title. */
export type PeriodOption<P extends string = Period> = { value: P; short: string; label: string };

const SHORT: Record<Period, string> = { '1d': '24H', '7d': '7D', '30d': '30D', '90d': '90D', all: 'All' };
const DEFAULT_OPTIONS: PeriodOption[] = PERIODS.map((p) => ({ value: p, short: SHORT[p], label: PERIOD_LABEL[p] }));

/**
 * The reporting period for a whole page. Given `onChange`, it is controlled: the page holds the period (in state, in
 * a context, or in the URL its own way) and the control touches no router, so it needs no Suspense boundary. Without
 * it, the control writes `?period=` itself with `router.replace`, so a server component can read the period; that
 * reads the search params, so it sits inside <Suspense>. `periods` replaces Meridian's four (7D, 30D, 90D, All) with the
 * product's own, a 24-hour period included.
 */
export function PeriodSelect<P extends string = Period>({
  value,
  onChange,
  periods,
}: {
  value: P;
  onChange?: (period: P) => void;
  periods?: readonly PeriodOption<P>[];
}) {
  const options = (periods ?? DEFAULT_OPTIONS) as readonly PeriodOption<P>[];
  if (onChange) return <Control value={value} onChange={onChange} options={options} />;
  return <UrlControl value={value} options={options} />;
}

function Control<P extends string>({ value, onChange, options }: { value: P; onChange: (p: P) => void; options: readonly PeriodOption<P>[] }) {
  return <Segmented label="Reporting period" value={value} onChange={onChange} options={options.map((o) => ({ value: o.value, label: o.short, title: o.label }))} />;
}

function UrlControl<P extends string>({ value, options }: { value: P; options: readonly PeriodOption<P>[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <Control
      value={value}
      options={options}
      onChange={(p) => {
        const next = new URLSearchParams(params);
        next.set('period', p);
        router.replace(`${path}?${next}`, { scroll: false });
      }}
    />
  );
}
