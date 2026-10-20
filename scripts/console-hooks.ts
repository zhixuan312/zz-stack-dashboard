/**
 * The console's modules as its server runs them, for a script that imports them with plain `node`: the project's path
 * aliases and extensionless imports resolved, every source under `src/` compiled, `server-only` stubbed, and
 * `next/headers` answering the one credential the server forwards (`src/data/gateway.ts`), the session cookie, from
 * the global the script sets under `cookieKey`. scripts/explore-probe.ts and scripts/review-context.ts both read the
 * console through it.
 */
import fs from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importTarget, projectAliases } from './lib/aliases.ts';

export function consoleHooks(root: string, cookieKey: string): void {
  const source = path.join(root, 'src');
  const require = createRequire(path.join(root, 'package.json'));
  const ts = require('typescript') as typeof import('typescript');
  const aliases = projectAliases(root);
  const stubs: Record<string, string> = {
    'server-only': '',
    'next/headers': `const c = () => globalThis[Symbol.for(${JSON.stringify(cookieKey)})];
      export async function cookies() { return { get: (n) => (n === 'zz_console' && c() ? { name: n, value: c() } : undefined) }; }
      export async function headers() { return new Headers(); }`,
  };
  const file = (base: string) => ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  registerHooks({
    resolve(spec, context, next) {
      if (spec in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[spec])}`, shortCircuit: true };
      const from = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
      const target = from?.startsWith(source) ? importTarget(path.relative(root, from), spec, aliases) : null;
      const found = target ? file(path.join(root, target)) : undefined;
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
      try {
        return next(spec, context);
      } catch (e) {
        // A package without an `exports` map (`next/navigation`) is resolved as its own CommonJS resolves it.
        if (/^[@a-z]/.test(spec)) return { url: pathToFileURL(require.resolve(spec)).href, shortCircuit: true };
        throw e;
      }
    },
    load(url, context, next) {
      if (!url.startsWith('file:') || !/\.tsx?$/.test(url) || !fileURLToPath(url).startsWith(source)) return next(url, context);
      const name = fileURLToPath(url);
      const { outputText } = ts.transpileModule(fs.readFileSync(name, 'utf8'), {
        fileName: name,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: 'module', source: outputText, shortCircuit: true };
    },
  });
}
