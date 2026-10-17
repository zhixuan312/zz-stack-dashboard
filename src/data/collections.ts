/**
 * The records the assistant reads: one prepared collection per row of `src/data/prepared.ts`, each answering ZZ
 * Meridian's `aggregate` and drill through the gateway's prepared query as the person asking
 * (`src/data/prepared-aggregate.ts`). No collection loads a list for the agent, and none takes a change from it: every
 * change this console makes is made on a page, by the person.
 */
import { PREPARED } from '@/data/prepared';
import { preparedCollection } from '@/data/prepared-aggregate';
import type { AnyCollection } from '@/lib/collection';

/** The data's clock. The console reads a live deployment, so it is the wall clock. */
export const clock = (): Date => new Date();

export const collections: AnyCollection[] = PREPARED.map(preparedCollection);
