import { useConsole } from '@/lib/api';
import type { WaitingGate } from '@/lib/api-shapes';

/** Every gate waiting on a person, newest first. The bell and the Overview read the same list.
 *
 *  DELIBERATE: its own read rather than the whole initiative list. The alert bell is inside the
 *  console frame, which wraps every route, so asking for the list made every page download a
 *  stepper and a gate list for every initiative the caller may read — kilobytes — to draw a badge
 *  that is usually empty. The gateway answers this projection in a row per open gate.
 *
 *  In a module of its own for the same reason: the frame imports this hook, and a bundle carries a module whole, so
 *  living beside the initiative table's columns and badges it put all of them in the first load of every page,
 *  2.8 kB on pages that draw no initiative (attributed from source maps, 2026-10-12). */
export function useWaitingGates(enabled = true) {
  return useConsole<{ waiting: WaitingGate[] }>(enabled ? '/initiatives?waiting=1' : null);
}
