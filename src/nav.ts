import { nav } from '@/app.config';
import { FLEET } from '@/data/features';
import type { ConsoleMode } from '@/lib/api';

const needOf = new Map(nav.flatMap((group) => group.items).map((item) => [item.href, item.needs]));

/**
 * The superadmin's team view, applied in the browser to the destinations the server answered (`chromeAccess().only`):
 * the platform view keeps them all, and the team view leaves out every one that needs the fleet's grant, which is what
 * a member is shown. It only ever removes: a destination the server did not answer is never added back.
 *
 * This decides what is drawn, never what may be read: each page carries its own gate, and the gateway scopes every
 * read by the caller, whatever the rail shows.
 */
export function shownIn(only: string[], mode: ConsoleMode): string[] {
  return mode === 'platform' ? only : only.filter((href) => needOf.get(href) !== FLEET);
}
