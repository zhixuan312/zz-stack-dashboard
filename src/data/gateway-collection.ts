/**
 * A collection whose rows are one gateway read: the `Collection` contract (`src/lib/collection.ts`) for a real store,
 * as Meridian's assistant guide asks of a product whose data is not an in-memory array.
 *
 * Read-only for an agent. A collection built here is given a `query_<name>` tool and no tool that changes anything:
 * every change in this console is made on a page, by the person. An operation a page performs is declared with
 * `onPage`, which is Meridian's `pageOnly`: no tool is built for it, so it is never run from here, and the assistant
 * can say where the thing is done rather than that nobody can do it.
 *
 * **The conditions, the sort and the page are Meridian's own, not a copy of them.** The gateway answers a list whole
 * and already scoped to the caller, so `query` reads it and hands the rows to the release's `queryRows`, which is
 * where a field with no value matching only `ne`, `gt` and `lt` comparing like with like, `contains` ignoring case
 * and rows with no value sorting last are decided. One implementation, the release's.
 *
 * Nothing is kept between two questions: each query is one gateway read, as the person asking, and its rows go no
 * further than its answer.
 *
 * A list the gateway filters and pages itself is `routeCollection`'s instead: a query's conditions become the route's
 * own parameters and its page the route's page, and the total is the route's, so the agent never counts one page as if
 * it were the whole list. A condition or an order the route does not take is refused, naming the ones it does.
 */
import type { z } from 'zod';
import { queryRows, type Collection, type Query } from '@/lib/collection';

type Row = Record<string, unknown>;

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
  const collection: Collection<T, K> = {
    ...rest,
    query: async (q) => queryRows(await load(), rest.key, q),
  };
  if (onPage) {
    // Declared, never run: `pageOnly` keeps every one of these out of the assistant's tools.
    const refuse = async (): Promise<never> => { throw new Error(`That is done on ${onPage.where}, by the person.`); };
    for (const op of onPage.ops) collection[op] = refuse;
    collection.pageOnly = onPage.ops;
  }
  return collection;
}

/** The page an agent's query reads when it names none, and the most a route answers. */
const ROUTE_LIMIT = 10;
const ROUTE_MAX = 100;

/** A collection whose conditions, page and total are one gateway route's, which filters and pages the list itself. */
export function routeCollection<T extends Row, K extends keyof T & string>(def: {
  name: string;
  label: string;
  description: string;
  key: K;
  title: (row: T) => string;
  fields: z.ZodObject;
  /** Each condition the route takes: the field, its one operator, and the parameter it becomes. */
  conditions: Record<string, { op: 'eq' | 'contains'; param: string }>;
  /** One page of the route for these parameters, as the person asking: its rows made flat, and the route's total. */
  read: (params: Record<string, string>, page: { limit: number; offset: number }) => Promise<{ rows: T[]; total: number }>;
}): Collection<T, K> {
  const { conditions, read, ...rest } = def;
  const takes = Object.entries(conditions).map(([field, c]) => `${field} ${c.op}`).join(', ');
  return {
    ...rest,
    query: async ({ where = [], sort, limit = ROUTE_LIMIT, offset = 0 }: Query) => {
      if (sort) throw new Error(`${def.label} are ordered by the gateway, not by a query: ask without a sort.`);
      const params: Record<string, string> = {};
      for (const w of where) {
        const c = conditions[w.field];
        // A text or a yes-or-no, as the route's own parameter spells it: `refused eq true` is `?refused=true`.
        if (!c || c.op !== w.op || (typeof w.value !== 'string' && typeof w.value !== 'boolean') || c.param in params) {
          throw new Error(`${def.label} are filtered by the gateway, which takes ${takes}, each once with one text or true or false; ${w.field} ${w.op} is not one of them.`);
        }
        params[c.param] = String(w.value);
      }
      return read(params, { limit: Math.min(Math.max(1, limit), ROUTE_MAX), offset: Math.max(0, offset) });
    },
  };
}
