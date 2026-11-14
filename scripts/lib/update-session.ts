/**
 * The rules of an update session: the keep register, the journal, the plan hash and the readiness predicate.
 *
 * Author this standalone module here: `scripts/check.ts` runs it under plain node in projects with no CLI.
 * `cli/scripts/build-payload.ts` generates `cli/src/update-session.ts` from the same source snapshot as the payload.
 * Its only import is `node:crypto` and it uses erasable TypeScript only, so adopted projects can load it as is.
 */
import { createHash } from 'node:crypto';

export type Hash = `sha256-${string}`;
export type FileSide = { exists: boolean; hash: Hash | null };
export type Disposition = 'untouched' | 'edited' | 'kept' | 'added' | 'removed' | 'local-deletion' | 'collision' | 'retired-kept' | 'team-preserved';
export type FileOperation = {
  path: string; disposition: Disposition; action: 'write' | 'delete' | 'stage' | 'leave';
  base: FileSide; ours: FileSide; target: FileSide; applied: boolean; appliedHash: Hash | null;
};
export type Migration = { id: string; summary: string; paths: string[]; instructions: string; checks: string[] };
export type Resolution = { id: string; status: 'resolved' | 'not-applicable'; reason: string; files: Record<string, Hash | null> };
export type ValidationResult = { command: string; exitCode: number; evidenceFile: string };
export type Manifest = { version: string; route: 'adopt' | 'create'; brand: Record<string, string>; files: Record<string, string> };
export type KeepEntry = { path: string; reason: string };
export type Retirement = { path: string; baselineHash: Hash; reason: string };
export type Phase = 'prepared' | 'applying' | 'needs-resolution' | 'ready' | 'validating' | 'failed' | 'complete' | 'aborted';
export type UpdateJournal = {
  id: string; sourceVersion: string; targetVersion: string; route: 'adopt' | 'create';
  originalManifest: Manifest; targetManifest: Manifest; targetIntegrity: string; planHash: Hash;
  phase: Phase;
  operations: FileOperation[]; migrations: Migration[];
  retired: Retirement[];
  /** Managed files the team had deleted, recorded in keep.json by this update: absent is a deletion the team kept. */
  keptDeletions: KeepEntry[];
  validation: ValidationResult[]; failure: string | null;
};

const DISPOSITIONS: Disposition[] = ['untouched', 'edited', 'kept', 'added', 'removed', 'local-deletion', 'collision', 'retired-kept', 'team-preserved'];
const ACTIONS: FileOperation['action'][] = ['write', 'delete', 'stage', 'leave'];
const PHASES: Phase[] = ['prepared', 'applying', 'needs-resolution', 'ready', 'validating', 'failed', 'complete', 'aborted'];

// ── Primitive checks ─────────────────────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonBlank = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isHash = (v: unknown): v is Hash => typeof v === 'string' && /^sha256-[0-9a-f]{64}$/.test(v);

/** A project-relative path that stays inside the project: posix separators, no absolute form, no `.` or `..` segment. */
export function isSafePath(p: unknown): p is string {
  if (typeof p !== 'string' || p === '' || p.includes('\\') || p.includes('\0') || p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${what}: not valid JSON (${(e as Error).message})`);
  }
}

function exactKeys(o: Obj, keys: string[], at: string) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${at}: unexpected field "${k}"`);
  for (const k of keys) if (!(k in o)) throw new Error(`${at}: missing field "${k}"`);
}

function str(v: unknown, at: string): string {
  if (typeof v !== 'string') throw new Error(`${at}: must be a string`);
  return v;
}

/** A journal id is one folder's name: letters, digits, dot, dash and underscore, never `.` or `..`. */
function sessionName(v: unknown, at: string): string {
  const s = str(v, at);
  if (!/^[A-Za-z0-9._-]+$/.test(s) || s === '.' || s === '..') throw new Error(`${at}: must be a plain folder name (letters, digits, dot, dash and underscore)`);
  return s;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], at: string): T {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) throw new Error(`${at}: must be one of ${list.join(', ')}`);
  return v as T;
}

function strings(v: unknown, at: string): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error(`${at}: must be an array of strings`);
  return [...v];
}

function paths(v: unknown, at: string): string[] {
  const list = strings(v, at);
  for (const p of list) if (!isSafePath(p)) throw new Error(`${at}: "${p}" is not a safe project-relative path`);
  return list;
}

function hash(v: unknown, at: string): Hash {
  if (!isHash(v)) throw new Error(`${at}: must be a sha256-… hash`);
  return v;
}

function recordOf<T>(v: unknown, at: string, value: (x: unknown, at: string) => T): Record<string, T> {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) {
    if (!isSafePath(k)) throw new Error(`${at}: "${k}" is not a safe project-relative path`);
    out[k] = value(x, `${at}["${k}"]`);
  }
  return out;
}

// ── The keep register ────────────────────────────────────────────────────────────────────────────────

/** `.meridian/keep.json`: an array of exactly `{ path, reason }`, paths unique and safe, reasons not blank. */
export function parseKeep(text: string): KeepEntry[] {
  const v = parseJson(text, 'keep.json');
  if (!Array.isArray(v)) throw new Error('keep.json: must be an array of { path, reason }');
  const seen = new Set<string>();
  return v.map((e, i) => {
    const at = `keep.json entry ${i}`;
    const entry = keepEntry(e, at);
    if (seen.has(entry.path)) throw new Error(`${at}: path "${entry.path}" is listed twice`);
    seen.add(entry.path);
    return entry;
  });
}

function keepEntry(e: unknown, at: string): KeepEntry {
  if (!isObj(e)) throw new Error(`${at}: must be an object with path and reason`);
  exactKeys(e, ['path', 'reason'], at);
  if (!isSafePath(e.path)) throw new Error(`${at}: path must be a safe project-relative path`);
  if (!nonBlank(e.reason)) throw new Error(`${at} (${e.path}): reason must not be blank`);
  return { path: e.path, reason: e.reason };
}

/**
 * A kept path must be managed or verifiably retired. An absent kept file is not a problem: it is a file the team
 * deliberately deleted, and the update recorded it as kept deleted so no later update stages it again.
 */
export function keepProblems(
  keep: KeepEntry[],
  ctx: { managed: ReadonlySet<string>; retired: readonly Retirement[] },
): string[] {
  const retired = new Set(ctx.retired.map((r) => r.path));
  const out: string[] = [];
  for (const { path: p } of keep) {
    if (!ctx.managed.has(p) && !retired.has(p)) out.push(`${p}: kept, but Meridian neither manages nor retired it (remove it from .meridian/keep.json)`);
  }
  return out;
}

// ── The journal ──────────────────────────────────────────────────────────────────────────────────────

function side(v: unknown, at: string): FileSide {
  if (!isObj(v)) throw new Error(`${at}: must be { exists, hash }`);
  exactKeys(v, ['exists', 'hash'], at);
  if (typeof v.exists !== 'boolean') throw new Error(`${at}.exists: must be a boolean`);
  if (v.exists) return { exists: true, hash: hash(v.hash, `${at}.hash`) };
  if (v.hash !== null) throw new Error(`${at}: an absent file has a null hash`);
  return { exists: false, hash: null };
}

function manifest(v: unknown, at: string): Manifest {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  return {
    version: str(v.version, `${at}.version`),
    route: oneOf(v.route, ['adopt', 'create'], `${at}.route`),
    brand: recordAny(v.brand, `${at}.brand`, str),
    files: recordOf(v.files, `${at}.files`, str),
  };
}

function recordAny<T>(v: unknown, at: string, value: (x: unknown, at: string) => T): Record<string, T> {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x, `${at}.${k}`)]));
}

function operation(v: unknown, at: string): FileOperation {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  if (!isSafePath(v.path)) throw new Error(`${at}.path: must be a safe project-relative path`);
  const here = `${at} (${v.path})`;
  return {
    path: v.path,
    disposition: oneOf(v.disposition, DISPOSITIONS, `${here}.disposition`),
    action: oneOf(v.action, ACTIONS, `${here}.action`),
    base: side(v.base, `${here}.base`),
    ours: side(v.ours, `${here}.ours`),
    target: side(v.target, `${here}.target`),
    applied: typeof v.applied === 'boolean' ? v.applied : (() => { throw new Error(`${here}.applied: must be a boolean`); })(),
    appliedHash: v.appliedHash === null ? null : hash(v.appliedHash, `${here}.appliedHash`),
  };
}

function migration(v: unknown, at: string): Migration {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  if (!nonBlank(v.id)) throw new Error(`${at}.id: must not be blank`);
  const here = `${at} (${v.id})`;
  return { id: v.id, summary: str(v.summary, `${here}.summary`), paths: paths(v.paths, `${here}.paths`), instructions: str(v.instructions, `${here}.instructions`), checks: strings(v.checks, `${here}.checks`) };
}

function retirement(v: unknown, at: string): Retirement {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  if (!isSafePath(v.path)) throw new Error(`${at}.path: must be a safe project-relative path`);
  return { path: v.path, baselineHash: hash(v.baselineHash, `${at}.baselineHash`), reason: str(v.reason, `${at}.reason`) };
}

function validation(v: unknown, at: string): ValidationResult {
  if (!isObj(v)) throw new Error(`${at}: must be an object`);
  if (typeof v.exitCode !== 'number' || !Number.isInteger(v.exitCode)) throw new Error(`${at}.exitCode: must be an integer`);
  return { command: str(v.command, `${at}.command`), exitCode: v.exitCode, evidenceFile: str(v.evidenceFile, `${at}.evidenceFile`) };
}

function list<T>(v: unknown, at: string, one: (x: unknown, at: string) => T): T[] {
  if (!Array.isArray(v)) throw new Error(`${at}: must be an array`);
  return v.map((x, i) => one(x, `${at}[${i}]`));
}

/** Read `state.json` back, refusing anything that is not exactly a journal. Every error names the field. */
export function parseJournal(text: string): UpdateJournal {
  const v = parseJson(text, 'state.json');
  if (!isObj(v)) throw new Error('state.json: must be an object');
  return {
    // The id becomes the session folder's name under `.meridian/history/<version>/`; a hand-edited `../` would move it
    // outside.
    id: sessionName(v.id, 'id'),
    sourceVersion: str(v.sourceVersion, 'sourceVersion'),
    targetVersion: str(v.targetVersion, 'targetVersion'),
    route: oneOf(v.route, ['adopt', 'create'], 'route'),
    originalManifest: manifest(v.originalManifest, 'originalManifest'),
    targetManifest: manifest(v.targetManifest, 'targetManifest'),
    targetIntegrity: str(v.targetIntegrity, 'targetIntegrity'),
    planHash: hash(v.planHash, 'planHash'),
    phase: oneOf(v.phase, PHASES, 'phase'),
    operations: list(v.operations, 'operations', operation),
    migrations: list(v.migrations, 'migrations', migration),
    retired: list(v.retired, 'retired', retirement),
    // Records written before the field existed hold no keep entries, which is exactly what absent means: `keepDeletions`
    // arrived after several releases had already written journals, and refusing them failed `check.ts` — and so
    // `--finalize` — in every project that had ever updated (an adopter hit 19 of them, 0.13.0 to 0.39.0).
    keptDeletions: list(v.keptDeletions ?? [], 'keptDeletions', keepEntry),
    validation: list(v.validation, 'validation', validation),
    failure: v.failure === null ? null : str(v.failure, 'failure'),
  };
}

/** `resolutions.json`: an array of `{ id, status, reason, files }`. */
export function parseResolutions(text: string): Resolution[] {
  const v = parseJson(text, 'resolutions.json');
  if (!Array.isArray(v)) throw new Error('resolutions.json: must be an array');
  return v.map((e, i) => {
    const at = `resolutions.json entry ${i}`;
    if (!isObj(e)) throw new Error(`${at}: must be an object`);
    exactKeys(e, ['id', 'status', 'reason', 'files'], at);
    if (!nonBlank(e.id)) throw new Error(`${at}: id must not be blank`);
    return {
      id: e.id,
      status: oneOf(e.status, ['resolved', 'not-applicable'], `${at} (${e.id}).status`),
      reason: str(e.reason, `${at} (${e.id}).reason`),
      files: recordOf(e.files, `${at} (${e.id}).files`, (x, a) => (x === null ? null : hash(x, a))),
    };
  });
}

// ── The plan hash ────────────────────────────────────────────────────────────────────────────────────

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

/** The identity of the plan: both manifests, every operation's decision inputs, and the migrations. Not progress. */
export function planHash(j: UpdateJournal): Hash {
  const plan = {
    originalManifest: j.originalManifest,
    targetManifest: j.targetManifest,
    operations: j.operations.map((o) => ({ path: o.path, disposition: o.disposition, action: o.action, base: o.base, ours: o.ours, target: o.target })),
    migrations: j.migrations,
  };
  return `sha256-${createHash('sha256').update(canonical(plan)).digest('hex')}`;
}

/** A retirement counts only when the original manifest recorded that very baseline for the path. */
export function verifiedRetirements(j: UpdateJournal): Retirement[] {
  return j.retired.filter((r) => j.originalManifest.files[r.path] === r.baselineHash);
}

// ── Readiness ────────────────────────────────────────────────────────────────────────────────────────

/** The open items of a session, one `<id or path>: <what is wrong>` each; `[]` when it is ready to finalize. */
export function unresolved(j: UpdateJournal, resolutions: Resolution[], hashOf: (p: string) => Hash | null): string[] {
  if (j.phase === 'prepared' || j.phase === 'applying') return [`${j.id}: the update was interrupted: run update --resume`];
  if (j.phase === 'complete' || j.phase === 'aborted') return [`${j.id}: the session is ${j.phase} and does not belong in .meridian/update/`];

  const out: string[] = [];
  if (planHash(j) !== j.planHash) out.push(`${j.id}: the plan was edited (its hash no longer matches state.json)`);
  for (const o of j.operations) {
    // Shared package/agent/lockfile edits stay the team's; only automatic managed results are fixed by this plan.
    if (o.action !== 'write' && o.action !== 'delete') continue;
    if (!o.applied) out.push(`${o.path}: ${o.action} was never applied`);
    else if (o.disposition !== 'team-preserved' && hashOf(o.path) !== o.appliedHash) {
      out.push(`${o.path}: changed after the update applied it; restore the planned ${o.action === 'delete' ? 'absence' : 'new/ copy'} before finalizing (save deliberate edits separately before aborting and restarting to review them)`);
    }
  }

  const byId = new Map<string, Resolution[]>();
  for (const r of resolutions) byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
  const expected = new Set<string>();
  const current = (files: Record<string, Hash | null>, p: string) => Object.hasOwn(files, p) && files[p] === hashOf(p);

  const check = (id: string, statuses: Resolution['status'][], named: string[]) => {
    expected.add(id);
    const found = byId.get(id) ?? [];
    if (found.length === 0) return out.push(`${id}: needs a resolution`);
    if (found.length > 1) return out.push(`${id}: has ${found.length} resolutions, exactly one is allowed`);
    const r = found[0];
    if (!statuses.includes(r.status)) return out.push(`${id}: status must be ${statuses.join(' or ')}`);
    if (!nonBlank(r.reason)) return out.push(`${id}: the resolution needs a reason`);
    for (const p of named) {
      if (!Object.hasOwn(r.files, p)) out.push(`${id}: the resolution does not record ${p}`);
      else if (!current(r.files, p)) out.push(`${id}: ${p} changed since the resolution recorded it`);
    }
  };
  for (const o of j.operations) if (o.action === 'stage') check(`file:${o.path}`, ['resolved'], [o.path]);
  for (const m of j.migrations) check(`migration:${m.id}`, ['resolved', 'not-applicable'], m.paths);

  for (const [id, found] of byId) if (!expected.has(id)) out.push(`${id}: unknown resolution${found.length > 1 ? ' (and duplicated)' : ''}`);
  return out;
}
