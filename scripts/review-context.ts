/**
 * review-context.ts — beside each screenshot of a review, the shared context the console's assistant is given on that
 * page, as `view_<name>` answers it, so a reader who never built the console can judge what an agent on the page is told.
 *
 *   node scripts/review-context.ts <path ...> --as <persona> --gateway <url> [--out out/review/<persona>]
 *
 * The paths and `--as` are a `scripts/shot.ts` run's own, so a review runs the two side by side; `--gateway` is the
 * gateway the served console reads (its `ZZ_GATEWAY`), the fake one in a review. Each path's file is the shot's name
 * with its width, theme and anything pressed left off: `/platform/releases/0.97.0` as `member` is
 * `platform-releases-0.97.0-member.context.txt`, beside `platform-releases-0.97.0-member-1440-light.png`.
 *
 * A file's text is `contextText` of the view's context, the text both the page's `<view-context>` and its view tool hand
 * the model (`src/lib/shared-context.ts`), read by the view whose page renders the address (`viewAt`) with the address's
 * segments and query as its input, as the person. The console's modules are loaded as `scripts/explore-probe.ts` loads
 * them: hooks resolve `@/` and extensionless imports, the console's TypeScript compiles each source, `server-only` is
 * empty, and `next/headers` answers the persona's session cookie alone, so every read is the console's own gateway read.
 *
 * DELIBERATE: an address no view renders (an old address, which draws the missing page) and a view the person may not
 * open (which the console answers with the missing page, and whose tool the assistant is not offered) are given no view
 * context at all. Their file says so in one sentence with the address, since that is what the assistant is told there:
 * the page's visible text and no view context.
 *
 * Exit 0: one file written per path, one line each, then the final line.
 * Exit 1: a view the person may open could not be read — each such address and why; the other files are still written.
 * Exit 2: no path, no persona, no gateway, or a gateway that could not be reached — nothing could be read, not a pass.
 */
import fs from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { may } from '../src/data/access.ts';
import type { ViewTool, contextText, viewAt } from '../src/lib/shared-context.ts';
import type { AUDIT_DEFAULTS } from '../src/views/platform-audit-context.ts';
import type { viewTools } from '../src/views/tools.ts';
import { importTarget, projectAliases } from './lib/aliases.ts';
import config from './verify.config.ts';

const NAME = 'review-context';
const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'src');
/** Where the hooks find the cookie: set once the persona is known, before any console module asks for it. */
const COOKIE = Symbol.for('zz-stack.review-context.cookie');

/** A shot's name for a route and a persona, without its width and theme: `scripts/shot.ts`'s own rule. */
export function contextFile(route: string, persona: string): string {
  const slug = persona.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${route.replace(/^\//, '').replace(/[/?=&#]+/g, '-') || 'home'}-${slug}.context.txt`;
}

/** What the assistant is told on an address where it is given no view context, and why. */
export const NO_VIEW = (address: string) => `${address} · no view renders this address, so the assistant is given no view context here: only the page's visible text, which is the console's missing page.`;
export const NOT_OPEN = (address: string, title: string) => `${address} · ${title} is not a view this person may open: the console draws the missing page here and does not offer its view tool, so the assistant is given no view context, only that page's visible text.`;

/** The console's modules as its server runs them: aliases and extensionless imports resolved, every source compiled. */
function hook(): void {
  const require = createRequire(path.join(ROOT, 'package.json'));
  const ts = require('typescript') as typeof import('typescript');
  const aliases = projectAliases(ROOT);
  const stubs: Record<string, string> = {
    'server-only': '',
    // The one credential the server forwards (`src/data/gateway.ts`): the session cookie, and no other header.
    'next/headers': `const c = () => globalThis[Symbol.for('zz-stack.review-context.cookie')];
      export async function cookies() { return { get: (n) => (n === 'zz_console' && c() ? { name: n, value: c() } : undefined) }; }
      export async function headers() { return new Headers(); }`,
  };
  const file = (base: string) => ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  registerHooks({
    resolve(spec, context, next) {
      if (spec in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[spec])}`, shortCircuit: true };
      const from = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
      const target = from?.startsWith(SOURCE) ? importTarget(path.relative(ROOT, from), spec, aliases) : null;
      const found = target ? file(path.join(ROOT, target)) : undefined;
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
      if (!url.startsWith('file:') || !/\.tsx?$/.test(url) || !fileURLToPath(url).startsWith(SOURCE)) return next(url, context);
      const name = fileURLToPath(url);
      const { outputText } = ts.transpileModule(fs.readFileSync(name, 'utf8'), {
        fileName: name,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: 'module', source: outputText, shortCircuit: true };
    },
  });
}

/** A view's input from an address it renders: `[name]` is one segment, `[...name]` the rest of them joined, and the
 *  query's parameters by their names. */
function inputOf(page: string, address: string): Record<string, string> {
  const [where, query = ''] = address.split('?');
  const want = page.split('/'), got = where.split('/');
  return {
    ...Object.fromEntries(want.flatMap((s, i) => {
      const rest = /^\[\.\.\.([^\]]+)\]$/.exec(s), one = /^\[([^\]]+)\]$/.exec(s);
      return rest ? [[rest[1], got.slice(i).join('/')]] : one ? [[one[1], got[i]]] : [];
    })),
    ...Object.fromEntries(new URLSearchParams(query)),
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i < 0 ? '' : args.splice(i, 2)[1] ?? ''; };
  const as = opt('--as'), gateway = opt('--gateway').replace(/\/+$/, ''), outOpt = opt('--out');
  const routes = args;
  const personas = (config as { personas?: Record<string, { cookie: { name: string; value: string } }> }).personas ?? {};
  const cookie = personas[as]?.cookie;
  if (!routes.length || !cookie || !gateway) {
    console.error(`${NAME}: usage: node scripts/review-context.ts <path ...> --as <${Object.keys(personas).join('|')}> --gateway <url> [--out <folder>]` +
      ' — nothing was read, which is not a pass');
    return 2;
  }
  try {
    await fetch(`${gateway}/api/console/me`, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    console.error(`${NAME}: ${gateway} could not be reached (${(e as Error).message}) — nothing was read, which is not a pass`);
    return 2;
  }
  const out = path.resolve(outOpt || path.join(ROOT, 'out', 'review', as));
  // The console's server, as a deployment runs it: the gateway's address, production, and no development credential.
  Object.assign(process.env, { ZZ_GATEWAY: gateway, NODE_ENV: 'production', ZZ_DEV_PAT: '' });
  (globalThis as Record<symbol, unknown>)[COOKIE] = cookie.value;
  hook();
  const m = Object.assign({}, ...await Promise.all(['views/tools.ts', 'lib/shared-context.ts', 'data/access.ts', 'views/platform-audit-context.ts']
    .map((f) => import(pathToFileURL(path.join(SOURCE, f)).href) as Promise<Record<string, unknown>>))) as {
    viewTools: typeof viewTools; viewAt: typeof viewAt; contextText: typeof contextText; may: typeof may; AUDIT_DEFAULTS: typeof AUDIT_DEFAULTS;
  };
  /** What a page reads when its address names nothing, for the one view whose tool takes it as a required input: Audit
   *  opens on its acts of administration. Every other view's input is its address's segments, its query optional. */
  const opened: Record<string, Record<string, string>> = { audit: { filter: m.AUDIT_DEFAULTS.filter } };
  /** The context a view tool answers at an address, as the text the model is handed, or why it could not be read. */
  const contextAt = async (v: ViewTool, route: string): Promise<string | { error: string }> => {
    try {
      const { context } = await v.read(v.input.parse({ ...opened[v.name], ...inputOf(v.page, route) }));
      return m.contextText(context);
    } catch (e) {
      return { error: e instanceof Error ? e.message.replace(/\s+/g, ' ') : String(e) };
    }
  };

  fs.mkdirSync(out, { recursive: true });
  const failed: string[] = [];
  for (const route of routes) {
    const where = route.split('?')[0].replace(/(.)\/+$/, '$1');
    const v = m.viewAt(m.viewTools as ViewTool[], where);
    const open = v ? await m.may(v.needs) : false;
    const read = !v ? NO_VIEW(route) : !open ? NOT_OPEN(route, v.title) : await contextAt(v, route);
    if (typeof read !== 'string') {
      failed.push(`${route} (view_${v!.name}): ${read.error}`);
      continue;
    }
    const file = path.join(out, contextFile(route, as));
    fs.writeFileSync(file, `${read}\n`);
    console.log(`  ok  ${path.relative(process.cwd(), file)} · ${!v ? 'no view' : open ? `view_${v.name}, ${read.split('\n').length} lines` : `${v.title} is not open to ${as}`}`);
  }
  if (failed.length) {
    console.error(`${NAME}: FAILED: ${failed.length} of ${routes.length} contexts could not be read as ${as}:\n    ${failed.join('\n    ')}`);
    return 1;
  }
  console.log(`${NAME}: ${routes.length} contexts, as the assistant is given each page's, written for ${as} into ${path.relative(process.cwd(), out) || '.'}: ok`);
  return 0;
}

// Imported by its test for its names, it reads nothing.
if (import.meta.main) process.exit(await main());
