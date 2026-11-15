/**
 * What a run does when the browser stops drawing frames: the whole browser, not one page.
 *
 * A page that never shows its result has two possible causes. Its own renderer is wedged, which is that page's failure and
 * stays one. Or the browser's compositing has stopped, every tab in it frozen at once, which is no verdict about the
 * product: a product that can wedge a page will wedge it on a fresh browser too, so relaunching once and measuring the
 * same work again hides nothing, and a second stall is a check that could not run. `scripts/lib/unresponsive.ts` is the
 * predicate (`painting`); this is the recovery, because the navigation run had it inline and every other timed script —
 * a product's own among them — had none.
 *
 * Seen in the field twice: 2026-11-14 on the navigation run, and 2026-11-15 inside a product's timed check, where it cost
 * 46 routes and about 16 minutes of a Tier 2 stage before the browser recovered on its own. The cause is still not
 * established; what this makes sure of is that a repeat is one counted line and at most one relaunch per unit of work.
 */
import { launch, type Page } from './chrome.ts';
import { NOT_RUN_EXIT } from './coverage.ts';
import { painting } from './unresponsive.ts';

/** The work a browser was relaunched for, named as a reader names it: a route, and the device it was measured at. */
export type Work = { route: string; device?: string };

const where = (work: Work): string => (work.device === undefined ? work.route : `${work.route} ${work.device}`);

export class StallGuard {
  private readonly relaunchedWork: Work[] = [];
  private readonly retried = new Set<string>();
  private readonly relaunch: () => Promise<Page>;
  private readonly prepare?: (page: Page) => Promise<void>;

  /**
   * @param relaunch Starts a browser: `chrome.ts`'s `launch`, or the script's own.
   * @param prepare Instruments a fresh browser before the work is measured again. A fresh browser has none of the
   * script's own arms and helpers, so a script whose pages are instrumented must pass this or measure blind.
   *
   * The fields are declared and assigned rather than written as parameter properties: these scripts are run by `node`
   * itself, whose type-stripping refuses `constructor(private x)` (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), and a type
   * check cannot see that.
   */
  constructor(relaunch: () => Promise<Page> = launch, prepare?: (page: Page) => Promise<void>) {
    this.relaunch = relaunch;
    this.prepare = prepare;
  }

  /**
   * Whether the browser that just failed has stopped painting, asked of a fresh tab — another renderer, so a wedged page
   * cannot answer for the whole browser. False when it is painting, however slowly: a stalled browser and a slow one need
   * opposite answers, and `painting` is where that line is drawn.
   */
  async stopped(page: Page): Promise<boolean> {
    return !painting(await page.frames());
  }

  /**
   * The work at `work` stalled: close the browser, start a fresh one, prepare it, return it, and say so once — the caller
   * measures the same work again on it. A work that stalls again on the fresh browser is a check that could not run: it
   * prints `not run:` with `why` and ends the run with `NOT_RUN_EXIT`, as every suite reports what it could not measure.
   * A relaunch that cannot be made is the same answer, with its reason, rather than the stack trace of the run.
   */
  async restart(page: Page, work: Work, why: string): Promise<Page> {
    const at = where(work);
    if (this.retried.has(at)) {
      console.log(`not run: the browser stopped drawing frames (${why})`);
      page.close();
      process.exit(NOT_RUN_EXIT);
    }
    this.retried.add(at);
    this.relaunchedWork.push(work);
    console.log(`warn    the browser stopped drawing frames; relaunching it once and measuring ${at} again`);
    page.close();
    let fresh: Page;
    try {
      fresh = await this.relaunch();
    } catch (e) {
      console.log(`not run: the browser could not be started again (${(e as Error).message.split('\n')[0]})`);
      process.exit(NOT_RUN_EXIT);
    }
    if (this.prepare) {
      try {
        await this.prepare(fresh);
      } catch (e) {
        fresh.close();
        console.log(`not run: the relaunched browser could not be prepared (${(e as Error).message})`);
        process.exit(NOT_RUN_EXIT);
      }
    }
    return fresh;
  }

  /** What this run relaunched, for its summary: a run that says what it did can be read against the one before it. */
  get relaunched(): readonly Work[] {
    return this.relaunchedWork;
  }

  /**
   * The counted line, once, before the run's summary. A retry that passes has to stay visible, or a stall that recurs
   * every run hides inside a green one — which is how it went unnoticed for two weeks.
   */
  report(): void {
    const n = this.relaunchedWork.length;
    if (n === 0) return;
    console.log(`reported: the browser stopped drawing frames ${n} ${n === 1 ? 'time' : 'times'}; relaunched (${this.relaunchedWork.map(where).join(', ')})`);
  }
}
