/**
 * Text in the order a reader expects: case and accents aside, and the numbers inside it by value ("v2" before "v10").
 * One locale on the server and in the browser, so a sorted table hydrates as it was drawn.
 */
const TEXT = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true });

/**
 * Two cell values in ascending order: text by the collator, anything else by value. The one order a table sorts by and
 * a context lists the same rows in, so what the assistant reads is what the person sees.
 */
export const compareValues = (x: unknown, y: unknown): number => (typeof x === 'string' && typeof y === 'string' ? TEXT.compare(x, y) : x === y ? 0 : (x as number) > (y as number) ? 1 : -1);
