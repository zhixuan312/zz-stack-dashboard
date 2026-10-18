import { z } from 'zod';

/** A named set of records the pages and the assistant read and change through one interface. */
type Op = 'create' | 'update' | 'remove';
type Scalar = string | number | boolean | null;
type Value = Scalar | Scalar[];
type Condition = { field: string; op: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in'; value: Value };
export type { Condition };
export type Query = { where?: Condition[]; sort?: { field: string; dir: 'asc' | 'desc' }; limit?: number; offset?: number };

/**
 * A question answered over every row a collection holds, not a page of them: a count, a sum or a percentile, grouped
 * by a field or a time bucket. A collection answers it itself, so nothing reads a collection page by page to group it.
 */
export type AggregateQuery = {
  where?: Condition[];                       // the operators a prepared query may use: eq, ne, in, lt, gt
  window?: { field: string; from: string; to: string }; // inclusive dates YYYY-MM-DD, compared with the field's first ten characters
  group?: { field: string } | { field: string; bucket: 'day' | 'week' | 'month' | 'weekday' };
  measures: { name: string; agg: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'p95'; field?: string; where?: Condition[] }[]; // `field` may be a dotted path; a count's `where` counts the rows that meet it
  top?: number;                              // groups returned: largest first by the first measure, or for a bucket the latest `top` buckets in date order (weekday: Monday to Sunday), the earlier ones in `others`; 8 when not given, at most 50
};
export type AggregateValues = { rows: number; values: Record<string, number | null> };
export type AggregateResult = {
  total: AggregateValues;                    // over every row the conditions keep
  groups: (AggregateValues & { key: string | null })[]; // null is the group of the rows with no value in the field
  others: (AggregateValues & { groups: number }) | null; // the groups past `top`, their measures over their own rows
};

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
  /** The View as group: the persona in view, the five personas in order, and the action that signs the demo in as one. A session with nobody to view as leaves it out, and the menu has no such group. */
  viewAs?: {
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
   * table. They live on the record, so a page reads them and a prepared query may filter on them, and they are never in
   * `fields` — a change cannot set one, because `patchOf` builds its shape from `fields` alone.
   */
  derived?: (keyof T & string)[];
  key: K;
  title: (row: T) => string;
  query: (q: Query) => Promise<{ rows: T[]; total: number }>;
  /**
   * The answer to an aggregate query over every row the collection holds. A collection that holds its rows answers
   * through `aggregateRows`; one over a database answers as one grouped query, never by reading every page.
   */
  aggregate: (q: AggregateQuery) => Promise<AggregateResult>;
  /** Present on a collection already bound to an authorized scope: calls `listener` after each committed write. */
  subscribe?: (listener: (event: LiveEvent) => void) => () => void;
  /**
   * `<boot>:<n>`: `<boot>` names this process (it holds no `:`) and `<n>` grows on every committed write. A live page
   * compares the revision it was served with the one the stream sees, so a write in between is never lost. An adapter
   * without it is resynced on every open.
   */
  revision?: () => string;
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
 * `next` is the next id's number: it only grows, so a removed record's id is never given to a new one. `rev` counts
 * the writes the collection has emitted.
 */
type Store = { rows: Record<string, unknown>[]; next: number; rev: number };
/**
 * This process's id in a revision; a new process gets a new one, so a revision from another boot never matches. On
 * globalThis like the stores: a page and a route handler are separate bundles with their own copy of this module, and
 * an id of the module's own differed between them, so no first open ever matched what its page was served.
 */
const BOOT = ((globalThis as Record<symbol, unknown>)[Symbol.for('zz-meridian.boot')] ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`) as string;
const STORES = Symbol.for('zz-meridian.collections');
const stores = () => ((globalThis as Record<symbol, unknown>)[STORES] ??= new Map<string, Store>()) as Map<string, Store>;
const storeKey = (tenantId: string, name: string) => JSON.stringify([tenantId, name]);

/** The listeners of each tenant's collection, on globalThis for the same reason as the stores. */
const LIVE = Symbol.for('zz-meridian.live');
const listeners = () => ((globalThis as Record<symbol, unknown>)[LIVE] ??= new Map<string, Set<(e: LiveEvent) => void>>()) as Map<string, Set<(e: LiveEvent) => void>>;

/** How many listeners a tenant's collection has: for tests and diagnostics. */
export const liveListeners = (tenantId: string, name: string): number => listeners().get(storeKey(tenantId, name))?.size ?? 0;


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

/**
 * A field with no value (null, or not there) matches `ne` of any value but null, and is named by `eq null` or an `in`
 * list holding null; `gt`/`lt` need the field and the value to be the same kind.
 */
function matches(row: Record<string, unknown>, { field, op, value }: Condition): boolean {
  const v = row[field];
  if (v === null || v === undefined) return op === 'ne' ? value !== null : op === 'eq' ? value === null : op === 'in' && Array.isArray(value) && value.includes(null);
  switch (op) {
    case 'eq': return v === value;
    case 'ne': return v !== value;
    case 'gt': return typeof v === typeof value && compare(v, value) > 0;
    case 'lt': return typeof v === typeof value && compare(v, value) < 0;
    case 'contains': return String(v).toLowerCase().includes(String(value).toLowerCase());
    case 'in': return Array.isArray(value) && value.includes(v as Scalar);
  }
}

/**
 * A list of rows filtered, ordered and paged as a `Query` means: every condition must hold, rows with no value in the
 * sorted field come last whichever way it runs, ties fall back to the key, and `total` counts before the page is cut.
 * A collection over a real store that answers with a list calls this, so its `query` means what the sample's does. The
 * rows returned are the ones passed in, not copies.
 */
export function queryRows<T extends Record<string, unknown>>(rows: T[], key: keyof T & string, { where = [], sort, limit, offset = 0 }: Query): { rows: T[]; total: number } {
  const hits = rows.filter((r) => where.every((w) => matches(r, w)));
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
  return { rows: limit === undefined ? hits.slice(offset) : hits.slice(offset, offset + limit), total: hits.length };
}

const AGGS = ['count', 'sum', 'avg', 'min', 'max', 'p95'];
const BUCKETS = ['day', 'week', 'month', 'weekday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_TOP = 8;
const MAX_TOP = 50;

/**
 * An aggregate query with its `top` applied (8 when not given, at most 50) and every name checked as `normalizeQuery`
 * checks a query's: only the collection's `fields`, its key and its `derived` fields may be named (for a dotted path,
 * its first part), and only the six operators, the six measures and the four buckets; anything else throws an Error
 * naming it.
 */
export function normalizeAggregate(c: AnyCollection, q: AggregateQuery): AggregateQuery & { top: number } {
  const allowed = new Set<string>([c.key, ...Object.keys(c.fields.shape), ...((c.derived ?? []) as string[])]);
  const field = (f: string) => {
    if (!allowed.has(f.split('.')[0])) throw new Error(`${c.name} has no field ${JSON.stringify(f)}`);
    return f;
  };
  // A condition names a field of the row itself, as a query's does: `matches` reads no path.
  const where = (ws: Condition[]) => ws.map((w) => {
    if (!OPS.includes(w.op)) throw new Error(`Unsupported operator ${JSON.stringify(w.op)}`);
    if (!allowed.has(w.field)) throw new Error(`${c.name} has no field ${JSON.stringify(w.field)}`);
    return { field: w.field, op: w.op, value: w.value };
  });
  const top = q.top ?? DEFAULT_TOP;
  if (!Number.isInteger(top) || top < 1) throw new Error('top must be a whole number of at least 1');
  const out: AggregateQuery & { top: number } = {
    measures: q.measures.map((m) => {
      if (!AGGS.includes(m.agg)) throw new Error(`Unsupported measure ${JSON.stringify(m.agg)}`);
      return { name: m.name, agg: m.agg, ...(m.field === undefined ? {} : { field: field(m.field) }), ...(m.where ? { where: where(m.where) } : {}) };
    }),
    top: Math.min(top, MAX_TOP),
  };
  if (q.where) out.where = where(q.where);
  if (q.window) out.window = { field: field(q.window.field), from: q.window.from, to: q.window.to };
  if (q.group) {
    if ('bucket' in q.group && !BUCKETS.includes(q.group.bucket)) throw new Error(`Unsupported bucket ${JSON.stringify(q.group.bucket)}`);
    out.group = 'bucket' in q.group ? { field: field(q.group.field), bucket: q.group.bucket } : { field: field(q.group.field) };
  }
  return out;
}

/** The value at a field or a dotted path into an object field (`revenueByPlan.Enterprise`); undefined where there is none. */
function valueAt(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), row);
}

/** The date a value starts with, as YYYY-MM-DD: its first ten characters, or null when they are not a date. */
function dayOf(v: unknown): string | null {
  const d = typeof v === 'string' ? v.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** A date's bucket key: the day, the week's Monday, `YYYY-MM`, or the weekday's English name. Worked out in UTC, as the data's days are. */
function bucketOf(v: unknown, bucket: string): string | null {
  const d = dayOf(v);
  if (d === null) return null;
  if (bucket === 'day') return d;
  if (bucket === 'month') return d.slice(0, 7);
  const t = Date.parse(`${d}T00:00:00Z`);
  const weekday = (new Date(t).getUTCDay() + 6) % 7;
  if (bucket === 'weekday') return WEEKDAYS[weekday];
  if (bucket === 'week') return new Date(t - weekday * 86_400_000).toISOString().slice(0, 10);
  throw new Error(`Unsupported bucket ${JSON.stringify(bucket)}`);
}

/** One measure over `rows`: a count of those that meet its own conditions, or a figure over the numbers of its field, null when there is none. */
function measure(rows: Record<string, unknown>[], m: AggregateQuery['measures'][number]): number | null {
  const own = m.where?.length ? rows.filter((r) => m.where!.every((w) => matches(r, w))) : rows;
  if (m.agg === 'count') return own.length;
  if (!AGGS.includes(m.agg)) throw new Error(`Unsupported measure ${JSON.stringify(m.agg)}`);
  const xs = m.field === undefined ? [] : own.map((r) => valueAt(r, m.field!)).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!xs.length) return null;
  let sum = 0, min = Infinity, max = -Infinity;
  for (const x of xs) { sum += x; if (x < min) min = x; if (x > max) max = x; }
  switch (m.agg) {
    case 'sum': return sum;
    case 'avg': return sum / xs.length;
    case 'min': return min;
    case 'max': return max;
    // Nearest rank: the value at ceil(0.95 × n) of the values in order.
    case 'p95': return xs.sort((a, b) => a - b)[Math.ceil(0.95 * xs.length) - 1];
  }
}

const valuesOf = (rows: Record<string, unknown>[], measures: AggregateQuery['measures']): AggregateValues => ({
  rows: rows.length,
  values: Object.fromEntries(measures.map((m) => [m.name, measure(rows, m)])),
});

/**
 * An aggregate query answered over a list of rows, as `queryRows` answers a query: every condition and the window must
 * hold; a group's key is `String` of its field, null for the rows with no value in it, or its bucket's key (a row whose
 * field is no date is in no bucket), and only a group a row falls in appears. Groups by a
 * field come largest first by the first measure (ties by key), buckets the latest `top` in date order, Monday to Sunday
 * for a weekday; the rest are `others`, their measures over their own rows. A collection that holds its rows answers
 * `aggregate` with this; it checks no names, which `normalizeAggregate` does.
 */
export function aggregateRows<T extends Record<string, unknown>>(rows: T[], q: AggregateQuery): AggregateResult {
  const { where = [], window, group, measures } = q;
  const top = Math.min(q.top ?? DEFAULT_TOP, MAX_TOP);
  const kept = rows.filter((r) => {
    if (!where.every((w) => matches(r, w))) return false;
    if (!window) return true;
    const d = dayOf(valueAt(r, window.field));
    return d !== null && d >= window.from && d <= window.to;
  });
  const total = valuesOf(kept, measures);
  if (!group) return { total, groups: [], others: null };

  const bucket = 'bucket' in group ? group.bucket : undefined;
  // undefined is no group: a bucket of a field that holds no date. A field with no value is the group keyed null, never
  // "null", which a field may really hold.
  const keyOf = (r: T): string | null | undefined => {
    const v = valueAt(r, group.field);
    if (bucket) return bucketOf(v, bucket) ?? undefined;
    return v === null || v === undefined ? null : String(v);
  };
  const keyed = kept.map((r) => [keyOf(r), r] as const);
  const members = new Map<string | null, T[]>();
  for (const [key, r] of keyed) {
    if (key === undefined) continue;
    const list = members.get(key);
    if (list) list.push(r);
    else members.set(key, [r]);
  }
  const all = [...members].map(([key, rs]) => ({ key, ...valuesOf(rs, measures) }));

  let shown: typeof all, past: typeof all;
  if (bucket) {
    all.sort(bucket === 'weekday' ? (a, b) => WEEKDAYS.indexOf(a.key!) - WEEKDAYS.indexOf(b.key!) : (a, b) => compare(a.key, b.key));
    const cut = Math.max(0, all.length - top);
    [past, shown] = [all.slice(0, cut), all.slice(cut)];
  } else {
    const first = measures[0]?.name;
    const size = (g: (typeof all)[number]) => (first === undefined ? g.rows : g.values[first]);
    all.sort((a, b) => {
      const x = size(a), y = size(b);
      if (x !== y) return x === null ? 1 : y === null ? -1 : y - x;
      return compare(a.key, b.key);
    });
    [shown, past] = [all.slice(0, top), all.slice(top)];
  }
  if (!past.length) return { total, groups: shown, others: null };
  const pastKeys = new Set(past.map((g) => g.key));
  const theirs = keyed.filter(([key]) => key !== undefined && pastKeys.has(key)).map(([, r]) => r);
  return { total, groups: shown, others: { groups: past.length, ...valuesOf(theirs, measures) } };
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
    stores().set(sk, { rows: structuredClone(def.rows), next: top + 1, rev: 0 });
  }
  const store = () => stores().get(sk)!;
  const emit = () => {
    store().rev++;
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
    async query(q) {
      const { rows: hits, total } = queryRows(rows(), key, q);
      return { rows: copy(hits), total };
    },
    async aggregate(q) {
      return aggregateRows(rows(), normalizeAggregate(c, q));
    },
    revision: () => `${BOOT}:${store().rev}`,
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
 * It says nothing about reading: a page's prepared query may still filter, group or drill on a role or an add-on the
 * same as on any other visible field. Reading a field and changing it are different rules, and this is the second.
 */
export function writableFields(c: AnyCollection): z.ZodObject {
  const base = visibleFields(c);
  const pageOnly = (c.pageOnlyFields ?? []) as string[];
  return pageOnly.length ? base.omit(Object.fromEntries(pageOnly.map((f) => [f, true])) as Record<string, true>).strict() : base;
}
