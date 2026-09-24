/**
 * Prepare a stored document for rendering.
 *
 * Acceptance criteria are stored one per line with no blank line between them:
 *
 *     **AC-1.1** `[me]` — Booking a walk that has capacity is confirmed…
 *     **AC-1.2** `[me]` — Once a walk has reached twenty confirmed bookings…
 *
 * In markdown that is one paragraph, so a renderer joins a dozen criteria into a wall of
 * text. The blank line the format needs is added here rather than in every stored document.
 *
 * DELIBERATE: targeted, not a blanket "honour every newline". Prose in these documents is
 * hard-wrapped at about ninety characters, so forcing a break at every newline would render
 * every paragraph ragged. Only a line that opens a new labelled item gets separated.
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
