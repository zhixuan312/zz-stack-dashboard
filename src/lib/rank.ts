/** What a typed query is matched against: a label, and optionally the words around it. */
type Rankable = {
  label: string;
  /** A line under the label that helps choose; also searched. */
  description?: string;
  /** Extra words a search matches, never shown: a person's email, a ticket's number. */
  keywords?: string;
  /** The palette's own second line (a page's parent, a command's group); also searched. */
  hint?: string;
};

/**
 * The items a query matches, ranked the way every type-to-find list in Meridian ranks them: by where the query starts
 * in the label — a label that begins with it first — then by the order given. A query that matches no label but appears
 * in a hint, a description or keywords still finds its item, and those rank after every label match, in their own order.
 */
export function rank<T extends Rankable>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const at = (item: T) => item.label.toLowerCase().indexOf(q);
  const elsewhere = (item: T) => [item.hint, item.description, item.keywords].some((text) => text?.toLowerCase().includes(q));
  return items
    .map((item, order) => ({ item, order, start: at(item), found: at(item) >= 0 || elsewhere(item) }))
    .filter((x) => x.found)
    .sort((a, b) => (a.start < 0 ? 99 : a.start) - (b.start < 0 ? 99 : b.start) || a.order - b.order)
    .map((x) => x.item);
}
