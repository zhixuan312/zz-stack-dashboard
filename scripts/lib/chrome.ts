/* eslint-disable @typescript-eslint/no-explicit-any -- Chrome's DevTools protocol has no types here; this file runs in Node, never in a page. */
/** A headless Chrome over the DevTools protocol, with no dependency: Node's own fetch and WebSocket. */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
// A Linux CI runner (Ubuntu 24.04's AppArmor) refuses Chrome's sandbox; there it only ever opens the app just built.
const SANDBOX = process.platform === 'linux' && process.env.CI === 'true' ? ['--no-sandbox'] : [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Page = {
  /** Uncaught exceptions and console errors since the last open(). */
  errors: string[];
  /** How many native file choosers the page has opened: intercepted, so none is shown, and counted, since opening one changes nothing in the DOM. */
  fileChoosers: () => number;
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  eval: <T = unknown>(expression: string) => Promise<T>;
  open: (url: string, opts: { width: number; height?: number; theme?: 'light' | 'dark'; reduced?: boolean; wait?: number; cookie?: { name: string; value: string } }) => Promise<void>;
  shot: (file: string, opts?: { full?: boolean; width?: number; height?: number }) => Promise<number>;
  close: () => void;
};

/** Every Chrome this process launched and has not closed: each is killed, and its profile removed, whichever way the process ends. */
const launched = new Set<{ proc: ChildProcess; dir: string }>();
/**
 * Kill a browser and remove its profile. The removal is never the caller's work: a suite closes its browser inside a hook
 * and a hook has a ten-second ceiling, while a profile that has loaded many pages runs to tens of megabytes — removing one
 * that way timed a hook out on a runner (`Hook timed out in 10000ms`, tests/deep-dom.test.ts's afterAll), and before that
 * it threw `ENOTEMPTY: directory not empty` when Chrome was still writing into the directory. So it starts at once, in the
 * background; at exit, where nothing is timed, it is one last synchronous attempt for a browser nobody closed.
 */
function reap(c: { proc: ChildProcess; dir: string }, sync = false) {
  launched.delete(c);
  c.proc.kill('SIGKILL');
  if (!sync) { fs.rm(c.dir, { recursive: true, force: true }, () => {}); return; }
  try {
    fs.rmSync(c.dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  } catch {
    /* a profile left in the temp folder is cheaper than a run that failed tidying up after itself */
  }
}
process.on('exit', () => { for (const c of [...launched]) reap(c, true); });
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));

export async function launch(): Promise<Page> {
  // Port 0 lets Chrome pick a free port and write it into its own profile, so this never attaches to another
  // session's browser that happens to hold a guessed port.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-chrome-'));
  const proc = spawn(CHROME, [...SANDBOX, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const handle = { proc, dir };
  launched.add(handle);
  try {
    return await attach(proc, dir, handle);
  } catch (e) {
    reap(handle);
    throw e;
  }
}

async function attach(proc: ChildProcess, dir: string, handle: { proc: ChildProcess; dir: string }): Promise<Page> {
  let list: any[] | undefined;
  // A cold Chrome on a busy machine or runner can take well over ten seconds to open its debugging port; wait up to 30 s,
  // and stop at once if it exited instead.
  const deadline = Date.now() + 30_000;
  while (!list && Date.now() < deadline && proc.exitCode === null && proc.signalCode === null) {
    try {
      const port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    } catch { await sleep(150); }
  }
  if (!list) throw new Error(proc.exitCode !== null || proc.signalCode !== null ? `Chrome exited before it started (${proc.exitCode ?? proc.signalCode})` : 'Chrome did not start within 30 s');
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map<number, (m: any) => void>();
  const errors: string[] = [];
  let choosers = 0;
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(String(e.data));
    if (m.method === 'Page.fileChooserOpened') choosers++;
    if (m.id && pending.has(m.id)) { pending.get(m.id)!(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? '').split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  });
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((r, reject) => {
      const i = ++id;
      const t = setTimeout(() => { pending.delete(i); reject(new Error(`${method} timed out`)); }, 30000);
      // A protocol error rejects: a silently refused command (a bad parameter) would leave the page in the wrong state.
      pending.set(i, (m) => { clearTimeout(t); if (m.error) reject(new Error(`${method}: ${m.error.message}`)); else r(m); });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.setInterceptFileChooserDialog', { enabled: true });
  const page: Page = {
    errors,
    fileChoosers: () => choosers,
    send,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed');
      return r.result?.result?.value;
    },
    async open(url, { width, height = 900, theme, reduced = true, wait = 2600, cookie }) {
      const features = [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }];
      if (theme) features.push({ name: 'prefers-color-scheme', value: theme });
      errors.length = 0;
      await send('Emulation.setEmulatedMedia', { features });
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: Number(process.env.DPR ?? 2), mobile: width < 600 });
      // A phone is touch: pointer: coarse, so touch targets and tap behaviour are what a phone gets.
      await send('Emulation.setTouchEmulationEnabled', width < 600 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      // A cookie is set through the network domain, BEFORE the navigation, so the very first request already carries it
      // (a persona suite signed in this way sees that person's pages, never the signed-out or default one).
      if (cookie) {
        await send('Network.enable');
        await send('Network.setCookie', { name: cookie.name, value: cookie.value, url });
      }
      await send('Page.navigate', { url });
      await sleep(wait);
      // Then its load event: on a busy machine a page can still be loading after any fixed wait, and a suite reading it then
      // reads a page that is not all there. Bounded, so a page whose load never ends still opens.
      await page.eval('new Promise((r) => { if (document.readyState === "complete") return r(true); addEventListener("load", () => r(true), { once: true }); setTimeout(() => r(false), 25000); })');
      await page.eval('Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))])');
    },
    async shot(file, { full = false, width, height } = {}) {
      const m = await page.eval<{ w: number; h: number; sh: number }>(
        `(() => { const s = document.querySelector('[data-scroll-region]'); return { w: innerWidth, h: innerHeight, sh: s ? s.scrollHeight - s.clientHeight : Math.max(0, document.documentElement.scrollHeight - innerHeight) }; })()`,
      );
      let h = height ?? m.h;
      if (full && m.sh > 0) {
        // The document never scrolls: grow the viewport by the scroll region's overflow so the whole page shows.
        h = m.h + m.sh;
        await send('Emulation.setDeviceMetricsOverride', { width: width ?? m.w, height: h, deviceScaleFactor: Number(process.env.DPR ?? 2), mobile: (width ?? m.w) < 600 });
        await sleep(1200);
        await page.eval("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");
      }
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full && m.sh > 0, clip: { x: 0, y: 0, width: width ?? m.w, height: h, scale: 1 } });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return h;
    },
    // Synchronous, like every other way out: a timer to remove the profile later never fired when the script exited
    // straight after close(), and each run left a 30 MB profile in the temp folder.
    close() { ws.close(); reap(handle); },
  };
  return page;
}
