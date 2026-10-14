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
 */
import type { z } from 'zod';
import { queryRows, type Collection } from '@/lib/collection';

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
