'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * Whether a navigation drawer is open, for the frame that owns one.
 *
 * Below 1024px the drawer is opened by a button in the top bar, and the drawer's own chunk can arrive after the button
 * that opens it — so the frame counts the presses and hands the count here, and a drawer mounting late opens for every
 * press it has not answered yet, each press once. It remembers the page it opened on rather than a boolean, so leaving
 * that page closes it without an effect.
 *
 * What it remembers has to be cleared when the address moves, or a person who opened the contents, followed a link and
 * pressed Back finds the drawer open again. The console's shell and the Atlas's each wrote this bookkeeping for
 * themselves, and the Atlas's was missing that clearing.
 */
export function useNavDrawer(asked: number) {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpenOn(null);
  }
  const [answered, setAnswered] = useState(0);
  if (answered !== asked) {
    setAnswered(asked);
    setOpenOn(path);
  }
  return { open: openOn === path, setOpen: (open: boolean) => setOpenOn(open ? path : null) };
}
