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

/** An ATX heading, which is where these documents state their own title. */
const HEADING = /^#{1,6}\s+(.*)$/;

/**
 * The body, with its own title dropped when the masthead is already showing it.
 *
 * These documents open with `# <their title>`, and the page's masthead is that same line: the reader saw
 * "Spec: relevance that explains itself" at 55px, and then the identical sentence again 200px below it as the first
 * line of the text. One of the two is the title; the masthead is. Only the FIRST heading is dropped, and only when its
 * text is that title — a document whose first heading is a section is left alone.
 */
function withoutTitle(lines: string[], title: string | null | undefined): string[] {
  if (!title) return lines;
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) return lines;
  const heading = HEADING.exec(lines[first].trim());
  if (!heading) return lines;
  return heading[1].trim().toLowerCase() === title.trim().toLowerCase() ? lines.slice(first + 1) : lines;
}

export function readableDocument(body: string, title?: string | null): string {
  const lines = withoutTitle(body.replace(/\r\n/g, '\n').split('\n'), title);
  const out: string[] = [];
  for (const line of lines) {
    // A labelled item that follows a non-blank line needs the blank line
    // markdown requires to see it as its own paragraph.
    if (ITEM.test(line) && out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(line);
  }
  return out.join('\n');
}
