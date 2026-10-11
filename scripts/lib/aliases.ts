/**
 * The project's import aliases, read from its tsconfig's `paths`, so the checks resolve an import the way TypeScript
 * does. In the template `@/` is `src/`; in an adopted project `@/` is the team's own root and Meridian is `@meridian/`.
 * A check that assumed `@/` meant `src/` misread every import an adopted project writes.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Each alias prefix (`@/`, `@meridian/`) and the project directory it names (`src/`, or `` for the root). */
export function aliasesOf(tsconfig: string | null): [string, string][] {
  const out = new Map<string, string>();
  // `"@/*": ["./src/*"]` maps `@/` to `src/`; `"@/*": ["./*"]` maps it to the project root.
  for (const m of (tsconfig ?? '').matchAll(/"(@[\w-]*)\/\*"\s*:\s*\[\s*"([^"*]*)\*"/g)) out.set(`${m[1]}/`, m[2]!.replace(/^\.\//, ''));
  if (!out.size) out.set('@/', 'src/');
  return [...out].sort((a, b) => b[0].length - a[0].length);
}

export function projectAliases(root: string): [string, string][] {
  const file = path.join(root, 'tsconfig.json');
  return aliasesOf(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
}

/** The project path an import names before extensions are tried, or null for a package import. */
export function importTarget(from: string, spec: string, aliases: [string, string][]): string | null {
  if (spec.startsWith('.')) return path.posix.join(path.posix.dirname(from), spec);
  for (const [alias, dir] of aliases) if (spec.startsWith(alias)) return path.posix.join(dir || '.', spec.slice(alias.length));
  return null;
}
