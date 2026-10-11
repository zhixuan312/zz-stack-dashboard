'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The Meridian: one time cursor shared by every chart and tile on a page. Point at a day in any time chart (or move
 * through it with the arrow keys) and every chart draws the same vertical line, and every tile reads that day.
 * Charts on one Meridian share one list of dates; a chart outside a provider keeps its own cursor.
 */
type Ctx = { dates: string[]; index: number | null; setIndex: (i: number | null) => void; shared: boolean };
const MeridianCtx = createContext<Ctx | null>(null);

/**
 * `day` (YYYY-MM-DD) opens the page pointed at that day, so an address can name it (`?day=2026-09-22`) and a link
 * reproduces what an agent or a person was looking at. The person's own pointer takes over from there.
 */
export function Meridian({ dates, day, children }: { dates: string[]; day?: string | null; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(() => (day && dates.includes(day) ? dates.indexOf(day) : null));
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

/** Points the page's Meridian at a day (YYYY-MM-DD), from outside a chart: a finding that names a day shows it. No-op without a Meridian. */
export function usePointMeridian(): (date: string) => void {
  const c = useContext(MeridianCtx);
  return (date) => { const i = c?.dates.indexOf(date) ?? -1; if (c && i >= 0) c.setIndex(i); };
}
