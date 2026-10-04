/** A headless Chrome over the DevTools protocol, with no dependency: Node's own fetch and WebSocket. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Page = {
  /** Uncaught exceptions and console errors since the last open(). */
  errors: string[];
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  eval: <T = unknown>(expression: string) => Promise<T>;
  open: (url: string, opts: { width: number; height?: number; theme?: 'light' | 'dark'; reduced?: boolean; wait?: number }) => Promise<void>;
  shot: (file: string, opts?: { full?: boolean; width?: number; height?: number }) => Promise<number>;
  close: () => void;
};

export async function launch(): Promise<Page> {
  // Port 0 lets Chrome pick a free port and write it into its own profile, so this never attaches to another
  // session's browser that happens to hold a guessed port.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  let list: any[] | undefined;
  for (let i = 0; i < 80 && !list; i++) {
    try {
      const port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    } catch { await sleep(150); }
  }
  if (!list) throw new Error('Chrome did not start');
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map<number, (m: any) => void>();
  const errors: string[] = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(String(e.data));
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
  const page: Page = {
    errors,
    send,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluation failed');
      return r.result?.result?.value;
    },
    async open(url, { width, height = 900, theme, reduced = true, wait = 2600 }) {
      const features = [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }];
      if (theme) features.push({ name: 'prefers-color-scheme', value: theme });
      errors.length = 0;
      await send('Emulation.setEmulatedMedia', { features });
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: Number(process.env.DPR ?? 2), mobile: width < 600 });
      // A phone is touch: pointer: coarse, so touch targets and tap behaviour are what a phone gets.
      await send('Emulation.setTouchEmulationEnabled', width < 600 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      await send('Page.navigate', { url });
      await sleep(wait);
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
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip: { x: 0, y: 0, width: width ?? m.w, height: h, scale: 1 } });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return h;
    },
    close() { ws.close(); proc.kill(); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 500).unref(); },
  };
  return page;
}
