/**
 * Prepare a stored document for rendering.
 *
 * ONE PROBLEM, AND IT IS THE STORE'S OWN SHAPE. Acceptance criteria are written
 * one per line with no blank line between them:
 *
 *     **AC-1.1** `[me]` — Booking a walk that has capacity is confirmed…
 *     **AC-1.2** `[me]` — Once a walk has reached twenty confirmed bookings…
 *
 * In markdown that is ONE paragraph, so the renderer correctly joined a dozen
 * criteria into a wall of text where each one ran into the next mid-sentence.
 * The document is not wrong — every writer of these files reads them as lines —
 * and the renderer is not wrong either. What is missing is the blank line the
 * format needs, which is added here rather than in three hundred files.
 *
 * TARGETED, not a blanket "honour every newline". Prose in these documents is
 * hard-wrapped at about ninety characters, and forcing a break at every newline
 * would render every paragraph ragged. Only a line that OPENS a new labelled
 * item gets separated, which is exactly the case that reads wrong.
 */
const ITEM = /^\*\*(AC|Task|Gap|Goal|Decision|Risk|Check)[-\s0-9.]*\*\*/;

export function readableDocument(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    // A labelled item that follows a non-blank line needs the blank line
    // markdown requires to see it as its own paragraph.
    if (ITEM.test(line) && out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(line);
  }
  return out.join('\n');
}
