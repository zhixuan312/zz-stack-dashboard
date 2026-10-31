'use client';

import { useEffect } from 'react';
import { useMeridianIndex } from '@/components/charts/meridian';

/** How long the cursor has to rest on a week before the page takes it as what the person is pointing at. */
const POINT_SETTLE_MS = 150;

/**
 * Tells the page which week the Meridian points at, once the cursor rests there: a sweep across the chart passes every
 * week, and what the assistant needs is where the person stopped. Home and Activity draw it inside their Meridian.
 */
export function Pointed({ onChange }: { onChange: (index: number | null) => void }) {
  const { index } = useMeridianIndex();
  useEffect(() => {
    const t = setTimeout(() => onChange(index), POINT_SETTLE_MS);
    return () => clearTimeout(t);
  }, [index, onChange]);
  return null;
}
