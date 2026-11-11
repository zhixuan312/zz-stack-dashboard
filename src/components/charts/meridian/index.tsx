'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The Meridian: one time cursor shared by every chart and tile on a page. Point at a day in any time chart (or move
 * through it with the arrow keys) and every chart draws the same vertical line, and every tile whose points are the
 * page's reads that day. Charts on one Meridian share one list of dates; a chart outside a provider keeps its own cursor.
 */
type Ctx = { dates: string[]; index: number | null; setIndex: (i: number | null) => void; shared: boolean };
const MeridianCtx = createContext<Ctx | null>(null);

/**
 * `day` (YYYY-MM-DD) opens the page pointed at that day, so an address can name it (`?day=2026-09-22`) and a link
 * reproduces what an agent or a person was looking at. The person's own pointer takes over from there.
 */
export function Meridian({ dates, day, children }: { dates: string[]; day?: string | null; children: ReactNode }) {
  const addressDay = day ?? null;
  const [cursor, setCursor] = useState(() => ({ day: addressDay, selected: addressDay }));
  // A new address takes over once. Otherwise keep the person's date, not its position in a frame that can change.
  const selected = cursor.day !== addressDay ? addressDay : cursor.selected;
  const position = selected === null ? -1 : dates.indexOf(selected);
  const index = position < 0 ? null : position;
  if (cursor.day !== addressDay || (cursor.selected !== null && index === null)) {
    setCursor({ day: addressDay, selected: index === null ? null : selected });
  }
  const setIndex = useCallback((i: number | null) => {
    const selected = i === null ? null : dates[i];
    setCursor((current) => current.selected === selected ? current : { ...current, selected });
  }, [dates]);
  const value = useMemo(() => ({ dates, index, setIndex, shared: true }), [dates, index, setIndex]);
  return <MeridianCtx.Provider value={value}>{children}</MeridianCtx.Provider>;
}

/** The page's cursor, or a private one when the chart stands alone. */
export function useMeridian(dates: string[]): Ctx {
  const shared = useContext(MeridianCtx);
  const [index, setIndex] = useState<number | null>(null);
  // The same days, not merely the same number of them: two charts of equal length over different windows (this week and
  // last) would otherwise share one position, and pointing at the fifth day of one would light the fifth day of the other.
  // The ends identify a window: a range that begins and ends on the same days is the range.
  const same = Boolean(shared) && shared!.dates.length === dates.length && shared!.dates[0] === dates[0] && shared!.dates[shared!.dates.length - 1] === dates[dates.length - 1];
  return same ? shared! : { dates, index, setIndex, shared: false };
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

/** Lets go of the page's Meridian from outside a chart, as leaving a chart does: a calendar of days does, for a day the Meridian does not hold. No-op without a Meridian. */
export function useClearMeridian(): () => void {
  const c = useContext(MeridianCtx);
  return () => c?.setIndex(null);
}
