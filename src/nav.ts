import { nav } from '@/app.config';
import type { ConsoleMode } from '@/lib/api';

/**
 * The destinations the view in force shows, as hrefs: what Meridian's chrome narrows `nav` by (`visible` in
 * `src/views/console-chrome.tsx`), for the rail and the command palette alike.
 *
 * The platform view shows every destination. The team view is what a member sees: every destination that needs more
 * than being signed in is left out. A pure function over the config, so which routes a member is offered is a question
 * a test can ask directly.
 *
 * This decides what is drawn, never what may be read: the gateway scopes every read by the caller, whatever the rail
 * shows.
 */
export function shownIn(mode: ConsoleMode): string[] {
  return nav.flatMap((group) => group.items).filter((item) => mode === 'platform' || item.needs === 'public').map((item) => item.href);
}
