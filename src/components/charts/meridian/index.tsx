'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The Meridian: one time cursor shared by every chart and tile on a page. Point at a day in any time chart (or move
 * through it with the arrow keys) and every chart draws the same vertical line, and every tile reads that day.
 * Charts on one Meridian share one list of dates; a chart outside a provider keeps its own cursor.
 */
type Ctx = { dates: string[]; index: number | null; setIndex: (i: number | null) => void; shared: boolean };
const MeridianCtx = createContext<Ctx | null>(null);

export function Meridian({ dates, children }: { dates: string[]; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const value = useMemo(() => ({ dates, index, setIndex, shared: true }), [dates, index]);
  return <MeridianCtx.Provider value={value}>{children}</MeridianCtx.Provider>;
}

/** The page's cursor, or a private one when the chart stands alone. */
export function useMeridian(dates: string[]): Ctx {
  const shared = useContext(MeridianCtx);
  const [index, setIndex] = useState<number | null>(null);
  return shared && shared.dates.length === dates.length ? shared : { dates, index, setIndex, shared: false };
}

/** For tiles and captions: the shared cursor if there is one, without creating a private one. */
export function useMeridianIndex(): { index: number | null; dates: string[] } {
  const c = useContext(MeridianCtx);
  return { index: c?.index ?? null, dates: c?.dates ?? [] };
}
