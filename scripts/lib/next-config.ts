/**
 * The project's Next config, in whichever file Next itself reads (next.config.js, .mjs, .ts or .mts, in Next's order):
 * the template writes next.config.ts, and an adopted project keeps whatever it had. Scripts read the build folder here,
 * never by importing a config file by name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.mts'];

/** `distDir` as the project's config sets it for a production build, or `.next`. */
export async function distDirOf(root: string): Promise<string> {
  const file = FILES.map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
  if (!file) return '.next';
  const loaded = ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
  const config = typeof loaded === 'function' ? await loaded('phase-production-build', { defaultConfig: {} }) : loaded;
  const dir = (config as { distDir?: unknown } | undefined)?.distDir;
  return typeof dir === 'string' && dir ? dir : '.next';
}
