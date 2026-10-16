/**
 * Starting the fake gateway as a server, for a test file to read and to kill.
 *
 * One helper because the start contract is the server's, not a test's: `scripts/fake-gateway/server.ts` takes
 * `--port 0`, picks a free port and prints `listening on <url>` once it is ready, and every suite that reads the
 * fixture over HTTP waits for that line. A copy per suite is one place to change when the flag or the line changes,
 * and the copies that were forgotten would hang on a fixture that started perfectly well.
 *
 * COUPLED: `scripts/verify.ts` starts the same script as `verify.config.ts`'s `fakeApi` and waits for the same line,
 * so the print is a contract two callers with nothing else in common depend on.
 */
import { spawn, type ChildProcess } from 'node:child_process';

/** How long a fixture gets to print its address before the suite is told it never did. */
const START_FAILED_MS = 15_000;

/** A started fixture: the address it printed, and the process to kill when the suite ends. */
type Fixture = { base: string; proc: ChildProcess };

/** Start `scripts/fake-gateway/server.ts` from this repository and resolve once it prints its address; `extra` are the
 *  flags a suite needs beyond `--port 0`, such as `--mode`. The rejection names everything it printed, stdout and stderr
 *  both, because a fixture that could not start says why on the second. */
export function startFakeGateway(...extra: string[]): Promise<Fixture> {
  const proc = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0', ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise<Fixture>((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`no address printed: ${out}`)), START_FAILED_MS);
    proc.stdout!.on('data', (d: Buffer) => {
      out += String(d);
      const m = /listening on (\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve({ base: m[1], proc }); }
    });
    proc.stderr!.on('data', (d: Buffer) => { out += String(d); });
    proc.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
  });
}
