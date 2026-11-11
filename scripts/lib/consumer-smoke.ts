/**
 * Whether a change owes the consumer smoke before it is pushed, and which half. The smoke lives in Meridian's own
 * repository (`cli/`): a project made from it has no CLI, and its `scripts/` changes are the release's managed files, not
 * a release being prepared. The tool answers both questions so `test:t2` cannot run it where it does not exist.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SMOKE_SCRIPT = path.join('cli', 'scripts', 'smoke.ts');

/**
 * `create` when the shipped test runner or its libraries changed — those run inside every project's `test:release`, and
 * only a created project proves them with real values — `update` for the update path, `verify` for any other check
 * change, and null when the smoke does not belong here or nothing needs it.
 */
export function consumerSmokeKind({ root, changed }: { root: string; changed: string[] }): 'create' | 'update' | 'verify' | null {
  if (!fs.existsSync(path.join(root, SMOKE_SCRIPT))) return null;
  if (changed.some((p) => p === 'scripts/test-run.ts' || p.startsWith('scripts/lib/'))) return 'create';
  if (changed.some((p) => p.startsWith('cli/'))) return 'update';
  if (changed.some((p) => p.startsWith('scripts/'))) return 'verify';
  return null;
}
