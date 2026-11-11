'use client';

import { useSyncExternalStore } from 'react';

/*
 * What a page needs of the palette before anyone opens it: the call that opens it and the name of its key. The palette
 * itself is a chunk of its own (`ConsolePalette` loads it), so these live apart from it, and a press that lands before
 * that chunk has mounted is kept and answered when it does.
 */
let opener: (() => void) | null = null;
let pending = false;

/** Open the palette from anywhere: the rail's search button, a shortcut in a page. */
export function openCommand() {
  if (opener) opener();
  else pending = true;
}

/** The palette registers how it opens once it has mounted, and opens at once for a press that came first. */
export function registerOpener(open: (() => void) | null) {
  opener = open;
  if (open && pending) {
    pending = false;
    open();
  }
}

const noChange = () => () => {};
const appleKeyboard = () => /mac|iphone|ipad/i.test((navigator as { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform);
/**
 * The palette's keystroke as the reader's keyboard names it: ⌘K on Apple's, Ctrl K on every other. The server cannot
 * know, so it draws ⌘K and the client names the reader's key once it has hydrated.
 */
export function usePaletteKey() {
  return useSyncExternalStore(noChange, () => (appleKeyboard() ? '⌘K' : 'Ctrl K'), () => '⌘K');
}
