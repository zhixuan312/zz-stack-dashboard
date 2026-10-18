'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import type { Dialog } from 'radix-ui';

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
 *
 * The drawer stays a modal dialog, and opening it costs no layout inside the tap. `root` is the frame's own element,
 * which holds `data-drawer-open` while the drawer is open (see base.css for why). The returned `content` is for the
 * `Dialog.Content`: it moves focus into the sheet one frame after the open's commit, because focusing in the commit made
 * the browser lay the whole page out inside the tap, and it gives focus back to what held it when the drawer opened,
 * because the trigger is not Radix's own `Dialog.Trigger` and a touch tap does not always focus a button.
 */
export function useNavDrawer(asked: number, root: RefObject<HTMLElement | null>) {
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
  const open = openOn === path;
  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    el.setAttribute('data-drawer-open', '');
    return () => el.removeAttribute('data-drawer-open');
  }, [open, root]);
  const opener = useRef<HTMLElement | null>(null);
  const content: Pick<ComponentProps<typeof Dialog.Content>, 'onOpenAutoFocus' | 'onCloseAutoFocus'> = {
    onOpenAutoFocus: (e) => {
      e.preventDefault();
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const sheet = e.currentTarget as HTMLElement;
      requestAnimationFrame(() => (sheet.querySelector<HTMLElement>('a[href], button:not([disabled])') ?? sheet).focus({ preventScroll: true }));
    },
    onCloseAutoFocus: (e) => {
      e.preventDefault();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      opener.current = null;
    },
  };
  return { open, setOpen: (next: boolean) => setOpenOn(next ? path : null), content };
}
