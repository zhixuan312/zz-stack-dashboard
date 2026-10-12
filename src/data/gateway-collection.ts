/**
 * A collection whose rows are one gateway read: the `Collection` contract (`src/lib/collection.ts`) written for a real
 * store, as Meridian's assistant guide asks of a product whose data is not an in-memory array.
 *
 * Read-only for an agent. A collection built here is given a `query_<name>` tool and no tool that changes anything:
 * every change in this console is made on a page, by the person. An operation a page performs is declared with
 * `onPage`, which is Meridian's `pageOnly`: no tool is built for it, so it is never run from here, and the assistant
 * can say where the thing is done rather than that nobody can do it.
 *
 * The gateway answers a list whole and already scoped to the caller, so `query` reads it and then applies the
 * conditions, the sort and the page here, with the same meaning `arrayCollection` gives them: a field with no value
 * matches only `ne`, `gt` and `lt` compare like with like, `contains` ignores case, and rows with no value sort last.
 */
import type { z } from 'zod';
import type { Collection, Query } from '@/lib/collection';

type Row = Record<string, unknown>;
type Condition = NonNullable<Query['where']>[number];

/** Code-point order for strings, numeric order for numbers. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matches(row: Row, { field, op, value }: Condition): boolean {
  const v = row[field];
  if (v === null || v === undefined) return op === 'ne';
  switch (op) {
    case 'eq': return v === value;
    case 'ne': return v !== value;
    case 'gt': return typeof v === typeof value && compare(v, value) > 0;
    case 'lt': return typeof v === typeof value && compare(v, value) < 0;
    case 'contains': return String(v).toLowerCase().includes(String(value).toLowerCase());
    case 'in': return Array.isArray(value) && value.includes(v as string | number | boolean | null);
  }
}

/** `rows` narrowed, ordered and paged as `q` asks; `total` counts what matched before the page was cut. */
function applyQuery<T extends Row>(rows: T[], key: string, { where = [], sort, limit, offset = 0 }: Query): { rows: T[]; total: number } {
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

export function gatewayCollection<T extends Row, K extends keyof T & string>(def: {
  name: string;
  label: string;
  /** What the model reads to choose this list: what a row is, whose rows these are, and what each unit means. */
  description: string;
  key: K;
  title: (row: T) => string;
  /** The record without its key: every field a query may name. */
  fields: z.ZodObject;
  /** The gateway read, as the person asking: every row they may read. */
  load: () => Promise<T[]>;
  /** What a page does to these records, and which page. */
  onPage?: { ops: ('create' | 'update' | 'remove')[]; where: string };
}): Collection<T, K> {
  const { load, onPage, ...rest } = def;
  const collection: Collection<T, K> = { ...rest, query: async (q) => applyQuery(await load(), def.key, q) };
  if (onPage) {
    // Declared, never run: `pageOnly` keeps every one of these out of the assistant's tools.
    const refuse = async (): Promise<never> => { throw new Error(`That is done on ${onPage.where}, by the person.`); };
    for (const op of onPage.ops) collection[op] = refuse;
    collection.pageOnly = onPage.ops;
  }
  return collection;
}
