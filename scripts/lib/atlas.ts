/**
 * The Design Atlas's own pages, for the checks that visit them: every entry the Atlas serves, read through the module the
 * Atlas renders from, so a new entry is checked without being listed anywhere.
 */
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CONTENT = path.join(ROOT, 'src/system/content.ts');

export type AtlasEntry = { href: string; kind: 'card' | 'template' | 'doc' | 'tokens' | 'page' };

/** Whether this project has an Atlas at all. An adopted project usually does not, and has nothing here to check. */
export const hasAtlas = () => fs.existsSync(CONTENT);

let hooked = false;
/**
 * Every Atlas entry: the guides, the token views, the cards, the page templates and the page specs. Throws, with the reason, when the content
 * module cannot be read. It never answers with fewer entries instead: that module imports `server-only`, a marker only
 * Next's bundler resolves, and for as long as a failed import was caught and answered with "the cards alone",
 * `audit.ts --atlas` said it had measured the Atlas while every token view, page spec and guide went unvisited.
 */
export async function atlasEntries(): Promise<AtlasEntry[]> {
  if (!hooked) {
    hooked = true;
    registerHooks({ resolve: (specifier, context, next) => (specifier === 'server-only' ? { url: 'data:text/javascript,', shortCircuit: true } : next(specifier, context)) });
  }
  let entries: AtlasEntry[] | undefined;
  try {
    entries = ((await import(pathToFileURL(CONTENT).href)) as { entries?: () => AtlasEntry[] }).entries?.();
  } catch (e) {
    throw new Error(`src/system/content.ts could not be read: ${(e as Error).message.split('\n')[0]}`);
  }
  if (!entries?.length) throw new Error('src/system/content.ts lists no Atlas entry');
  return entries.map(({ href, kind }) => ({ href, kind }));
}

/** One line saying what an Atlas run covers, by kind, so a run that reached less than the Atlas says so in its own output. */
export const atlasCoverage = (entries: AtlasEntry[]) => {
  const n = (k: AtlasEntry['kind']) => entries.filter((e) => e.kind === k).length;
  return `${n('card') + n('template')} cards, ${n('tokens')} token views, ${n('page')} page specs, ${n('doc')} guides`;
};
