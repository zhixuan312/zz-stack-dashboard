/**
 * The assistant's reads of a collection: `read()` for rows and `aggregate()` for a figure over every row, each asking
 * the caller's grant first and throwing before anything is read when they may not. The release's assistant route hands
 * both to the prepared query's runner.
 *
 * DELIBERATE: nothing here is cached, where Meridian's own module caches each read per scope with `'use cache'`. Every
 * read of this console is a gateway read made with the caller's own cookie (`src/data/gateway.ts`), and spec version 8
 * lets no read made with one caller's credential be kept for another, so each call is its own read.
 */
import { createHash } from 'node:crypto';
import { normalizeAggregate, normalizeQuery, type AggregateQuery, type AggregateResult, type Query } from '@/lib/collection';
import { AccessDenied, can, collectionFor, resolveAccess } from '@/data/access';
import { clock } from '@/data/collections';

/** `collection:` and the SHA-256 of the tenant and the name: bounded, deterministic and free of any raw identifier. */
export const collectionTag = (tenantId: string, name: string): string =>
  `collection:${createHash('sha256').update(JSON.stringify([tenantId, name])).digest('hex')}`;

/**
 * The rows of a collection the caller may read, with the time the read ran. Its names are checked as the release
 * checks them, and the order asked is handed on as it was asked: a prepared collection's rows come in the route's own
 * order, which `normalizeQuery`'s default by the key would contradict.
 */
export async function read(name: string, q: Query = {}): Promise<{ rows: Record<string, unknown>[]; total: number; observedAt: string }> {
  const scope = await resolveAccess();
  if (!(await can(scope, name, 'read'))) throw new AccessDenied();
  const c = collectionFor(scope, name);
  const { rows, total } = await c.query({ ...normalizeQuery(c, q), sort: q.sort });
  return { rows, total, observedAt: clock().toISOString() };
}

/** An aggregate query over every row of a collection the caller may read, answered by the collection itself. */
export async function aggregate(name: string, q: AggregateQuery): Promise<AggregateResult & { observedAt: string }> {
  const scope = await resolveAccess();
  if (!(await can(scope, name, 'read'))) throw new AccessDenied();
  const c = collectionFor(scope, name);
  return { ...(await c.aggregate(normalizeAggregate(c, q))), observedAt: clock().toISOString() };
}
