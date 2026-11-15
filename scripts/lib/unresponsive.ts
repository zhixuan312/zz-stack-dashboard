/**
 * Whether the browser is still answering, decided from a page that did not.
 *
 * A suite meets two kinds of error. Most are the product's: a page failed to load, threw, or a check found something. One
 * is not the product's at all — a DevTools command that timed out, which means that page's renderer never answered —
 * and when it happens on page after page, from the first, the browser itself has stopped, not the product.
 *
 * On 2026-11-14 that read as 807 `Runtime.evaluate timed out` lines on every route at every width, including a route that
 * does not exist, over three hours. What was loading that machine is not established: no Chrome crash and no sleep,
 * DarkWake or thermal event was recorded in the window, the other session's gate ran on a hosted runner, and everything
 * else running there is unknown — the unit-test phase kept its normal pace and the browser stage was starved from the
 * moment it started. The verdict stays the same — a check that could not run is not verified, so the run is not green —
 * but it is one line, with its reason, instead of a suite of them.
 *
 * The probe is a fresh tab: a browser whose renderer is wedged still starts one when the machine is only busy, and cannot
 * when the browser has stopped. A busy machine therefore never loses a sweep to this, and a stopped browser never wastes
 * three hours on one.
 */
export const STOPPED_AFTER = 3;

/**
 * Every DevTools command whose timeout means the browser answered nothing: `send` rejects with `<Domain>.<method> timed
 * out` (`scripts/lib/chrome.ts`), whatever the command was. The first draft named only `Runtime.evaluate` and
 * `Page.navigate`, and a frozen browser walked straight past it — the failures after the first were
 * `Emulation.setEmulatedMedia timed out`, which is the same fact. A page's own error cannot look like this: an exception
 * arrives as its description (`Error: request timed out`, with a colon and no domain), never as a bare method name.
 */
const TRANSPORT = /^[A-Za-z]+\.[A-Za-z]+ timed out$/;

export const isTimeout = (e: unknown): boolean => TRANSPORT.test((e instanceof Error ? e.message : String(e)).trim());

const firstLine = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split('\n')[0]!.replace(/\s+/g, ' ').trim();

/**
 * One watcher per suite. Each page's error is handed to it; it returns a reason when the browser has stopped answering,
 * and `null` otherwise. A page that failed its own way restarts the count, so a product that fails some pages never
 * reaches the probe.
 */
export function watchForStoppedBrowser(probe: () => Promise<boolean>, limit = STOPPED_AFTER): (e: unknown) => Promise<string | null> {
  let consecutive = 0;
  return async (e: unknown) => {
    if (!isTimeout(e)) { consecutive = 0; return null; }
    consecutive++;
    if (consecutive < limit) return null;
    if (await probe()) { consecutive = 0; return null; }
    return `the browser stopped answering: ${consecutive} pages in a row could not be measured (${firstLine(e)}), and a fresh tab did not answer either`;
  };
}
