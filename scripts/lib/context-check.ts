/**
 * Pure checks for the agent-facing context a project keeps: the product brief (`docs/brief.md`) and the references its
 * instruction documents make to files and package scripts. No I/O here: the caller reads the files and says what exists.
 */
import path from 'node:path';
import { BRIEF_GUIDANCE } from '../../src/lib/assistant/prompt.ts';

/** The headings a brief must have, once each, in the order the template writes them. */
const REQUIRED = ['Product', 'Users', 'Data', 'Decisions', 'Glossary'] as const;

/**
 * Check a brief. A required `## ` heading that is missing or appears twice is an error; a section whose only non-blank
 * line is its own guidance line (the template, untouched) is a warning, because it has not been written yet.
 */
export function checkBrief(text: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sections = new Map<string, string[][]>();
  let current: string[] | null = null;
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = [];
      sections.set(heading[1], [...(sections.get(heading[1]) ?? []), current]);
    } else if (!fenced && /^#{1,2} /.test(line)) current = null;
    else current?.push(line);
  }
  for (const name of REQUIRED) {
    const found = sections.get(name) ?? [];
    if (found.length === 0) errors.push(`missing required heading "## ${name}"`);
    else if (found.length > 1) errors.push(`heading "## ${name}" appears ${found.length} times`);
    else {
      const body = found[0].map((l) => l.trim()).filter(Boolean);
      if (body.length === 0 || (body.length === 1 && body[0] === BRIEF_GUIDANCE[name])) warnings.push(`"## ${name}" is still the template guidance; write it`);
    }
  }
  return { errors, warnings };
}

/** A path reference starts with one of these, after an optional `required:`, `optional:` or `example:`. */
const PATH_ROOTS = ['.agents/', '.claude/', 'src/', 'app/', 'scripts/', 'docs/', '.meridian/', 'tokens/', 'tests/', 'references/', 'decisions/', 'journeys/', 'README.md', 'CONTRIBUTING.md'];

/**
 * The roots a project may genuinely lack, so a fenced command that names one is read too. A fence holds commands,
 * examples and placeholders, so every other root stays unchecked there.
 */
const FENCED_ROOTS = ['decisions/', 'journeys/', 'README.md', 'CONTRIBUTING.md'];

/** `pnpm <name>`, `pnpm run <name>`, `npm run <name>`, `yarn <name>` or `bun run <name>`, then nothing, ` -- ...` or flags. */
const SCRIPT = /^(pnpm run|pnpm|npm run|yarn|bun run) ([\w:.-]+)(?: --(?: .*)?| -.*)?$/;
/** What a bare `pnpm <name>` or `yarn <name>` runs as the package manager's own command, never a package script. */
const OWN_COMMANDS = new Set(['add', 'approve-builds', 'audit', 'bin', 'config', 'create', 'dedupe', 'deploy', 'dlx', 'env', 'exec', 'fetch', 'i', 'import', 'init', 'install', 'licenses', 'link', 'list', 'ls', 'outdated', 'pack', 'patch', 'prune', 'publish', 'rebuild', 'remove', 'rm', 'root', 'setup', 'store', 'uninstall', 'unlink', 'up', 'update', 'upgrade', 'why']);

/** The problem one path reference makes, if any: a root it starts with, a filter that admits it, and whether it is held. */
function pathProblem(
  ref: string,
  prefix: string | undefined,
  at: string,
  file: string,
  roots: readonly string[],
  exists: (path: string) => boolean,
): string | null {
  if (!roots.some((r) => ref.startsWith(r)) || /[*?<>{} ]/.test(ref)) return null;
  if (prefix === 'optional') return null;
  const target = ref.startsWith('references/') ? path.posix.join(path.posix.dirname(file), ref) : ref;
  const asGiven = ref.endsWith('/') && !target.endsWith('/') ? `${target}/` : target;
  return exists(asGiven) ? null : `${at}: path "${asGiven}" does not exist`;
}

/**
 * Check what documents point at. Outside a fence only inline code spans count; inside one, a bare word that starts with
 * `FENCED_ROOTS` is read too, because a project may lack those and a fenced command still has to tell the truth. A path
 * reference must exist, unless it is `optional:` or `example:`; a script reference must be in `scripts`. Globs,
 * placeholders, URLs, `node_modules/` paths and plain words are not references. `references/...` resolves against the
 * document's own folder, everything else from the repository root. `docs[i].file` is repository-relative and
 * `firstLine` (default 1) is the line of `text`'s first line in it. Returns one `<file>:<line>: <what is missing>`.
 */
export function scanReferences(
  docs: { file: string; text: string; firstLine?: number }[],
  exists: (path: string) => boolean,
  scripts: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const { file, text, firstLine = 1 } of docs) {
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      const at = `${file}:${firstLine + i}`;
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) {
        for (const token of line.split(/\s+/)) {
          const prefix = /^(required|optional|example):/.exec(token)?.[1];
          if (prefix === 'example') continue;
          // A command line ends a token with `;`, a comma or a full stop, and names a line of the file after a colon: a
          // path the project holds must not be reported because the sentence around it added one (`README.md;`,
          // `journeys/workspaces.ts:14`).
          const ref = (prefix ? token.slice(prefix.length + 1) : token).replace(/:\d+(?:-\d+)?$/, '').replace(/[;,.]$/, '');
          const problem = pathProblem(ref, prefix, at, file, FENCED_ROOTS, exists);
          if (problem) problems.push(problem);
        }
        return;
      }
      for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
        const prefix = /^(required|optional|example):/.exec(span)?.[1];
        if (prefix === 'example') continue;
        const ref = prefix ? span.slice(prefix.length + 1) : span;
        const script = SCRIPT.exec(ref);
        if (script) {
          const [, runner, name] = script;
          const own = (runner === 'pnpm' || runner === 'yarn') && OWN_COMMANDS.has(name);
          if (!own && !scripts.has(name)) problems.push(`${at}: package script "${name}" is not in package.json`);
          continue;
        }
        const problem = pathProblem(ref, prefix, at, file, PATH_ROOTS, exists);
        if (problem) problems.push(problem);
      }
    });
  }
  return problems;
}

/**
 * A line that names an entry point the three test commands replaced, and what the rule reports for it. The commands
 * are the product's whole test surface (`pnpm test:t1`, `test:t2`, `test:release`), so a document that tells a reader to
 * run `pnpm verify` or passes `--full` sends them to a command a project no longer has; that is a guarantee a project
 * depends on, not a preference about wording.
 */
const STALE: readonly (readonly [RegExp, string])[] = [
  [/\bpnpm (?:verify|gate)\b/, 'names pnpm verify or pnpm gate'],
  [/\b(?:npm|yarn|bun) run (?:verify|gate)\b/, 'names a removed package script'],
  [/\b(?:scripts|node scripts)\/(?:verify|gate)\.ts\b/, 'names a removed script'],
  [/`(?:verify|gate) --/, 'names a removed command with a flag'],
  [/--(?:full|timed|perf|shard)\b/, 'names a removed flag'],
  [/\btest:all\b/, 'names test:all'],
];

/**
 * The files the retired-entry-point rule reads in a project: its instruction documents, the scripts and workflows a
 * reader follows, and the CLI's own text. A path a project lacks is skipped by the caller. History is not here — the
 * decision records under `decisions/`, the dated evidence under `docs/evidence/`, the changelog and the migrations a
 * past release shipped say what was true then and are not rewritten.
 */
export const STALE_SURFACES: readonly string[] = [
  'README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'cli/README.md', 'docs/testing.md', 'docs/distribution.md', 'docs/benchmark.md', 'docs/agents.md', 'docs/start-a-dashboard.md', 'docs/atlas-scenario-coverage.md', 'docs/skill-evals.md', 'docs/data-display.md', 'docs/data-layers.md', 'docs/product-workspaces.md', 'docs/surfaces.md', 'docs/voice.md',
  'scripts/test-run.ts', 'scripts/brand.ts', 'scripts/verify.config.ts', 'scripts/audit.ts', 'scripts/interactions.ts', 'scripts/keyboard.ts', 'scripts/assistant.ts', 'scripts/live.ts', 'scripts/navigate.ts', 'scripts/vitals.ts', 'scripts/sizes.ts', 'scripts/shot.ts', 'scripts/route-policy.ts', 'cli/src/context.ts', 'cli/src/create.ts', 'cli/src/cli.ts', 'cli/src/session.ts', 'cli/src/merge-report.ts', 'cli/src/reconcile.ts', 'cli/scripts/smoke.ts',
  '.github/workflows/release.yml', '.github/workflows/weekly.yml',
];

/** The trees the skill is installed into: the repository's own, and the two an adopted project carries. */
export const SKILL_TREES: readonly string[] = ['skills/zz-meridian', '.agents/skills/zz-meridian', '.claude/skills/zz-meridian'];

/** The stale claims in the files given, each as `<file>:<line>: <what>`. */
export function staleClaims(files: readonly { file: string; text: string }[]): string[] {
  return files.flatMap(({ file, text }) =>
    text.split('\n').flatMap((line, i) => STALE.filter(([rule]) => rule.test(line)).map(([, what]) => `${file}:${i + 1}: ${what}`)),
  );
}
