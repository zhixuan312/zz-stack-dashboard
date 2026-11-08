/**
 * The manifest a product's own check reads to ask whether a path is Meridian's. During an update the recorded
 * `.meridian/manifest.json` is still the source release's, so a file the update just added is not in it: with one
 * session under `.meridian/update/`, the session's target manifest answers instead, as it does for `scripts/check.ts`.
 * A rule in `scripts/check.local.ts` that reads the recorded manifest fails every file an update adds (#105).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseJournal, type Manifest } from './update-session.ts';

/** The update session's target manifest while exactly one session is open, otherwise the recorded one; null with none. */
export function effectiveManifest(root: string = process.cwd()): Manifest | null {
  const dir = path.join(root, '.meridian/update');
  const sessions = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'state.json'))) : [];
  // Two sessions are a problem the gate reports on its own; neither of them is the one to read.
  if (sessions.length === 1) return parseJournal(fs.readFileSync(path.join(dir, sessions[0]!.name, 'state.json'), 'utf8')).targetManifest;
  const file = path.join(root, '.meridian/manifest.json');
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest) : null;
}
