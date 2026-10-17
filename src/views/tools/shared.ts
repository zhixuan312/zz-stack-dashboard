/**
 * What every view tool module shares: the inputs a tool's address is made of, and how a read says when it was made and
 * for whom.
 *
 * A tool's input is its page's address: the same names as the query string, and for a record the segments of its path.
 * Each segment is held to the characters a slug or a file name has, because it is placed in a gateway path.
 */
import { z } from 'zod';
import { may } from '@/data/access';
import { FLEET } from '@/data/features';
import { PERIODS } from '@/lib/period';
import type { Arrival, ViewMode } from '../context';

/** The page People asks for, every row on one: the gateway answers 10 unless asked. */
export const EVERY_ROW = 'limit=100';

export const period = z.enum(PERIODS).optional().describe('The reporting period; all time when not given.');
export const search = z.string().max(100).optional();
/** One segment of a path: a team, an initiative, a plugin, a skill. */
export const segment = (what: string) => z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).max(200).describe(what);
/** A path inside an initiative or a shelf: file-name segments joined by "/", never "." or "..". */
export const file = (what: string) => z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/).max(400).describe(what);

/** A read made now: the data's clock is the moment the gateway answered. */
export const justRead = (): Arrival => { const now = new Date(); return { updatedAt: now, now }; };
/** Whose rows the gateway returned: every team's to a superadmin, the caller's own team's otherwise. */
export const modeOf = async (): Promise<ViewMode> => ((await may(FLEET)) ? 'platform' : 'team');
