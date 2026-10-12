/**
 * The tag a committed change would drop its cached reads by, which the assistant's route names.
 *
 * DELIBERATE: no `read()` here, where Meridian's own module has one. That function caches a collection per scope and
 * reads it with the server's own database credential, for pages that render on the server. This console's pages read
 * in the browser and keep their cache there (`src/lib/api.ts`); the server reads only for the assistant, as the person
 * asking, and the gateway has to see their credential on each request to decide what they may read, so there is
 * nothing a cached function could hold. Nothing is ever tagged with `collectionTag` either: no collection takes a
 * change from an agent (`src/data/collections.ts`).
 */
import { createHash } from 'node:crypto';

/** `collection:` and the SHA-256 of the tenant and the name: bounded, deterministic and free of any raw identifier. */
export const collectionTag = (tenantId: string, name: string): string =>
  `collection:${createHash('sha256').update(JSON.stringify([tenantId, name])).digest('hex')}`;
