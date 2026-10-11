import { z } from 'zod';

/** A named set of records the pages and the assistant read and change through one interface. */
type Op = 'create' | 'update' | 'remove';
type Scalar = string | number | boolean | null;
type Value = Scalar | Scalar[];
type Condition = { field: string; op: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in'; value: Value };
export type Query = { where?: Condition[]; sort?: { field: string; dir: 'asc' | 'desc' }; limit?: number; offset?: number };

/** What a grant permits: an object and one of the four operations, e.g. `keys:create`. */
export type Grant = `${string}:${'read' | 'create' | 'update' | 'remove'}`;
/** A need one grant satisfies on its own, or several that must all hold. */
export type ProtectedNeed = Grant | { readonly allOf: readonly [Grant, ...Grant[]] };
/** A need with no grant behind it: any signed-in active person satisfies it. */
export type Need = ProtectedNeed | 'public';

/** What a browser may be told about a change: which collection, and nothing about the rows, the tenant or the cache. */
export type LiveEvent = { collection: string };

/**
 * What the console's chrome shows about the current request: the destinations, the person and who the demo may be viewed
 * as. It lives here, beside the need vocabulary, and not in the project's own `src/data/access.ts`, because Meridian ships
 * the chrome that takes it: a file we manage may only import what we manage.
 */
export type ChromeAccess = {
  /** The destinations this person may satisfy the need of, as hrefs — what the rail and the palette both draw. */
  only: string[];
  /** The signed-in person, as the rail's account card reads them: their name and `roleLabel`. */
  user: { name: string; role: string };
  /** The View as group: the persona in view, the five personas in order, and the action that signs the demo in as one. */
  viewAs: {
    current: string;
    options: { id: string; label: string; disabled?: boolean }[];
    choose: (id: string) => Promise<void>;
  };
};

export type Collection<T extends Record<string, unknown>, K extends keyof T & string> = {
  name: string;
  label: string;
  description: string;
  /** The record without its key, as a write takes it. */
  fields: z.ZodObject;
  /**
   * Fields the data layer works out and no write ever takes: a score, a band, a stage, a value joined in from another
   * table. They live on the record, so a page reads them and the assistant may filter on them, and they are never in
   * `fields` — a change cannot set one, because `patchOf` builds its shape from `fields` alone.
   */
  derived?: (keyof T & string)[];
  key: K;
  title: (row: T) => string;
  query: (q: Query) => Promise<{ rows: T[]; total: number }>;
  /** Present on a collection already bound to an authorized scope: calls `listener` after each committed write. */
  subscribe?: (listener: (event: LiveEvent) => void) => () => void;
  /**
   * A plain record, validated by `fields`, and never `Omit<T, K>`.
   *
   * A record type carries fields a write does not take — the worked-out ones above, and data joined in from elsewhere —
   * and a form hands over strings, so `Omit<T, K>` demands things the caller cannot supply and every real data layer
   * ends up casting around it. The write shape is `fields`; this says so, and `fields.parse` is what holds it.
   */
  create?: (input: Record<string, unknown>) => Promise<T>;
  update?: (ids: string[], patch: Record<string, unknown>) => Promise<T[]>;
  remove?: (ids: string[]) => Promise<number>;
  /** Operations only a page may perform; the assistant and an MCP server never get them. */
  pageOnly?: Op[];
  /**
   * Fields an agent may read and never write: left out of the create and update **schemas** the assistant builds
   * (`writableFields`) and refused at execution if sent anyway. A query still names them, and a page still sets them
   * through its own action — the roles and add-ons on the Members page, for one, which only `assignRole` may change.
   */
  pageOnlyFields?: (keyof T & string)[];
  /** Fields only a page may see: left out of every assistant tool's input and result. */
  hidden?: (keyof T)[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCollection = Collection<any, any>;

/**
 * One store per tenant and name per process, on globalThis, so a route handler, a server action and a page share it.
 * `next` is the next id's number: it only grows, so a removed record's id is never given to a new one.
 */
type Store = { rows: Record<string, unknown>[]; next: number };
const STORES = Symbol.for('zz-meridian.collections');
const stores = () => ((globalThis as Record<symbol, unknown>)[STORES] ??= new Map<string, Store>()) as Map<string, Store>;
const storeKey = (tenantId: string, name: string) => JSON.stringify([tenantId, name]);

/** The listeners of each tenant's collection, on globalThis for the same reason as the stores. */
const LIVE = Symbol.for('zz-meridian.live');
const listeners = () => ((globalThis as Record<symbol, unknown>)[LIVE] ??= new Map<string, Set<(e: LiveEvent) => void>>()) as Map<string, Set<(e: LiveEvent) => void>>;

/** How many listeners a tenant's collection has: for tests and diagnostics. */
export const liveListeners = (tenantId: string, name: string): number => listeners().get(storeKey(tenantId, name))?.size ?? 0;

/** Forget every store and listener: for tests. */
export function resetCollections(): void {
  stores().clear();
  listeners().clear();
}

const OPS = ['eq', 'ne', 'gt', 'lt', 'contains', 'in'];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_OFFSET = 100_000;

/**
 * A query with every default applied and every limit held: `limit` (default 100, at most 500), `offset` (a whole number
 * from 0 to 100000) and `sort` (the key ascending when none is asked). Only the collection's `fields`, its key and its
 * `derived` fields may be named, and only the six operators; anything else throws an Error naming it.
 */
export function normalizeQuery(c: AnyCollection, q: Query = {}): Required<Pick<Query, 'limit' | 'offset' | 'sort'>> & Pick<Query, 'where'> {
  const allowed = new Set<string>([c.key, ...Object.keys(c.fields.shape), ...((c.derived ?? []) as string[])]);
  const field = (f: string) => {
    if (!allowed.has(f)) throw new Error(`${c.name} has no field ${JSON.stringify(f)}`);
    return f;
  };
  const where = (q.where ?? []).map((w) => {
    if (!OPS.includes(w.op)) throw new Error(`Unsupported operator ${JSON.stringify(w.op)}`);
    return { field: field(w.field), op: w.op, value: w.value };
  });
  const sort = q.sort ? { field: field(q.sort.field), dir: q.sort.dir === 'desc' ? 'desc' as const : 'asc' as const } : { field: c.key as string, dir: 'asc' as const };
  const limit = q.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a whole number of at least 1');
  const offset = q.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) throw new Error(`offset must be a whole number from 0 to ${MAX_OFFSET}`);
  return { where, sort, limit: Math.min(limit, MAX_LIMIT), offset };
}

/** Code-point order for strings, numeric order for numbers. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = Array.from(String(a), (c) => c.codePointAt(0)!), y = Array.from(String(b), (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

/** A null field matches only `ne`; `gt`/`lt` need the field and the value to be the same kind. */
function matches(row: Record<string, unknown>, { field, op, value }: Condition): boolean {
  const v = row[field];
  if (v === null || v === undefined) return op === 'ne';
  switch (op) {
    case 'eq': return v === value;
    case 'ne': return v !== value;
    case 'gt': return typeof v === typeof value && compare(v, value) > 0;
    case 'lt': return typeof v === typeof value && compare(v, value) < 0;
    case 'contains': return String(v).toLowerCase().includes(String(value).toLowerCase());
    case 'in': return Array.isArray(value) && value.includes(v as Scalar);
  }
}

export function arrayCollection<T extends Record<string, unknown>, K extends keyof T & string>(def: {
  name: string;
  label: string;
  description: string;
  fields: z.ZodObject;
  derived?: (keyof T & string)[];
  /** Works out the `derived` fields of a row from the rest; run on every created and changed row, never written by a caller. */
  derive?: (row: Record<string, unknown>) => Partial<T>;
  key: K;
  title: (row: T) => string;
  rows: T[];
  allow: readonly Op[];
  pageOnly?: Op[];
  pageOnlyFields?: (keyof T & string)[];
  hidden?: (keyof T)[];
  /** The tenant whose store and listeners this collection binds; the sample has one. */
  tenantId?: string;
}): Collection<T, K> {
  const { name, key, allow } = def;
  const tenantId = def.tenantId ?? 'demo';
  const sk = storeKey(tenantId, name);
  if (key in def.fields.shape) throw new Error(`${name}: fields describe the record without its key, so they cannot name ${key}`);
  if (!stores().has(sk)) {
    const top = def.rows.reduce((m, r) => Math.max(m, Number(/_(\d+)$/.exec(String(r[key]))?.[1] ?? 0)), 0);
    stores().set(sk, { rows: structuredClone(def.rows), next: top + 1 });
  }
  const store = () => stores().get(sk)!;
  const emit = () => {
    for (const l of [...(listeners().get(sk) ?? [])]) {
      try { l({ collection: name }); } catch { /* a listener's failure is never the write's */ }
    }
  };
  const rows = () => store().rows as T[];
  const copy = <R,>(r: R): R => structuredClone(r);
  const missing = (ids: string[]) => ids.filter((id) => !rows().some((r) => r[key] === id));
  const pick = (ids: string[]) => {
    const gone = missing(ids);
    // The sentence is the whole diagnosis, and the same one reaches the form's banner, the assistant's tool result and
    // a REST route of your own: `src/lib/assistant/tools.ts` wraps a thrown message, and the sample's server actions
    // return it, so nothing has to be translated between them. A REST surface maps it to a status where it lives.
    if (gone.length) throw new Error(`No ${name} with id ${gone.join(', ')}`);
    return rows().filter((r) => ids.includes(r[key] as string));
  };

  const c: Collection<T, K> = {
    name,
    label: def.label,
    description: def.description,
    fields: def.fields,
    derived: def.derived,
    key,
    title: def.title,
    pageOnly: def.pageOnly,
    pageOnlyFields: def.pageOnlyFields,
    hidden: def.hidden,
    async query({ where = [], sort, limit, offset = 0 }) {
      const hits = rows().filter((r) => where.every((w) => matches(r, w)));
      if (sort) {
        const s = sort.dir === 'desc' ? -1 : 1;
        hits.sort((a, b) => {
          const x = a[sort.field], y = b[sort.field];
          if (x != null && y != null) {
            const d = s * compare(x, y);
            if (d) return d;
          } else if (x != null || y != null) return x == null ? 1 : -1;
          return compare(a[key], b[key]);
        });
      }
      return { rows: copy(limit === undefined ? hits.slice(offset) : hits.slice(offset, offset + limit)), total: hits.length };
    },
    subscribe(listener) {
      const set = listeners().get(sk) ?? new Set();
      listeners().set(sk, set);
      set.add(listener);
      return () => {
        set.delete(listener);
        if (!set.size && listeners().get(sk) === set) listeners().delete(sk);
      };
    },
  };
  if (allow.includes('create')) {
    c.create = async (input) => {
      const row = { ...def.fields.parse(input), [key]: `${name}_${store().next++}` } as unknown as T;
      Object.assign(row, def.derive?.(row));
      rows().push(row);
      emit();
      return copy(row);
    };
  }
  if (allow.includes('update')) {
    c.update = async (ids, patch) => {
      const set = patchOf(def.fields).parse(patch);
      const hit = pick(ids);
      for (const r of hit) Object.assign(r, set, def.derive?.({ ...r, ...set }));
      emit();
      return copy(hit);
    };
  }
  if (allow.includes('remove')) {
    c.remove = async (ids) => {
      const hit = new Set(pick(ids));
      store().rows = rows().filter((r) => !hit.has(r));
      emit();
      return hit.size;
    };
  }
  return c;
}

/**
 * What a change may set: any of `fields`, none required, nothing else. A field's default is dropped, so a change that
 * does not name a field never resets it.
 */
export function patchOf(fields: z.ZodObject): z.ZodObject {
  const optional = (f: z.ZodType) => {
    const g = withoutDefault(f).optional();
    return f.description ? g.describe(f.description) : g;
  };
  return z.object(Object.fromEntries(Object.entries(fields.shape).map(([k, f]) => [k, optional(f)]))).strict();
}

/** `field` with every default, prefault and catch removed, however deep in optional, nullable or readonly. */
function withoutDefault(field: z.ZodType): z.ZodType {
  const inner = () => withoutDefault((field.def as unknown as { innerType: z.ZodType }).innerType);
  return field instanceof z.ZodDefault || field instanceof z.ZodPrefault || field instanceof z.ZodCatch ? inner()
    : field instanceof z.ZodOptional ? inner().optional()
    : field instanceof z.ZodNullable ? inner().nullable()
    : field instanceof z.ZodReadonly ? inner().readonly()
    : field;
}

/** The collection's fields without its hidden ones. */
export function visibleFields(c: AnyCollection): z.ZodObject {
  return c.fields.omit(Object.fromEntries(((c.hidden ?? []) as string[]).map((f) => [f, true])) as Record<string, true>).strict();
}

/**
 * The collection's fields an agent's tool may WRITE: its visible fields without the fields only a page may set
 * (`pageOnlyFields`). The create tool is built from this and the update tool's `set` from `patchOf` of it, so a field
 * a page owns is absent from the schema and, because the schema is strict, refused at execution if sent anyway.
 *
 * It says nothing about reading: `queryInput` still names every visible field, so an agent filters on a role or an
 * add-on the same as on any other field. Reading a field and changing it are different rules, and this is the second.
 */
export function writableFields(c: AnyCollection): z.ZodObject {
  const base = visibleFields(c);
  const pageOnly = (c.pageOnlyFields ?? []) as string[];
  return pageOnly.length ? base.omit(Object.fromEntries(pageOnly.map((f) => [f, true])) as Record<string, true>).strict() : base;
}

/** The input schema of the query tool: field names come from the collection, so an unknown or hidden field is rejected.
 *
 * `derived` fields are named here and nowhere else: they are readable and queryable, and no write can set one, because
 * `fields` is what a write takes. `visibleFields` has already dropped the hidden ones from `fields`, so only a hidden
 * derived field needs dropping here. */
export function queryInput(c: AnyCollection) {
  const hidden = new Set((c.hidden ?? []) as string[]);
  const derived = ((c.derived ?? []) as string[]).filter((f) => !hidden.has(f));
  const field = z.enum([c.key, ...Object.keys(visibleFields(c).shape), ...derived] as [string, ...string[]]);
  const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
  return z.object({
    where: z.array(z.object({ field, op: z.enum(['eq', 'ne', 'gt', 'lt', 'contains', 'in']), value: z.union([scalar, z.array(scalar)]) })).optional(),
    sort: z.object({ field, dir: z.enum(['asc', 'desc']) }).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  });
}
