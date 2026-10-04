/**
 * The fake gateway's clock: every timestamp is an offset from the moment the server started, so a
 * page reads "3 hours ago" whatever day verify runs on. Fixed for the life of the process, so two
 * requests for the same record always agree.
 */
const START = Date.now();

/** An instant `hours` before the server started, as the gateway spells one (ISO 8601, UTC). */
export const ago = (hours: number) => new Date(START - hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** A calendar date `days` before the server started (`YYYY-MM-DD`). */
export const day = (days: number) => ago(days * 24).slice(0, 10);

/** Milliseconds since the epoch at the server's start, for bucketed series. */
export const now = () => START;
