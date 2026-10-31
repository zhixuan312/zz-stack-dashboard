/**
 * A tool installed in this project, run from node_modules/.bin, so the gates work under pnpm, npm, yarn or bun alike.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

// The gate, verify and the live check run `next` in the project: Meridian's own runs send no Next.js telemetry, whatever
// the project's next.config says.
process.env.NEXT_TELEMETRY_DISABLED ??= '1';

export const bin = (name: string) => path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);

/** A port nothing listens on now, for a server this run starts. */
export const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

/** The status the server on `port` answers `/` with, or null when nothing does; a fresh connection each time, so a server that was just stopped is never reached through a stale one. */
export const status = (port: number) => new Promise<number | null>((resolve) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/', agent: false, timeout: 3000 }, (res) => { res.resume(); resolve(res.statusCode ?? null); });
  req.on('error', () => resolve(null));
  req.on('timeout', () => { req.destroy(); resolve(null); });
});

/**
 * The built app started on `port`, loopback only, because every client here reaches 127.0.0.1 (#81), and detached, so the
 * caller stops its whole group. The caller records the process before it waits on `answers`.
 */
export const spawnNext = (port: number, env: NodeJS.ProcessEnv): ChildProcess =>
  spawn(bin('next'), ['start', '-H', '127.0.0.1', '-p', String(port)], { cwd: ROOT, env, stdio: 'ignore', detached: true });

/** Whether the server on `port` answers below 500 within a minute. A miss of either kind, no answer or a 5xx while it settles, waits a quarter second. */
export async function answers(port: number): Promise<boolean> {
  for (const deadline = Date.now() + 60_000; Date.now() < deadline; await new Promise((r) => setTimeout(r, 250))) {
    const code = await status(port);
    if (code !== null && code < 500) return true;
  }
  return false;
}
